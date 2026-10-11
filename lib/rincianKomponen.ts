import { periodeIndex } from './komponenTagihan'
import { BULAN_PANJANG } from './formatLaporan'

// Rincian tagihan per komponen — dasar memilih komponen yang dibayar di halaman bayar wali,
// membagi cicilan, dan mencatat pembayaran per komponen (keputusan 11 Okt 2026). Dipakai
// halaman bayar, unggah bukti, verifikasi, dan Catat Pembayaran Manual — jangan disalin.
//
// Harga bersih komponen = tagihan_item.nominal − tagihan_item.potongan (potongan beasiswa
// yang dicatat saat terbit dan saat dihitung ulang). Bagian yang sudah dibayar dibaca dari
// pembayaran.alokasi: [{ tagihan_item_id, nama_komponen, jumlah }].
//
// Tagihan hanya bisa dibayar per komponen kalau rinciannya utuh: harga bersih semua
// komponen berjumlah sama dengan total_nominal, dan setiap pembayarannya punya alokasi yang
// cocok dengan komponennya. Selain itu — tagihan lama yang potongannya belum tercatat per
// komponen, "komponen tambahan" di luar rincian, pembayaran tanpa rincian (data lama,
// gateway) — tagihan itu dipilih dan dibayar utuh. Jumlah yang ditagih tetap sama.

export interface AlokasiKomponen {
  tagihan_item_id: string
  nama_komponen:   string
  jumlah:          number
}

// Isian cicilan wali: halaman bayar dan route unggah bukti memakai batas yang sama
/** Sama dengan constraint verifikasi_pembayaran_catatan_wali_check */
export const MAKS_CATATAN_WALI = 200
/** Rencana pelunasan sisa cicilan paling jauh setahun dari hari ini */
export const MAKS_HARI_RENCANA = 365

/** Tanggal kalender WIB, 'YYYY-MM-DD' */
export const tanggalWIB = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

/** Rentang tanggal rencana pelunasan yang boleh dipilih, mulai hari ini (WIB) */
export const rentangRencana = (sekarang: Date): { awal: string; akhir: string } => ({
  awal:  tanggalWIB(sekarang),
  akhir: tanggalWIB(new Date(sekarang.getTime() + MAKS_HARI_RENCANA * 86_400_000)),
})

const bilanganPositif = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0

/** Isi pembayaran.alokasi; null kalau kosong atau bentuknya tidak dikenal */
export function bacaAlokasi(raw: unknown): AlokasiKomponen[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const hasil: AlokasiKomponen[] = []
  for (const a of raw) {
    if (!a || typeof a !== 'object') return null
    const { tagihan_item_id, nama_komponen, jumlah } = a as Record<string, unknown>
    if (typeof tagihan_item_id !== 'string' || !bilanganPositif(jumlah)) return null
    hasil.push({ tagihan_item_id, nama_komponen: typeof nama_komponen === 'string' ? nama_komponen : '', jumlah })
  }
  return hasil
}

// ── Rincian satu tagihan ─────────────────────────────────────────────────────

export interface ItemRincian {
  id:            string
  nama_komponen: string
  nominal:       number
  potongan:      number
}

export interface KomponenSisa<I extends ItemRincian> {
  item:     I
  /** Nominal sesudah potongan beasiswa */
  bersih:   number
  terbayar: number
  sisa:     number
}

export interface RincianKomponen<I extends ItemRincian> {
  /** Komponennya bisa dipilih dan dibayar satu per satu */
  perKomponen: boolean
  /** Urutan tampil sekaligus urutan pembagian: harga bersih terbesar dulu */
  komponen:    KomponenSisa<I>[]
}

const urutKomponen = (a: ItemRincian, b: ItemRincian): number =>
  (b.nominal - b.potongan) - (a.nominal - a.potongan)
  || b.nominal - a.nominal
  || a.nama_komponen.localeCompare(b.nama_komponen, 'id')
  || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function rincianKomponen<I extends ItemRincian>(
  totalNominal: number,
  items:        I[],
  pembayaran:   { jumlah: number; alokasi: unknown }[],
): RincianKomponen<I> {
  const urut = [...items].sort(urutKomponen)
  const ids  = new Set(urut.map(i => i.id))

  let utuh = urut.length > 0
    && urut.every(i => i.potongan >= 0 && i.potongan <= i.nominal)
    && urut.reduce((s, i) => s + i.nominal - i.potongan, 0) === totalNominal

  const terbayar = new Map<string, number>()
  for (const p of pembayaran) {
    const alokasi = bacaAlokasi(p.alokasi)
    if (!alokasi || alokasi.some(a => !ids.has(a.tagihan_item_id)) || alokasi.reduce((s, a) => s + a.jumlah, 0) !== p.jumlah) {
      // Uang tanpa rincian komponen tidak bisa dipastikan menutup komponen yang mana
      utuh = false
      continue
    }
    for (const a of alokasi) terbayar.set(a.tagihan_item_id, (terbayar.get(a.tagihan_item_id) ?? 0) + a.jumlah)
  }

  const komponen = urut.map(item => {
    const bersih  = item.nominal - item.potongan
    const dibayar = terbayar.get(item.id) ?? 0
    return { item, bersih, terbayar: dibayar, sisa: Math.max(0, bersih - dibayar) }
  })
  // Lebih bayar pada satu komponen (mis. potongannya naik sesudah dibayar) membuat sisa
  // per komponen tidak lagi menjumlah ke sisa tagihan
  if (komponen.some(k => k.terbayar > k.bersih)) utuh = false

  return { perKomponen: utuh, komponen }
}

// ── Yang bisa dipilih wali ───────────────────────────────────────────────────

/** Satu hal yang bisa dicentang: satu komponen, atau satu tagihan yang dibayar utuh */
export interface UnitBayar {
  tagihan_id:      string
  /** null = tagihan dibayar utuh */
  tagihan_item_id: string | null
  bulan:           number
  tahun:           number
  /** null untuk tagihan utuh */
  nama_komponen:   string | null
  sisa:            number
}

export const kunciUnit = (u: { tagihan_id: string; tagihan_item_id: string | null }): string =>
  `${u.tagihan_id}:${u.tagihan_item_id ?? '*'}`

export const labelUnit = (u: Pick<UnitBayar, 'nama_komponen' | 'bulan' | 'tahun'>): string =>
  `${u.nama_komponen ?? 'Tagihan'} ${BULAN_PANJANG[u.bulan] ?? ''} ${u.tahun}`

export interface TagihanBerincian {
  id:            string
  bulan:         number
  tahun:         number
  total_nominal: number
  terbayar:      number
  rincian:       RincianKomponen<ItemRincian>
}

/** Semua yang masih bisa dibayar dari tagihan-tagihan ini, dalam urutan pembagian: bulan terlama dulu, lalu urutan komponen */
export function unitBayar(daftar: TagihanBerincian[]): UnitBayar[] {
  return [...daftar]
    .sort((a, b) => periodeIndex(a.bulan, a.tahun) - periodeIndex(b.bulan, b.tahun))
    .flatMap((t): UnitBayar[] => t.rincian.perKomponen
      ? t.rincian.komponen.map(k => ({
          tagihan_id: t.id, tagihan_item_id: k.item.id, bulan: t.bulan, tahun: t.tahun,
          nama_komponen: k.item.nama_komponen, sisa: k.sisa,
        }))
      : [{
          tagihan_id: t.id, tagihan_item_id: null, bulan: t.bulan, tahun: t.tahun,
          nama_komponen: null, sisa: Math.max(0, t.total_nominal - t.terbayar),
        }])
    .filter(u => u.sisa > 0)
}

export interface PilihanBayar {
  tagihan_id:      string
  tagihan_item_id: string | null
}

/** Pilihan dari permintaan wali atau dari verifikasi_pembayaran.pilihan; null kalau bentuknya salah */
export function bacaPilihan(raw: unknown): PilihanBayar[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) return null
  const hasil: PilihanBayar[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') return null
    const { tagihan_id, tagihan_item_id } = p as Record<string, unknown>
    if (typeof tagihan_id !== 'string' || !(tagihan_item_id === null || typeof tagihan_item_id === 'string')) return null
    hasil.push({ tagihan_id, tagihan_item_id })
  }
  return hasil
}

/**
 * Tagihan yang disentuh satu bukti transfer: tagihan tempat bukti itu dicatat ditambah
 * semua tagihan dalam pilihannya. Bukti masih "menunggu" selama salah satunya belum lunas —
 * aturan yang sama untuk kunci halaman bayar, label Diproses, dan pengingat.
 */
export const tagihanBukti = (v: { tagihan_id: string; pilihan: unknown }): string[] =>
  [v.tagihan_id, ...(bacaPilihan(v.pilihan) ?? []).map(p => p.tagihan_id)]

/** Salinan pilihan yang disimpan bersama bukti (verifikasi_pembayaran.pilihan), untuk ditampilkan */
export function bacaPilihanTersimpan(raw: unknown): UnitBayar[] | null {
  const pilihan = bacaPilihan(raw)
  if (!pilihan || !Array.isArray(raw)) return null
  return pilihan.map((p, i) => {
    const r = raw[i] as Record<string, unknown>
    return {
      ...p,
      bulan:         typeof r.bulan === 'number' ? r.bulan : 0,
      tahun:         typeof r.tahun === 'number' ? r.tahun : 0,
      nama_komponen: typeof r.nama_komponen === 'string' ? r.nama_komponen : null,
      sisa:          typeof r.sisa === 'number' ? r.sisa : 0,
    }
  })
}

/**
 * Unit yang dipilih wali, persis — saat bukti dikirim. Satu saja yang tidak ada di `units`
 * (sudah lunas, tagihan lain, komponen dari tagihan yang dibayar utuh) menolak seluruh
 * pilihan: halaman yang usang tidak boleh diam-diam menagih jumlah lain.
 */
export function pilihanPersis(units: UnitBayar[], pilihan: PilihanBayar[]): UnitBayar[] | null {
  const kunci = new Set(pilihan.map(kunciUnit))
  if (kunci.size !== pilihan.length) return null
  const dipilih = units.filter(u => kunci.has(kunciUnit(u)))
  return dipilih.length > 0 && dipilih.length === kunci.size ? dipilih : null
}

/**
 * Unit dari pilihan yang tersimpan, menurut keadaan SEKARANG — saat verifikasi. Komponen
 * yang lunas sejak bukti dikirim terlewati. Tagihan yang sejak itu hanya bisa dibayar utuh
 * dipakai utuh; tagihan yang dipilih utuh lalu menjadi berincian dipakai semua komponennya.
 */
export function pilihanSekarang(units: UnitBayar[], pilihan: PilihanBayar[]): UnitBayar[] {
  const kunci   = new Set(pilihan.map(kunciUnit))
  const tagihan = new Set(pilihan.map(p => p.tagihan_id))
  return units.filter(u => u.tagihan_item_id === null
    ? tagihan.has(u.tagihan_id)
    : kunci.has(kunciUnit(u)) || kunci.has(kunciUnit({ tagihan_id: u.tagihan_id, tagihan_item_id: null })))
}

// ── Pembagian ────────────────────────────────────────────────────────────────

export interface BagianUnit {
  unit:   UnitBayar
  jumlah: number
}

/** Satu nominal dibagi ke `units` sesuai urutannya. Kelebihan di atas sisanya tidak dibagi. */
export function bagiPerUnit(units: UnitBayar[], jumlah: number): BagianUnit[] {
  const hasil: BagianUnit[] = []
  let uang = jumlah
  for (const unit of units) {
    if (uang <= 0) break
    if (unit.sisa <= 0) continue
    const bayar = Math.min(unit.sisa, uang)
    hasil.push({ unit, jumlah: bayar })
    uang -= bayar
  }
  return hasil
}

export interface BagianTagihan {
  tagihan_id: string
  jumlah:     number
  /** Komponen yang ditutup (pembayaran.alokasi); null kalau tagihannya dibayar utuh */
  alokasi:    AlokasiKomponen[] | null
}

/** Pembagian dikelompokkan per tagihan — satu baris pembayaran per tagihan */
export function bagiKeTagihan(units: UnitBayar[], jumlah: number): BagianTagihan[] {
  const hasil: BagianTagihan[] = []
  for (const { unit, jumlah: bayar } of bagiPerUnit(units, jumlah)) {
    let bagian = hasil.find(b => b.tagihan_id === unit.tagihan_id)
    if (!bagian) {
      bagian = { tagihan_id: unit.tagihan_id, jumlah: 0, alokasi: unit.tagihan_item_id ? [] : null }
      hasil.push(bagian)
    }
    bagian.jumlah += bayar
    if (unit.tagihan_item_id && bagian.alokasi) {
      bagian.alokasi.push({ tagihan_item_id: unit.tagihan_item_id, nama_komponen: unit.nama_komponen ?? '', jumlah: bayar })
    }
  }
  return hasil
}
