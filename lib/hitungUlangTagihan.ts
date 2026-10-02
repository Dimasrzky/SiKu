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
  const nominalKomponen = new Map(
    semua.filter(i => i.komponen_id).map(i => [i.komponen_id as string, i.nominal])
  )

  // Potongan beasiswa hanya berlaku atas komponen yang ditagihkan pada tagihan ini
  let potongan = 0
  for (const bs of a.beasiswa) {
    for (const kid of bs.komponen_ids) {
      const nominal = nominalKomponen.get(kid)
      if (nominal === undefined) continue
      potongan += bs.jenis_potongan === 'persen'
        ? Math.round(nominal * (bs.persen ?? 0) / 100)
        : (bs.nominal ?? 0)
    }
  }

  const total = Math.max(0, dasar - potongan)

  // Satu nominal yang hilang membuat seluruh hitungan NaN, dan menulisnya mengosongkan
  // total_nominal (JSON.stringify(NaN) → null) sehingga nilai aslinya hilang
  if (!Number.isFinite(total)) return { susulan: [], total: null }

  // Rincian kosong bukan bukti tagihannya memang nol — bisa jadi rinciannya yang belum
  // ada. Menimpa nominal yang sudah terbit dengan nol menghapus angka yang kuitansinya
  // mungkin sudah dipegang orang tua.
  if (semua.length === 0 && total === 0 && a.totalTersimpan > 0) return { susulan, total: null }

  return { susulan, total }
}
