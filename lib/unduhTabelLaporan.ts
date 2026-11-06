import { jsPDF } from 'jspdf'
import autoTable, { type CellInput, type RowInput } from 'jspdf-autotable'
import type { DataKop } from './kopLaporan'
import type { GrupKepala } from './eksporExcel'
import { ATAS_KOP, JARAK_ISI, judulLaporanPdf, pasangKopSemuaHalaman, tandaTanganPdf, tataKop } from './kopPdf'
import { formatRupiah as fmt } from './formatLaporan'

// Unduhan tabel di halaman Laporan (transaksi, tunggakan, siswa aktif, alumni, keuangan
// tahunan): satu tabel berkop sebagai Excel atau PDF. Hanya untuk komponen 'use client'.

export type FormatEkspor = 'excel' | 'pdf'

// Font bawaan jsPDF (helvetica) tidak menjamin tanda pisah en/em — kode PDF lama di
// halaman ini pun sengaja memakai "-" biasa
const teksPdf = (s: string) => s.replace(/[–—]/g, '-')

function getFinalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20
}

/**
 * Kepala tabel PDF. Dengan kelompok: dua baris — kolom di luar kelompok setinggi dua
 * baris, nama kelompok selebar kolom-kolomnya; baris kedua hanya berisi kolom anggota
 * kelompok, urut kiri ke kanan. Pasangan Excel-nya: `grupKepala` di tulisTabelExcel.
 */
export function kepalaPdf(headers: string[], grup: GrupKepala[] = []): RowInput[] {
  if (grup.length === 0) return [headers.map(teksPdf)]
  const dalamGrup = (c: number) => grup.some(g => c >= g.dari && c < g.dari + g.jumlah)
  return [
    headers.flatMap((h, c): CellInput[] => {
      if (!dalamGrup(c)) return [{ content: teksPdf(h), rowSpan: 2 }]
      const g = grup.find(x => x.dari === c)
      return g ? [{ content: teksPdf(g.label), colSpan: g.jumlah }] : []
    }),
    headers.filter((_, c) => dalamGrup(c)).map(teksPdf),
  ]
}

export interface TabelEkspor {
  format:       FormatEkspor
  /** Tanpa ekstensi — .xlsx / .pdf ditambahkan sesuai format */
  namaFile:     string
  namaSheet:    string
  /** Judul dan keterangan cakupan di bawah kop */
  judul:        string
  keterangan:   string
  /** Kop sekolah, sudah diperiksa lengkap oleh useKopLaporan */
  kop:          DataKop
  headers:      string[]
  /** Kepala dua baris — judul kelompok (mis. nama komponen) di atas beberapa kolom */
  grupKepala?:  GrupKepala[]
  baris:        (string | number)[][]
  /** Lebar kolom Excel (wch) */
  lebarKolom:   number[]
  /** Indeks kolom Rupiah: angka di Excel (format Rp), "Rp …" rata kanan dan dijumlah di PDF */
  kolomRupiah?: number[]
}

/**
 * Tulis satu tabel laporan sebagai Excel atau PDF dari baris yang SAMA, supaya isi
 * kedua format tidak mungkin berselisih. Keduanya berkop sekolah. PDF: kop di setiap
 * halaman, lanskap otomatis untuk tabel lebar, baris total untuk kolom Rupiah, dan
 * nomor halaman.
 */
export async function unduhTabel(t: TabelEkspor): Promise<void> {
  const lanskap = t.headers.length > 8

  if (t.format === 'excel') {
    // ExcelJS berat — baru dimuat saat tombol Excel diklik
    const { bukuExcelBaru, lembarBerkop, tulisTabelExcel, simpanExcel } = await import('./eksporExcel')
    const wb = await bukuExcelBaru()
    const { ws, baris } = lembarBerkop(wb, t.kop, {
      nama: t.namaSheet, lebarKolom: t.lebarKolom, judul: t.judul, keterangan: t.keterangan, lanskap,
    })
    tulisTabelExcel(ws, baris, { kepala: t.headers, grupKepala: t.grupKepala, baris: t.baris, kolomRupiah: t.kolomRupiah })
    await simpanExcel(wb, t.namaFile)
    return
  }

  const doc = new jsPDF({ orientation: lanskap ? 'landscape' : 'portrait' })
  const lebarHalaman  = doc.internal.pageSize.getWidth()
  const tinggiHalaman = doc.internal.pageSize.getHeight()
  const navy: [number, number, number] = [26, 44, 78]
  const kop = tataKop(doc, t.kop, { atas: ATAS_KOP, kiri: 10, kanan: lebarHalaman - 10 })
  const y   = judulLaporanPdf(doc, kop.bawah, t.judul, t.keterangan)

  const rupiah = new Set(t.kolomRupiah ?? [])
  const kanan  = { halign: 'right' as const }
  const body   = t.baris.map(b => b.map((sel, i) => (
    rupiah.has(i) && typeof sel === 'number' ? { content: fmt(sel), styles: kanan } : teksPdf(String(sel))
  )))

  // Baris total: label "Total" membentang sampai kolom Rupiah pertama
  const pertamaRp = rupiah.size > 0 ? Math.min(...rupiah) : -1
  const foot = pertamaRp > 0
    ? [[
        { content: 'Total', colSpan: pertamaRp },
        ...t.headers.slice(pertamaRp).map((_, j) => {
          const i = pertamaRp + j
          if (!rupiah.has(i)) return ''
          const jumlah = t.baris.reduce((s, b) => s + (typeof b[i] === 'number' ? (b[i] as number) : 0), 0)
          return { content: fmt(jumlah), styles: kanan }
        }),
      ]]
    : undefined

  const grup = t.grupKepala ?? []
  const head = kepalaPdf(t.headers, grup)
  // Tabel per komponen bisa sangat lebar — huruf sedikit diperkecil
  const ukuranHuruf = t.headers.length > 14 ? 7 : 8

  autoTable(doc, {
    startY:     y,
    head,
    body,
    foot,
    showFoot:   'lastPage',
    theme:      'grid',
    headStyles: grup.length === 0
      ? { fillColor: navy, fontSize: ukuranHuruf }
      : { fillColor: navy, fontSize: ukuranHuruf, halign: 'center', valign: 'middle' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: ukuranHuruf },
    styles:     { fontSize: ukuranHuruf, cellPadding: 1.5 },
    // Halaman lanjutan mulai di bawah kop
    margin:     { left: 10, right: 10, top: kop.bawah + JARAK_ISI },
  })

  tandaTanganPdf(doc, t.kop.tandaTangan, { y: getFinalY(doc), kiri: 10, kanan: lebarHalaman - 10, atasHalaman: kop.bawah + JARAK_ISI })

  const jumlahHalaman = doc.getNumberOfPages()
  for (let p = 1; p <= jumlahHalaman; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120)
    doc.text(`Halaman ${p} dari ${jumlahHalaman}`, lebarHalaman - 10, tinggiHalaman - 8, { align: 'right' })
  }
  pasangKopSemuaHalaman(doc, kop)
  doc.save(`${t.namaFile}.pdf`)
}
