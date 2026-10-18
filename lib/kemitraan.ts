import type { SupabaseClient } from '@supabase/supabase-js'

// Konfirmasi kemitraan sekolah oleh tim Equanusa. Sekolah yang baru mendaftar berstatus
// 'menunggu' sampai admin menekan Konfirmasi di /admin/kemitraan; selama itu
// bendahara hanya bisa membuka /kemitraan. Sesudah dikonfirmasi, halaman yang sama
// menampilkan "Akun Anda Telah Diaktifkan" satu kali, sampai bendahara menekan Buka Dashboard.
// Sekolah yang sudah ada sebelum fitur ini berstatus 'aktif' tanpa waktu konfirmasi, jadi
// tidak pernah melihat halaman itu.

export type StatusKemitraan = 'menunggu' | 'aktif'

export const RUTE_KEMITRAAN = '/kemitraan'

export interface KemitraanAkun {
  sekolahId:      string
  status:         StatusKemitraan
  /** Waktu tim Equanusa menekan Konfirmasi; null untuk sekolah lama */
  dikonfirmasiAt: string | null
  /** Waktu bendahara menutup halaman aktivasi lewat Buka Dashboard */
  dilihatAt:      string | null
}

/** Nilai selain 'aktif', termasuk yang tidak dikenal, diperlakukan masih menunggu */
export const bacaStatus = (nilai: unknown): StatusKemitraan => (nilai === 'aktif' ? 'aktif' : 'menunggu')

/**
 * Kemitraan sekolah milik akun yang login, lewat RLS (klien browser atau klien sesi
 * server). data null tanpa error = akun belum punya sekolah, pendaftarannya berhenti di
 * langkah 1.
 */
export async function bacaKemitraan(
  db: SupabaseClient,
  userId: string,
): Promise<{ data: KemitraanAkun | null; error: string | null }> {
  const { data, error } = await db
    .from('profiles')
    .select('sekolah_id, aktivasi_dilihat_at, data_sekolah:sekolah_id(status_kemitraan, kemitraan_dikonfirmasi_at)')
    .eq('id', userId)
    .maybeSingle()
  if (error) return { data: null, error: 'Status kemitraan gagal dimuat.' }

  type Baris = {
    sekolah_id:          string | null
    aktivasi_dilihat_at: string | null
    data_sekolah:        { status_kemitraan: string; kemitraan_dikonfirmasi_at: string | null } | null
  }
  const baris = data as Baris | null
  if (!baris?.sekolah_id) return { data: null, error: null }
  if (!baris.data_sekolah) return { data: null, error: 'Data sekolah tidak ditemukan.' }

  return {
    data: {
      sekolahId:      baris.sekolah_id,
      status:         bacaStatus(baris.data_sekolah.status_kemitraan),
      dikonfirmasiAt: baris.data_sekolah.kemitraan_dikonfirmasi_at,
      dilihatAt:      baris.aktivasi_dilihat_at,
    },
    error: null,
  }
}

/** Untuk route server (service role): sekolah ini sudah dikonfirmasi tim Equanusa? */
export async function sekolahTerkonfirmasi(
  db: SupabaseClient,
  sekolahId: string,
): Promise<{ data: boolean | null; error: string | null }> {
  const { data, error } = await db.from('sekolah').select('status_kemitraan').eq('id', sekolahId).maybeSingle()
  if (error) return { data: null, error: 'Status kemitraan sekolah gagal dimuat.' }
  return { data: bacaStatus((data as { status_kemitraan?: unknown } | null)?.status_kemitraan) === 'aktif', error: null }
}

// ── Khusus browser ─────────────────────────────────────────────────────────

const KUNCI_AKTIVASI = 'siku_aktivasi_dilihat'

/**
 * Halaman aktivasi sudah ditutup di perangkat ini. Penjaga kalau penanda di database gagal
 * tersimpan: tanpa ini Buka Dashboard bisa terus dikembalikan ke /kemitraan.
 */
export function aktivasiDilihatLokal(sekolahId: string): boolean {
  try { return localStorage.getItem(KUNCI_AKTIVASI) === sekolahId } catch { return false }
}

export function tandaiAktivasiDilihatLokal(sekolahId: string): void {
  try { localStorage.setItem(KUNCI_AKTIVASI, sekolahId) } catch { /* penyimpanan diblokir */ }
}

/** Harus membuka /kemitraan dulu: masih menunggu, atau baru dikonfirmasi dan halaman aktivasinya belum dilihat */
export const perluHalamanKemitraan = (k: KemitraanAkun): boolean =>
  k.status === 'menunggu'
  || (k.dikonfirmasiAt !== null && k.dilihatAt === null && !aktivasiDilihatLokal(k.sekolahId))

/** Status terakhir yang tersimpan di siku_auth; undefined kalau belum pernah dicatat */
export function statusLokal(): StatusKemitraan | undefined {
  try {
    const raw = localStorage.getItem('siku_auth')
    const nilai = raw ? (JSON.parse(raw) as { kemitraan?: unknown }).kemitraan : undefined
    return nilai === undefined ? undefined : bacaStatus(nilai)
  } catch { return undefined }
}

/**
 * Catat status terakhir di siku_auth. Layout dashboard membacanya saat render pertama, jadi
 * sekolah yang masih menunggu tidak sempat melihat dashboard sebelum pemeriksaan selesai.
 */
export function simpanStatusLokal(status: StatusKemitraan): void {
  try {
    const raw = localStorage.getItem('siku_auth')
    if (!raw) return
    const lama = JSON.parse(raw) as Record<string, unknown>
    if (lama.kemitraan === status) return
    const newValue = JSON.stringify({ ...lama, kemitraan: status })
    localStorage.setItem('siku_auth', newValue)
    // Event storage tidak terpicu di tab yang sama; layout dashboard mendengarkan event ini
    window.dispatchEvent(new StorageEvent('storage', { key: 'siku_auth', newValue }))
  } catch { /* penyimpanan diblokir */ }
}
