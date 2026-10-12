// Jenis gambar dari isi berkasnya (magic bytes), bukan dari label yang dikirim browser —
// label itu bisa diisi apa saja oleh pengirim.

const TANDA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** 'image/jpeg' atau 'image/png' kalau isinya memang gambar itu, selain itu null */
export function jenisGambar(isi: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (isi.length >= 3 && isi[0] === 0xff && isi[1] === 0xd8 && isi[2] === 0xff) return 'image/jpeg'
  if (isi.length >= TANDA_PNG.length && TANDA_PNG.every((b, i) => isi[i] === b)) return 'image/png'
  return null
}
