import { adalahTunggakan, type TagihanMetrik } from './metrikLaporan'
import { batasJatuhTempo } from './statusTagihan'
import { sisaTagihan, tagihanTautan, tagihanTertagih } from './tagihanTertagih'
import { buildPesanTunggakanText, buildWaMeLink } from './templates/waTagihan'

// Pengingat tunggakan dari laporan (level Kelas dan Siswa) — satu pesan merangkum
// SEMUA tunggakan siswa dari tahun ajaran mana pun, bukan hanya yang masuk filter.

interface TagihanPengingat extends TagihanMetrik {
  payment_token: string | null
}

export function tunggakanSiswa<T extends TagihanMetrik>(tagihan: T[], sekarang: Date): T[] {
  return tagihan
    .filter(t => adalahTunggakan(t, sekarang))
    .sort((a, b) => batasJatuhTempo(a).getTime() - batasJatuhTempo(b).getTime())
}

/**
 * Tautan wa.me berisi pesan tunggakan, atau null kalau tidak ada nomor WA atau
 * tidak ada tunggakan. `tagihan` = semua tagihan siswa, bukan hanya periode terpilih.
 */
export function tautanPengingatTunggakan(p: {
  tagihan:     TagihanPengingat[]
  sekarang:    Date
  noWa:        string | null
  namaWali:    string
  namaSiswa:   string
  kelasNama:   string
  namaSekolah: string
  origin:      string
}): string | null {
  if (!p.noWa || tunggakanSiswa(p.tagihan, p.sekarang).length === 0) return null

  // Tautan tagihan belum lunas terbaru. Pesannya merinci isi halaman bayar tautan itu —
  // tunggakan sebelumnya beserta tagihan itu sendiri — supaya totalnya sama
  const terbaru = tagihanTautan(p.tagihan)
  const daftar  = terbaru ? tagihanTertagih(p.tagihan, terbaru, p.sekarang).daftar : []

  const pesan = buildPesanTunggakanText({
    namaWali:    p.namaWali,
    namaSiswa:   p.namaSiswa,
    kelasNama:   p.kelasNama,
    daftar:      daftar.map(t => ({
      bulan: t.bulan, tahun: t.tahun, sisa: sisaTagihan(t), belumJatuhTempo: !adalahTunggakan(t, p.sekarang),
    })),
    namaSekolah: p.namaSekolah,
    paymentUrl:  terbaru?.payment_token ? `${p.origin}/bayar/${terbaru.payment_token}` : undefined,
  })
  return buildWaMeLink(p.noWa, pesan)
}
