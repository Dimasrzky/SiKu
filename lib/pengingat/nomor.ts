// Nomor tujuan pengingat lewat antrean. Lebih ketat daripada formatWaNumber di
// lib/templates/waTagihan (tautan wa.me): di sana nomor apa pun diberi awalan 62,
// sehingga nomor luar negeri berubah menjadi nomor Indonesia milik orang lain. Tautan
// wa.me masih dilihat bendahara sebelum dikirim; pesan dari antrean tidak.

/**
 * Nomor seluler Indonesia dalam format 62xxx, atau null kalau kosong atau tidak sah.
 * Menerima penulisan 08…, 8…, 62…, +62…, dan 62 0…, dengan spasi atau tanda hubung.
 */
export function normalkanNomorWa(no: string | null | undefined): string | null {
  const mentah = (no ?? '').trim()
  const angka  = mentah.replace(/\D/g, '')
  // Kode negara lain yang ditulis eksplisit tidak boleh ditafsirkan sebagai nomor lokal
  if (mentah.startsWith('+') && !angka.startsWith('62')) return null

  let lokal = angka
  if (angka.startsWith('620'))     lokal = angka.slice(3)
  else if (angka.startsWith('62')) lokal = angka.slice(2)
  else if (angka.startsWith('0'))  lokal = angka.slice(1)

  // Nomor seluler selalu diawali 8; tanpa kode negara panjangnya 9–12 digit
  return /^8\d{8,11}$/.test(lokal) ? `62${lokal}` : null
}
