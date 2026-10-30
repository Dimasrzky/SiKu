// Jatuh tempo tagihan menurut tanggal jatuh tempo paket (paket.tanggal_jatuh_tempo):
// tanggal yang berulang tiap bulan, kosong = akhir bulan, tanggal 29–31 jatuh ke hari
// terakhir bulan yang lebih pendek, pukul 23.59.59 WIB — sama dengan trigger database
// tagihan_isi_snapshot yang mengisinya saat tagihan terbit.
//
// Saat jatuh tempo paket DIUBAH (keputusan user 30 Okt 2026), semua tagihan bulan berjalan
// (lunas maupun belum) di kelas-kelas paket itu ikut diperbarui (/api/tagihan/jatuh-tempo). Kalau
// tanggal barunya di bulan tagihan sudah lewat saat diubah, jatuh temponya bulan berikutnya:
// diubah 30 Okt ke tanggal 15 → tagihan Oktober jatuh tempo 15 November. Aturan ini hanya
// berlaku saat paket diubah — dijalankan berulang, jatuh tempo akan terus terdorong maju.
//
// Berkas ini dipakai browser dan server.

const SELISIH_WIB_JAM = 7

/** Pukul 23.59.59 WIB pada tanggal itu, ISO; tanggal kosong atau melebihi panjang bulan = hari terakhir */
export function jatuhTempoBulan(tanggal: number | null, bulan: number, tahun: number): string {
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const hari = tanggal === null ? hariTerakhir : Math.min(Math.max(1, tanggal), hariTerakhir)
  return new Date(Date.UTC(tahun, bulan - 1, hari, 23 - SELISIH_WIB_JAM, 59, 59)).toISOString()
}

/**
 * Jatuh tempo baru tagihan bulan `bulan`/`tahun` setelah tanggal jatuh tempo paketnya diubah
 * pada `sekarang`: tanggal itu di bulan tagihannya, atau di bulan berikutnya kalau sudah lewat.
 */
export function jatuhTempoSesudahDiubah(tanggal: number | null, bulan: number, tahun: number, sekarang: Date): string {
  const diBulanItu = jatuhTempoBulan(tanggal, bulan, tahun)
  if (new Date(diBulanItu).getTime() >= sekarang.getTime()) return diBulanItu
  return bulan === 12 ? jatuhTempoBulan(tanggal, 1, tahun + 1) : jatuhTempoBulan(tanggal, bulan + 1, tahun)
}
