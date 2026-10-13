// Besaran potongan beasiswa dari isian form. Potongan negatif justru MENAIKKAN total
// tagihan, jadi ditolak di sini — dan oleh constraint di tabel beasiswa.

/** Pesan galat isian besaran, atau null kalau sah */
export function galatBesaran(jenis: 'persen' | 'nominal', teks: string): string | null {
  const n = Number(teks)
  if (teks.trim() === '' || !Number.isFinite(n)) return 'Isi besaran potongan dengan angka.'
  if (jenis === 'persen') return n > 0 && n <= 100 ? null : 'Persen harus lebih dari 0 dan paling banyak 100.'
  return Number.isInteger(n) && n > 0 ? null : 'Nominal harus bilangan bulat lebih dari 0.'
}
