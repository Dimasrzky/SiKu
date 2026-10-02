import type { TagihanMetrik } from '../metrikLaporan'
import { tunggakanSiswa } from '../pengingatTunggakan'
import { tanpaKewajiban } from '../statusTagihan'

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
  /** Jumlah sisa seluruh tunggakan */
  total:     number
  /** Tagihan yang tautan bayarnya dikirim; null kalau tautannya tidak ada atau tidak aktif */
  tautan:    T | null
}

export const sisaTagihan = (t: TagihanMetrik): number => Math.max(0, t.total_nominal - t.terbayar)

/** `tagihan` = semua tagihan belum lunas milik satu siswa, sudah digabung dengan pembayarannya */
export function ringkasTunggakan<T extends TagihanPengingat>(tagihan: T[], sekarang: Date): RingkasanTunggakan<T> {
  const tunggakan = tunggakanSiswa(tagihan, sekarang)

  // Tautan menuju tunggakan yang terbaru: halaman bayarnya menampilkan tagihan itu
  // beserta tunggakan sebelumnya, jadi isinya sama dengan total di pesan. Tagihan yang
  // lebih baru tetapi belum jatuh tempo sengaja tidak dipakai (berbeda dari tautan wa.me
  // di lib/pengingatTunggakan) — halamannya akan menampilkan jumlah yang lebih besar
  // daripada yang diingatkan, dan tagihan itu punya pengingat otomatisnya sendiri.
  const terbaru = tunggakan[tunggakan.length - 1]

  return {
    tunggakan,
    total:  tunggakan.reduce((s, t) => s + sisaTagihan(t), 0),
    // Halaman bayar menolak token yang tidak aktif, jadi tautannya tidak dikirim
    tautan: terbaru?.payment_token && terbaru.payment_token_aktif === true ? terbaru : null,
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
  if (!sasaran || sasaran.status === 'lunas' || tanpaKewajiban(sasaran.total_nominal) || sisaTagihan(sasaran) <= 0) return null

  // Kalau pengirimannya tertunda sampai lewat jatuh tempo, sasaran sendiri sudah termasuk
  // tunggakan — dibuang dulu supaya tidak terhitung dua kali
  const lama = tunggakanSiswa(tagihan, sekarang).filter(t => t.id !== sasaran.id)

  return {
    tunggakan: [...lama, sasaran],
    total:     sisaTagihan(sasaran) + lama.reduce((s, t) => s + sisaTagihan(t), 0),
    tautan:    sasaran.payment_token && sasaran.payment_token_aktif === true ? sasaran : null,
  }
}
