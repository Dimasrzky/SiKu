import { useCallback, useState } from 'react'
import { judulBelumLengkap, muatKopLaporan, pesanKopBelumLengkap, type DataKop, type FormatUnduhan } from './kopLaporan'

// Pemeriksaan kop sebelum setiap unduhan laporan (PDF dan Excel). Isian kop dibaca
// ulang dari database tiap kali tombol diklik, jadi perubahan di Pengaturan langsung
// berlaku tanpa memuat ulang halaman Laporan.

export interface PesanKop {
  judul: string
  teks:  string
  /** Tampilkan tombol ke Pengaturan — hanya kalau penyebabnya isian yang kosong */
  kePengaturan: boolean
}

export function useKopLaporan(sekolahId: string | null | undefined) {
  const [pesanKop, setPesanKop] = useState<PesanKop | null>(null)

  /** Kop lengkap, atau null setelah menampilkan pop up penyebabnya. PDF juga memeriksa
   *  isian tanda tangan. */
  const siapkanKop = useCallback(async (format: FormatUnduhan): Promise<DataKop | null> => {
    if (!sekolahId) return null
    const hasil = await muatKopLaporan(sekolahId, format)
    if (hasil.error !== null) {
      setPesanKop({ judul: 'Kop Laporan Gagal Dimuat', teks: hasil.error, kePengaturan: false })
      return null
    }
    if (!hasil.data.kop) {
      setPesanKop({ judul: judulBelumLengkap(hasil.data.kurang), teks: pesanKopBelumLengkap(hasil.data.kurang), kePengaturan: true })
      return null
    }
    return hasil.data.kop
  }, [sekolahId])

  const tutupPesanKop = useCallback(() => setPesanKop(null), [])

  return { siapkanKop, pesanKop, tutupPesanKop }
}
