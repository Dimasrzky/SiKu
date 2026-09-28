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

/** Kolom tagihan yang dibutuhkan untuk menentukan jatuh temponya. */
export interface WaktuTagihan {
  /** Diisi trigger database saat tagihan dibuat — null hanya untuk baris yang belum terisi */
  jatuh_tempo: string | null
  bulan:       number
  tahun:       number
}

/**
 * Detik terakhir hari jatuh tempo. Sumbernya tagihan.jatuh_tempo: trigger database
 * mengisinya saat tagihan dibuat dari tanggal jatuh tempo paket kelasnya (23:59:59
 * WIB), jadi mengubah paket belakangan tidak menggeser riwayat. Tanpa nilai itu
 * dipakai akhir hari terakhir bulan periodenya.
 */
export function batasJatuhTempo(t: WaktuTagihan): Date {
  if (t.jatuh_tempo) return new Date(t.jatuh_tempo)
  return new Date(t.tahun, t.bulan, 0, 23, 59, 59, 999)
}

/**
 * Lewat jatuh tempo = sudah melewati akhir hari jatuh tempo. Membayar pada hari
 * jatuh tempo itu sendiri masih tepat waktu — dulu batasnya pukul 00:00 sehingga
 * seharian penuh hari itu sudah terhitung menunggak.
 */
export const lewatJatuhTempo = (t: WaktuTagihan, sekarang: Date): boolean =>
  sekarang.getTime() > batasJatuhTempo(t).getTime()

/** Tanggal jatuh tempo untuk ditampilkan, mis. "10 Oktober 2026". */
export const formatJatuhTempo = (t: WaktuTagihan): string =>
  batasJatuhTempo(t).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  })

/**
 * Tagihan tanpa kewajiban bayar — nilainya Rp 0 karena beasiswa menutup seluruh
 * komponen. Barisnya tetap terbit berstatus belum_bayar dan tidak akan pernah
 * dibayar, jadi harus dibaca sebagai lunas, bukan menunggak.
 */
export const tanpaKewajiban = (totalNominal: number): boolean => totalNominal <= 0

/**
 * Status efektif sebuah tagihan — dipakai badge tabel, angka ringkasan, dan donut
 * di seluruh halaman supaya tidak pernah berselisih.
 *
 * - tagihan Rp 0 → lunas (lihat tanpaKewajiban)
 * - lunas / cicilan → apa adanya; cicilan berarti pembayaran sedang berjalan
 * - belum bayar dan sudah lewat jatuh tempo → menunggak
 * - alumni yang belum lunas → menunggak tanpa memandang tanggal, karena mereka
 *   sudah lulus dan tidak punya siklus bulan berjalan lagi
 */
export function statusEfektif(
  status: string,
  lewatTempo: boolean,
  isAlumni: boolean,
  totalNominal: number,
): StatusTagihan {
  if (tanpaKewajiban(totalNominal)) return 'lunas'
  if (status === 'lunas')   return 'lunas'
  if (status === 'cicilan') return 'cicilan'
  return lewatTempo || isAlumni ? 'menunggak' : 'belum_bayar'
}
