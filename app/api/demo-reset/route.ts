import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEMO_SEKOLAH_ID = process.env.DEMO_SEKOLAH_ID!

// Tabel dengan sekolah_id — urutan hapus dari child ke parent
const DEMO_TABLES = [
  'tagihan_siswa',
  'pembayaran',
  'rekening',
  'tagihan',
  'siswa',
  'kelas',
  'tahun_ajaran',
] as const

// paket_kelas & paket_komponen tidak punya sekolah_id — hapus via paket_id
async function deletePaketDemo() {
  const { data: pakets } = await supabaseAdmin
    .from('paket')
    .select('id')
    .eq('sekolah_id', DEMO_SEKOLAH_ID)

  if (pakets && pakets.length > 0) {
    const ids = pakets.map((p: { id: string }) => p.id)
    await supabaseAdmin.from('paket_kelas').delete().in('paket_id', ids)
    await supabaseAdmin.from('paket_komponen').delete().in('paket_id', ids)
  }
  await supabaseAdmin.from('paket').delete().eq('sekolah_id', DEMO_SEKOLAH_ID)
}

// tagihan_item tidak punya sekolah_id — hapus via tagihan_id
async function deleteTagihanItemDemo() {
  const { data: tagihans } = await supabaseAdmin
    .from('tagihan')
    .select('id')
    .eq('sekolah_id', DEMO_SEKOLAH_ID)

  if (tagihans && tagihans.length > 0) {
    const ids = tagihans.map((t: { id: string }) => t.id)
    await supabaseAdmin.from('tagihan_item').delete().in('tagihan_id', ids)
  }
}

// komponen_tagihan_potongan & komponen_tagihan_item tidak punya sekolah_id
async function deleteKomponenTagihanDemo() {
  const { data: komponens } = await supabaseAdmin
    .from('komponen_tagihan')
    .select('id')
    .eq('sekolah_id', DEMO_SEKOLAH_ID)

  if (komponens && komponens.length > 0) {
    const ids = komponens.map((k: { id: string }) => k.id)
    await supabaseAdmin.from('komponen_tagihan_potongan').delete().in('komponen_id', ids)
    await supabaseAdmin.from('komponen_tagihan_item').delete().in('komponen_id', ids)
  }
  await supabaseAdmin.from('komponen_tagihan').delete().eq('sekolah_id', DEMO_SEKOLAH_ID)
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })

  // Guard 1: harus super_admin
  const { data: roleCheck } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (roleCheck?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Akses tidak sah.' }, { status: 403 })
  }

  // Guard 2: sekolah harus jenis = 'demo'
  const { data: sekolahCheck } = await supabaseAdmin
    .from('sekolah')
    .select('id, jenis')
    .eq('id', DEMO_SEKOLAH_ID)
    .eq('jenis', 'demo')
    .single()

  if (!sekolahCheck || sekolahCheck.id !== DEMO_SEKOLAH_ID) {
    return NextResponse.json({ error: 'Sekolah demo tidak valid.' }, { status: 403 })
  }

  // Hapus child tables yang tidak punya sekolah_id lebih dulu
  await deleteTagihanItemDemo()
  await deletePaketDemo()
  await deleteKomponenTagihanDemo()

  // Hapus tabel dengan sekolah_id
  for (const table of DEMO_TABLES) {
    await supabaseAdmin.from(table).delete().eq('sekolah_id', DEMO_SEKOLAH_ID)
  }

  // Reset profiles ke template default
  await supabaseAdmin.from('profiles').update({
    nama:    'Tim SiKu',
    jabatan: 'Super Admin',
    sekolah: 'Demo SiKu',
    avatar:  'T',
  }).eq('id', user.id)

  // Reset sekolah ke state awal
  await supabaseAdmin.from('sekolah')
    .update({ nama: 'Demo SiKu', no_wa: '', alamat: null })
    .eq('id', DEMO_SEKOLAH_ID)

  // Reset pengaturan + setup_steps agar semua modul kembali ke state awal
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
