import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Masa trial dihitung dari waktu konfirmasi: sebelum itu sekolah belum bisa memakai aplikasi
const MASA_TRIAL_MS = 30 * 24 * 60 * 60 * 1000

const gagal = (error: string, status: number) => NextResponse.json({ data: null, error }, { status })

/**
 * Tombol Konfirmasi di dasbor admin: kemitraan sekolah yang baru mendaftar dikonfirmasi tim
 * Equanusa, sehingga bendaharanya bisa membuka dashboard. Halaman /kemitraan bendahara
 * memeriksa status ini dan berganti menjadi "Akun Anda Telah Diaktifkan".
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    return gagal('Sesi admin tidak valid. Silakan masuk kembali.', 401)
  }

  const { id } = await params
  if (!POLA_UUID.test(id)) return gagal('Sekolah tidak ditemukan.', 404)

  const db = createServiceClient()
  const { data: sekolah, error: bacaErr } = await db
    .from('sekolah')
    .select('id, jenis, status_kemitraan')
    .eq('id', id)
    .maybeSingle()
  if (bacaErr) return gagal('Data sekolah gagal dimuat.', 500)
  if (!sekolah) return gagal('Sekolah tidak ditemukan.', 404)
  if (sekolah.status_kemitraan !== 'menunggu') return gagal('Kemitraan sekolah ini sudah dikonfirmasi.', 400)

  const sekarang = new Date()
  // Klaim dari 'menunggu': dua klik Konfirmasi yang berbarengan hanya tercatat sekali
  const { data: klaim, error: ubahErr } = await db
    .from('sekolah')
    .update({
      status_kemitraan:          'aktif',
      kemitraan_dikonfirmasi_at: sekarang.toISOString(),
      updated_at:                sekarang.toISOString(),
      ...(sekolah.jenis === 'trial'
        ? { trial_expires_at: new Date(sekarang.getTime() + MASA_TRIAL_MS).toISOString() }
        : {}),
    })
    .eq('id', id)
    .eq('status_kemitraan', 'menunggu')
    .select('id')

  if (ubahErr) return gagal('Gagal mengonfirmasi kemitraan sekolah.', 500)
  if (!klaim || klaim.length === 0) return gagal('Kemitraan sekolah ini sudah dikonfirmasi.', 400)

  return NextResponse.json({ data: { id }, error: null })
}
