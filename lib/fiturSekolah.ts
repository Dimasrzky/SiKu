import type { SupabaseClient } from '@supabase/supabase-js'

// Subfitur yang hanya dibuka untuk sekolah tertentu. Fiturnya dibuat sekali di kode
// (KATALOG_FITUR); tim Equanusa memasangkannya ke sekolah yang mengajukan lewat
// /admin/fitur-sekolah. Pasangan sekolah–fitur disimpan di tabel fitur_sekolah yang
// hanya bisa ditulis service role, jadi bendahara tidak bisa menyalakannya sendiri.
// Mencabut fitur hanya menyembunyikannya: data yang sudah dicatat tetap tersimpan dan
// muncul lagi kalau fiturnya ditambahkan kembali.

export const KATALOG_FITUR = [
  {
    kode:      'pengeluaran',
    nama:      'Pengeluaran',
    /** Menu sidebar tempat subfitur ini muncul */
    menu:      'Laporan',
    deskripsi: 'Catat pengeluaran sekolah per kategori beserta foto nota, dan ringkasan kas dari pemasukan SPP dikurangi pengeluaran.',
  },
] as const

export type KodeFitur = (typeof KATALOG_FITUR)[number]['kode']

export const fiturSah = (nilai: unknown): nilai is KodeFitur => KATALOG_FITUR.some(f => f.kode === nilai)

export const infoFitur = (kode: KodeFitur) => KATALOG_FITUR.find(f => f.kode === kode)!

/**
 * Subfitur sekolah milik akun yang login, lewat RLS (klien browser). Tabel yang belum
 * dibuat atau gagal dibaca dianggap tanpa subfitur, supaya dashboard tetap berjalan.
 */
export async function bacaFiturSaya(db: SupabaseClient): Promise<{ data: KodeFitur[] | null; error: string | null }> {
  const { data, error } = await db.from('fitur_sekolah').select('fitur').limit(50)
  if (error) return { data: null, error: 'Subfitur sekolah gagal dimuat.' }
  return { data: ((data ?? []) as { fitur: unknown }[]).map(b => b.fitur).filter(fiturSah), error: null }
}

/** Sekolah ini sudah diberi subfitur tersebut? Untuk klien sesi server maupun service role. */
export async function sekolahPunyaFitur(
  db: SupabaseClient,
  sekolahId: string,
  fitur: KodeFitur,
): Promise<{ data: boolean | null; error: string | null }> {
  const { data, error } = await db
    .from('fitur_sekolah')
    .select('id')
    .eq('sekolah_id', sekolahId)
    .eq('fitur', fitur)
    .limit(1)
  if (error) return { data: null, error: 'Subfitur sekolah gagal dimuat.' }
  return { data: (data ?? []).length > 0, error: null }
}

// ── Khusus browser ─────────────────────────────────────────────────────────

const KUNCI_LOKAL = 'siku_fitur'

/** Subfitur terakhir yang diketahui — sidebar memakainya selagi data terbaru dimuat */
export function fiturLokal(): KodeFitur[] {
  try {
    const raw = localStorage.getItem(KUNCI_LOKAL)
    const daftar = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(daftar) ? daftar.filter(fiturSah) : []
  } catch { return [] }
}

export function simpanFiturLokal(daftar: KodeFitur[]): void {
  try { localStorage.setItem(KUNCI_LOKAL, JSON.stringify(daftar)) } catch { /* penyimpanan diblokir */ }
}

export function hapusFiturLokal(): void {
  try { localStorage.removeItem(KUNCI_LOKAL) } catch { /* penyimpanan diblokir */ }
}
