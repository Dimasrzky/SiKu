import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEMO_SEKOLAH_ID = process.env.DEMO_SEKOLAH_ID!

/** Tabel yang belum tentu ada di semua skema — ketiadaannya bukan kegagalan. */
const tabelTidakAda = (e: { code?: string; message?: string }) =>
  e.code === 'PGRST205' || e.code === '42P01'
  || (e.message ?? '').includes('Could not find the table')

/** Kumpulan kegagalan nyata, supaya reset tidak pernah lagi mengaku berhasil diam-diam. */
type Gagal = { tabel: string; pesan: string }

async function hapus(
  gagal: Gagal[],
  tabel: string,
  bangun: (q: ReturnType<typeof supabaseAdmin.from>) => PromiseLike<{ error: { code?: string; message?: string } | null }>,
) {
  const { error } = await bangun(supabaseAdmin.from(tabel))
  if (error && !tabelTidakAda(error)) gagal.push({ tabel, pesan: error.message ?? 'gagal' })
}

/** Ambil id baris milik sekolah demo untuk menghapus tabel anak yang tanpa sekolah_id. */
async function idMilikDemo(tabel: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from(tabel).select('id').eq('sekolah_id', DEMO_SEKOLAH_ID).limit(10000)
  return ((data ?? []) as { id: string }[]).map(r => r.id)
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })

  // Guard 1: harus super_admin
  const { data: roleCheck } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (roleCheck?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Akses tidak sah.' }, { status: 403 })
  }

  // Guard 2: sekolah harus jenis = 'demo'
  const { data: sekolahCheck } = await supabaseAdmin
    .from('sekolah').select('id, jenis').eq('id', DEMO_SEKOLAH_ID).eq('jenis', 'demo').single()
  if (!sekolahCheck || sekolahCheck.id !== DEMO_SEKOLAH_ID) {
    return NextResponse.json({ error: 'Sekolah demo tidak valid.' }, { status: 403 })
  }

  const gagal: Gagal[] = []

  // Id induk dikumpulkan lebih dulu — sesudah induknya terhapus, anaknya tak terlacak
  const [tagihanIds, paketIds, beasiswaIds, komponenIds] = await Promise.all([
    idMilikDemo('tagihan'),
    idMilikDemo('paket'),
    idMilikDemo('beasiswa'),
    idMilikDemo('komponen_tagihan'),
  ])

  // ── Urutan anak → induk. Salah urutan membuat foreign key menolak penghapusan,
  //    dan versi lama membiarkan penolakan itu lewat tanpa pesan.

  // Semua yang mengacu ke tagihan
  if (tagihanIds.length > 0) {
    await hapus(gagal, 'tagihan_item', q => q.delete().in('tagihan_id', tagihanIds))
  }
  await hapus(gagal, 'verifikasi_pembayaran', q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))
  await hapus(gagal, 'payment_gateway_trx',   q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))
  await hapus(gagal, 'pembayaran',            q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))
  await hapus(gagal, 'tagihan_siswa',         q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))
  await hapus(gagal, 'tagihan',               q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))

  // Paket dan anaknya
  if (paketIds.length > 0) {
    await hapus(gagal, 'paket_kelas',    q => q.delete().in('paket_id', paketIds))
    await hapus(gagal, 'paket_komponen', q => q.delete().in('paket_id', paketIds))
  }
  await hapus(gagal, 'paket', q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))

  // Beasiswa dan anaknya
  if (beasiswaIds.length > 0) {
    await hapus(gagal, 'beasiswa_siswa',   q => q.delete().in('beasiswa_id', beasiswaIds))
    await hapus(gagal, 'beasiswa_komponen', q => q.delete().in('beasiswa_id', beasiswaIds))
  }
  await hapus(gagal, 'beasiswa', q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))

  // Komponen individu harus lepas sebelum komponen induknya dihapus
  await hapus(gagal, 'siswa_komponen_individu', q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))
  if (komponenIds.length > 0) {
    await hapus(gagal, 'komponen_tagihan_item',     q => q.delete().in('komponen_id', komponenIds))
    await hapus(gagal, 'komponen_tagihan_potongan', q => q.delete().in('komponen_id', komponenIds))
  }
  await hapus(gagal, 'komponen_tagihan', q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))

  // Siswa mengacu ke kelas, jadi siswa lebih dulu
  await hapus(gagal, 'siswa',        q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))
  await hapus(gagal, 'kelas',        q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))
  await hapus(gagal, 'rekening',     q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))
  await hapus(gagal, 'tahun_ajaran', q => q.delete().eq('sekolah_id', DEMO_SEKOLAH_ID))

  if (gagal.length > 0) {
    return NextResponse.json({
      error: `Sebagian data gagal dihapus: ${gagal.map(g => `${g.tabel} (${g.pesan})`).join('; ')}`,
    }, { status: 500 })
  }

  // ── Kembalikan ke keadaan awal ────────────────────────────────────────────
  await supabaseAdmin.from('profiles').update({
    nama:    'Tim SiKu',
    jabatan: 'Super Admin',
    sekolah: 'Demo SiKu',
    avatar:  'T',
  }).eq('id', user.id)

  await supabaseAdmin.from('sekolah')
    .update({ nama: 'Demo SiKu', no_wa: '', alamat: null })
    .eq('id', DEMO_SEKOLAH_ID)

  await supabaseAdmin.from('pengaturan').upsert({
    sekolah_id:      DEMO_SEKOLAH_ID,
    jenjang_sekolah: 'SMP/MTs',
    setup_steps: {
      profil_sekolah:   true,
      tahun_ajaran:     false,
      komponen_tagihan: false,
      buat_kelas:       false,
      import_siswa:     false,
    },
  }, { onConflict: 'sekolah_id' })

  return NextResponse.json({ data: { ok: true }, error: null })
}
