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


