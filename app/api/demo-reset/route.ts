import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cekAksesDemo, hapusDataDemo, hapusRekeningDemo } from '@/lib/demoServer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEMO_SEKOLAH_ID = process.env.DEMO_SEKOLAH_ID!

// Data contoh 12 bulan berisi ribuan baris — penghapusan per potongan butuh waktu
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const akses = await cekAksesDemo(supabaseAdmin, token, DEMO_SEKOLAH_ID)
  if (akses.error !== null) return NextResponse.json({ data: null, error: akses.error }, { status: akses.status })

  const gagal = [
    ...await hapusDataDemo(supabaseAdmin, DEMO_SEKOLAH_ID),
    ...await hapusRekeningDemo(supabaseAdmin, DEMO_SEKOLAH_ID),
  ]
  if (gagal.length > 0) {
    return NextResponse.json({
      data:  null,
      error: `Sebagian data gagal dihapus: ${gagal.map(g => `${g.tabel} (${g.pesan})`).join('; ')}`,
    }, { status: 500 })
  }

  // ── Kembalikan ke keadaan awal ────────────────────────────────────────────
  await supabaseAdmin.from('profiles').update({
    nama:    'Tim SiKu',
    jabatan: 'Super Admin',
    sekolah: 'Demo SiKu',
    avatar:  'T',
  }).eq('id', akses.userId)

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
