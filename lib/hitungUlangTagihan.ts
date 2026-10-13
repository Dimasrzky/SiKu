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
// Beasiswa dan komponen individu yang dipakai adalah keadaan HARI INI. Itu sebabnya
// cakupannya sempit: memakainya pada bulan lalu mencabut potongan dari bulan saat
// beasiswa masih berlaku, atau menambah komponen baru ke tagihan yang sudah dibayar.

export interface RincianTagihan {
  komponen_id: string | null
  nominal:     number
}

export interface KomponenIndividu {
  komponen_id: string
  jenis:       string
  nominal:     number
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
   * Komponen individu yang belum ada di rincian dan boleh ditagih bulan ini. Wajib
   * dicatat ke tagihan_item: `total` sudah memuatnya, dan komponen yang hanya masuk
   * total tanpa rincian akan ditagihkan lagi oleh penerbitan bulan depan.
   */
  susulan: K[]
  /** Total sesudah susulan dan potongan beasiswa; null = total yang tersimpan jangan diubah */
  total:   number | null
  /** Potongan per komponen untuk `[...rincian, ...susulan]`, urutan yang sama (tagihan_item.potongan) */
  potongan: number[]
}

export function hitungUlangTagihan<K extends KomponenIndividu>(a: {
  siswaId:        string
  bulan:          number
  tahun:          number
  totalTersimpan: number
  rincian:        RincianTagihan[]
  individu:       K[]
  beasiswa:       PotonganBeasiswa[]
  ta:             PeriodeTahunAjaran | null
  riwayat:        RiwayatTagih
}): HasilHitungUlang<K> {
  const tercatat = new Set(a.rincian.map(i => i.komponen_id).filter((id): id is string => !!id))
  const susulan: K[] = []
  for (const k of a.individu) {
    if (tercatat.has(k.komponen_id)) continue
    if (!komponenDitagihkan(k.jenis, a.bulan, a.tahun, a.ta, a.siswaId, k.komponen_id, a.riwayat)) continue
    tercatat.add(k.komponen_id)
    susulan.push(k)
  }

  const semua: RincianTagihan[] = [...a.rincian, ...susulan]
  const dasar = semua.reduce((s, i) => s + i.nominal, 0)

  // Potongan beasiswa hanya berlaku atas komponen yang ditagihkan pada tagihan ini
  const potongan = potonganPerKomponen(semua, a.beasiswa)

  const total = Math.max(0, dasar - potongan.total)

  // Satu nominal yang hilang membuat seluruh hitungan NaN, dan menulisnya mengosongkan
  // total_nominal (JSON.stringify(NaN) → null) sehingga nilai aslinya hilang
  if (!Number.isFinite(total)) return { susulan: [], total: null, potongan: [] }

  // Rincian kosong bukan bukti tagihannya memang nol — bisa jadi rinciannya yang belum
  // ada. Menimpa nominal yang sudah terbit dengan nol menghapus angka yang kuitansinya
  // mungkin sudah dipegang orang tua.
  if (semua.length === 0 && total === 0 && a.totalTersimpan > 0) return { susulan, total: null, potongan: [] }

  return { susulan, total, potongan: potongan.perKomponen }
}
