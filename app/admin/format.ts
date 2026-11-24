// Format waktu dasbor admin. Dihitung di server (halaman admin dirender per permintaan)
// lalu dikirim sebagai teks ke komponen klien, supaya hasil hydrate tidak berbeda.

const ZONA = 'Asia/Jakarta'

/** "24 Nov 2026, 09.12" (WIB, tanpa akhiran) */
export const formatWaktu = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONA,
  })

/** "24 Nov 2026, 09.12 WIB" */
export const formatWaktuWIB = (iso: string) => `${formatWaktu(iso)} WIB`

/** "24 Nov 2026" */
export const formatTanggalWIB = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: ZONA })

/** "Selasa, 24 November 2026" */
export const formatHariIniWIB = (sekarang = new Date()) =>
  sekarang.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA })

/** Tanggal kalender WIB "YYYY-MM-DD" */
const hariWIB = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA })

/** "Baru saja", "12 menit lalu", "3 jam lalu", "Kemarin", "5 hari lalu"; lebih dari 30 hari → tanggal */
export function formatRelatif(iso: string, sekarang = new Date()): string {
  const waktu = new Date(iso)
  const menit = Math.floor(Math.max(0, sekarang.getTime() - waktu.getTime()) / 60_000)
  if (menit < 1) return 'Baru saja'
  if (menit < 60) return `${menit} menit lalu`
  if (menit < 24 * 60) return `${Math.floor(menit / 60)} jam lalu`
  const hari = Math.round((Date.parse(hariWIB(sekarang)) - Date.parse(hariWIB(waktu))) / 86_400_000)
  if (hari <= 1) return 'Kemarin'
  if (hari <= 30) return `${hari} hari lalu`
  return formatTanggalWIB(iso)
}
