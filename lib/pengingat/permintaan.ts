import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

// Pembantu route /api/reminders: siapa pemanggilnya, siswa mana yang dimaksud, dan
// alamat aplikasi untuk tautan di pesan. Khusus server.

type Akses =
  | { userId: string; sekolahId: string; error: null }
  | { userId: null; sekolahId: null; error: string; status: number }

/** Akun yang sedang login beserta sekolahnya, dari header `Authorization: Bearer <token>` */
export async function sekolahPemanggil(db: SupabaseClient, authorization: string | null): Promise<Akses> {
  const token = authorization?.replace('Bearer ', '')
  if (!token) return { userId: null, sekolahId: null, error: 'Unauthorized', status: 401 }

  const { data: { user }, error: authError } = await db.auth.getUser(token)
  if (authError || !user) return { userId: null, sekolahId: null, error: 'Token tidak valid', status: 401 }

  const { data: profile } = await db.from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
  const sekolahId = (profile as { sekolah_id?: string | null } | null)?.sekolah_id
  if (!sekolahId) return { userId: null, sekolahId: null, error: 'Profil tidak lengkap', status: 400 }

  return { userId: user.id, sekolahId, error: null }
}

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Daftar id siswa yang unik, huruf kecil. null kalau bukan daftar, ada yang bukan UUID,
 * atau jumlahnya melebihi `maks` — id yang bukan UUID akan membuat query database galat.
 */
export function bacaSiswaIds(nilai: unknown, maks: number): string[] | null {
  if (!Array.isArray(nilai)) return null
  if (!nilai.every((v): v is string => typeof v === 'string' && POLA_UUID.test(v))) return null
  const unik = [...new Set(nilai.map(v => v.toLowerCase()))]
  return unik.length <= maks ? unik : null
}

/**
 * Pemanggil mesin (pg_cron) membawa `Authorization: Bearer <rahasia>`. Rahasia yang belum
 * diisi di server berarti semua pemanggil ditolak, bukan semua diterima.
 */
export function rahasiaCocok(authorization: string | null, rahasia: string | undefined): boolean {
  const benar = rahasia?.trim()
  if (!benar) return false
  const diterima = Buffer.from(authorization ?? '')
  const harapan  = Buffer.from(`Bearer ${benar}`)
  return diterima.length === harapan.length && crypto.timingSafeEqual(diterima, harapan)
}

/** Alamat aplikasi tanpa garis miring di akhir, untuk tautan halaman bayar di dalam pesan */
export const alamatAplikasi = (req: NextRequest): string =>
  (process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin).replace(/\/+$/, '')
