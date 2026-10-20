import { komponenDitagihkan, type PeriodeTahunAjaran, type RiwayatTagih } from './komponenTagihan'

// Aturan hitung ulang tagihan yang SUDAH terbit — satu-satunya sumber kebenaran. Dipakai
// /api/recalculate-tagihan (yang menulis) dan halaman Tagihan Aktif (yang menampilkan,
// lalu meminta route itu menulis). Penerbitan tagihan baru ada di lib/generateTagihan.
//
// Diputuskan 2 Okt 2026:
// - yang dihitung ulang hanya tagihan bulan berjalan yang belum lunas;
// - komponen individu yang ditambahkan setelah tagihan terbit dicatat di rincian tagihan
//   itu (tagihan_item), supaya tidak ditagihkan lagi bulan depan dan rincian = total;
// - tagihan lunas dan tagihan bulan-bulan lalu tidak pernah diubah — beasiswa atau
//   komponen baru untuk siswanya berlaku mulai tagihan berikutnya.
//
// Diputuskan 20 Okt 2026: komponen individu yang komponennya juga ada di paket kelas
// siswa MENGGANTI nominal paket untuk siswa itu (mis. SPP 250rb, paket 200rb), bukan
// ditambahkan. Nominal rincian tagihan bulan berjalan yang belum lunas mengikuti keadaan
// hari ini: komponen individu siswa, lalu paket kelasnya — jadi mengubah atau menghapus
// komponen individu, atau mengubah nominal paket, ikut menyesuaikan tagihan itu.
//
// Beasiswa, komponen individu, dan paket yang dipakai adalah keadaan HARI INI. Itu sebabnya
// cakupannya sempit: memakainya pada bulan lalu mencabut potongan dari bulan saat
// beasiswa masih berlaku, atau menambah komponen baru ke tagihan yang sudah dibayar.

export interface RincianTagihan {
  komponen_id: string | null
  nominal:     number
}

export interface KomponenPaket {
  komponen_id: string
  nominal:     number
}

export interface KomponenIndividu extends KomponenPaket {
  jenis: string
}

/**
 * Komponen tagihan satu siswa: paket kelasnya dengan nominal diganti komponen individu
 * yang komponennya sama, lalu komponen individu yang tidak ada di paket. Satu-satunya
 * aturan gabungan paket + individu, dipakai penerbitan (lib/generateTagihan).
 */
export function gabungKomponenSiswa<K extends KomponenPaket>(paket: K[], individu: K[]): K[] {
  const pengganti = new Map(individu.map(k => [k.komponen_id, k.nominal]))
  const diPaket   = new Set(paket.map(k => k.komponen_id))
  return [
    ...paket.map(k => {
      const nominal = pengganti.get(k.komponen_id)
      return nominal === undefined ? k : { ...k, nominal }
    }),
    ...individu.filter(k => !diPaket.has(k.komponen_id)),
  ]
}

export interface PotonganBeasiswa {
  jenis_potongan: 'persen' | 'nominal'
  persen:         number | null
  nominal:        number | null
  komponen_ids:   Set<string>
}

/**
 * Potongan beasiswa tiap komponen rincian, dan jumlahnya — satu-satunya rumus potongan,
 * dipakai penerbitan (lib/generateTagihan) dan hitung ulang. Potongan berlaku atas komponen
 * yang dicakup program dan memang ada di rincian (komponen pertama dengan komponen_id itu).
 *
 * `total` adalah jumlah apa adanya, dasar total_nominal sejak awal. `perKomponen` dibatasi
 * nominal komponennya (tagihan_item.potongan): kalau batas itu terpakai — potongan tetap
 * yang lebih besar dari komponennya — harga bersih komponen tidak lagi menjumlah ke total,
 * dan tagihan itu dibayar utuh, bukan per komponen (lib/rincianKomponen).
 */
export function potonganPerKomponen(
  rincian: RincianTagihan[],
  beasiswa: PotonganBeasiswa[],
): { perKomponen: number[]; total: number } {
  const perKomponen = rincian.map(() => 0)
  let total = 0
  for (const bs of beasiswa) {
    for (const kid of bs.komponen_ids) {
      const idx = rincian.findIndex(i => i.komponen_id === kid)
      if (idx < 0) continue
      // Potongan negatif (data lama atau isian yang lolos) akan menaikkan total — dianggap 0
      const potongan = Math.max(0, bs.jenis_potongan === 'persen'
        ? Math.round(rincian[idx].nominal * (bs.persen ?? 0) / 100)
        : (bs.nominal ?? 0))
      perKomponen[idx] += potongan
      total += potongan
    }
  }
  return {
    perKomponen: perKomponen.map((p, i) => Math.min(Math.max(0, p), Math.max(0, rincian[i].nominal))),
    total,
  }
}

/** Tagihan yang boleh dihitung ulang: bulan berjalan dan belum lunas */
export const bolehDihitungUlang = (
  t: { bulan: number; tahun: number; status: string }, bulanIni: number, tahunIni: number,
): boolean => t.bulan === bulanIni && t.tahun === tahunIni && t.status !== 'lunas'

export interface HasilHitungUlang<K extends KomponenIndividu> {
  /**
   * Komponen individu yang belum ada di rincian, tidak ada di paket kelas siswa, dan boleh
   * ditagih bulan ini. Wajib dicatat ke tagihan_item: `total` sudah memuatnya, dan
   * komponen yang hanya masuk total tanpa rincian akan ditagihkan lagi bulan depan.
   */
  susulan: K[]
  /** Total sesudah susulan dan potongan beasiswa; null = total yang tersimpan jangan diubah */
  total:   number | null
  /** Nominal yang seharusnya untuk tiap baris `rincian`, urutan yang sama (tagihan_item.nominal) */
  nominal: number[]
  /** Potongan per komponen untuk `[...rincian, ...susulan]`, urutan yang sama (tagihan_item.potongan); baris `buang` bernilai 0 */
  potongan: number[]
  /** Indeks baris `rincian` yang harus dihapus: komponen dobel, atau yang tidak lagi ada di paket maupun komponen individu */
  buang: number[]
}

export function hitungUlangTagihan<K extends KomponenIndividu>(a: {
  siswaId:        string
  bulan:          number
  tahun:          number
  totalTersimpan: number
  rincian:        RincianTagihan[]
  individu:       K[]
  /** Komponen paket kelas siswa pada tahun ajaran aktif — WAJIB lengkap: komponen individu yang ada di sini dianggap pengganti nominal, bukan tambahan */
  paket:          KomponenPaket[]
  beasiswa:       PotonganBeasiswa[]
  ta:             PeriodeTahunAjaran | null
  riwayat:        RiwayatTagih
  /**
   * Boleh membuang baris rincian — HANYA untuk tagihan yang belum punya pembayaran maupun
   * bukti yang menunggu verifikasi: pembayaran per komponen menunjuk ke baris rincian
   * (pembayaran.alokasi.tagihan_item_id), jadi baris yang sudah dibayari tidak boleh hilang.
   */
  rapikan:        boolean
}): HasilHitungUlang<K> {
  // Nominal rincian mengikuti keadaan hari ini: komponen individu siswa (pengganti), lalu
  // paket kelasnya. Komponen yang tidak ada di keduanya tetap seperti tercatat.
  const pengganti    = new Map(a.individu.map(k => [k.komponen_id, k.nominal]))
  const nominalPaket = new Map(a.paket.map(k => [k.komponen_id, k.nominal]))
  const rincian: RincianTagihan[] = a.rincian.map(i => {
    if (!i.komponen_id) return i
    const nominal = pengganti.get(i.komponen_id) ?? nominalPaket.get(i.komponen_id)
    return nominal === undefined ? i : { ...i, nominal }
  })

  // Rincian dirapikan menjadi paket + komponen individu hari ini (diputuskan 20 Okt 2026):
  // komponen yang tercatat dua kali disisakan yang pertama — sisa penerbitan lama yang
  // menjumlahkan paket dan individu — dan komponen yang sudah dikeluarkan dari paket
  // serta tidak di-assign ke siswa ini dibuang. Tanpa paket kelas, tidak ada acuan:
  // tidak ada yang dibuang.
  const buang = new Set<number>()
  if (a.rapikan && a.paket.length > 0) {
    const sudahAda = new Set<string>()
    rincian.forEach((i, idx) => {
      if (!i.komponen_id) return
      if (sudahAda.has(i.komponen_id) || (!pengganti.has(i.komponen_id) && !nominalPaket.has(i.komponen_id))) buang.add(idx)
      else sudahAda.add(i.komponen_id)
    })
  }
  const tetap = rincian.filter((_, idx) => !buang.has(idx))

  const tercatat = new Set(tetap.map(i => i.komponen_id).filter((id): id is string => !!id))
  const susulan: K[] = []
  for (const k of a.individu) {
    if (tercatat.has(k.komponen_id)) continue
    // Pengganti nominal paket hanya mengganti; komponen paket yang tidak ditagihkan bulan
    // ini tidak boleh muncul hanya untuk siswa yang punya pengganti
    if (nominalPaket.has(k.komponen_id)) continue
    if (!komponenDitagihkan(k.jenis, a.bulan, a.tahun, a.ta, a.siswaId, k.komponen_id, a.riwayat)) continue
    tercatat.add(k.komponen_id)
    susulan.push(k)
  }

  // Baris yang dibuang tidak ikut dihitung sama sekali — bukan dinolkan: potongan nominal
  // tetap atas komponen bernilai nol tetap mengurangi total
  const semua: RincianTagihan[] = [...tetap, ...susulan]
  const dasar = semua.reduce((s, i) => s + i.nominal, 0)

  // Potongan beasiswa hanya berlaku atas komponen yang ditagihkan pada tagihan ini
  const potongan = potonganPerKomponen(semua, a.beasiswa)

  const total = Math.max(0, dasar - potongan.total)

  // Satu nominal yang hilang membuat seluruh hitungan NaN, dan menulisnya mengosongkan
  // total_nominal (JSON.stringify(NaN) → null) sehingga nilai aslinya hilang
  if (!Number.isFinite(total)) return { susulan: [], total: null, nominal: [], potongan: [], buang: [] }

  // Rincian kosong bukan bukti tagihannya memang nol — bisa jadi rinciannya yang belum
  // ada. Menimpa nominal yang sudah terbit dengan nol menghapus angka yang kuitansinya
  // mungkin sudah dipegang orang tua.
  if (semua.length === 0 && total === 0 && a.totalTersimpan > 0) return { susulan, total: null, nominal: [], potongan: [], buang: [] }

  // Potongan dikembalikan ke urutan `rincian` asli, lalu susulan
  let j = 0
  const potonganRincian = rincian.map((_, idx) => buang.has(idx) ? 0 : potongan.perKomponen[j++])
  return {
    susulan, total,
    nominal:  rincian.map(i => i.nominal),
    potongan: [...potonganRincian, ...potongan.perKomponen.slice(tetap.length)],
    buang:    [...buang],
  }
}
