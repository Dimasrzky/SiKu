import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable, { type CellInput, type RowInput } from 'jspdf-autotable'
import { formatRupiah } from './formatLaporan'
import { labelBulan, teksBesaran, type BarisKas, type KelompokPengeluaran } from './pengeluaran'

// Unduhan Excel/PDF halaman Pengeluaran. Rincian mengikuti format laporan pengeluaran
// sekolah: No dan Jenis digabung setinggi baris kategorinya, kategori kosong tetap
// tampil, dan baris Total di bawah. Hanya untuk komponen 'use client'.

export type FormatEkspor = 'excel' | 'pdf'

const NAVY: [number, number, number] = [26, 44, 78]

// Font bawaan jsPDF (helvetica) tidak menjamin tanda pisah en/em
const teksPdf = (s: string) => s.replace(/[–—]/g, '-')

const namaBerkas = (s: string) => s.replace(/[^\w-]+/g, '_')

function kopPdf(doc: jsPDF, namaSekolah: string, judul: string, keterangan: string): number {
  const lebar = doc.internal.pageSize.getWidth()
  const kini  = new Date()
  let y = 16
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text(teksPdf(namaSekolah || 'Sekolah'), lebar / 2, y, { align: 'center' })
  y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  doc.text(teksPdf(judul), lebar / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(9); doc.setTextColor(100)
  doc.text(teksPdf(keterangan), lebar / 2, y, { align: 'center' })
  y += 5
  doc.text(
    `Dibuat pada ${kini.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}, ${kini.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
    lebar / 2, y, { align: 'center' },
  )
  doc.setTextColor(0)
  return y + 6
}

function nomorHalaman(doc: jsPDF): void {
  const lebar  = doc.internal.pageSize.getWidth()
  const tinggi = doc.internal.pageSize.getHeight()
  const jumlah = doc.getNumberOfPages()
  for (let p = 1; p <= jumlah; p++) {
    doc.setPage(p)
    doc.setFontSize(8); doc.setTextColor(120)
    doc.text(`Halaman ${p} dari ${jumlah}`, lebar - 10, tinggi - 8, { align: 'right' })
  }
}

// ── Rincian pengeluaran satu bulan ───────────────────────────────────────────

const KOLOM_RINCIAN = ['No', 'Jenis', 'Keterangan Barang', 'Volume', 'Satuan', 'Biaya Satuan', 'Jumlah']

export function unduhRincianPengeluaran(opsi: {
  format:      FormatEkspor
  namaSekolah: string
  bulan:       { bulan: number; tahun: number }
  kelompok:    KelompokPengeluaran[]
}): void {
  const { format, namaSekolah, bulan, kelompok } = opsi
  const judulBulan = labelBulan(bulan)
  const total      = kelompok.reduce((s, k) => s + k.total, 0)
  const berkas     = namaBerkas(`Laporan_Pengeluaran_${judulBulan}`)

  if (format === 'excel') {
    const aoa: (string | number)[][] = [KOLOM_RINCIAN]
    const merges: XLSX.Range[] = []
    kelompok.forEach((k, i) => {
      const awal = aoa.length
      const isi  = k.baris.length > 0 ? k.baris : [null]
      isi.forEach((b, j) => {
        aoa.push([
          j === 0 ? i + 1 : '',
          j === 0 ? k.kategori.nama : '',
          b?.keterangan ?? '',
          b ? teksBesaran(b.volume, b.volume_satuan) : '',
          b ? teksBesaran(b.kuantitas, b.kuantitas_satuan) : '',
          b?.biaya_satuan ?? '',
          b?.jumlah ?? '',
        ])
      })
      if (isi.length > 1) {
        merges.push({ s: { r: awal, c: 0 }, e: { r: aoa.length - 1, c: 0 } })
        merges.push({ s: { r: awal, c: 1 }, e: { r: aoa.length - 1, c: 1 } })
      }
    })
    merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: 5 } })
    aoa.push(['Total', '', '', '', '', '', total])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols']   = [5, 20, 36, 12, 12, 14, 16].map(wch => ({ wch }))
    ws['!merges'] = merges
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pengeluaran')
    XLSX.writeFile(wb, `${berkas}.xlsx`)
    return
  }

  const doc = new jsPDF({ orientation: 'portrait' })
  const y   = kopPdf(doc, namaSekolah, 'Laporan Pengeluaran', `Bulan ${judulBulan}`)
  const kanan = { halign: 'right' as const }

  const body: RowInput[] = []
  kelompok.forEach((k, i) => {
    const isi = k.baris.length > 0 ? k.baris : [null]
    isi.forEach((b, j) => {
      const sel: CellInput[] = []
      if (j === 0) {
        sel.push({ content: String(i + 1), rowSpan: isi.length, styles: { halign: 'center', valign: 'middle' } })
        sel.push({ content: teksPdf(k.kategori.nama), rowSpan: isi.length, styles: { valign: 'middle' } })
      }
      sel.push(
        teksPdf(b?.keterangan ?? ''),
        b ? teksPdf(teksBesaran(b.volume, b.volume_satuan)) : '',
        b ? teksPdf(teksBesaran(b.kuantitas, b.kuantitas_satuan)) : '',
        { content: b?.biaya_satuan != null ? formatRupiah(b.biaya_satuan) : '', styles: kanan },
        { content: b ? formatRupiah(b.jumlah) : '', styles: kanan },
      )
      body.push(sel)
    })
  })

  autoTable(doc, {
    startY:     y,
    head:       [KOLOM_RINCIAN],
    body,
    foot:       [[{ content: 'Total', colSpan: 6, styles: { halign: 'center' } }, { content: formatRupiah(total), styles: kanan }]],
    showFoot:   'lastPage',
    theme:      'grid',
    headStyles: { fillColor: NAVY, fontSize: 8, halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles:     { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 28 }, 3: { cellWidth: 18 }, 4: { cellWidth: 18 }, 5: { cellWidth: 25 }, 6: { cellWidth: 27 } },
    margin:     { left: 10, right: 10 },
  })

  nomorHalaman(doc)
  doc.save(`${berkas}.pdf`)
}

// ── Ringkasan kas satu periode ───────────────────────────────────────────────

const KOLOM_KAS = ['Bulan', 'Pemasukan SPP', 'Pengeluaran', 'Selisih', 'Saldo Kumulatif']

export function unduhRingkasanKas(opsi: {
  format:      FormatEkspor
  namaSekolah: string
  namaPeriode: string
  baris:       BarisKas[]
}): void {
  const { format, namaSekolah, namaPeriode, baris } = opsi
  const masuk  = baris.reduce((s, b) => s + b.pemasukan, 0)
  const keluar = baris.reduce((s, b) => s + b.pengeluaran, 0)
  const saldo  = baris.length > 0 ? baris[baris.length - 1].saldo : 0
  const berkas = namaBerkas(`Ringkasan_Kas_${namaPeriode}`)

  if (format === 'excel') {
    const ws = XLSX.utils.aoa_to_sheet([
      KOLOM_KAS,
      ...baris.map(b => [labelBulan(b), b.pemasukan, b.pengeluaran, b.selisih, b.saldo]),
      ['Total', masuk, keluar, masuk - keluar, saldo],
    ])
    ws['!cols'] = [18, 16, 16, 16, 18].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan Kas')
    XLSX.writeFile(wb, `${berkas}.xlsx`)
    return
  }

  const doc = new jsPDF({ orientation: 'portrait' })
  const y   = kopPdf(doc, namaSekolah, 'Ringkasan Kas', `Periode ${namaPeriode} - pemasukan dari pembayaran SPP yang tercatat di SiKu`)
  const rp  = (n: number) => ({ content: formatRupiah(n), styles: { halign: 'right' as const } })

  autoTable(doc, {
    startY:     y,
    head:       [KOLOM_KAS],
    body:       baris.map(b => [labelBulan(b), rp(b.pemasukan), rp(b.pengeluaran), rp(b.selisih), rp(b.saldo)]),
    foot:       [['Total', rp(masuk), rp(keluar), rp(masuk - keluar), rp(saldo)]],
    showFoot:   'lastPage',
    theme:      'grid',
    headStyles: { fillColor: NAVY, fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles:     { fontSize: 8, cellPadding: 1.5 },
    margin:     { left: 10, right: 10 },
  })

  nomorHalaman(doc)
  doc.save(`${berkas}.pdf`)
}
