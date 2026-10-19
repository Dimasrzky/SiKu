import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const gagal = (error: string, status: number) => NextResponse.json({ data: null, error }, { status })

/**
 * Saklar pengingat WhatsApp otomatis per sekolah (pengaturan.pengingat_wa_aktif), dari halaman
 * Kemitraan Sekolah di dasbor admin. Menyala: cron pagi mengantrekan pengingat sekolah ini
 * sesuai toggle H-7/H-3/H-1 di Pengaturannya, dan tombol Ingatkan memakai antrean (nomor
 * pengirim bersama di wa_sender). Mati: kembali ke tautan wa.me.
 */
async function ubahSaklar(params: Promise<{ sekolahId: string }>, aktif: boolean): Promise<NextResponse> {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    return gagal('Sesi admin tidak valid. Silakan masuk kembali.', 401)
  }

  const { sekolahId } = await params
  if (!POLA_UUID.test(sekolahId)) return gagal('Sekolah tidak ditemukan.', 404)

  const db = createServiceClient()
  const { data: sekolah, error: bacaErr } = await db
    .from('sekolah').select('id, status_kemitraan').eq('id', sekolahId).maybeSingle()
  if (bacaErr) return gagal('Data sekolah gagal dimuat.', 500)
  if (!sekolah) return gagal('Sekolah tidak ditemukan.', 404)
  // Pesan dikirim lewat nomor milik SiKu: hanya untuk sekolah mitra yang sudah dikonfirmasi
  if (aktif && sekolah.status_kemitraan !== 'aktif') return gagal('Kemitraan sekolah ini belum dikonfirmasi.', 400)

  const { data: diubah, error: ubahErr } = await db
    .from('pengaturan')
    .update({ pengingat_wa_aktif: aktif, updated_at: new Date().toISOString() })
    .eq('sekolah_id', sekolahId)
    .select('sekolah_id')
  if (ubahErr) return gagal(aktif ? 'Gagal menyalakan notifikasi.' : 'Gagal mematikan notifikasi.', 500)
  if (!diubah || diubah.length === 0) return gagal('Pengaturan sekolah ini belum dibuat.', 404)

  return NextResponse.json({ data: { sekolahId, aktif }, error: null })
}

/** Nyalakan pengingat WhatsApp otomatis */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ sekolahId: string }> }) {
  return ubahSaklar(params, true)
}

/** Matikan pengingat WhatsApp otomatis — job yang sudah antre tetap dicek ulang worker */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ sekolahId: string }> }) {
  return ubahSaklar(params, false)
}
