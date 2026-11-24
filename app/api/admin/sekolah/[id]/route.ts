import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { hapusAkunSekolah } from '@/lib/hapusDataSekolah'
import { adalahSekolahDemo, samakanNama, type RingkasanHapusSekolah } from '@/lib/akunSekolah'

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Sekolah besar (ribuan tagihan + file bukti) butuh beberapa detik sampai puluhan detik
export const maxDuration = 60

const tolak = (error: string, status: number) => NextResponse.json({ data: null, error }, { status })

type ProfilJoin = { email: string | null; role: string | null }
type SekolahRow = { id: string; nama: string; jenis: string | null; profiles: ProfilJoin[] | ProfilJoin | null }

interface Sasaran {
  db:      SupabaseClient
  id:      string
  nama:    string
  demo:    boolean
  akun:    string[]
}

/** Sesi admin + sekolah yang dituju; dipakai GET (ringkasan) maupun DELETE */
async function bacaSasaran(params: Promise<{ id: string }>): Promise<Sasaran | { tolak: NextResponse }> {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    return { tolak: tolak('Sesi admin tidak valid. Silakan masuk kembali.', 401) }
  }

  const { id } = await params
  if (!POLA_UUID.test(id)) return { tolak: tolak('Sekolah tidak ditemukan.', 404) }

  const db = createServiceClient()
  const { data, error } = await db
    .from('sekolah')
    .select('id, nama, jenis, profiles(email, role)')
    .eq('id', id)
    .maybeSingle()
  if (error) return { tolak: tolak('Data sekolah gagal dimuat.', 500) }
  if (!data) return { tolak: tolak('Sekolah tidak ditemukan.', 404) }

  const s = data as unknown as SekolahRow
  const profil = Array.isArray(s.profiles) ? s.profiles : s.profiles ? [s.profiles] : []
  return {
    db,
    id:   s.id,
    nama: s.nama,
    demo: adalahSekolahDemo(s, profil.map(p => p.role), process.env.DEMO_SEKOLAH_ID?.trim()),
    akun: profil.map(p => p.email).filter((e): e is string => !!e),
  }
}

/** Isi popup Hapus di dasbor admin: jumlah data yang ikut terhapus */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await bacaSasaran(params)
  if ('tolak' in s) return s.tolak
  if (s.demo) return tolak('Akun demo tidak bisa dihapus.', 403)

  const hitung = async (tabel: string): Promise<number | null> => {
    const { count, error } = await s.db.from(tabel).select('id', { count: 'exact', head: true }).eq('sekolah_id', s.id)
    return error ? null : count ?? 0
  }
  const [siswa, tagihan, pembayaran, pengeluaran, buktiTransfer] = await Promise.all([
    hitung('siswa'), hitung('tagihan'), hitung('pembayaran'), hitung('pengeluaran'), hitung('verifikasi_pembayaran'),
  ])

  const data: RingkasanHapusSekolah = {
    nama:   s.nama,
    akun:   s.akun,
    jumlah: { siswa, tagihan, pembayaran, pengeluaran, buktiTransfer },
  }
  return NextResponse.json({ data, error: null })
}

/**
 * Hapus permanen akun sekolah: semua data, file, akun login bendahara, lalu sekolahnya.
 * Wajib menyertakan nama sekolah yang diketik admin di popup; sekolah demo selalu ditolak.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await bacaSasaran(params)
  if ('tolak' in s) return s.tolak
  if (s.demo) return tolak('Akun demo tidak bisa dihapus.', 403)

  let body: { konfirmasiNama?: unknown }
  try {
    body = await req.json()
  } catch {
    return tolak('Request tidak valid.', 400)
  }
  if (typeof body.konfirmasiNama !== 'string' || samakanNama(body.konfirmasiNama) !== samakanNama(s.nama)) {
    return tolak('Nama sekolah yang diketik tidak cocok.', 400)
  }

  const gagal = await hapusAkunSekolah(s.db, s.id)
  if (gagal.length > 0) {
    console.error('[admin] hapus sekolah belum tuntas', s.id, gagal)
    const tabel = [...new Set(gagal.map(g => g.tabel))].join(', ')
    return tolak(`Sebagian data gagal dihapus (${tabel}). Sekolah belum terhapus seluruhnya — tekan Hapus lagi untuk mencoba ulang.`, 500)
  }

  console.info('[admin] sekolah dihapus', s.id, s.nama)
  return NextResponse.json({ data: { id: s.id }, error: null })
}
