const BULAN_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

export function formatWaNumber(no: string): string {
  const digits = no.replace(/\D/g, '')
  if (digits.startsWith('0'))  return '62' + digits.slice(1)
  if (digits.startsWith('62')) return digits
  return '62' + digits
}

// Link wa.me — membuka WhatsApp dengan pesan yang sudah terisi, dikirim manual oleh admin
export function buildWaMeLink(no: string, message: string): string {
  return `https://wa.me/${formatWaNumber(no)}?text=${encodeURIComponent(message)}`
}

export interface PesanTagihanParams {
  namaWali:      string
  namaSiswa:     string
  kelasNama:     string
  totalNominal:  number
  bulan:         number
  tahun:         number
  namaSekolah?:  string
  paymentUrl?:   string  // jika diisi, pesan menyertakan link pembayaran
}

// Plain text — untuk dikirim via API
export function buildPesanTagihanText(p: PesanTagihanParams): string {
  const wali    = p.namaWali || 'Orang Tua/Wali'
  const periode = `${BULAN_NAMES[p.bulan]} ${p.tahun}`
  const sekolah = p.namaSekolah || 'Admin Sekolah'

  const lines = [
    `Assalamualaikum wr. wb.`,
    ``,
    `Yth. Bapak/Ibu *${wali}*`,
    ``,
    `Kami dari ${sekolah} menginformasikan tagihan pendidikan yang perlu segera dilunasi:`,
    ``,
    `*Nama Siswa*    : ${p.namaSiswa}`,
    `*Kelas*          : ${p.kelasNama}`,
    `*Periode*        : ${periode}`,
    `*Total Tagihan* : *${formatRp(p.totalNominal)}*`,
    `*Status*          : Belum Lunas`,
    ``,
  ]

  if (p.paymentUrl) {
    lines.push(
      `Silakan lakukan pembayaran melalui link berikut:`,
      ``,
      `${p.paymentUrl}`,
      ``,
      `_Klik link di atas untuk membayar. Nominal sudah otomatis terisi._`,
      ``,
    )
  } else {
    lines.push(
      `Mohon melakukan pembayaran sesuai nominal di atas dan konfirmasi kepada pihak sekolah.`,
      ``,
    )
  }

  lines.push(
    `Terima kasih atas perhatian dan kerja samanya.`,
    ``,
    `_Hormat kami,_`,
    `_${sekolah}_`,
  )

  return lines.join('\n')
}

export interface PesanTunggakanParams {
  namaWali:     string
  namaSiswa:    string
  kelasNama:    string
  /** Tagihan yang sudah lewat jatuh tempo beserta sisanya, terlama dulu */
  daftar:       { bulan: number; tahun: number; sisa: number }[]
  namaSekolah?: string
  /** Tautan tagihan belum lunas terbaru — halaman bayar ikut menampilkan tunggakan sebelumnya */
  paymentUrl?:  string
}

// Pengingat dari laporan level Kelas: satu pesan merangkum semua bulan yang menunggak,
// bukan satu pesan per tagihan
export function buildPesanTunggakanText(p: PesanTunggakanParams): string {
  const wali    = p.namaWali || 'Orang Tua/Wali'
  const sekolah = p.namaSekolah || 'Admin Sekolah'
  const total   = p.daftar.reduce((s, d) => s + d.sisa, 0)

  const lines = [
    `Assalamualaikum wr. wb.`,
    ``,
    `Yth. Bapak/Ibu *${wali}*`,
    ``,
    `Kami dari ${sekolah} mengingatkan tagihan pendidikan yang sudah melewati jatuh tempo:`,
    ``,
    `*Nama Siswa* : ${p.namaSiswa}`,
    `*Kelas*       : ${p.kelasNama}`,
    ``,
    ...p.daftar.map(d => `• ${BULAN_NAMES[d.bulan]} ${d.tahun}: ${formatRp(d.sisa)}`),
    ``,
    `*Total* : *${formatRp(total)}*`,
    ``,
  ]

  if (p.paymentUrl) {
    lines.push(
      `Rincian dan pembayaran dapat dilakukan melalui link berikut:`,
      ``,
      `${p.paymentUrl}`,
      ``,
    )
  } else {
    lines.push(
      `Mohon melakukan pembayaran dan konfirmasi kepada pihak sekolah.`,
      ``,
    )
  }

  lines.push(
    `Apabila sudah membayar, mohon abaikan pesan ini. Terima kasih atas perhatian dan kerja samanya.`,
    ``,
    `_Hormat kami,_`,
    `_${sekolah}_`,
  )

  return lines.join('\n')
}


