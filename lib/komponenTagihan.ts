// Aturan penagihan komponen — satu-satunya sumber kebenaran.
// Dipakai bersama oleh generate tagihan, rekalkulasi total di halaman tagihan aktif,
// dan API recalculate-tagihan, supaya ketiganya tidak pernah memakai aturan berbeda.

export type KomponenJenis = 'rutin_bulanan' | 'per_semester' | 'sekali_bayar'

export const JENIS_LABEL: Record<string, string> = {
  rutin_bulanan: 'Rutin bulanan',
  sekali_bayar:  'Sekali bayar',
  per_semester:  'Per semester',
}

export const JENIS_WARNA: Record<string, string> = {
  rutin_bulanan: '#69C183',
  sekali_bayar:  '#3C75B7',
  per_semester:  '#7D7ADC',
}

/** Urutan periode untuk membandingkan bulan/tahun tagihan. */
export const periodeIndex = (bulan: number, tahun: number): number => tahun * 12 + bulan

const periodeDariISO = (iso: string): number => {
  const d = new Date(iso)
  return periodeIndex(d.getMonth() + 1, d.getFullYear())
}

/** Batas tahun ajaran beserta pembagian semesternya. */
export interface PeriodeTahunAjaran {
  tanggal_mulai:           string
  tanggal_selesai:         string
  semester_ganjil_mulai:   string
  semester_ganjil_selesai: string
  semester_genap_mulai:    string
  semester_genap_selesai:  string
}

export const TA_PERIODE_SELECT =
  'tanggal_mulai, tanggal_selesai, semester_ganjil_mulai, semester_ganjil_selesai, semester_genap_mulai, semester_genap_selesai'

/**
 * `selalu` — ditagih tiap bulan tanpa syarat.
 * `sekali` — ditagih sekali saja dalam rentang periode [mulai, selesai].
 * `lewati` — bulan ini di luar cakupan, jangan ditagih.
 */
export type Cakupan =
  | { mode: 'selalu' }
  | { mode: 'sekali'; mulai: number; selesai: number }
  | { mode: 'lewati' }

/**
 * Cakupan penagihan sebuah komponen untuk bulan tertentu:
 * - rutin_bulanan → tiap bulan
 * - per_semester  → sekali dalam semester yang memuat bulan tsb
 * - sekali_bayar  → sekali dalam satu tahun ajaran
 *
 * Batas semester dibaca dari tanggal yang dikonfigurasi di tahun ajaran, bukan
 * bulan yang dipatok — sekolah bebas memakai kalender akademiknya sendiri.
 */
export function cakupanTagih(
  jenis: string,
  bulan: number,
  tahun: number,
  ta: PeriodeTahunAjaran | null,
): Cakupan {
  if (jenis === 'rutin_bulanan') return { mode: 'selalu' }
  if (!ta) return { mode: 'lewati' }

  const kini = periodeIndex(bulan, tahun)

  if (jenis === 'per_semester') {
    const semester = [
      { mulai: periodeDariISO(ta.semester_ganjil_mulai), selesai: periodeDariISO(ta.semester_ganjil_selesai) },
      { mulai: periodeDariISO(ta.semester_genap_mulai),  selesai: periodeDariISO(ta.semester_genap_selesai)  },
    ].find(s => kini >= s.mulai && kini <= s.selesai)
    return semester ? { mode: 'sekali', mulai: semester.mulai, selesai: semester.selesai } : { mode: 'lewati' }
  }

  if (jenis === 'sekali_bayar') {
    const mulai   = periodeDariISO(ta.tanggal_mulai)
    const selesai = periodeDariISO(ta.tanggal_selesai)
    return kini >= mulai && kini <= selesai ? { mode: 'sekali', mulai, selesai } : { mode: 'lewati' }
  }

  return { mode: 'lewati' }
}

/** Riwayat penagihan: `${siswaId}|${komponenId}` → daftar periode bulan yang pernah ditagih. */
export type RiwayatTagih = Map<string, number[]>

export const kunciRiwayat = (siswaId: string, komponenId: string): string => `${siswaId}|${komponenId}`

/**
 * Apakah komponen ditagihkan pada bulan ini untuk siswa ini.
 *
 * Kuncinya "sudah pernah ditagihkan dalam cakupan", bukan "sudah dibayar".
 * Mengunci pada status bayar akan menagihkan ulang kewajiban yang sama tiap bulan
 * selama belum lunas — komponen yang menunggak tetap melekat pada tagihan asalnya
 * dan ditampilkan lewat blok tunggakan, bukan ditagih ulang.
 */
export function komponenDitagihkan(
  jenis: string,
  bulan: number,
  tahun: number,
  ta: PeriodeTahunAjaran | null,
  siswaId: string,
  komponenId: string,
  riwayat: RiwayatTagih,
): boolean {
  const cakupan = cakupanTagih(jenis, bulan, tahun, ta)
  if (cakupan.mode === 'selalu') return true
  if (cakupan.mode === 'lewati') return false

  const pernah = riwayat.get(kunciRiwayat(siswaId, komponenId)) ?? []
  return !pernah.some(p => p >= cakupan.mulai && p <= cakupan.selesai)
}

/** Bangun peta riwayat dari baris tagihan + tagihan_item milik satu sekolah. */
export function bangunRiwayatTagih(
  rows: { siswa_id: string; bulan: number; tahun: number; tagihan_item: { komponen_id: string | null }[] }[],
): RiwayatTagih {
  const riwayat: RiwayatTagih = new Map()
  for (const r of rows) {
    const periode = periodeIndex(r.bulan, r.tahun)
    for (const item of (r.tagihan_item ?? [])) {
      if (!item.komponen_id) continue
      const kunci = kunciRiwayat(r.siswa_id, item.komponen_id)
      const list  = riwayat.get(kunci) ?? []
      list.push(periode)
      riwayat.set(kunci, list)
    }
  }
  return riwayat
}
