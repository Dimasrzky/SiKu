// Teks turunan untuk halaman /kemitraan. Dihitung di server supaya HTML awal dan hasil
// hidrasi sama: zona waktunya selalu WIB, bukan zona waktu peramban.

const WIB = 'Asia/Jakarta'

/** "Sri Wahyuni, S. Pd." → "SW": huruf depan dua kata pertama, tanpa gelar */
export function inisialNama(nama: string): string {
  const kata = nama
    .split(',')[0]                       // gelar di belakang koma
    .split(/\s+/)
    .filter(k => k && !k.endsWith('.'))  // gelar di depan: Drs., H., Hj.
  const huruf = kata.slice(0, 2).map(k => k.charAt(0).toUpperCase()).join('')
  return huruf || nama.trim().charAt(0).toUpperCase() || 'S'
}

const hariWib = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: WIB })
const tahunWib = (d: Date) => d.toLocaleDateString('en-CA', { year: 'numeric', timeZone: WIB })

/** "Selesai pukul 17.35"; tanggalnya ikut ditulis kalau bukan hari ini */
export function labelSelesai(iso: string, sekarang: Date): string {
  const waktu = new Date(iso)
  const jam = waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: WIB })
  if (hariWib(waktu) === hariWib(sekarang)) return `Selesai pukul ${jam}`
  const tanggal = waktu.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', timeZone: WIB,
    ...(tahunWib(waktu) === tahunWib(sekarang) ? {} : { year: 'numeric' }),
  })
  return `Selesai ${tanggal}, pukul ${jam}`
}

/**
 * Tautan wa.me ke tim Equanusa dengan pesan siap kirim. null selama EQUANUSA_WA belum
 * diisi: tombolnya disembunyikan, bukan diarahkan ke nomor yang salah.
 */
export function tautanWaEquanusa(nomor: string | undefined, namaBendahara: string, namaSekolah: string): string | null {
  let digit = (nomor ?? '').replace(/\D/g, '')
  if (digit.startsWith('0')) digit = '62' + digit.slice(1)
  if (digit.length < 10) return null
  const pesan = `Halo Tim Equanusa, saya ${namaBendahara} dari ${namaSekolah}. `
    + 'Kami sudah mendaftar di SiKu dan menunggu konfirmasi kemitraan sekolah.'
  return `https://wa.me/${digit}?text=${encodeURIComponent(pesan)}`
}
