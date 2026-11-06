import { jsPDF } from 'jspdf'
import autoTable, { type CellInput, type RowInput, type Styles } from 'jspdf-autotable'
import type { DataKop } from './kopLaporan'
import { ATAS_KOP, JARAK_ISI, judulLaporanPdf, pasangKopSemuaHalaman, tandaTanganPdf, tataKop } from './kopPdf'
import { BULAN_PANJANG, formatPersen, formatRupiah as fmt } from './formatLaporan'
import type { MetrikUtama } from './laporanUtama'

// PDF "Generate Laporan Utama": seluruh blok "Ringkasan periode ini" di layar dalam satu
// dokumen. Satu kolom = tata letak biasa (tegak). Beberapa kolom = unduhan per komponen
// yang dipisah: setiap tabel punya satu kolom (atau satu kelompok kolom) per komponen,
// halaman lanskap supaya muat. Hanya untuk komponen 'use client'.

export interface KolomUtama {
  label: string
  m:     MetrikUtama
}

export interface OpsiLaporanUtama {
  kop:       DataKop
  /** "Setahun penuh - 2026/2027" */
  periode:   string
  /** Keterangan komponen di bawah judul; kosong = laporan tanpa pilihan komponen */
  komponen?: string
  kolom:     KolomUtama[]
  /** Semua komponen terpilih digabung — dasar tabel komponen belum dibayar */
  gabungan:  MetrikUtama
  namaFile:  string
}

// Font bawaan jsPDF (helvetica) tidak menjamin tanda pisah en/em
const teksPdf = (s: string) => s.replace(/[–—−]/g, '-')

const NAVY: [number, number, number] = [26, 44, 78]

function getFinalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20
}

const labelBulan = (t: { bulan: number; tahun: number; berjalan: boolean }) =>
  `${BULAN_PANJANG[t.bulan]} ${t.tahun}${t.berjalan ? ' (berjalan)' : ''}`

const pelunasanTren = (t: { tagihan: number; terbayar: number }) =>
  t.tagihan > 0 ? `${Math.round((t.terbayar / t.tagihan) * 100)}%` : '-'

export function unduhLaporanUtamaPdf(o: OpsiLaporanUtama): void {
  const pisah = o.kolom.length > 1
  const doc = new jsPDF({ orientation: pisah ? 'landscape' : 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()
  // Tabel di dokumen ini memakai margin bawaan jspdf-autotable (40 pt); ujung garis
  // kop disamakan dengan tepi tabelnya
  const tepi = 40 / doc.internal.scaleFactor
  const kop  = tataKop(doc, o.kop, { atas: ATAS_KOP, kiri: tepi, kanan: pageWidth - tepi })
  // Halaman baru (manual maupun tabel bersambung) mulai di bawah kop
  const awalHalaman = kop.bawah + JARAK_ISI
  const margin = { top: awalHalaman }
  // Judul bagian berikutnya pindah halaman kalau sisa tempatnya sudah sempit (250 mm di A4 tegak)
  const batasBawah = doc.internal.pageSize.getHeight() - 47
  const keterangan = `Periode: ${o.periode}${o.komponen ? ` · Komponen: ${o.komponen}` : ''}`
  let y = judulLaporanPdf(doc, kop.bawah, 'Laporan Utama', keterangan) + 2

  const judulBagian = (judul: string, pindahHalaman = true) => {
    if (pindahHalaman && y > batasBawah) { doc.addPage(); y = awalHalaman + 4 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(judul, 14, y)
    y += 4
  }
  const tabel: Tabel = (head, body, columnStyles, rapat = false) => {
    autoTable(doc, {
      startY: y,
      margin,
      head,
      body,
      theme: 'grid',
      headStyles: pisah ? { fillColor: NAVY, halign: 'center', valign: 'middle' } : { fillColor: NAVY },
      // Tabel berkelompok (satu kelompok kolom per komponen) dirapatkan supaya angka
      // tidak terpenggal; barisnya tidak dibelah di pergantian halaman
      styles: pisah ? { fontSize: rapat ? 7 : 7.5, cellPadding: rapat ? 1.2 : 1.76 } : { fontSize: 9 },
      rowPageBreak: pisah ? 'avoid' : 'auto',
      columnStyles,
    })
    y = getFinalY(doc) + 10
  }

  if (pisah) tulisPerKomponen(o, judulBagian, tabel, pageWidth - 2 * tepi)
  else tulisSatuKolom(o.kolom[0].m, o.gabungan, judulBagian, tabel)

  tandaTanganPdf(doc, o.kop.tandaTangan, { y: getFinalY(doc), kiri: tepi, kanan: pageWidth - tepi, atasHalaman: awalHalaman })
  pasangKopSemuaHalaman(doc, kop)
  doc.save(`${o.namaFile}.pdf`)
}

type JudulBagian = (judul: string, pindahHalaman?: boolean) => void
type GayaKolom = Record<number, Partial<Styles>>
type Tabel = (head: RowInput[], body: RowInput[], columnStyles?: GayaKolom, rapat?: boolean) => void

/** Tata letak biasa: satu kolom nilai di setiap tabel */
function tulisSatuKolom(m: MetrikUtama, gabungan: MetrikUtama, judulBagian: JudulBagian, tabel: Tabel): void {
  const { ringkasan, pemasukan } = m
  tabel([['Ringkasan', 'Nilai']], [
    ['Total Pemasukan', fmt(pemasukan.total)],
    ['Dari Transaksi', `${pemasukan.transaksi} transaksi`],
    ['Tingkat Pelunasan (tagihan jatuh tempo)', ringkasan.tingkatPelunasan === null
      ? 'Belum ada tagihan jatuh tempo'
      : `${formatPersen(ringkasan.tingkatPelunasan)} (${fmt(ringkasan.terbayarJatuhTempo)} dari ${fmt(ringkasan.nilaiJatuhTempo)})`],
    ['Ketepatan Waktu', ringkasan.ketepatanWaktu === null
      ? 'Belum ada tagihan jatuh tempo'
      : `${formatPersen(ringkasan.ketepatanWaktu)} (${ringkasan.jumlahTepatWaktu} dari ${ringkasan.jumlahDinilai} tagihan)`],
    ['Rata-rata Keterlambatan', ringkasan.rataHariTelat === null
      ? 'Tidak ada yang telat'
      : `${Math.round(ringkasan.rataHariTelat)} hari (${ringkasan.jumlahTelat} tagihan lunas telat)`],
    ['Tunggakan (lewat jatuh tempo)', `${fmt(ringkasan.tunggakanBerjalan)} (${ringkasan.siswaMenunggak} siswa)`],
    ['Akan Masuk (belum jatuh tempo)', fmt(ringkasan.akanMasuk)],
  ])

  judulBagian('Komposisi Status Pembayaran', false)
  tabel([['Status', 'Jumlah Tagihan']], m.komposisiTagihan.map(d => [d.label, String(d.value)]))

  judulBagian('Tagihan vs Realisasi per Bulan Jatuh Tempo (12 Bulan Terakhir)')
  // Tagihan tiap bulan sudah digabung dengan tunggakan bulan sebelumnya; kolom
  // "Termasuk Tunggakan" memperlihatkan porsinya supaya tidak dijumlahkan antarbulan
  tabel([['Bulan', 'Tagihan', 'Termasuk Tunggakan', 'Terbayar', 'Pelunasan']], m.tren.map(t => [
    labelBulan(t),
    fmt(t.tagihan),
    t.tunggakanLama > 0 ? fmt(t.tunggakanLama) : '-',
    fmt(t.terbayar),
    pelunasanTren(t),
  ]))

  judulBagian('Umur Tunggakan (semua tunggakan per hari ini)')
  // Tiap rentang sudah digabung dengan tunggakan yang lebih lama; kolom "Termasuk
  // Lebih Lama" memperlihatkan porsinya supaya nominal tidak dijumlahkan antarbaris
  tabel([['Umur', 'Nominal', 'Termasuk Lebih Lama', 'Jumlah Siswa', 'Jumlah Tagihan']], m.umur.map(k => [
    teksPdf(k.label), fmt(k.nominal), k.lebihLama > 0 ? fmt(k.lebihLama) : '-',
    String(k.jumlahSiswa), String(k.jumlahTagihan),
  ]))

  if (m.jenjang.length > 0) {
    judulBagian('Pelunasan per Jenjang (tagihan jatuh tempo)')
    tabel([['Jenjang', 'Tingkat Pelunasan', 'Terbayar', 'Nilai Jatuh Tempo']],
      m.jenjang.map(j => [j.jenjang, teksPdf(formatPersen(j.pct)), fmt(j.terbayar), fmt(j.nilai)]))
  }

  tulisKomponenBelum(gabungan, judulBagian, tabel)
}

function tulisKomponenBelum(gabungan: MetrikUtama, judulBagian: JudulBagian, tabel: Tabel): void {
  if (gabungan.komponen.length === 0) return
  judulBagian('Komponen Paling Banyak Belum Dibayar')
  tabel([['Komponen', 'Jumlah Tagihan', 'Total Nominal']], gabungan.komponen.map(k => [k.nama, String(k.jumlah), fmt(k.total)]))
}

/** Kepala dua baris: label kiri setinggi dua baris, lalu satu kelompok kolom per komponen */
function kepalaKelompok(kiri: string, kolom: { label: string }[], sub: string[]): RowInput[] {
  return [
    [
      { content: kiri, rowSpan: 2 },
      ...kolom.map((k): CellInput => ({ content: k.label, colSpan: sub.length })),
    ],
    kolom.flatMap(() => sub),
  ]
}

/** Kolom pertama selebar `pertama` mm, kolom nilai sisanya sama lebar dan rata kanan */
const kolomRata = (lebarIsi: number, pertama: number, jumlah: number): GayaKolom => {
  const lebar = (lebarIsi - pertama) / jumlah
  return {
    0: { cellWidth: pertama },
    ...Object.fromEntries(Array.from({ length: jumlah }, (_, i) => [i + 1, { cellWidth: lebar, halign: 'right' as const }])),
  }
}

// Tabel berkelompok memuat belasan kolom: angka ditulis tanpa "Rp" (judul bagiannya
// menyebut "Rupiah") supaya muat tanpa dipenggal
const angka = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)

/** Unduhan per komponen yang dipisah: satu kolom atau kelompok kolom per komponen */
function tulisPerKomponen(o: OpsiLaporanUtama, judulBagian: JudulBagian, tabel: Tabel, lebarIsi: number): void {
  const { kolom } = o
  const baris = (label: string, nilai: (m: MetrikUtama) => string): RowInput =>
    [label, ...kolom.map(k => teksPdf(nilai(k.m)))]
  // Kolom judul baris tabel berkelompok: cukup untuk "September 2026 (berjalan)" dua baris
  const PERTAMA = 24

  tabel([['Ringkasan', ...kolom.map(k => k.label)]], [
    baris('Total Pemasukan', m => fmt(m.pemasukan.total)),
    baris('Dari Transaksi', m => `${m.pemasukan.transaksi} transaksi`),
    baris('Tingkat Pelunasan (tagihan jatuh tempo)', m => formatPersen(m.ringkasan.tingkatPelunasan)),
    baris('Terbayar (tagihan jatuh tempo)', m => fmt(m.ringkasan.terbayarJatuhTempo)),
    baris('Nilai Tagihan Jatuh Tempo', m => fmt(m.ringkasan.nilaiJatuhTempo)),
    baris('Ketepatan Waktu', m => m.ringkasan.ketepatanWaktu === null
      ? '-'
      : `${formatPersen(m.ringkasan.ketepatanWaktu)} (${m.ringkasan.jumlahTepatWaktu} dari ${m.ringkasan.jumlahDinilai})`),
    baris('Rata-rata Keterlambatan', m => m.ringkasan.rataHariTelat === null ? '-' : `${Math.round(m.ringkasan.rataHariTelat)} hari`),
    baris('Tunggakan (lewat jatuh tempo)', m => fmt(m.ringkasan.tunggakanBerjalan)),
    baris('Siswa Menunggak', m => `${m.ringkasan.siswaMenunggak} siswa`),
    baris('Akan Masuk (belum jatuh tempo)', m => fmt(m.ringkasan.akanMasuk)),
  ], kolomRata(lebarIsi, 70, kolom.length))

  judulBagian('Komposisi Status Pembayaran (jumlah tagihan)', false)
  tabel([['Status', ...kolom.map(k => k.label)]],
    kolom[0].m.komposisiTagihan.map((d, i) => [d.label, ...kolom.map(k => String(k.m.komposisiTagihan[i]?.value ?? 0))]),
    kolomRata(lebarIsi, 70, kolom.length))

  judulBagian('Tagihan vs Realisasi per Bulan Jatuh Tempo, 12 Bulan Terakhir (Rupiah)')
  // Bulan-bulan tren sama untuk setiap kolom: dihitung dari waktu dan tahun ajaran yang sama
  tabel(kepalaKelompok('Bulan', kolom, ['Tagihan', 'Termasuk Tunggakan', 'Terbayar', 'Pelunasan']),
    kolom[0].m.tren.map((titik, i) => [
      labelBulan(titik),
      ...kolom.flatMap(k => {
        const t = k.m.tren[i]
        return [angka(t.tagihan), t.tunggakanLama > 0 ? angka(t.tunggakanLama) : '-', angka(t.terbayar), pelunasanTren(t)]
      }),
    ]),
    kolomRata(lebarIsi, PERTAMA, kolom.length * 4), true)

  judulBagian('Umur Tunggakan, semua tunggakan per hari ini (Rupiah)')
  tabel(kepalaKelompok('Umur', kolom, ['Nominal', 'Termasuk Lebih Lama', 'Siswa', 'Tagihan']),
    kolom[0].m.umur.map((kel, i) => [
      teksPdf(kel.label),
      ...kolom.flatMap(k => {
        const u = k.m.umur[i]
        return [angka(u.nominal), u.lebihLama > 0 ? angka(u.lebihLama) : '-', String(u.jumlahSiswa), String(u.jumlahTagihan)]
      }),
    ]),
    kolomRata(lebarIsi, PERTAMA, kolom.length * 4), true)

  // Jenjang yang tidak punya tagihan komponen tertentu tetap satu baris, kolomnya "-"
  const kodeJenjang = [...new Set(kolom.flatMap(k => k.m.jenjang.map(j => j.kode)))]
    .sort((a, b) => a.localeCompare(b, 'id', { numeric: true }))
  if (kodeJenjang.length > 0) {
    judulBagian('Pelunasan per Jenjang, tagihan jatuh tempo (Rupiah)')
    tabel(kepalaKelompok('Jenjang', kolom, ['Pelunasan', 'Terbayar', 'Nilai Jatuh Tempo']),
      kodeJenjang.map(kode => [
        `Jenjang ${kode}`,
        ...kolom.flatMap(k => {
          const j = k.m.jenjang.find(x => x.kode === kode)
          return j ? [teksPdf(formatPersen(j.pct)), angka(j.terbayar), angka(j.nilai)] : ['-', '-', '-']
        }),
      ]),
      kolomRata(lebarIsi, PERTAMA, kolom.length * 3), true)
  }

  tulisKomponenBelum(o.gabungan, judulBagian, tabel)
}
