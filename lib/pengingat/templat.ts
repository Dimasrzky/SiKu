// Teks pengingat WhatsApp yang dikirim lewat antrean — satu template untuk pengingat
// otomatis maupun manual (bagian 8 spec). Sapaan dan penutup dipilih acak supaya teksnya
// tidak 100% identik ke semua wali.

/** Diletakkan di depan "Bapak/Ibu {nama wali}," */
export const SAPAAN_PENGINGAT = [
  'Yth.',
  'Kepada Yth.',
  'Halo',
  'Salam hormat',
] as const

export const PENUTUP_PENGINGAT = [
  'Terima kasih atas perhatian Bapak/Ibu.',
  'Apabila sudah membayar, mohon abaikan pesan ini. Terima kasih.',
  'Terima kasih atas perhatian dan kerja samanya.',
  'Mohon abaikan pesan ini apabila pembayaran sudah dilakukan.',
] as const

export interface DataPesanPengingat {
  namaWali:    string | null
  namaSiswa:   string
  kelasNama:   string | null
  namaSekolah: string
  /** Total tagihan yang diingatkan, rupiah */
  total:       number
  /** Tautan halaman bayar; null kalau tagihannya tidak punya tautan aktif */
  tautan:      string | null
  /** Nomor TU/bendahara sekolah, ditulis apa adanya */
  kontakTu:    string | null
}

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

/** `acak` mengembalikan angka di [0, 1) — bisa diganti supaya hasilnya tetap saat diuji */
export function renderPesanPengingat(d: DataPesanPengingat, acak: () => number = Math.random): string {
  const pilih = <T>(daftar: readonly T[]): T => daftar[Math.min(daftar.length - 1, Math.floor(acak() * daftar.length))]

  const sekolah = d.namaSekolah.trim() || 'sekolah'
  const wali    = d.namaWali?.trim() || `Orang Tua/Wali ${d.namaSiswa}`
  const siswa   = `Ananda ${d.namaSiswa}${d.kelasNama?.trim() ? ` (${d.kelasNama.trim()})` : ''}`
  const kontak  = d.kontakTu?.trim()

  return [
    `${pilih(SAPAAN_PENGINGAT)} Bapak/Ibu ${wali},`,
    ``,
    `Kami dari ${sekolah} menginformasikan tagihan SPP untuk ${siswa} sebesar ${formatRp(d.total)}.`,
    ``,
    ...(d.tautan ? [`Rincian: ${d.tautan}`, ``] : []),
    pilih(PENUTUP_PENGINGAT),
    kontak ? `Info lebih lanjut hubungi TU ${sekolah}: ${kontak}.` : `Info lebih lanjut hubungi TU ${sekolah}.`,
    `Balas STOP jika tidak ingin menerima pengingat.`,
  ].join('\n')
}
