// Nama kelas = tingkat + identitas, mis. "7-A". Sekolah yang hanya punya satu kelas per
// tingkat boleh tanpa identitas: namanya tingkat saja ("7"), tampil "Kelas 7". Dalam satu
// tingkat tidak boleh ada kelas tanpa identitas bersama kelas lain (lihat Manajemen Kelas).

/** Nama kelas dari tingkat + identitas; identitas kosong → tingkat saja */
export const namaKelas = (tingkat: string, identitas: string): string => {
  const id = identitas.trim()
  return id ? `${tingkat}-${id}` : tingkat
}

/**
 * Kunci pencocokan nama kelas yang ditulis bebas (impor Excel). Kata "Kelas" di depan,
 * tanda "-", dan spasi diabaikan: "Kelas 1", "1" → "1"; "Kelas 1-A", "1a", "1 A" → "1A".
 */
export const kunciKelas = (teks: string): string =>
  teks.trim().toUpperCase().replace(/^KELAS(?=[\s\-\d]|$)/, '').replace(/[-\s]/g, '')

/** Identitas dari nama kelas: "10-INTERNASIONAL" di tingkat "10" → "INTERNASIONAL"; "7" di tingkat "7" → "" */
export const identitasKelas = (nama: string, tingkat: string): string => {
  const n = nama.trim()
  if (n === tingkat) return ''
  const awalan = `${tingkat}-`
  return n.startsWith(awalan) ? n.slice(awalan.length) : n
}
