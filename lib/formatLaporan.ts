// Format angka dan nama bulan untuk halaman laporan — dipakai bersama oleh level
// Sekolah, Jenjang, dan Kelas supaya angka yang sama selalu tertulis sama.

export const BULAN_PENDEK = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]
export const BULAN_PANJANG = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

/** Label ringkas: 0 / 500rb / 2,5jt / 1,2M */
export function formatRingkas(n: number): string {
  const ringkas = (v: number) => String(Number(v.toFixed(1))).replace('.', ',')
  if (n >= 1_000_000_000) return `${ringkas(n / 1_000_000_000)}M`
  if (n >= 1_000_000)     return `${ringkas(n / 1_000_000)}jt`
  if (n >= 1_000)         return `${Math.round(n / 1_000)}rb`
  return String(n)
}

/** Persen metrik — null berarti belum ada yang bisa dihitung */
export const formatPersen = (p: number | null): string => (p === null ? '—' : `${Math.round(p)}%`)

const LABEL_METODE: Record<string, string> = {
  tunai:    'Tunai',
  transfer: 'Transfer',
  qris:     'QRIS',
  va:       'Virtual Account',
}
export const labelMetode = (m: string | null): string => (m ? (LABEL_METODE[m] ?? m) : 'Transfer')

/** Tanggal dan jam WIB, mis. "12 Agu 2026, 09.15" */
export const formatWaktuWIB = (iso: string): string =>
  new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  })
