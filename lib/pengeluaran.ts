import { tanggalWIB } from './metrikLaporan'
import { BULAN_PANJANG } from './formatLaporan'

// Pengeluaran sekolah — subfitur 'pengeluaran' (lib/fiturSekolah). Sejak 27 Okt 2026:
// Jenis (kategori buatan bendahara), Nama, Tanggal, Volume (angka) + Satuan (teks, opsional),
// Biaya Satuan, Jumlah (Volume × Biaya Satuan, boleh diubah kalau beda dengan nota), dan
// sumber dana: komponen tagihan yang membiayainya, berjumlah tepat sama dengan Jumlah
// (lib/kasKomponen). Data sebelum itu memakai dua besaran — Volume "18 hari" × Satuan
// "14 guru" (kolom kuantitas*) — dan tetap ditampilkan apa adanya sampai diubah.

export const BUCKET_FOTO_PENGELUARAN = 'bukti-pengeluaran'

export interface KategoriPengeluaran {
  id:     string
  nama:   string
  urutan: number
}

/** Satu komponen yang membiayai sebuah pengeluaran (tabel pengeluaran_sumber_dana) */
export interface SumberDana {
  /** Komponen tagihan saat dicatat — hanya untuk warna; kas dikelompokkan menurut nama */
  komponen_id:   string | null
  nama_komponen: string
  nominal:       number
}

export interface Pengeluaran {
  id:               string
  kategori_id:      string
  tanggal:          string
  keterangan:       string
  volume:           number | null
  volume_satuan:    string | null
  /** Besaran kedua format lama ("14 guru"); null untuk data sejak 27 Okt 2026 */
  kuantitas:        number | null
  kuantitas_satuan: string | null
  biaya_satuan:     number | null
  jumlah:           number
  foto_path:        string | null
  created_at:       string
  sumber_dana:      SumberDana[]
}

export const KATEGORI_SELECT    = 'id, nama, urutan'
export const PENGELUARAN_SELECT = 'id, kategori_id, tanggal, keterangan, volume, volume_satuan, kuantitas, kuantitas_satuan, biaya_satuan, jumlah, foto_path, created_at'
/** Beserta sumber dananya — butuh tabel pengeluaran_sumber_dana (SQL 27 Okt 2026) */
export const PENGELUARAN_SELECT_SUMBER = `${PENGELUARAN_SELECT}, sumber_dana:pengeluaran_sumber_dana(komponen_id, nama_komponen, nominal)`

export const MAKS_KETERANGAN   = 200
export const MAKS_NAMA_SATUAN  = 30
export const MAKS_NAMA_KATEGORI = 60

const angkaAtauNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

/** Baris dari PostgREST: numeric/bigint bisa datang sebagai string; sumber dana bisa belum ada */
export const bacaPengeluaran = (b: Omit<Pengeluaran, 'sumber_dana'> & { sumber_dana?: SumberDana[] | null }): Pengeluaran => ({
  ...b,
  volume:       angkaAtauNull(b.volume),
  kuantitas:    angkaAtauNull(b.kuantitas),
  biaya_satuan: angkaAtauNull(b.biaya_satuan),
  jumlah:       Number(b.jumlah),
  sumber_dana:  (b.sumber_dana ?? []).map(s => ({ komponen_id: s.komponen_id, nama_komponen: s.nama_komponen, nominal: Number(s.nominal) })),
})

export const urutkanKategori = (daftar: KategoriPengeluaran[]): KategoriPengeluaran[] =>
  [...daftar].sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama, 'id'))

/** Volume × Satuan × Biaya Satuan; null kalau Biaya Satuan kosong. Angka yang kosong dihitung 1. */
export function hitungJumlah(volume: number | null, kuantitas: number | null, biayaSatuan: number | null): number | null {
  if (biayaSatuan === null) return null
  return Math.round((volume ?? 1) * (kuantitas ?? 1) * biayaSatuan)
}

/** "18 hari", "4 buah", "1,5 kg"; satuan saja kalau angkanya kosong */
export function teksBesaran(angka: number | null, satuan: string | null): string {
  const s = satuan?.trim() ?? ''
  if (angka === null) return s
  const a = angka.toLocaleString('id-ID', { maximumFractionDigits: 2 })
  return s ? `${a} ${s}` : a
}

/** Dicatat dengan format lama dua besaran (Volume "18 hari" × Satuan "14 guru") */
export const formatLama = (p: Pick<Pengeluaran, 'kuantitas' | 'kuantitas_satuan'>): boolean =>
  p.kuantitas !== null || !!p.kuantitas_satuan?.trim()

/** Kolom Volume: angkanya saja; format lama ditampilkan utuh "18 hari × 14 guru" */
export const teksVolume = (p: Pick<Pengeluaran, 'volume' | 'volume_satuan' | 'kuantitas' | 'kuantitas_satuan'>): string =>
  formatLama(p)
    ? [teksBesaran(p.volume, p.volume_satuan), teksBesaran(p.kuantitas, p.kuantitas_satuan)].filter(Boolean).join(' × ')
    : p.volume === null ? '' : p.volume.toLocaleString('id-ID', { maximumFractionDigits: 2 })

/** Kolom Satuan: nama satuannya; kosong untuk format lama (sudah di kolom Volume) */
export const teksSatuan = (p: Pick<Pengeluaran, 'volume_satuan' | 'kuantitas' | 'kuantitas_satuan'>): string =>
  formatLama(p) ? '' : p.volume_satuan?.trim() ?? ''

// ── Isian formulir ───────────────────────────────────────────────────────────

/** Angka desimal dari isian ("1,5" atau "1.5"); null kalau kosong, NaN kalau tidak sah */
export function bacaAngkaIsian(teks: string): number | null {
  const t = teks.trim()
  if (!t) return null
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return NaN
  return Number(t.replace(',', '.'))
}

/** Angka ke isian formulir: desimal memakai koma */
export const angkaKeIsian = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','))

/** Isian Rupiah hanya digit; tampil dengan titik ribuan */
export const rupiahKeIsian = (digit: string): string => digit.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// ── Tanggal & bulan (WIB) ────────────────────────────────────────────────────

export interface Bulan { bulan: number; tahun: number }

export const kunciBulan = (b: Bulan): string => `${b.tahun}-${b.bulan}`
export const labelBulan = (b: Bulan): string => `${BULAN_PANJANG[b.bulan]} ${b.tahun}`

/** Tanggal kalender 'YYYY-MM-DD' → pukul 00.00 WIB hari itu, ISO */
export const tanggalKeIso = (tanggal: string): string => new Date(`${tanggal}T00:00:00+07:00`).toISOString()

/** Pukul 00.00 WIB tanggal 1 bulan itu, ISO */
export const awalBulanIso = (b: Bulan): string =>
  tanggalKeIso(`${b.tahun}-${String(b.bulan).padStart(2, '0')}-01`)

export const bulanBerikut = (b: Bulan): Bulan => (b.bulan === 12 ? { bulan: 1, tahun: b.tahun + 1 } : { bulan: b.bulan + 1, tahun: b.tahun })

/** Bulan kalender WIB sebuah waktu */
export function bulanDari(iso: string | Date): Bulan {
  const [tahun, bulan] = tanggalWIB(typeof iso === 'string' ? new Date(iso) : iso).split('-').map(Number)
  return { bulan, tahun }
}

export const bacaKunciBulan = (k: string): Bulan => {
  const [tahun, bulan] = k.split('-').map(Number)
  return { bulan, tahun }
}

export const indeksBulan = (b: Bulan) => b.tahun * 12 + b.bulan

export const bulanSama = (a: Bulan, b: Bulan) => indeksBulan(a) === indeksBulan(b)

// ── Periode (tahun ajaran) ───────────────────────────────────────────────────

export interface PeriodeKas {
  id:      string
  nama:    string
  /** 'YYYY-MM-DD' */
  mulai:   string
  selesai: string
  aktif:   boolean
}

/** Sekolah tanpa tahun ajaran memakai tahun kalender berjalan */
export function periodeTahunKalender(sekarang: Date): PeriodeKas {
  const { tahun } = bulanDari(sekarang)
  return { id: `tahun-${tahun}`, nama: `Tahun ${tahun}`, mulai: `${tahun}-01-01`, selesai: `${tahun}-12-31`, aktif: true }
}

/** Semua bulan dari bulan mulai sampai bulan selesai periode, berurutan */
export function bulanDalamPeriode(p: PeriodeKas): Bulan[] {
  const [ty, tm] = p.mulai.split('-').map(Number)
  const [sy, sm] = p.selesai.split('-').map(Number)
  const akhir = { bulan: sm, tahun: sy }
  const hasil: Bulan[] = []
  for (let b = { bulan: tm, tahun: ty }; indeksBulan(b) <= indeksBulan(akhir) && hasil.length < 36; b = bulanBerikut(b)) hasil.push(b)
  return hasil
}

/** Bulan awal tampilan rincian: bulan ini kalau masuk periode, selain itu bulan terdekat */
export function bulanAwal(daftar: Bulan[], sekarang: Date): Bulan | null {
  if (daftar.length === 0) return null
  const ini = bulanDari(sekarang)
  if (daftar.some(b => bulanSama(b, ini))) return ini
  return indeksBulan(ini) < indeksBulan(daftar[0]) ? daftar[0] : daftar[daftar.length - 1]
}

// ── Rincian per kategori ─────────────────────────────────────────────────────

export interface KelompokPengeluaran {
  kategori: KategoriPengeluaran
  baris:    Pengeluaran[]
  total:    number
}

/**
 * Pengeluaran dikelompokkan per kategori menurut urutan kategori. Hanya kategori yang punya
 * pengeluaran (keputusan user 27 Okt 2026); kategori lain tidak ditampilkan. Pengeluaran
 * yang kategorinya tidak ada lagi di daftar dikelompokkan sebagai "Tanpa jenis".
 */
export function kelompokkanPerKategori(kategori: KategoriPengeluaran[], baris: Pengeluaran[]): KelompokPengeluaran[] {
  const perKategori = new Map<string, Pengeluaran[]>()
  for (const b of baris) perKategori.set(b.kategori_id, [...(perKategori.get(b.kategori_id) ?? []), b])
  const dikenal = new Set(kategori.map(k => k.id))
  const tanpaJenis = baris.filter(b => !dikenal.has(b.kategori_id))
  const urutTanggal = (a: Pengeluaran, b: Pengeluaran) =>
    new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  const kelompok = urutkanKategori(kategori).map(k => {
    const isi = (perKategori.get(k.id) ?? []).sort(urutTanggal)
    return { kategori: k, baris: isi, total: isi.reduce((s, b) => s + b.jumlah, 0) }
  })
  if (tanpaJenis.length > 0) {
    kelompok.push({
      kategori: { id: '', nama: 'Tanpa jenis', urutan: Number.MAX_SAFE_INTEGER },
      baris:    tanpaJenis.sort(urutTanggal),
      total:    tanpaJenis.reduce((s, b) => s + b.jumlah, 0),
    })
  }
  return kelompok.filter(k => k.baris.length > 0)
}
