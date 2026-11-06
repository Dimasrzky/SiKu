import { jsPDF } from 'jspdf'
import autoTable, { type CellInput, type RowInput } from 'jspdf-autotable'
import { formatRupiah } from './formatLaporan'
import { kunciKomponen, persenTersisa, type BagianKomponen, type SaldoKomponen } from './kasKomponen'
import type { KolomKomponen } from './komponenLaporan'
import { labelBulan, teksSatuan, teksVolume, type KelompokPengeluaran, type Pengeluaran } from './pengeluaran'
import type { BarisRiwayatKas } from './riwayatKas'
import type { DataKop } from './kopLaporan'
import { ATAS_KOP, JARAK_ISI, judulLaporanPdf, pasangKopSemuaHalaman, tandaTanganPdf, tataKop, type TataKop } from './kopPdf'
import type { GrupKepala, TabelExcel } from './eksporExcel'
import { kepalaPdf } from './unduhTabelLaporan'

// Unduhan Excel/PDF halaman Pengeluaran — mengikuti tab yang sedang dibuka:
// - Daftar Pengeluaran: daftar bulan terpilih per jenis (No dan Jenis digabung setinggi
//   baris jenisnya), beserta sumber dananya, dan baris Total.
// - Ringkasan Kas: ringkasan bulan terpilih, saldo per komponen sepanjang periode, dan
//   riwayat pemasukan + pengeluaran bulan itu.
// Keduanya berkop sekolah (lib/kopPdf, lib/eksporExcel). Hanya untuk komponen 'use client'.
//
// Pilihan komponen (lib/komponenLaporan, semua sekolah sejak 6 Nov 2026): hanya
// pemasukan dan pengeluaran yang menyentuh komponen terpilih, nominalnya bagian komponen
// itu. Daftar Pengeluaran tetap menampilkan Jumlah belanja penuh (sama dengan Volume ×
// Biaya Satuan) ditambah kolom bagian komponen terpilih (keputusan user).

export type FormatEkspor = 'excel' | 'pdf'

/** Pilihan komponen yang sudah diterjemahkan halaman — tanpa ini unduhan memuat semua komponen */
export interface KomponenUnduhan {
  /** Kunci komponen terpilih (kunciKomponen) */
  pilih:      ReadonlySet<string>
  /** Nama komponen terpilih, urut kolom */
  nama:       string[]
  /** Kolom nominal: satu per komponen (dipisah) atau satu kolom gabungan */
  kolom:      KolomKomponen[]
  pisah:      boolean
  /** " · Komponen: SPP" — ditempel ke keterangan */
  keterangan: string
  /** "_SPP" — ditempel ke nama berkas */
  akhiran:    string
}

/** Rupiah bagian komponen-komponen `kunci` */
const jumlahUntuk = (bagian: BagianKomponen[], kunci: ReadonlySet<string>): number =>
  bagian.reduce((s, b) => (kunci.has(kunciKomponen(b.nama)) ? s + b.jumlah : s), 0)

const sumberSebagaiBagian = (p: Pengeluaran): BagianKomponen[] =>
  p.sumber_dana.map(s => ({ nama: s.nama_komponen, jumlah: s.nominal }))

/** Satu kolom gabungan: "Dari SPP", "Dari SPP + Komite", atau "Dari Komponen Terpilih" */
const labelGabungan = (nama: string[]) => (nama.length <= 2 ? `Dari ${nama.join(' + ')}` : 'Dari Komponen Terpilih')

const NAVY: [number, number, number] = [26, 44, 78]
const ABU:  [number, number, number] = [241, 245, 249]

// Font bawaan jsPDF (helvetica) tidak menjamin tanda pisah en/em dan tanda minus
const teksPdf = (s: string) => s.replace(/[–—−]/g, '-')

const namaBerkas = (s: string) => s.replace(/[^\w-]+/g, '_')

const tanggalPanjang = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })

/** "SPP Rp 400.000, Komite Rp 100.000" */
const teksSumber = (p: Pengeluaran) =>
  p.sumber_dana.map(s => `${s.nama_komponen} ${formatRupiah(s.nominal)}`).join(', ')

interface AwalPdf {
  kop:          TataKop
  /** Awal isi di halaman pertama, di bawah judul laporan */
  y:            number
  /** Margin tabel: tepi kiri/kanan kop, dan halaman lanjutan mulai di bawah kop */
  margin:       { left: number; right: number; top: number }
}

/** Kop sekolah + judul laporan di halaman pertama */
function awalPdf(doc: jsPDF, dataKop: DataKop, judul: string, keterangan: string): AwalPdf {
  const lebar = doc.internal.pageSize.getWidth()
  const kop   = tataKop(doc, dataKop, { atas: ATAS_KOP, kiri: 10, kanan: lebar - 10 })
  return {
    kop,
    y:      judulLaporanPdf(doc, kop.bawah, judul, keterangan),
    margin: { left: 10, right: 10, top: kop.bawah + JARAK_ISI },
  }
}

/**
 * Tanda tangan di bawah tabel terakhir, lalu nomor halaman dan kop di setiap halaman —
 * dipanggil sesudah semua isi digambar
 */
function akhiriPdf(doc: jsPDF, awal: AwalPdf, dataKop: DataKop): void {
  const lebar  = doc.internal.pageSize.getWidth()
  const tinggi = doc.internal.pageSize.getHeight()
  const { kop, margin } = awal
  tandaTanganPdf(doc, dataKop.tandaTangan, { y: akhirTabel(doc), kiri: margin.left, kanan: lebar - margin.right, atasHalaman: margin.top })
  const jumlah = doc.getNumberOfPages()
  for (let p = 1; p <= jumlah; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120)
    doc.text(`Halaman ${p} dari ${jumlah}`, lebar - 10, tinggi - 8, { align: 'right' })
  }
  pasangKopSemuaHalaman(doc, kop)
}

/** Posisi akhir tabel terakhir yang digambar jspdf-autotable */
const akhirTabel = (doc: jsPDF): number => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20

/** Subjudul tabel berikutnya; pindah ke halaman baru kalau sisa halaman tinggal sedikit */
function subjudulPdf(doc: jsPDF, teks: string, y: number, atasHalaman: number): number {
  if (y > doc.internal.pageSize.getHeight() - 35) {
    doc.addPage()
    y = atasHalaman + 4
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0)
  doc.text(teksPdf(teks), 10, y)
  doc.setFont('helvetica', 'normal')
  return y + 3
}

// ── Daftar pengeluaran satu bulan ────────────────────────────────────────────

const KOLOM_DAFTAR = ['No', 'Jenis', 'Nama', 'Tanggal', 'Volume', 'Satuan', 'Biaya Satuan', 'Jumlah', 'Sumber Dana']

/**
 * `kelompok` sudah disaring halaman: dengan pilihan komponen hanya pengeluaran yang
 * mengambil dana komponen terpilih. Kolom bagian komponen ada di antara Jumlah dan Sumber Dana.
 */
export async function unduhDaftarPengeluaran(opsi: {
  format:    FormatEkspor
  kop:       DataKop
  bulan:     { bulan: number; tahun: number }
  kelompok:  KelompokPengeluaran[]
  komponen?: KomponenUnduhan
}): Promise<void> {
  const { format, kop, bulan, kelompok, komponen } = opsi
  const judulBulan = labelBulan(bulan)
  const total      = kelompok.reduce((s, k) => s + k.total, 0)
  const berkas     = namaBerkas(`Daftar_Pengeluaran_${judulBulan}`) + (komponen?.akhiran ?? '')
  const keterangan = `Bulan ${judulBulan}${komponen?.keterangan ?? ''}`

  // Kolom bagian komponen terpilih: satu per komponen (dipisah) atau satu gabungan
  const kolomDana  = komponen ? (komponen.pisah ? komponen.kolom.map(k => k.label) : [labelGabungan(komponen.nama)]) : []
  const n          = kolomDana.length
  const danaDari   = (b: Pengeluaran): number[] => (komponen ? komponen.kolom.map(k => jumlahUntuk(sumberSebagaiBagian(b), k.kunci)) : [])
  const totalDana  = kolomDana.map((_, i) => kelompok.reduce((s, k) => s + k.baris.reduce((t, b) => t + danaDari(b)[i], 0), 0))
  const kepala     = [...KOLOM_DAFTAR.slice(0, 8), ...kolomDana, KOLOM_DAFTAR[8]]
  const grup: GrupKepala[] = komponen?.pisah ? [{ label: 'Dari Komponen', dari: 8, jumlah: n }] : []
  const kosong     = komponen ? `Belum ada pengeluaran dari komponen terpilih di ${judulBulan}.` : `Belum ada pengeluaran di ${judulBulan}.`

  if (format === 'excel') {
    const baris: TabelExcel['baris'] = []
    const gabung: NonNullable<TabelExcel['gabung']> = []
    kelompok.forEach((k, i) => {
      const awal = baris.length
      k.baris.forEach((b, j) => {
        baris.push([
          j === 0 ? i + 1 : '',
          j === 0 ? k.kategori.nama : '',
          b.keterangan,
          tanggalPanjang(b.tanggal),
          teksVolume(b),
          teksSatuan(b),
          b.biaya_satuan ?? '',
          b.jumlah,
          ...danaDari(b),
          teksSumber(b),
        ])
      })
      if (k.baris.length > 1) {
        gabung.push({ baris: awal, kolom: 0, sampaiBaris: baris.length - 1, sampaiKolom: 0 })
        gabung.push({ baris: awal, kolom: 1, sampaiBaris: baris.length - 1, sampaiKolom: 1 })
      }
    })

    const { bukuExcelBaru, lembarBerkop, tulisTabelExcel, simpanExcel } = await import('./eksporExcel')
    const wb = await bukuExcelBaru()
    const { ws, baris: mulai } = lembarBerkop(wb, kop, {
      nama: 'Pengeluaran', lebarKolom: [5, 20, 30, 18, 14, 12, 14, 16, ...kolomDana.map(() => 16), 36],
      judul: 'Daftar Pengeluaran', keterangan, lanskap: true,
    })
    tulisTabelExcel(ws, mulai, {
      kepala, grupKepala: grup, baris, gabung,
      kolomRupiah: [6, 7, ...kolomDana.map((_, i) => 8 + i)], kolomTengah: [0],
      total: ['Total Pengeluaran', '', '', '', '', '', '', total, ...totalDana, ''],
      gabungTotal: [{ kolom: 0, sampaiKolom: 6 }],
    })
    await simpanExcel(wb, berkas)
    return
  }

  const doc = new jsPDF({ orientation: 'landscape' })
  const awal = awalPdf(doc, kop, 'Daftar Pengeluaran', keterangan)
  const { y, margin } = awal
  const kanan = { halign: 'right' as const }

  const body: RowInput[] = []
  kelompok.forEach((k, i) => {
    k.baris.forEach((b, j) => {
      const sel: CellInput[] = []
      if (j === 0) {
        sel.push({ content: String(i + 1), rowSpan: k.baris.length, styles: { halign: 'center', valign: 'middle' } })
        sel.push({ content: teksPdf(k.kategori.nama), rowSpan: k.baris.length, styles: { valign: 'middle' } })
      }
      sel.push(
        teksPdf(b.keterangan),
        tanggalPanjang(b.tanggal),
        teksPdf(teksVolume(b)),
        teksPdf(teksSatuan(b)),
        { content: b.biaya_satuan != null ? formatRupiah(b.biaya_satuan) : '', styles: kanan },
        { content: formatRupiah(b.jumlah), styles: kanan },
        ...danaDari(b).map(d => ({ content: d > 0 ? formatRupiah(d) : '-', styles: kanan })),
        teksPdf(teksSumber(b)),
      )
      body.push(sel)
    })
  })
  if (body.length === 0) body.push([{ content: kosong, colSpan: kepala.length, styles: { halign: 'center', textColor: 120 } }])

  // Kolom bagian komponen memakan tempat: kolom lain dirapatkan supaya Nama tetap lega;
  // Sumber Dana mengisi sisanya
  const lebarDana = Object.fromEntries(kolomDana.map((_, i) => [8 + i, { cellWidth: 23 }]))
  const lebarTetap: Record<number, { cellWidth: number }> = n > 0
    ? { 0: { cellWidth: 9 }, 1: { cellWidth: 24 }, 3: { cellWidth: 25 }, 4: { cellWidth: 16 }, 5: { cellWidth: 14 }, 6: { cellWidth: 22 }, 7: { cellWidth: 24 } }
    : { 0: { cellWidth: 9 }, 1: { cellWidth: 30 }, 3: { cellWidth: 28 }, 4: { cellWidth: 22 }, 5: { cellWidth: 18 }, 6: { cellWidth: 25 }, 7: { cellWidth: 27 }, 8: { cellWidth: 55 } }
  autoTable(doc, {
    startY:     y,
    head:       kepalaPdf(kepala, grup),
    body,
    foot:       [[
      { content: 'Total Pengeluaran', colSpan: 7, styles: { halign: 'center' } },
      { content: formatRupiah(total), styles: kanan },
      ...totalDana.map(d => ({ content: formatRupiah(d), styles: kanan })),
      '',
    ]],
    showFoot:   'lastPage',
    theme:      'grid',
    headStyles: grup.length > 0 ? { fillColor: NAVY, fontSize: 8, halign: 'center', valign: 'middle' } : { fillColor: NAVY, fontSize: 8, halign: 'center' },
    footStyles: { fillColor: ABU, textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles:     { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { ...lebarTetap, ...lebarDana },
    margin,
  })

  akhiriPdf(doc, awal, kop)
  doc.save(`${berkas}.pdf`)
}

// ── Ringkasan kas ────────────────────────────────────────────────────────────

const persenTeks = (s: SaldoKomponen) => {
  const p = persenTersisa(s)
  return p === null ? '-' : `${Math.round(p)}%`
}

export async function unduhRingkasanKas(opsi: {
  format:      FormatEkspor
  kop:         DataKop
  namaPeriode: string
  bulan:       { bulan: number; tahun: number }
  masuk:       number
  keluar:      number
  saldo:       SaldoKomponen[]
  riwayat:     BarisRiwayatKas[]
  komponen?:   KomponenUnduhan
}): Promise<void> {
  if (opsi.komponen) return unduhRingkasanKasKomponen({ ...opsi, komponen: opsi.komponen })
  const { format, kop, namaPeriode, bulan, masuk, keluar, saldo, riwayat } = opsi
  const judulBulan = labelBulan(bulan)
  const totalMasuk  = saldo.reduce((s, b) => s + b.masuk, 0)
  const totalKeluar = saldo.reduce((s, b) => s + b.keluar, 0)
  const totalSaldo  = saldo.reduce((s, b) => s + b.saldo, 0)
  const berkas = namaBerkas(`Ringkasan_Kas_${judulBulan}`)

  if (format === 'excel') {
    const { bukuExcelBaru, lembarBerkop, tulisTabelExcel, simpanExcel } = await import('./eksporExcel')
    const wb = await bukuExcelBaru()

    const ringkasan = lembarBerkop(wb, kop, {
      nama: 'Ringkasan', lebarKolom: [28, 18],
      judul: 'Ringkasan Kas', keterangan: `Bulan ${judulBulan} - Periode ${namaPeriode}`,
    })
    tulisTabelExcel(ringkasan.ws, ringkasan.baris, {
      kepala: [`Bulan ${judulBulan}`, 'Jumlah'],
      baris: [['Pemasukan', masuk], ['Pengeluaran', keluar]],
      total: ['Selisih', masuk - keluar],
      kolomRupiah: [1],
    })

    const perKomponen = lembarBerkop(wb, kop, {
      nama: `Saldo ${namaPeriode}`.slice(0, 31).replace(/[\\/?*[\]:]/g, '-'), lebarKolom: [22, 16, 16, 16, 10],
      judul: 'Saldo per Komponen', keterangan: `Periode ${namaPeriode}`,
    })
    tulisTabelExcel(perKomponen.ws, perKomponen.baris, {
      kepala: ['Komponen', 'Pemasukan', 'Pengeluaran', 'Saldo', 'Tersisa'],
      baris: saldo.map(s => [s.nama, s.masuk, s.keluar, s.saldo, persenTeks(s)]),
      total: ['Total Saldo Kas', totalMasuk, totalKeluar, totalSaldo, ''],
      kolomRupiah: [1, 2, 3],
    })

    const isiRiwayat = lembarBerkop(wb, kop, {
      nama: 'Riwayat', lebarKolom: [18, 30, 28, 26, 16, 16],
      judul: 'Riwayat Kas', keterangan: `Bulan ${judulBulan}`,
    })
    tulisTabelExcel(isiRiwayat.ws, isiRiwayat.baris, {
      kepala: ['Tanggal', 'Keterangan', 'Rincian', 'Komponen', 'Pemasukan', 'Pengeluaran'],
      baris: riwayat.map(r => [
        tanggalPanjang(r.tanggal), r.judul, r.keterangan, r.komponen.join(', '),
        r.jenis === 'masuk' ? r.jumlah : '', r.jenis === 'keluar' ? r.jumlah : '',
      ]),
      total: ['Total', '', '', '', masuk, keluar],
      gabungTotal: [{ kolom: 0, sampaiKolom: 3 }],
      kolomRupiah: [4, 5],
    })

    await simpanExcel(wb, berkas)
    return
  }

  const doc = new jsPDF({ orientation: 'portrait' })
  const awal = awalPdf(doc, kop, 'Ringkasan Kas', `Bulan ${judulBulan} - Periode ${namaPeriode}`)
  const rp = (n: number) => ({ content: teksPdf(formatRupiah(n)), styles: { halign: 'right' as const } })
  const gaya = {
    theme:      'grid' as const,
    headStyles: { fillColor: NAVY, fontSize: 8 },
    footStyles: { fillColor: ABU, textColor: [15, 23, 42] as [number, number, number], fontStyle: 'bold' as const, fontSize: 8 },
    styles:     { fontSize: 8, cellPadding: 1.5 },
    margin:     awal.margin,
  }

  autoTable(doc, {
    ...gaya, startY: awal.y,
    head: [[`Bulan ${judulBulan}`, 'Jumlah']],
    body: [['Pemasukan', rp(masuk)], ['Pengeluaran', rp(keluar)]],
    foot: [['Selisih', rp(masuk - keluar)]],
  })

  let y = subjudulPdf(doc, `Saldo per komponen - periode ${namaPeriode}`, akhirTabel(doc) + 9, awal.margin.top)
  autoTable(doc, {
    ...gaya, startY: y,
    head: [['Komponen', 'Pemasukan', 'Pengeluaran', 'Saldo', 'Tersisa']],
    body: saldo.length > 0
      ? saldo.map(s => [teksPdf(s.nama), rp(s.masuk), rp(s.keluar), rp(s.saldo), { content: persenTeks(s), styles: { halign: 'right' as const } }])
      : [[{ content: 'Belum ada pemasukan atau pengeluaran.', colSpan: 5, styles: { halign: 'center' as const, textColor: 120 } }]],
    foot: [['Total Saldo Kas', rp(totalMasuk), rp(totalKeluar), rp(totalSaldo), '']],
  })

  y = subjudulPdf(doc, `Riwayat kas ${judulBulan}`, akhirTabel(doc) + 9, awal.margin.top)
  autoTable(doc, {
    ...gaya, startY: y,
    head: [['Tanggal', 'Keterangan', 'Komponen', 'Pemasukan', 'Pengeluaran']],
    body: riwayat.length > 0
      ? riwayat.map(r => [
          tanggalPanjang(r.tanggal),
          teksPdf(r.keterangan ? `${r.judul}\n${r.keterangan}` : r.judul),
          teksPdf(r.komponen.join(', ')),
          r.jenis === 'masuk' ? rp(r.jumlah) : '',
          r.jenis === 'keluar' ? rp(r.jumlah) : '',
        ])
      : [[{ content: `Belum ada pemasukan atau pengeluaran di ${judulBulan}.`, colSpan: 5, styles: { halign: 'center' as const, textColor: 120 } }]],
    foot: [[{ content: 'Total', colSpan: 3 }, rp(masuk), rp(keluar)]],
    showFoot: 'lastPage',
    columnStyles: { 0: { cellWidth: 30 }, 3: { cellWidth: 28 }, 4: { cellWidth: 28 } },
  })

  akhiriPdf(doc, awal, kop)
  doc.save(`${berkas}.pdf`)
}

/**
 * Ringkasan kas untuk komponen terpilih saja: ringkasan bulan (satu kolom, atau satu kolom
 * per komponen ditambah Total), saldo komponen terpilih, dan riwayat yang menyentuh
 * komponen terpilih dengan nominal bagiannya (dipisah: kolom Pemasukan dan Pengeluaran
 * per komponen).
 */
async function unduhRingkasanKasKomponen(opsi: {
  format:      FormatEkspor
  kop:         DataKop
  namaPeriode: string
  bulan:       { bulan: number; tahun: number }
  saldo:       SaldoKomponen[]
  riwayat:     BarisRiwayatKas[]
  komponen:    KomponenUnduhan
}): Promise<void> {
  const { format, kop, namaPeriode, bulan, komponen } = opsi
  const { pisah } = komponen
  const judulBulan = labelBulan(bulan)
  const berkas = namaBerkas(`Ringkasan_Kas_${judulBulan}`) + komponen.akhiran

  // Ringkasan bulan — dari riwayat bulan itu, yang memuat semua pemasukan dan pengeluarannya
  const kolomRingkas = pisah ? [...komponen.kolom, { label: 'Total', kunci: komponen.pilih }] : [{ label: 'Jumlah', kunci: komponen.pilih }]
  const jumlahJenis  = (jenis: BarisRiwayatKas['jenis'], kunci: ReadonlySet<string>) =>
    opsi.riwayat.filter(r => r.jenis === jenis).reduce((s, r) => s + jumlahUntuk(r.perKomponen, kunci), 0)
  const masukPer   = kolomRingkas.map(k => jumlahJenis('masuk', k.kunci))
  const keluarPer  = kolomRingkas.map(k => jumlahJenis('keluar', k.kunci))
  const selisihPer = masukPer.map((m, i) => m - keluarPer[i])

  // Saldo sepanjang periode — hanya baris komponen terpilih
  const saldo       = opsi.saldo.filter(s => komponen.pilih.has(s.kunci))
  const totalMasuk  = saldo.reduce((s, b) => s + b.masuk, 0)
  const totalKeluar = saldo.reduce((s, b) => s + b.keluar, 0)
  const totalSaldo  = saldo.reduce((s, b) => s + b.saldo, 0)

  // Riwayat — baris yang menyentuh komponen terpilih, nominalnya bagian komponen itu
  const kolomRiwayat = pisah ? komponen.kolom : [{ label: '', kunci: komponen.pilih }]
  const n = kolomRiwayat.length
  const riwayat = opsi.riwayat
    .map(r => ({ r, nilai: kolomRiwayat.map(k => jumlahUntuk(r.perKomponen, k.kunci)) }))
    .filter(x => x.nilai.some(v => v > 0))
  const namaTerpilih = (r: BarisRiwayatKas) =>
    r.perKomponen.filter(b => b.jumlah > 0 && komponen.pilih.has(kunciKomponen(b.nama))).map(b => b.nama).join(', ')
  const angkaRiwayat = (x: (typeof riwayat)[number]): (number | '')[] => [
    ...x.nilai.map(v => (x.r.jenis === 'masuk' ? v : '' as const)),
    ...x.nilai.map(v => (x.r.jenis === 'keluar' ? v : '' as const)),
  ]
  const totalRiwayat = (jenis: BarisRiwayatKas['jenis']) =>
    kolomRiwayat.map((_, i) => riwayat.reduce((s, x) => s + (x.r.jenis === jenis ? x.nilai[i] : 0), 0))
  const totalAngka   = [...totalRiwayat('masuk'), ...totalRiwayat('keluar')]
  const kepalaAngka  = pisah ? [...komponen.nama, ...komponen.nama] : ['Pemasukan', 'Pengeluaran']
  const grupRiwayat  = (dari: number): GrupKepala[] => (pisah
    ? [{ label: 'Pemasukan', dari, jumlah: n }, { label: 'Pengeluaran', dari: dari + n, jumlah: n }]
    : [])

  if (format === 'excel') {
    const { bukuExcelBaru, lembarBerkop, tulisTabelExcel, simpanExcel } = await import('./eksporExcel')
    const wb = await bukuExcelBaru()

    const ringkasan = lembarBerkop(wb, kop, {
      nama: 'Ringkasan', lebarKolom: [28, ...kolomRingkas.map(() => 18)],
      judul: 'Ringkasan Kas', keterangan: `Bulan ${judulBulan} - Periode ${namaPeriode}${komponen.keterangan}`,
    })
    tulisTabelExcel(ringkasan.ws, ringkasan.baris, {
      kepala: [`Bulan ${judulBulan}`, ...kolomRingkas.map(k => k.label)],
      baris: [['Pemasukan', ...masukPer], ['Pengeluaran', ...keluarPer]],
      total: ['Selisih', ...selisihPer],
      kolomRupiah: kolomRingkas.map((_, i) => 1 + i),
    })

    const perKomponen = lembarBerkop(wb, kop, {
      nama: `Saldo ${namaPeriode}`.slice(0, 31).replace(/[\\/?*[\]:]/g, '-'), lebarKolom: [22, 16, 16, 16, 10],
      judul: 'Saldo per Komponen', keterangan: `Periode ${namaPeriode}${komponen.keterangan}`,
    })
    tulisTabelExcel(perKomponen.ws, perKomponen.baris, {
      kepala: ['Komponen', 'Pemasukan', 'Pengeluaran', 'Saldo', 'Tersisa'],
      baris: saldo.map(s => [s.nama, s.masuk, s.keluar, s.saldo, persenTeks(s)]),
      total: ['Total Saldo Kas', totalMasuk, totalKeluar, totalSaldo, ''],
      kolomRupiah: [1, 2, 3],
    })

    const isiRiwayat = lembarBerkop(wb, kop, {
      nama: 'Riwayat', lebarKolom: [18, 30, 28, 26, ...kepalaAngka.map(() => 16)],
      judul: 'Riwayat Kas', keterangan: `Bulan ${judulBulan}${komponen.keterangan}`, lanskap: pisah,
    })
    tulisTabelExcel(isiRiwayat.ws, isiRiwayat.baris, {
      kepala: ['Tanggal', 'Keterangan', 'Rincian', 'Komponen', ...kepalaAngka],
      grupKepala: grupRiwayat(4),
      baris: riwayat.map(x => [tanggalPanjang(x.r.tanggal), x.r.judul, x.r.keterangan, namaTerpilih(x.r), ...angkaRiwayat(x)]),
      total: ['Total', '', '', '', ...totalAngka],
      gabungTotal: [{ kolom: 0, sampaiKolom: 3 }],
      kolomRupiah: kepalaAngka.map((_, i) => 4 + i),
    })

    await simpanExcel(wb, berkas)
    return
  }

  const doc = new jsPDF({ orientation: pisah ? 'landscape' : 'portrait' })
  const awal = awalPdf(doc, kop, 'Ringkasan Kas', `Bulan ${judulBulan} - Periode ${namaPeriode}${komponen.keterangan}`)
  const kanan = { halign: 'right' as const }
  const rp = (nilai: number) => ({ content: teksPdf(formatRupiah(nilai)), styles: kanan })
  const gaya = {
    theme:      'grid' as const,
    headStyles: { fillColor: NAVY, fontSize: 8, valign: 'middle' as const },
    footStyles: { fillColor: ABU, textColor: [15, 23, 42] as [number, number, number], fontStyle: 'bold' as const, fontSize: 8 },
    styles:     { fontSize: 8, cellPadding: 1.5 },
    margin:     awal.margin,
  }

  autoTable(doc, {
    ...gaya, startY: awal.y,
    head: [[`Bulan ${judulBulan}`, ...kolomRingkas.map(k => teksPdf(k.label))]],
    body: [['Pemasukan', ...masukPer.map(rp)], ['Pengeluaran', ...keluarPer.map(rp)]],
    foot: [['Selisih', ...selisihPer.map(rp)]],
  })

  let y = subjudulPdf(doc, `Saldo per komponen - periode ${namaPeriode}`, akhirTabel(doc) + 9, awal.margin.top)
  autoTable(doc, {
    ...gaya, startY: y,
    head: [['Komponen', 'Pemasukan', 'Pengeluaran', 'Saldo', 'Tersisa']],
    body: saldo.length > 0
      ? saldo.map(s => [teksPdf(s.nama), rp(s.masuk), rp(s.keluar), rp(s.saldo), { content: persenTeks(s), styles: kanan }])
      : [[{ content: 'Belum ada pemasukan atau pengeluaran komponen terpilih.', colSpan: 5, styles: { halign: 'center' as const, textColor: 120 } }]],
    foot: [['Total Saldo Kas', rp(totalMasuk), rp(totalKeluar), rp(totalSaldo), '']],
  })

  y = subjudulPdf(doc, `Riwayat kas ${judulBulan}`, akhirTabel(doc) + 9, awal.margin.top)
  const kepala = ['Tanggal', 'Keterangan', 'Komponen', ...kepalaAngka]
  autoTable(doc, {
    ...gaya, startY: y,
    head: kepalaPdf(kepala, grupRiwayat(3)),
    headStyles: pisah ? { ...gaya.headStyles, halign: 'center' as const } : gaya.headStyles,
    body: riwayat.length > 0
      ? riwayat.map(x => [
          tanggalPanjang(x.r.tanggal),
          teksPdf(x.r.keterangan ? `${x.r.judul}\n${x.r.keterangan}` : x.r.judul),
          teksPdf(namaTerpilih(x.r)),
          ...angkaRiwayat(x).map(v => (v === '' ? '' : v > 0 ? rp(v) : { content: '-', styles: kanan })),
        ])
      : [[{ content: `Belum ada pemasukan atau pengeluaran komponen terpilih di ${judulBulan}.`, colSpan: kepala.length, styles: { halign: 'center' as const, textColor: 120 } }]],
    foot: [[{ content: 'Total', colSpan: 3 }, ...totalAngka.map(rp)]],
    showFoot: 'lastPage',
    columnStyles: { 0: { cellWidth: 30 }, ...Object.fromEntries(kepalaAngka.map((_, i) => [3 + i, { cellWidth: pisah ? 26 : 28 }])) },
  })

  akhiriPdf(doc, awal, kop)
  doc.save(`${berkas}.pdf`)
}
