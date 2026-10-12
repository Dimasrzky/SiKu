import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-service'
import { bankSah } from '@/lib/bankRekening'
import { catatPercobaan, terlaluBanyakPercobaan } from '@/lib/percobaanLogin'

// Konfirmasi password yang salah, per akun
const BATAS_PERCOBAAN = 5
const JENDELA_MENIT   = 15

interface RekeningBody {
  bank?:      unknown
  no_rek?:    unknown
  atas_nama?: unknown
  password?:  unknown
}

type RekeningTersimpan = { id: string; bank: string; no_rek: string; atas_nama: string }

const gagal = (error: string, status: number) => NextResponse.json({ data: null, error }, { status })

/**
 * Simpan rekening resmi sekolah — yang tampil ke orang tua di halaman bayar. Hanya lewat
 * route ini: browser tidak punya hak menulis tabel rekening. Pengubah wajib memasukkan
 * password akunnya lagi, dan setiap perubahan dicatat trigger ke rekening_log.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return gagal('Unauthorized', 401)

  const db = createServiceClient()
  const { data: { user }, error: authError } = await db.auth.getUser(token)
  if (authError || !user?.email) return gagal('Sesi tidak valid. Silakan masuk kembali.', 401)

  let body: RekeningBody
  try {
    body = await req.json()
  } catch {
    return gagal('Request tidak valid.', 400)
  }

  const bank     = typeof body.bank === 'string' ? body.bank : ''
  const noRek    = typeof body.no_rek === 'string' ? body.no_rek.trim() : ''
  const atasNama = typeof body.atas_nama === 'string' ? body.atas_nama.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!bankSah(bank))                         return gagal('Pilih bank dari daftar.', 400)
  if (!/^\d{5,20}$/.test(noRek))              return gagal('Nomor rekening harus 5–20 digit angka.', 400)
  if (!atasNama || atasNama.length > 100)     return gagal('Nama pemilik rekening wajib diisi, maksimal 100 karakter.', 400)
  if (!password)                              return gagal('Masukkan password akun Anda untuk mengonfirmasi.', 400)

  const { data: profile } = await db.from('profiles').select('sekolah_id, role').eq('id', user.id).maybeSingle()
  const p = profile as { sekolah_id: string | null; role: string } | null
  if (!p?.sekolah_id) return gagal('Profil tidak lengkap.', 400)
  if (p.role !== 'admin' && p.role !== 'super_admin') return gagal('Hanya admin sekolah yang bisa mengubah rekening.', 403)

  const kunci = `rekening:${user.id}`
  const terkunci = await terlaluBanyakPercobaan(db, kunci, BATAS_PERCOBAAN, JENDELA_MENIT)
  if (terkunci === null) return gagal('Gagal memeriksa percobaan. Silakan coba lagi.', 503)
  if (terkunci) return gagal(`Terlalu banyak password salah. Coba lagi dalam ${JENDELA_MENIT} menit.`, 429)

  // Konfirmasi password: masuk ulang lewat klien terpisah yang tidak menyimpan sesi
  const konfirmasi = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { error: pwError } = await konfirmasi.auth.signInWithPassword({ email: user.email, password })
  if (pwError) {
    if (pwError.status === 429) return gagal('Terlalu banyak percobaan masuk. Coba lagi beberapa saat lagi.', 429)
    await catatPercobaan(db, kunci)
    return gagal('Password salah.', 401)
  }
  // Sesi konfirmasi ini langsung dicabut; sesi yang sedang dipakai di browser tetap jalan
  await konfirmasi.auth.signOut({ scope: 'local' })

  // Satu transaksi: simpan rekening + tandai pengubahnya untuk trigger rekening_log
  const { data, error } = await db
    .rpc('simpan_rekening_transfer', {
      p_sekolah_id:  p.sekolah_id,
      p_pengubah_id: user.id,
      p_bank:        bank,
      p_no_rek:      noRek,
      p_atas_nama:   atasNama,
    })
    .single()

  if (error || !data) return gagal('Gagal menyimpan rekening.', 500)
  return NextResponse.json({ data: data as RekeningTersimpan, error: null })
}
