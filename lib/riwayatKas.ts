import { BULAN_PANJANG } from './formatLaporan'
import { bagiPembayaranKeKomponen, NAMA_LAINNYA, type BagianKomponen, type ItemTagihanKas } from './kasKomponen'
import type { Pengeluaran } from './pengeluaran'

// Riwayat kas halaman Pengeluaran (tab Ringkasan Kas): pemasukan dan pengeluaran satu
// bulan dalam satu tabel. Pemasukan satu baris per pembayaran (tanpa nama siswa), seperti
// riwayat di halaman Pembayaran (keputusan user 27 Okt 2026); pengeluaran satu baris per catatan.

export interface PembayaranKas {
  id:            string
  tagihan_id:    string
  jumlah:        number
  alokasi:       unknown
  tanggal_bayar: string
}

export interface TagihanKas {
  id:    string
  bulan: number
  tahun: number
  items: ItemTagihanKas[]
}

export interface BarisRiwayatKas {
  id:         string
  jenis:      'masuk' | 'keluar'
  /** ISO — tanggal bayar atau tanggal pengeluaran */
  tanggal:    string
  judul:      string
  keterangan: string
  /** Nama komponen, urut bagian terbesar dulu */
  komponen:   string[]
  jumlah:     number
  /** Bagian tiap komponen dari `jumlah` — dasar unduhan per komponen */
  perKomponen: BagianKomponen[]
}

/** Bagian komponen tiap pembayaran; tagihan yang tidak terbaca masuk "Lainnya" seluruhnya */
export function bagianPerPembayaran(
  pembayaran: PembayaranKas[],
  tagihanPer: Map<string, TagihanKas>,
): Map<string, BagianKomponen[]> {
  const hasil = new Map<string, BagianKomponen[]>()
  for (const p of pembayaran) {
    const t = tagihanPer.get(p.tagihan_id)
    hasil.set(p.id, t ? bagiPembayaranKeKomponen(p, t.items) : [{ nama: NAMA_LAINNYA, jumlah: Math.round(Number(p.jumlah)) }])
  }
  return hasil
}

/** Riwayat terurut menurut tanggal, terbaru dulu (permintaan user 27 Okt 2026) */
export function susunRiwayatKas(opsi: {
  pembayaran:   PembayaranKas[]
  tagihanPer:   Map<string, TagihanKas>
  bagian:       Map<string, BagianKomponen[]>
  pengeluaran:  Pengeluaran[]
  namaKategori: Map<string, string>
}): BarisRiwayatKas[] {
  const { pembayaran, tagihanPer, bagian, pengeluaran, namaKategori } = opsi

  // Nama siswa tidak ditampilkan (permintaan user 27 Okt 2026) — cukup bulan tagihannya
  const masuk: BarisRiwayatKas[] = pembayaran.map(p => {
    const t = tagihanPer.get(p.tagihan_id)
    const perKomponen = [...(bagian.get(p.id) ?? [])].sort((a, b) => b.jumlah - a.jumlah)
    return {
      id:         `masuk-${p.id}`,
      jenis:      'masuk',
      tanggal:    p.tanggal_bayar,
      judul:      t ? `Pembayaran ${BULAN_PANJANG[t.bulan] ?? ''} ${t.tahun}` : 'Pembayaran',
      keterangan: '',
      komponen:   perKomponen.map(b => b.nama),
      jumlah:     Math.round(Number(p.jumlah)),
      perKomponen,
    }
  })

  const keluar: BarisRiwayatKas[] = pengeluaran.map(p => {
    const perKomponen = [...p.sumber_dana].sort((a, b) => b.nominal - a.nominal).map(s => ({ nama: s.nama_komponen, jumlah: s.nominal }))
    return {
      id:         `keluar-${p.id}`,
      jenis:      'keluar',
      tanggal:    p.tanggal,
      judul:      p.keterangan,
      keterangan: namaKategori.get(p.kategori_id) ?? '',
      komponen:   perKomponen.map(b => b.nama),
      jumlah:     p.jumlah,
      perKomponen,
    }
  })

  return [...masuk, ...keluar].sort((a, b) =>
    new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
    || (a.jenis === b.jenis ? b.id.localeCompare(a.id) : a.jenis === 'keluar' ? -1 : 1))
}
