import { bagiPembayaranKeKomponen, kunciKomponen, NAMA_LAINNYA, petaWarnaKomponen, type ItemTagihanKas } from './kasKomponen'
import { bacaPilihanTersimpan, bagiPerUnit } from './rincianKomponen'

// Pilihan komponen saat mengunduh laporan — masukan bendahara MI Nurrohmah Bina Insani
// (6 Nov 2026): laporan menjumlah semua komponen, padahal yang dibutuhkan hanya SPP (SPP
// yang ditagih dan SPP yang sudah diterima). Sebelum mengunduh, bendahara mencentang
// komponennya; kalau lebih dari satu, nominalnya ditotalkan atau dipisah satu kolom per
// komponen. Dicoba di sekolah demo, lalu dibuka untuk semua sekolah (6 Nov 2026).
//
// Pembagian per komponen memakai aturan kas Pengeluaran (lib/kasKomponen), jadi "SPP
// diterima" di laporan sama dengan pemasukan SPP di Pengeluaran:
// - ditagih: total_nominal dibagi menurut harga bersih tiap komponen (nominal − potongan),
//   tepat sama dengan harga bersihnya kalau rincian tagihannya utuh;
// - diterima: pembayaran yang dicatat per komponen (pembayaran.alokasi) apa adanya, selain
//   itu dibagi menurut porsi harga bersih.
// Komponen dikenali dari namanya, jadi SPP tahun lalu dan tahun ini satu komponen.
//
// Berkas ini dipakai browser — jangan mengimpor apa pun yang khusus server.

export type ModeKomponen = 'total' | 'pisah'

export interface PilihanKomponen {
  /** Kunci komponen (kunciKomponen) yang dicentang, paling tidak satu */
  kunci: string[]
  /** Hanya berlaku kalau lebih dari satu komponen dicentang */
  mode:  ModeKomponen
}

export interface OpsiKomponen {
  kunci: string
  nama:  string
  warna: string
}

/** Rincian tagihan seperti yang dimuat halaman Laporan */
export interface ItemLaporanKomponen {
  id:            string
  nama_komponen: string
  nominal:       number
  potongan?:     number | null
  /** Nama hidup dari master komponen — null kalau komponennya sudah dihapus */
  komponen?:     { nama: string } | null
}

export interface PembayaranLaporanKomponen {
  tagihan_id:    string
  jumlah:        number
  alokasi:       unknown
  tanggal_bayar: string
}

const waktu = (iso: string) => new Date(iso).getTime()

/** Nama hidup dari master komponen; salinan di rincian kalau komponennya sudah dihapus */
export const namaItemKomponen = (i: { nama_komponen: string; komponen?: { nama: string } | null }): string =>
  (i.komponen?.nama ?? i.nama_komponen).trim() || NAMA_LAINNYA

export const kunciItemKomponen = (i: { nama_komponen: string; komponen?: { nama: string } | null }): string =>
  kunciKomponen(namaItemKomponen(i))

/** Rincian dalam bentuk yang dipakai pembagian kas */
export function itemKas(items: ItemLaporanKomponen[]): ItemTagihanKas[] {
  return items.map(i => ({
    id:            i.id,
    nama_komponen: namaItemKomponen(i),
    nominal:       Number(i.nominal) || 0,
    potongan:      Number(i.potongan ?? 0) || 0,
  }))
}

/** Bagian tiap komponen dari satu jumlah uang — kunci komponen → rupiah */
export function bagiKeKunci(p: { jumlah: number; alokasi: unknown }, items: ItemTagihanKas[]): Map<string, number> {
  const hasil = new Map<string, number>()
  for (const b of bagiPembayaranKeKomponen(p, items)) {
    const kunci = kunciKomponen(b.nama)
    hasil.set(kunci, (hasil.get(kunci) ?? 0) + b.jumlah)
  }
  return hasil
}

// ── Rincian per komponen satu tagihan ────────────────────────────────────────

export interface BagianTagihanKomponen {
  ditagih:       number
  terbayar:      number
  /** tanggal_bayar terakhir yang menyumbang ke komponen ini */
  bayarTerakhir: string | null
}

export interface RincianTagihanKomponen {
  /** Per kunci komponen. Komponen bernilai Rp 0 (beasiswa penuh) tetap ada. */
  komponen: Map<string, BagianTagihanKomponen>
  /** Nama tampil tiap kunci */
  nama:     Map<string, string>
  /** Kunci komponen yang menerima uang dari tiap pembayaran tagihan ini */
  bayar:    Set<string>[]
}

export function rincianTagihanKomponen(
  totalNominal: number,
  items:        ItemLaporanKomponen[],
  pembayaran:   { jumlah: number; alokasi: unknown; tanggal_bayar: string }[],
): RincianTagihanKomponen {
  const kas      = itemKas(items)
  const komponen = new Map<string, BagianTagihanKomponen>()
  const nama     = new Map<string, string>()
  const ambil = (kunci: string, namaTampil: string): BagianTagihanKomponen => {
    let b = komponen.get(kunci)
    if (!b) {
      b = { ditagih: 0, terbayar: 0, bayarTerakhir: null }
      komponen.set(kunci, b)
      nama.set(kunci, namaTampil)
    }
    return b
  }

  // Tagihan tanpa rincian: seluruhnya "Lainnya", sama dengan kas Pengeluaran
  if (kas.length === 0) ambil(kunciKomponen(NAMA_LAINNYA), NAMA_LAINNYA)
  for (const i of kas) ambil(kunciKomponen(i.nama_komponen), i.nama_komponen)

  // Kunci baru di sini hanya mungkin "Lainnya" (semua harga bersih Rp 0)
  for (const [kunci, jumlah] of bagiKeKunci({ jumlah: totalNominal, alokasi: null }, kas)) {
    ambil(kunci, NAMA_LAINNYA).ditagih += jumlah
  }

  const bayar: Set<string>[] = []
  for (const p of pembayaran) {
    const disentuh = new Set<string>()
    for (const [kunci, jumlah] of bagiKeKunci(p, kas)) {
      const b = ambil(kunci, NAMA_LAINNYA)
      b.terbayar += jumlah
      if (jumlah <= 0) continue
      disentuh.add(kunci)
      if (!b.bayarTerakhir || waktu(p.tanggal_bayar) > waktu(b.bayarTerakhir)) b.bayarTerakhir = p.tanggal_bayar
    }
    bayar.push(disentuh)
  }
  return { komponen, nama, bayar }
}

/** Rincian per komponen setiap tagihan, menurut id tagihan */
export function rincianSemuaTagihan(
  tagihan:    { id: string; total_nominal: number; tagihan_item: ItemLaporanKomponen[] }[],
  pembayaran: PembayaranLaporanKomponen[],
): Map<string, RincianTagihanKomponen> {
  const perTagihan = new Map<string, PembayaranLaporanKomponen[]>()
  for (const p of pembayaran) {
    const daftar = perTagihan.get(p.tagihan_id)
    if (daftar) daftar.push(p)
    else perTagihan.set(p.tagihan_id, [p])
  }
  return new Map(tagihan.map(t => [t.id, rincianTagihanKomponen(t.total_nominal, t.tagihan_item, perTagihan.get(t.id) ?? [])]))
}

/** Jumlah per komponen dalam satu rincian, untuk kunci-kunci terpilih */
export function jumlahDalam(r: RincianTagihanKomponen, pilih: ReadonlySet<string>): { ditagih: number; terbayar: number } {
  let ditagih = 0, terbayar = 0
  for (const [kunci, b] of r.komponen) {
    if (!pilih.has(kunci)) continue
    ditagih  += b.ditagih
    terbayar += b.terbayar
  }
  return { ditagih, terbayar }
}

/** Tagihan ini memuat paling tidak satu komponen terpilih */
export const memuatKomponen = (r: RincianTagihanKomponen | undefined, pilih: ReadonlySet<string>): boolean =>
  !!r && [...r.komponen.keys()].some(k => pilih.has(k))

// ── Proyeksi tagihan ke komponen terpilih ────────────────────────────────────

interface TagihanBisaDiproyeksi<I> {
  id:             string
  status:         'lunas' | 'belum_bayar' | 'cicilan'
  total_nominal:  number
  terbayar:       number
  bayar_terakhir: string | null
  tagihan_item:   I[]
}

/**
 * Tagihan seolah-olah hanya berisi komponen terpilih: nilai, terbayar, tanggal bayar
 * terakhir, status, dan rinciannya — supaya semua rumus di lib/metrikLaporan bisa dipakai
 * apa adanya. null kalau tagihan ini tidak memuat komponen terpilih sama sekali. Tagihan
 * yang semua komponennya terpilih dikembalikan utuh, jadi "semua komponen" persis sama
 * dengan laporan tanpa pilihan.
 */
export function proyeksiTagihan<I extends { nama_komponen: string; komponen?: { nama: string } | null }, T extends TagihanBisaDiproyeksi<I>>(
  t:     T,
  r:     RincianTagihanKomponen | undefined,
  pilih: ReadonlySet<string>,
): T | null {
  if (!r) return null
  const kunciTagihan = [...r.komponen.keys()]
  if (!kunciTagihan.some(k => pilih.has(k))) return null
  if (kunciTagihan.every(k => pilih.has(k))) return t

  const { ditagih, terbayar } = jumlahDalam(r, pilih)
  let bayarTerakhir: string | null = null
  for (const [kunci, b] of r.komponen) {
    if (!pilih.has(kunci) || !b.bayarTerakhir) continue
    if (!bayarTerakhir || waktu(b.bayarTerakhir) > waktu(bayarTerakhir)) bayarTerakhir = b.bayarTerakhir
  }
  // Tagihan lunas tetap lunas di setiap komponennya; selain itu dinilai dari uang yang
  // jatuh ke komponen terpilih (SPP bisa sudah lunas walau komponen lain belum)
  const status: T['status'] = t.status === 'lunas' || (ditagih > 0 && terbayar >= ditagih)
    ? 'lunas'
    : terbayar > 0 ? 'cicilan' : 'belum_bayar'
  return {
    ...t,
    status,
    total_nominal:  ditagih,
    terbayar,
    bayar_terakhir: bayarTerakhir,
    tagihan_item:   t.tagihan_item.filter(i => pilih.has(kunciItemKomponen(i))),
  }
}

export function proyeksiSemua<I extends { nama_komponen: string; komponen?: { nama: string } | null }, T extends TagihanBisaDiproyeksi<I>>(
  rows:     T[],
  rincian:  Map<string, RincianTagihanKomponen>,
  pilih:    ReadonlySet<string>,
): T[] {
  const hasil: T[] = []
  for (const t of rows) {
    const p = proyeksiTagihan<I, T>(t, rincian.get(t.id), pilih)
    if (p) hasil.push(p)
  }
  return hasil
}

// ── Bukti transfer yang menunggu verifikasi ──────────────────────────────────

/**
 * Bagian tiap komponen dari bukti transfer yang belum diverifikasi, menurut pilihan wali
 * yang tersimpan bersama buktinya — urutan pembagian sama dengan saat diverifikasi
 * (lib/rincianKomponen). Bukti lama tanpa pilihan, atau kelebihan di atas sisa pilihannya,
 * dibagi menurut harga bersih rincian tagihan tempat bukti itu dicatat.
 */
export function bagiBuktiKeKunci(
  v: { nominal_diajukan: number; tagihan_id: string; pilihan: unknown },
  itemsPerTagihan: Map<string, ItemTagihanKas[]>,
): Map<string, number> {
  const hasil = new Map<string, number>()
  const tambah = (kunci: string, jumlah: number) => hasil.set(kunci, (hasil.get(kunci) ?? 0) + jumlah)

  let sisa = Math.round(Number(v.nominal_diajukan)) || 0
  const units = bacaPilihanTersimpan(v.pilihan)
  if (units) {
    for (const { unit, jumlah } of bagiPerUnit(units, sisa)) {
      const items = itemsPerTagihan.get(unit.tagihan_id) ?? []
      if (unit.tagihan_item_id) {
        const item = items.find(i => i.id === unit.tagihan_item_id)
        tambah(kunciKomponen(item?.nama_komponen ?? unit.nama_komponen ?? NAMA_LAINNYA), jumlah)
      } else {
        for (const [kunci, j] of bagiKeKunci({ jumlah, alokasi: null }, items)) tambah(kunci, j)
      }
      sisa -= jumlah
    }
  }
  if (sisa > 0) {
    for (const [kunci, j] of bagiKeKunci({ jumlah: sisa, alokasi: null }, itemsPerTagihan.get(v.tagihan_id) ?? [])) tambah(kunci, j)
  }
  return hasil
}

// ── Pilihan di modal ─────────────────────────────────────────────────────────

/**
 * Komponen yang bisa dicentang: semua komponen yang pernah ditagih sekolah ini. Yang
 * paling sering ditagih dulu — SPP ada di setiap tagihan bulanan, jadi selalu paling atas
 * walau uang gedung sekali bayar nilainya lebih besar — lalu nilai terbesar; "Lainnya"
 * paling akhir. Urutan ini juga urutan kolom di laporan. Ejaan dan warna dari daftar
 * komponen tagihan (yang terbaru menang).
 */
export function daftarOpsiKomponen(
  rincian: Iterable<RincianTagihanKomponen>,
  resmi:   { nama: string; kelas_warna: string | null }[],
): OpsiKomponen[] {
  const sering = new Map<string, number>()
  const total  = new Map<string, number>()
  const nama   = new Map<string, string>()
  for (const r of rincian) {
    for (const [kunci, b] of r.komponen) {
      sering.set(kunci, (sering.get(kunci) ?? 0) + 1)
      total.set(kunci, (total.get(kunci) ?? 0) + b.ditagih)
      if (!nama.has(kunci)) nama.set(kunci, r.nama.get(kunci) ?? kunci)
    }
  }

  const namaResmi  = new Map<string, string>()
  const warnaResmi = new Map<string, string>()
  for (const k of resmi) {
    const kunci = kunciKomponen(k.nama)
    if (!namaResmi.has(kunci)) namaResmi.set(kunci, k.nama.trim())
    if (!warnaResmi.has(kunci) && k.kelas_warna) warnaResmi.set(kunci, k.kelas_warna)
  }

  const lainnya = kunciKomponen(NAMA_LAINNYA)
  const urut = [...total.keys()].sort((a, b) =>
    Number(a === lainnya) - Number(b === lainnya)
    || (sering.get(b) ?? 0) - (sering.get(a) ?? 0)
    || (total.get(b) ?? 0) - (total.get(a) ?? 0)
    || (namaResmi.get(a) ?? nama.get(a) ?? a).localeCompare(namaResmi.get(b) ?? nama.get(b) ?? b, 'id'))
  const warna = petaWarnaKomponen(warnaResmi, urut)
  return urut.map(kunci => ({ kunci, nama: namaResmi.get(kunci) ?? nama.get(kunci) ?? kunci, warna: warna.get(kunci) ?? '#94A3B8' }))
}

/** Lebih dari satu komponen dan diminta dipisah */
export const pisahPerKomponen = (p: PilihanKomponen): boolean => p.mode === 'pisah' && p.kunci.length > 1

/** Komponen terpilih dalam urutan opsi */
export const komponenTerpilih = (p: PilihanKomponen, opsi: OpsiKomponen[]): OpsiKomponen[] =>
  opsi.filter(o => p.kunci.includes(o.kunci))

export interface KolomKomponen {
  label: string
  kunci: ReadonlySet<string>
}

/** Satu kolom per komponen (dipisah), atau satu kolom berisi semua komponen terpilih */
export function kolomKomponen(p: PilihanKomponen, opsi: OpsiKomponen[]): KolomKomponen[] {
  const dipilih = komponenTerpilih(p, opsi)
  if (pisahPerKomponen(p)) return dipilih.map(o => ({ label: o.nama, kunci: new Set([o.kunci]) }))
  return [{ label: 'Total', kunci: new Set(dipilih.map(o => o.kunci)) }]
}

/** Keterangan komponen di bawah judul laporan: "SPP", "SPP, Komite (per komponen)", … */
export function teksKomponen(p: PilihanKomponen, opsi: OpsiKomponen[]): string {
  const dipilih = komponenTerpilih(p, opsi)
  const pisah   = pisahPerKomponen(p) ? ' (per komponen)' : ''
  if (dipilih.length === opsi.length && dipilih.length > 1) return `Semua komponen${pisah}`
  const MAKS = 4
  const nama = dipilih.slice(0, MAKS).map(o => o.nama).join(', ')
  const lebih = dipilih.length > MAKS ? `, +${dipilih.length - MAKS} lainnya` : ''
  return `${nama}${lebih}${pisah}`
}

/** Akhiran nama berkas: kosong kalau semua komponen, "_SPP" kalau hanya SPP, … */
export function akhiranNamaFile(p: PilihanKomponen, opsi: OpsiKomponen[]): string {
  const dipilih = komponenTerpilih(p, opsi)
  if (dipilih.length === opsi.length) return ''
  if (dipilih.length > 3) return '_Beberapa_Komponen'
  return dipilih
    .map(o => `_${o.nama.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')}`)
    .join('')
}

// Pilihan terakhir diingat per browser dan per sekolah — bendahara yang selalu mengunduh
// SPP saja tidak perlu mencentang ulang. Hanya kenyamanan: tanpa penyimpanan, bawaannya
// semua komponen.
const kunciSimpan = (sekolahId: string) => `siku_laporan_komponen_${sekolahId}`

export function pilihanAwal(sekolahId: string, opsi: OpsiKomponen[]): PilihanKomponen {
  const semua: PilihanKomponen = { kunci: opsi.map(o => o.kunci), mode: 'total' }
  try {
    const raw = window.localStorage.getItem(kunciSimpan(sekolahId))
    if (!raw) return semua
    const isi = JSON.parse(raw) as { kunci?: unknown; mode?: unknown }
    const kunci = Array.isArray(isi.kunci)
      ? opsi.map(o => o.kunci).filter(k => (isi.kunci as unknown[]).includes(k))
      : []
    if (kunci.length === 0) return semua
    return { kunci, mode: isi.mode === 'pisah' ? 'pisah' : 'total' }
  } catch {
    return semua
  }
}

export function simpanPilihanKomponen(sekolahId: string, p: PilihanKomponen): void {
  try {
    window.localStorage.setItem(kunciSimpan(sekolahId), JSON.stringify(p))
  } catch {
    // Penyimpanan diblokir — pilihan tidak diingat, unduhan tetap jalan
  }
}
