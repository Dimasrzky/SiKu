import { bacaAlokasi } from './rincianKomponen'

// Kas per komponen tagihan — dasar halaman Pengeluaran sejak 27 Okt 2026. Setiap
// pengeluaran diambil dari satu atau lebih komponen (SPP, Uang Gedung, Komite, …) dan
// pemasukan dipecah per komponen, sehingga saldo tiap komponen bisa dilihat.
//
// Keputusan user:
// - Komponen dikenali dari NAMANYA. Komponen tagihan bisa dibuat ulang tiap tahun ajaran,
//   jadi "SPP" tahun lalu dan tahun ini satu kas yang sama (tunggakan tahun lalu yang
//   dibayar sekarang masuk ke "SPP").
// - Pemasukan = pembayaran yang tercatat di SiKu menurut tanggal bayar, tanpa saldo awal.
// - Sumber dana satu pengeluaran harus berjumlah TEPAT sama dengan pengeluarannya.
// - Mengambil melebihi sisa saldo komponen boleh, saldonya tampil minus (SiKu tidak tahu
//   kas sekolah sebelum memakai SiKu).
//
// Berkas ini dipakai browser dan ekspor — jangan mengimpor apa pun yang khusus server.

/** Pemasukan yang komponennya tidak bisa dipastikan (tagihan tanpa rincian) */
export const NAMA_LAINNYA = 'Lainnya'

/** Warna komponen yang tidak punya warna tercatat, bergiliran */
export const WARNA_CADANGAN = ['#5C9BE4', '#AB69C1', '#C1AD69', '#69C183', '#E57373', '#7D7ADC', '#4FB6B0', '#E39B4F'] as const
export const WARNA_LAINNYA  = '#94A3B8'

/** Kunci komponen: nama tanpa beda huruf besar-kecil dan spasi berlebih */
export const kunciKomponen = (nama: string): string => nama.trim().replace(/\s+/g, ' ').toLowerCase()

// ── Pemasukan per komponen ───────────────────────────────────────────────────

export interface ItemTagihanKas {
  id:            string
  nama_komponen: string
  nominal:       number
  potongan:      number
}

export interface BagianKomponen {
  nama:   string
  jumlah: number
}

/** Bagian berkomponen sama (dua baris rincian bernama sama) digabung, urutan tetap */
function gabungBagian(bagian: BagianKomponen[]): BagianKomponen[] {
  const hasil = new Map<string, BagianKomponen>()
  for (const b of bagian) {
    if (b.jumlah === 0) continue
    const nama  = b.nama.trim() || NAMA_LAINNYA
    const kunci = kunciKomponen(nama)
    const ada   = hasil.get(kunci)
    if (ada) ada.jumlah += b.jumlah
    else hasil.set(kunci, { nama, jumlah: b.jumlah })
  }
  return [...hasil.values()]
}

/**
 * Bagian tiap komponen dari satu pembayaran.
 * - Dicatat per komponen (pembayaran.alokasi cocok dengan rincian tagihannya): apa adanya.
 * - Selain itu (tagihan dibayar utuh, data lama, payment gateway): dibagi menurut porsi
 *   harga bersih komponennya (nominal − potongan beasiswa). Sisa pembulatan rupiah ke
 *   pecahan terbesar, jadi jumlah bagiannya selalu tepat sama dengan pembayarannya.
 * - Tagihan tanpa rincian sama sekali: seluruhnya "Lainnya".
 */
export function bagiPembayaranKeKomponen(
  p: { jumlah: number; alokasi: unknown },
  items: ItemTagihanKas[],
): BagianKomponen[] {
  const jumlah = Math.round(Number(p.jumlah))
  if (!(jumlah > 0)) return []

  const perId   = new Map(items.map(i => [i.id, i]))
  const alokasi = bacaAlokasi(p.alokasi)
  if (alokasi
    && alokasi.every(a => perId.has(a.tagihan_item_id))
    && alokasi.reduce((s, a) => s + a.jumlah, 0) === jumlah) {
    // Nama dari rincian tagihan, bukan salinan di alokasi: komponen yang diganti namanya
    // ikut diperbarui di rincian (halaman Komponen), salinan di alokasi tidak
    return gabungBagian(alokasi.map(a => ({ nama: perId.get(a.tagihan_item_id)?.nama_komponen || a.nama_komponen, jumlah: a.jumlah })))
  }

  const bobot      = items.map(i => Math.max(0, Number(i.nominal) - Number(i.potongan)))
  const totalBobot = bobot.reduce((s, b) => s + b, 0)
  if (totalBobot <= 0) return [{ nama: NAMA_LAINNYA, jumlah }]

  const kasar = bobot.map(b => (jumlah * b) / totalBobot)
  const bulat = kasar.map(k => Math.floor(k))
  let sisa = jumlah - bulat.reduce((s, b) => s + b, 0)
  const urut = kasar
    .map((k, i) => ({ i, pecahan: k - bulat[i] }))
    .sort((a, b) => b.pecahan - a.pecahan || a.i - b.i)
  for (const { i } of urut) {
    if (sisa <= 0) break
    bulat[i] += 1
    sisa -= 1
  }
  return gabungBagian(items.map((it, i) => ({ nama: it.nama_komponen, jumlah: bulat[i] })))
}

// ── Saldo per komponen ───────────────────────────────────────────────────────

export interface SaldoKomponen {
  kunci:  string
  nama:   string
  masuk:  number
  keluar: number
  /** masuk − keluar; boleh minus */
  saldo:  number
}

/**
 * Saldo tiap komponen dari pemasukan dan sumber dana pengeluaran. `namaTampil` memberi
 * ejaan resmi (dari daftar komponen) untuk tiap kunci. Urut: pemasukan terbesar dulu,
 * "Lainnya" paling akhir.
 */
export function hitungSaldoKomponen(
  masuk:  BagianKomponen[],
  keluar: { nama_komponen: string; nominal: number }[],
  namaTampil: Map<string, string> = new Map(),
): SaldoKomponen[] {
  const peta = new Map<string, SaldoKomponen>()
  const ambil = (nama: string): SaldoKomponen => {
    const bersih = nama.trim() || NAMA_LAINNYA
    const kunci  = kunciKomponen(bersih)
    let baris = peta.get(kunci)
    if (!baris) {
      baris = { kunci, nama: namaTampil.get(kunci) ?? bersih, masuk: 0, keluar: 0, saldo: 0 }
      peta.set(kunci, baris)
    }
    return baris
  }
  for (const m of masuk)  ambil(m.nama).masuk += m.jumlah
  for (const k of keluar) ambil(k.nama_komponen).keluar += Number(k.nominal)
  const lainnya = kunciKomponen(NAMA_LAINNYA)
  return [...peta.values()]
    .map(b => ({ ...b, saldo: b.masuk - b.keluar }))
    .sort((a, b) => Number(a.kunci === lainnya) - Number(b.kunci === lainnya)
      || b.masuk - a.masuk || b.keluar - a.keluar || a.nama.localeCompare(b.nama, 'id'))
}

/** Persen saldo yang tersisa dari pemasukannya; null kalau belum ada pemasukan */
export const persenTersisa = (s: Pick<SaldoKomponen, 'masuk' | 'saldo'>): number | null =>
  s.masuk > 0 ? (s.saldo / s.masuk) * 100 : null

// ── Sumber dana satu pengeluaran ─────────────────────────────────────────────

/** kurang = Belum lengkap, lebih = Kelebihan, sesuai = tepat sama */
export type StatusSumberDana = 'kurang' | 'lebih' | 'sesuai'

export const statusSumberDana = (jumlahPengeluaran: number, diambil: number): StatusSumberDana =>
  diambil === jumlahPengeluaran ? 'sesuai' : diambil < jumlahPengeluaran ? 'kurang' : 'lebih'

/** Warna tiap komponen: dari daftar komponen tagihan, selain itu bergiliran */
export function petaWarnaKomponen(
  warnaTercatat: Map<string, string>,
  kunciLain: string[],
): Map<string, string> {
  const hasil = new Map(warnaTercatat)
  hasil.set(kunciKomponen(NAMA_LAINNYA), WARNA_LAINNYA)
  let giliran = 0
  for (const k of kunciLain) {
    if (hasil.has(k)) continue
    hasil.set(k, WARNA_CADANGAN[giliran % WARNA_CADANGAN.length])
    giliran += 1
  }
  return hasil
}
