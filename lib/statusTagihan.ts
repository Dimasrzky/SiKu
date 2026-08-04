// Warna status tagihan — satu-satunya sumber kebenaran.
// Sebelumnya tiap halaman punya paletnya sendiri: lunas pernah hijau di badge tapi
// navy di donut, belum bayar pernah biru, biru muda, amber, dan kuning sekaligus.
//
// `solid` untuk isian penuh (donut, titik legenda), `bg`/`text` untuk badge pastel.
//
// Alur warnanya: hijau = selesai, biru = sedang berjalan, amber = perlu perhatian,
// merah = terlambat.

export const STATUS_TAGIHAN = {
  lunas:       { label: 'Lunas',       solid: '#22C55E', bg: '#DCFCE7', color: '#15803D' },
  cicilan:     { label: 'Cicilan',     solid: '#3B82F6', bg: '#DBEAFE', color: '#1D4ED8' },
  belum_bayar: { label: 'Belum bayar', solid: '#F59E0B', bg: '#FEF3C7', color: '#92400E' },
  menunggak:   { label: 'Menunggak',   solid: '#EF4444', bg: '#FEE2E2', color: '#DC2626' },
} as const

export type StatusTagihan = keyof typeof STATUS_TAGIHAN

/** Urutan tampil yang dipakai donut dan legenda di semua halaman. */
export const URUTAN_STATUS: StatusTagihan[] = ['lunas', 'cicilan', 'belum_bayar', 'menunggak']

/**
 * Jatuh tempo sebuah tagihan = hari terakhir bulan periodenya, sama dengan yang
 * ditampilkan di kolom "Jatuh tempo".
 */
export const lewatJatuhTempo = (bulan: number, tahun: number, sekarang: Date): boolean =>
  sekarang.getTime() > new Date(tahun, bulan, 0).getTime()

/**
 * Status efektif sebuah tagihan — dipakai badge tabel, angka ringkasan, dan donut
 * di seluruh halaman supaya tidak pernah berselisih.
 *
 * - lunas / cicilan → apa adanya; cicilan berarti pembayaran sedang berjalan
 * - belum bayar dan sudah lewat jatuh tempo → menunggak
 * - alumni yang belum lunas → menunggak tanpa memandang tanggal, karena mereka
 *   sudah lulus dan tidak punya siklus bulan berjalan lagi
 */
export function statusEfektif(
  status: string,
  lewatTempo: boolean,
  isAlumni = false,
): StatusTagihan {
  if (status === 'lunas')   return 'lunas'
  if (status === 'cicilan') return 'cicilan'
  return lewatTempo || isAlumni ? 'menunggak' : 'belum_bayar'
}
