import { STATUS_TAGIHAN, lewatJatuhTempo, statusEfektif, tanpaKewajiban, type StatusTagihan } from './statusTagihan'
import {
  hitungPemasukan, hitungRingkasan, hitungSiswaLunas, trenTagihanRealisasi, umurTunggakan,
  type KelompokUmur, type RingkasanMetrik, type TitikTren,
} from './metrikLaporan'
import type { KelasLaporan, TagihanLaporan } from './useDataLaporan'

// Isi blok "Ringkasan periode ini" di halaman Laporan dan PDF Laporan Utama. Satu rumus
// untuk layar dan unduhan; unduhan per komponen memakai fungsi yang sama atas tagihan
// yang sudah diproyeksikan ke komponen terpilih (lib/komponenLaporan).

export interface KomposisiTagihan {
  label: string
  value: number
  color: string
}

/** Jumlah TAGIHAN per status — aturan sama persis dengan Tagihan Aktif, termasuk alumni */
export function komposisiPerTagihan(rows: TagihanLaporan[], sekarang: Date): KomposisiTagihan[] {
  const jumlah: Record<StatusTagihan, number> = { lunas: 0, cicilan: 0, belum_bayar: 0, menunggak: 0 }
  for (const t of rows) {
    jumlah[statusEfektif(t.status, lewatJatuhTempo(t, sekarang), t.is_alumni, t.total_nominal)] += 1
  }
  const { lunas, cicilan, belum_bayar: belumBayar, menunggak } = jumlah
  return [
    { label: STATUS_TAGIHAN.lunas.label,       value: lunas,      color: STATUS_TAGIHAN.lunas.solid       },
    { label: STATUS_TAGIHAN.cicilan.label,     value: cicilan,    color: STATUS_TAGIHAN.cicilan.solid     },
    { label: STATUS_TAGIHAN.belum_bayar.label, value: belumBayar, color: STATUS_TAGIHAN.belum_bayar.solid },
    { label: STATUS_TAGIHAN.menunggak.label,   value: menunggak,  color: STATUS_TAGIHAN.menunggak.solid   },
  ]
}

export interface RingkasJenjang {
  kode:         string
  jenjang:      string
  /** Tingkat pelunasan 0–100; null kalau belum ada tagihan yang jatuh tempo */
  pct:          number | null
  terbayar:     number
  nilai:        number
  tunggakan:    number
  siswaLunas:   number
  siswaDinilai: number
}

/**
 * Rumus yang sama dengan kartu tingkat pelunasan (Rupiah, hanya tagihan jatuh tempo),
 * dikelompokkan menurut kelas saat tagihan dibuat — bukan kelas siswa sekarang, yang
 * sudah bergeser setelah naik kelas. Tagihan tanpa snapshot kelas (tahun ajaran sebelum
 * kolom itu ada) hanya ikut di angka sekolah.
 */
export function ringkasPerJenjang(rows: TagihanLaporan[], kelas: Map<string, KelasLaporan>, sekarang: Date): RingkasJenjang[] {
  const perJenjang = new Map<string, TagihanLaporan[]>()
  for (const t of rows) {
    const jenjang = t.kelas_id ? kelas.get(t.kelas_id)?.jenjang : undefined
    if (!jenjang) continue
    const daftar = perJenjang.get(jenjang)
    if (daftar) daftar.push(t)
    else perJenjang.set(jenjang, [t])
  }
  return Array.from(perJenjang.entries())
    .map(([kode, daftar]) => {
      const r     = hitungRingkasan(daftar, sekarang)
      const siswa = hitungSiswaLunas(daftar, sekarang)
      return {
        kode,
        jenjang:      `Jenjang ${kode}`,
        pct:          r.tingkatPelunasan,
        terbayar:     r.terbayarJatuhTempo,
        nilai:        r.nilaiJatuhTempo,
        tunggakan:    r.tunggakanBerjalan,
        siswaLunas:   siswa.lunas,
        siswaDinilai: siswa.dinilai,
      }
    })
    .sort((a, b) => a.kode.localeCompare(b.kode, 'id', { numeric: true }))
}

export interface KomponenBelumLunas {
  nama:   string
  /** Tagihan — dipakai PDF */
  jumlah: number
  total:  number
  /** Siswa berbeda — dipakai kartu */
  siswa:  number
}

/**
 * Dikelompokkan per komponen_id dan diberi label nama hidup dari master komponen, bukan
 * snapshot nama_komponen. Kalau memakai snapshot, komponen yang di-rename pecah jadi dua
 * baris (nama lama dari tagihan lama, nama baru dari tagihan baru). Komponen yang sudah
 * dihapus tidak punya komponen_id lagi — jatuh ke snapshot.
 */
export function komponenBelumDibayar(rows: TagihanLaporan[]): KomponenBelumLunas[] {
  const byKomponen = new Map<string, { nama: string; jumlah: number; total: number; siswa: Set<string> }>()
  for (const t of rows) {
    if (t.status === 'lunas' || tanpaKewajiban(t.total_nominal)) continue
    for (const item of t.tagihan_item) {
      const kunci = item.komponen_id ?? `nama:${item.nama_komponen}`
      const nama  = item.komponen?.nama ?? item.nama_komponen
      const cur   = byKomponen.get(kunci) ?? { nama, jumlah: 0, total: 0, siswa: new Set<string>() }
      cur.nama    = nama
      cur.jumlah += 1
      cur.total  += item.nominal
      cur.siswa.add(t.siswa_id)
      byKomponen.set(kunci, cur)
    }
  }
  // Diurutkan berdasarkan nilai rupiah, bukan jumlah tagihan: setiap tagihan yang belum
  // lunas memuat komponen yang sama, jadi jumlahnya selalu seri dan urutannya jatuh ke
  // urutan penyisipan Map. Nilai rupiah juga yang ditonjolkan di kartu.
  return Array.from(byKomponen.values())
    .map(v => ({ nama: v.nama, jumlah: v.jumlah, total: v.total, siswa: v.siswa.size }))
    .sort((a, b) => b.total - a.total || b.jumlah - a.jumlah)
    .slice(0, 4)
}

/** Semua angka satu kolom Laporan Utama */
export interface MetrikUtama {
  ringkasan:        RingkasanMetrik
  pemasukan:        { total: number; transaksi: number }
  komposisiTagihan: KomposisiTagihan[]
  tren:             TitikTren[]
  umur:             KelompokUmur[]
  jenjang:          RingkasJenjang[]
  komponen:         KomponenBelumLunas[]
}

/**
 * Filter periode berlaku untuk ringkasan, komposisi, jenjang, dan komponen. Tren
 * mengikuti tahun ajaran (berakhir di `akhirTA`), umur tunggakan tidak mengikuti filter
 * apa pun — sama dengan blok di layar.
 */
export function hitungMetrikUtama(
  rows:         TagihanLaporan[],
  dalamPeriode: (t: { bulan: number; tahun: number }) => boolean,
  kelas:        Map<string, KelasLaporan>,
  sekarang:     Date,
  akhirTA:      Date,
): MetrikUtama {
  const periode = rows.filter(dalamPeriode)
  return {
    ringkasan:        hitungRingkasan(periode, sekarang),
    pemasukan:        hitungPemasukan(periode),
    komposisiTagihan: komposisiPerTagihan(periode, sekarang),
    tren:             trenTagihanRealisasi(rows, sekarang, akhirTA),
    umur:             umurTunggakan(rows, sekarang),
    jenjang:          ringkasPerJenjang(periode, kelas, sekarang),
    komponen:         komponenBelumDibayar(periode),
  }
}
