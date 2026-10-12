// Teks pengingat WhatsApp yang dikirim lewat antrean — satu template untuk pengingat
// otomatis maupun manual. Tanda *…* = huruf tebal di WhatsApp.

const BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export interface DataPesanPengingat {
  namaWali:    string | null
  namaSiswa:   string
  kelasNama:   string | null
  namaSekolah: string
  /** Bulan tagihan yang dijumlah di `total`, terlama dulu */
  periode:     { bulan: number; tahun: number }[]
  /** Total tagihan yang diingatkan, rupiah */
  total:       number
  /** Tautan halaman bayar; null kalau tagihannya tidak punya tautan aktif */
  tautan:      string | null
  /** Nomor TU/bendahara sekolah */
  kontakTu:    string | null
}

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

/** "Oktober 2026", atau rentang kalau total mencakup tunggakan bulan sebelumnya */
function teksPeriode(periode: DataPesanPengingat['periode']): string {
  if (periode.length === 0) return '-'
  const awal  = periode[0]
  const akhir = periode[periode.length - 1]
  if (awal.bulan === akhir.bulan && awal.tahun === akhir.tahun) return `${BULAN[akhir.bulan]} ${akhir.tahun}`
  return awal.tahun === akhir.tahun
    ? `${BULAN[awal.bulan]} – ${BULAN[akhir.bulan]} ${akhir.tahun}`
    : `${BULAN[awal.bulan]} ${awal.tahun} – ${BULAN[akhir.bulan]} ${akhir.tahun}`
}

/** "0812-5664-0452" dari 08…, 62… atau +62… */
function teksNomor(no: string): string {
  const angka = no.replace(/\D/g, '')
  const lokal = angka.startsWith('62') ? '0' + angka.slice(2) : angka
  return lokal.match(/.{1,4}/g)?.join('-') ?? lokal
}

export function renderPesanPengingat(d: DataPesanPengingat): string {
  const sekolah = d.namaSekolah.trim() || 'sekolah'
  const wali    = d.namaWali?.trim() || `Orang Tua/Wali ${d.namaSiswa}`
  const kontak  = d.kontakTu?.trim()

  return [
    `Assalamu’alaikum wr. wb.`,
    ``,
    `Yth. ${wali},`,
    ``,
    `Kami dari ${sekolah} ingin menyampaikan informasi tagihan pendidikan untuk siswa berikut:`,
    ``,
    `*Nama Siswa*    : ${d.namaSiswa}`,
    `*Kelas*          : ${d.kelasNama?.trim() || '-'}`,
    `*Periode*        : ${teksPeriode(d.periode)}`,
    `*Total Tagihan* : ${formatRp(d.total)}`,
    `*Status*          : Belum Lunas`,
    ``,
    ...(d.tautan
      ? [`Untuk melihat rincian tagihan dan melakukan pembayaran, silakan akses tautan berikut:`, ``, d.tautan, ``]
      : []),
    kontak
      ? `Jika ada pertanyaan atau kendala terkait tagihan maupun pembayaran, silakan menghubungi bagian TU ${sekolah} melalui WhatsApp di ${teksNomor(kontak)}.`
      : `Jika ada pertanyaan atau kendala terkait tagihan maupun pembayaran, silakan menghubungi bagian TU ${sekolah}.`,
    ``,
    `Terima kasih atas perhatian dan kerja sama Bapak/Ibu.`,
    ``,
    `Hormat kami,`,
    sekolah,
  ].join('\n')
}
