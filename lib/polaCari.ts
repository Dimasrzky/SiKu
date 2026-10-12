// Pola pencarian dari ketikan pengguna, untuk filter .ilike(). Ketikan selalu dikirim
// lewat .ilike() — PostgREST mengikatnya sebagai satu parameter query — dan tidak pernah
// dirangkai ke string .or(): .or() memakai stringnya apa adanya, sehingga koma atau
// kurung di ketikan bisa menyisipkan kondisi filter lain.

/**
 * `%kata%` untuk `.ilike()`: cocok dengan teks yang mengandung `kata`. `\`, `%`, dan `_`
 * dari ketikan di-escape supaya dicari apa adanya, bukan menjadi wildcard. `*` dibuang,
 * karena PostgREST mengubahnya menjadi `%` dan tidak ada cara meng-escape-nya.
 */
export const polaIlike = (kata: string): string =>
  `%${kata.replace(/\*/g, '').trim().replace(/[\\%_]/g, c => `\\${c}`)}%`
