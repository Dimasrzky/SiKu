import type { TagihanMetrik } from '../metrikLaporan'
import { tunggakanSiswa } from '../pengingatTunggakan'
import { masihBersisa, tagihanTautan, tagihanTertagih } from '../tagihanTertagih'

// Siapa yang boleh diingatkan dan berapa totalnya. Aturannya adalahTunggakan di
// lib/metrikLaporan — sama dengan pengingat wa.me di Laporan: sisa cicilan yang lewat
// jatuh tempo ikut dihitung, alumni yang belum lunas dihitung tanpa melihat tanggal,
// dan tunggakan dari tahun ajaran mana pun ikut.

export interface TagihanPengingat extends TagihanMetrik {
  payment_token:       string | null
  payment_token_aktif: boolean | null
}

export interface RingkasanTunggakan<T extends TagihanPengingat> {
  /** Tagihan yang sudah lewat jatuh tempo dan masih bersisa, terlama dulu */
  tunggakan: T[]
  /** Yang ditagih halaman bayar lewat tautan pesan ini (lib/tagihanTertagih) */
  total:     number
  /** Tagihan yang tautan bayarnya dikirim; null kalau tautannya tidak ada atau tidak aktif */
  tautan:    T | null
}

const tautanAktif = <T extends TagihanPengingat>(t: T | null): T | null =>
  // Halaman bayar menolak token yang tidak aktif, jadi tautannya tidak dikirim
  t?.payment_token && t.payment_token_aktif === true ? t : null

/** `tagihan` = semua tagihan belum lunas milik satu siswa, sudah digabung dengan pembayarannya */
export function ringkasTunggakan<T extends TagihanPengingat>(tagihan: T[], sekarang: Date): RingkasanTunggakan<T> {
  const tunggakan = tunggakanSiswa(tagihan, sekarang)

  // Tautan menuju tagihan terbaru yang belum lunas, juga kalau belum jatuh tempo
  // (keputusan 3 Okt 2026): halaman bayarnya memuat tagihan itu beserta seluruh
  // tunggakan sebelumnya, jadi total pesan = total halaman bayar = kolom Total di
  // Tagihan Aktif. Yang boleh diingatkan tetap hanya siswa yang punya tunggakan.
  const sasaran = tagihanTautan(tagihan)

  return {
    tunggakan,
    total:  sasaran ? tagihanTertagih(tagihan, sasaran, sekarang).total : 0,
    tautan: tautanAktif(sasaran),
  }
}

/**
 * Pengingat otomatis untuk satu tagihan yang mendekati jatuh tempo: tagihan itu ditambah
 * tunggakan lamanya (keputusan 1 Okt 2026), dengan tautan ke tagihan itu sendiri.
 * null kalau tagihannya tidak perlu diingatkan lagi — sudah lunas, Rp 0, atau sudah dihapus.
 */
export function ringkasOtomatis<T extends TagihanPengingat>(
  tagihan: T[], tagihanId: string, sekarang: Date,
): RingkasanTunggakan<T> | null {
  const sasaran = tagihan.find(t => t.id === tagihanId)
  if (!sasaran || !masihBersisa(sasaran)) return null

  // Kalau pengirimannya tertunda sampai lewat jatuh tempo, sasaran sendiri sudah termasuk
  // tunggakan — tagihanTertagih menghitungnya sekali saja
  const { daftar, total } = tagihanTertagih(tagihan, sasaran, sekarang)
  return { tunggakan: daftar, total, tautan: tautanAktif(sasaran) }
}
