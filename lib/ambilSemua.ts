import type { PostgrestError } from '@supabase/supabase-js'

// Sama dengan batas "Max rows" bawaan Supabase. Ukuran halaman tidak boleh
// melebihi batas proyek: kalau batasnya lebih kecil, range 0–999 hanya berisi
// sebagian baris dan halaman berikutnya melompati sisanya.
const UKURAN_HALAMAN = 1000

/**
 * Ambil seluruh baris sebuah query, per halaman 1000 baris. PostgREST memotong
 * hasil di batas "Max rows" proyek tanpa pesan apa pun, jadi `.limit(5000)`
 * tetap bisa diam-diam hanya berisi 1000 baris — dan laporan menjumlahkan
 * data yang tidak lengkap.
 *
 * `halaman` harus membangun query baru setiap kali dan mengurutkannya dengan
 * kunci yang unik (mis. `.order('id')`); tanpa urutan, baris bisa terlewat atau
 * terulang antarhalaman.
 */
export async function ambilSemua<T>(
  halaman: (dari: number, sampai: number) => PromiseLike<{ data: unknown; error: PostgrestError | null }>,
  batasBaris = 50_000,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const semua: T[] = []
  for (let dari = 0; dari < batasBaris; dari += UKURAN_HALAMAN) {
    const { data, error } = await halaman(dari, dari + UKURAN_HALAMAN - 1)
    if (error) return { data: semua, error }
    // Proyek ini tidak memakai tipe skema Supabase — bentuk baris dijamin oleh
    // string select pemanggil, sama seperti cast `as unknown as T[]` di tempat lain
    const baris = (data ?? []) as T[]
    semua.push(...baris)
    if (baris.length < UKURAN_HALAMAN) break
  }
  return { data: semua, error: null }
}
