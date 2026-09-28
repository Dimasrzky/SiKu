import { batasJatuhTempo, lewatJatuhTempo, tanpaKewajiban, type WaktuTagihan } from './statusTagihan'

// Rumus metrik laporan — satu-satunya sumber. Level sekolah memakainya sekarang;
// level jenjang, kelas, dan siswa (drill-down) cukup menyaring baris yang sama,
// rumusnya tidak boleh ditulis ulang di tempat lain.
// Definisi mengikuti bagian "Definisi metrik" di Draft Pengembangan Fitur Laporan.

/** Kolom tagihan yang dibutuhkan metrik, sebelum digabung dengan pembayarannya. */
export interface TagihanDasar extends WaktuTagihan {
  id:            string
  siswa_id:      string
  /** Snapshot kelas saat tagihan dibuat — null untuk tagihan tahun ajaran lama */
  kelas_id:      string | null
  total_nominal: number
  status:        string
  is_alumni:     boolean
}

export interface PembayaranDasar {
  tagihan_id:    string
  jumlah:        number
  tanggal_bayar: string
}

export interface KolomPembayaran {
  /** Jumlah seluruh pembayaran tagihan ini */
  terbayar:       number
  /** tanggal_bayar paling akhir. Untuk tagihan lunas inilah tanggal lunasnya —
   *  pada cicilan berarti tanggal cicilan terakhir. */
  bayar_terakhir: string | null
}

export type TagihanMetrik = TagihanDasar & KolomPembayaran

/** Tempelkan total pembayaran dan tanggal bayar terakhir ke setiap tagihan. */
export function gabungPembayaran<T extends TagihanDasar>(
  tagihan: T[],
  pembayaran: PembayaranDasar[],
): (T & KolomPembayaran)[] {
  const perTagihan = new Map<string, KolomPembayaran>()
  for (const p of pembayaran) {
    const cur = perTagihan.get(p.tagihan_id) ?? { terbayar: 0, bayar_terakhir: null }
    cur.terbayar += p.jumlah
    if (!cur.bayar_terakhir || new Date(p.tanggal_bayar).getTime() > new Date(cur.bayar_terakhir).getTime()) {
      cur.bayar_terakhir = p.tanggal_bayar
    }
    perTagihan.set(p.tagihan_id, cur)
  }
  return tagihan.map(t => ({ ...t, ...(perTagihan.get(t.id) ?? { terbayar: 0, bayar_terakhir: null }) }))
}

// ── Tanggal ──────────────────────────────────────────────────────────────────
// Telat dan umur tunggakan dihitung per tanggal kalender WIB, bukan per 24 jam:
// membayar pukul 07.00 sehari setelah jatuh tempo tetap telat 1 hari.

const ZONA = 'Asia/Jakarta'

/** Tanggal kalender WIB, 'YYYY-MM-DD' */
export const tanggalWIB = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: ZONA })

/** Selisih hari kalender WIB dari `dari` ke `ke` — positif kalau `ke` lebih akhir. */
export function selisihHari(dari: Date, ke: Date): number {
  const hariKe = (d: Date) => {
    const [y, m, h] = tanggalWIB(d).split('-').map(Number)
    return Date.UTC(y, m - 1, h)
  }
  return Math.round((hariKe(ke) - hariKe(dari)) / 86_400_000)
}

// ── Predikat ─────────────────────────────────────────────────────────────────

const sisaTagihan = (t: TagihanMetrik) => Math.max(0, t.total_nominal - t.terbayar)
const sudahLunas  = (t: TagihanMetrik) => t.status === 'lunas'

/**
 * Tagihan yang sudah masuk hitungan jatuh tempo: akhir hari jatuh temponya sudah
 * lewat, atau siswanya sudah alumni — aturan yang sama dengan statusEfektif.
 * Hari jatuh tempo itu sendiri belum dihitung, orang tua masih punya waktu.
 */
export const sudahJatuhTempo = (t: TagihanMetrik, sekarang: Date): boolean =>
  t.is_alumni || lewatJatuhTempo(t, sekarang)

/** Tunggakan berjalan: sudah jatuh tempo, belum lunas, dan masih bersisa. */
export const adalahTunggakan = (t: TagihanMetrik, sekarang: Date): boolean =>
  !tanpaKewajiban(t.total_nominal) && !sudahLunas(t) && sisaTagihan(t) > 0 && sudahJatuhTempo(t, sekarang)

// ── Ringkasan ────────────────────────────────────────────────────────────────

export interface RingkasanMetrik {
  /** Nilai tagihan yang sudah jatuh tempo — penyebut tingkat pelunasan */
  nilaiJatuhTempo:    number
  /** Uang terbayar untuk tagihan itu, dibatasi nilai tiap tagihan */
  terbayarJatuhTempo: number
  /** 0–100; null kalau belum ada tagihan yang jatuh tempo */
  tingkatPelunasan:   number | null
  /** Sisa belum dibayar dari tagihan yang belum jatuh tempo */
  akanMasuk:          number
  tunggakanBerjalan:  number
  siswaMenunggak:     number
  /** Tagihan jatuh tempo yang bisa dinilai ketepatan waktunya — penyebutnya */
  jumlahDinilai:      number
  jumlahTepatWaktu:   number
  /** 0–100; null kalau belum ada tagihan yang jatuh tempo */
  ketepatanWaktu:     number | null
  /** Tagihan yang lunas setelah jatuh tempo */
  jumlahTelat:        number
  rataHariTelat:      number | null
}

const persen = (bagian: number, total: number): number | null => (total > 0 ? (bagian / total) * 100 : null)

/**
 * - Tingkat pelunasan = terbayar ÷ nilai tagihan yang sudah jatuh tempo. Terbayar
 *   dibatasi nilai tiap tagihan, jadi bayar di muka atau kelebihan bayar tidak
 *   membuatnya lewat 100%.
 * - Ketepatan waktu = tagihan lunas paling lambat hari jatuh tempo ÷ tagihan jatuh
 *   tempo. Yang belum lunas atau baru dicicil ikut di penyebut sebagai tidak tepat.
 * - Rata-rata hari telat = rata-rata (tanggal lunas − jatuh tempo) untuk tagihan
 *   yang lunas terlambat.
 * Tagihan Rp 0 (beasiswa penuh) tidak ikut: tidak ada yang perlu dibayar.
 */
export function hitungRingkasan(rows: TagihanMetrik[], sekarang: Date): RingkasanMetrik {
  let nilaiJatuhTempo = 0, terbayarJatuhTempo = 0, akanMasuk = 0, tunggakanBerjalan = 0
  let jumlahDinilai = 0, jumlahTepatWaktu = 0, jumlahTelat = 0, totalHariTelat = 0
  const siswaMenunggak = new Set<string>()

  for (const t of rows) {
    if (tanpaKewajiban(t.total_nominal)) continue

    if (!sudahJatuhTempo(t, sekarang)) {
      if (!sudahLunas(t)) akanMasuk += sisaTagihan(t)
      continue
    }

    nilaiJatuhTempo    += t.total_nominal
    terbayarJatuhTempo += Math.min(t.terbayar, t.total_nominal)
    if (adalahTunggakan(t, sekarang)) {
      tunggakanBerjalan += sisaTagihan(t)
      siswaMenunggak.add(t.siswa_id)
    }

    // Lunas tanpa satu pun catatan pembayaran tidak punya tanggal lunas — tidak
    // bisa dinilai tepat atau telat, jadi dikeluarkan dari kedua sisi pecahan
    if (sudahLunas(t) && !t.bayar_terakhir) continue
    jumlahDinilai += 1
    if (!sudahLunas(t)) continue

    const hariTelat = selisihHari(batasJatuhTempo(t), new Date(t.bayar_terakhir!))
    if (hariTelat <= 0) {
      jumlahTepatWaktu += 1
    } else {
      jumlahTelat    += 1
      totalHariTelat += hariTelat
    }
  }

  return {
    nilaiJatuhTempo,
    terbayarJatuhTempo,
    tingkatPelunasan: persen(terbayarJatuhTempo, nilaiJatuhTempo),
    akanMasuk,
    tunggakanBerjalan,
    siswaMenunggak:   siswaMenunggak.size,
    jumlahDinilai,
    jumlahTepatWaktu,
    ketepatanWaktu:   persen(jumlahTepatWaktu, jumlahDinilai),
    jumlahTelat,
    rataHariTelat:    jumlahTelat > 0 ? totalHariTelat / jumlahTelat : null,
  }
}

/**
 * Uang yang benar-benar diterima untuk tagihan-tagihan ini, kapan pun dibayarnya.
 * Tidak dibatasi nilai tagihan seperti di tingkat pelunasan — ini arus kas.
 * `transaksi` = jumlah tagihan yang sudah menerima pembayaran.
 */
export function hitungPemasukan(rows: KolomPembayaran[]): { total: number; transaksi: number } {
  return {
    total:     rows.reduce((s, t) => s + t.terbayar, 0),
    transaksi: rows.filter(t => t.terbayar > 0).length,
  }
}

// ── Umur tunggakan ───────────────────────────────────────────────────────────

export interface KelompokUmur {
  label:         string
  nominal:       number
  jumlahTagihan: number
  jumlahSiswa:   number
}

const BATAS_UMUR = [
  { label: '1–30 hari',  sampai: 30 },
  { label: '31–60 hari', sampai: 60 },
  { label: '61–90 hari', sampai: 90 },
  { label: '> 90 hari',  sampai: Infinity },
]

/** Umur = hari ini − tanggal jatuh tempo, dikelompokkan; nilainya sisa tunggakan. */
export function umurTunggakan(rows: TagihanMetrik[], sekarang: Date): KelompokUmur[] {
  const kelompok = BATAS_UMUR.map(b => ({ label: b.label, nominal: 0, jumlahTagihan: 0, siswa: new Set<string>() }))
  for (const t of rows) {
    if (!adalahTunggakan(t, sekarang)) continue
    // Alumni bisa menunggak sebelum tanggal jatuh temponya lewat — masuk kelompok termuda
    const umur = Math.max(1, selisihHari(batasJatuhTempo(t), sekarang))
    const k = kelompok[BATAS_UMUR.findIndex(b => umur <= b.sampai)]
    k.nominal       += sisaTagihan(t)
    k.jumlahTagihan += 1
    k.siswa.add(t.siswa_id)
  }
  return kelompok.map(({ siswa, ...k }) => ({ ...k, jumlahSiswa: siswa.size }))
}

// ── Tren tagihan vs realisasi ────────────────────────────────────────────────

export interface TitikTren {
  bulan:    number
  tahun:    number
  /** Nilai tagihan yang jatuh tempo di bulan ini */
  tagihan:  number
  /** Terbayar untuk tagihan itu — kapan pun uangnya masuk, dibatasi nilai tagihan */
  terbayar: number
  /** Ketepatan waktu tagihan bulan ini (0–100); null kalau belum ada yang lewat jatuh tempo */
  ketepatanWaktu: number | null
  /** Bulan berjalan: sebagian tagihannya mungkin belum lewat jatuh tempo */
  berjalan: boolean
}

/**
 * Dikelompokkan menurut bulan jatuh tempo, bukan tanggal uang diterima. Karena itu
 * batang bulan lalu masih bisa naik ketika tunggakannya dilunasi belakangan.
 *
 * Berakhir di bulan `akhir` — akhir tahun ajaran arsip yang sedang dilihat — tapi
 * tidak pernah melewati bulan ini, jadi tahun ajaran aktif tetap 12 bulan terakhir.
 */
export function trenTagihanRealisasi<T extends TagihanMetrik>(
  rows: T[],
  sekarang: Date,
  akhir: Date = sekarang,
  jumlahBulan = 12,
): TitikTren[] {
  const [tahunIni, bulanIni]     = tanggalWIB(sekarang).split('-').map(Number)
  const [tahunAkhir, bulanAkhir] = tanggalWIB(akhir < sekarang ? akhir : sekarang).split('-').map(Number)
  const titik: TitikTren[] = []
  for (let mundur = jumlahBulan - 1; mundur >= 0; mundur--) {
    const d     = new Date(Date.UTC(tahunAkhir, bulanAkhir - 1 - mundur, 1))
    const bulan = d.getUTCMonth() + 1
    const tahun = d.getUTCFullYear()
    titik.push({ bulan, tahun, tagihan: 0, terbayar: 0, ketepatanWaktu: null, berjalan: tahun === tahunIni && bulan === bulanIni })
  }

  const indeks   = new Map(titik.map((p, i) => [`${p.tahun}-${p.bulan}`, i]))
  const perBulan = titik.map((): T[] => [])
  for (const t of rows) {
    if (tanpaKewajiban(t.total_nominal)) continue
    const [tahun, bulan] = tanggalWIB(batasJatuhTempo(t)).split('-').map(Number)
    const i = indeks.get(`${tahun}-${bulan}`)
    if (i === undefined) continue
    titik[i].tagihan  += t.total_nominal
    titik[i].terbayar += Math.min(t.terbayar, t.total_nominal)
    perBulan[i].push(t)
  }
  // Ketepatan per bulan memakai hitungRingkasan yang sama dengan kartu — satu rumus
  perBulan.forEach((daftar, i) => { titik[i].ketepatanWaktu = hitungRingkasan(daftar, sekarang).ketepatanWaktu })
  return titik
}

// ── Status siswa ─────────────────────────────────────────────────────────────

/**
 * Ambang status siswa — usulan awal draft, perlu divalidasi ke bendahara dan kelak
 * diatur per sekolah. Satu-satunya tempat angka ini ditulis.
 */
export const AMBANG_STATUS_SISWA = {
  /** Ketepatan waktu minimal (%) untuk Lancar */
  lancarMinKetepatan:     90,
  /** Jumlah tagihan menunggak yang membuat siswa Tertunggak */
  tertunggakMinTagihan:   2,
  /** Umur tunggakan (hari) yang membuat siswa Tertunggak meski baru satu tagihan */
  tertunggakMaksUmurHari: 60,
} as const

export type StatusSiswa = 'tertunggak' | 'perlu_perhatian' | 'lancar' | 'belum_dinilai'

export const URUTAN_STATUS_SISWA: StatusSiswa[] = ['tertunggak', 'perlu_perhatian', 'lancar', 'belum_dinilai']

export interface PenilaianSiswa {
  status:          StatusSiswa
  ringkasan:       RingkasanMetrik
  /** Tagihan menunggak, terlama dulu */
  tunggakan:       TagihanMetrik[]
  umurTertuaHari:  number
}

/**
 * Setiap siswa masuk tepat satu status, diperiksa berurutan:
 * 1. Tertunggak      — ≥2 tagihan menunggak, atau ada tunggakan berumur >60 hari
 * 2. Belum dinilai   — belum ada tagihan yang jatuh tempo
 * 3. Lancar          — ketepatan waktu ≥90% dan tidak ada tunggakan
 * 4. Perlu perhatian — sisanya: satu tunggakan muda, atau keterlambatan berulang
 * `rows` = tagihan satu siswa dalam filter yang sedang dipilih.
 */
export function nilaiSiswa<T extends TagihanMetrik>(rows: T[], sekarang: Date): PenilaianSiswa & { tunggakan: T[] } {
  const ringkasan = hitungRingkasan(rows, sekarang)
  const tunggakan = rows
    .filter(t => adalahTunggakan(t, sekarang))
    .sort((a, b) => batasJatuhTempo(a).getTime() - batasJatuhTempo(b).getTime())
  const umurTertuaHari = tunggakan.length > 0 ? Math.max(0, selisihHari(batasJatuhTempo(tunggakan[0]), sekarang)) : 0
  const A = AMBANG_STATUS_SISWA

  let status: StatusSiswa
  if (tunggakan.length >= A.tertunggakMinTagihan || umurTertuaHari > A.tertunggakMaksUmurHari) status = 'tertunggak'
  else if (ringkasan.jumlahDinilai === 0 && tunggakan.length === 0)                            status = 'belum_dinilai'
  else if (tunggakan.length === 0 && (ringkasan.ketepatanWaktu ?? 0) >= A.lancarMinKetepatan)  status = 'lancar'
  else                                                                                         status = 'perlu_perhatian'

  return { status, ringkasan, tunggakan, umurTertuaHari }
}

// ── Kategori sel heatmap ─────────────────────────────────────────────────────

export type KategoriBulan = 'tepat_waktu' | 'telat' | 'cicilan' | 'belum_bayar' | 'belum_jatuh_tempo' | 'tanpa_kewajiban'

/**
 * Keadaan satu tagihan untuk heatmap siswa × bulan. Cicilan mencakup yang sudah
 * maupun belum lewat jatuh tempo — sisanya dibaca dari tooltip dan daftar siswa.
 */
export function kategoriBulan(t: TagihanMetrik, sekarang: Date): KategoriBulan {
  if (tanpaKewajiban(t.total_nominal)) return 'tanpa_kewajiban'
  if (sudahLunas(t)) {
    if (!t.bayar_terakhir) return 'tepat_waktu'
    return selisihHari(batasJatuhTempo(t), new Date(t.bayar_terakhir)) <= 0 ? 'tepat_waktu' : 'telat'
  }
  if (t.terbayar > 0) return 'cicilan'
  return sudahJatuhTempo(t, sekarang) ? 'belum_bayar' : 'belum_jatuh_tempo'
}
