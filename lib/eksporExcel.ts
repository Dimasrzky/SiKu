import * as ExcelJSModul from 'exceljs'
import type { Borders, Cell, Workbook, Worksheet } from 'exceljs'
import { jsPDF } from 'jspdf'
import type { DataKop, GambarKop } from './kopLaporan'
import { susunTeksKop, ukuranMuat } from './kopPdf'

// Unduhan Excel laporan dengan kop yang sama seperti PDF: logo yayasan kiri, logo sekolah
// kanan, nama yayasan, nama sekolah, alamat, email/Hotline, lalu garis tipis dan garis
// ganda. Memakai ExcelJS karena SheetJS edisi gratis tidak bisa menyisipkan gambar.
// Modul ini berat (ExcelJS ±1 MB) — impor secara dinamis saat tombol Excel diklik.
// Hanya untuk komponen 'use client'.

// Paket CommonJS: tergantung bundler, isinya ada di `default` atau langsung di modul
const ExcelJS = (ExcelJSModul as unknown as { default?: typeof ExcelJSModul }).default ?? ExcelJSModul

const FONT_KOP  = 'Times New Roman'
const NAVY      = 'FF1A2C4E'
const ABU_MUDA  = 'FFF1F5F9'
const ABU_GARIS = 'FFBFC5CE'
const HITAM     = 'FF000000'

const PX_PER_PT  = 96 / 72
const EMU_PER_PX = 9525
const MM_PER_PX  = 25.4 / 96

/** Logo di kop Excel: muat di kotak 28 × 26 mm, sama dengan PDF */
const LOGO_LEBAR_PX  = Math.round(28 / MM_PER_PX)
const LOGO_TINGGI_PX = Math.round(26 / MM_PER_PX)
const CELAH_LOGO_PX  = 12
/** Kop selebar ini paling tidak, supaya teks di tengah tidak tertimpa logo */
const LEBAR_MIN_PX   = 700

/** Lebar kolom Excel (karakter) → piksel layar 96 dpi, dengan huruf bawaan Calibri 11 */
const pxKolom = (lebar: number) => Math.trunc(((256 * lebar + Math.trunc(128 / 7)) / 256) * 7)

/** Indeks baris/kolom tempat posisi `px` jatuh, beserta sisa jaraknya di dalamnya */
function jangkar(px: number, ukuran: number[]): { indeks: number; sisa: number } {
  let awal = 0
  for (let i = 0; i < ukuran.length; i++) {
    if (px < awal + ukuran[i] || i === ukuran.length - 1) return { indeks: i, sisa: Math.max(0, px - awal) }
    awal += ukuran[i]
  }
  return { indeks: 0, sisa: 0 }
}

function ukuranLogoPx(g: GambarKop): { w: number; h: number } {
  const s = Math.min(LOGO_LEBAR_PX / g.lebar, LOGO_TINGGI_PX / g.tinggi)
  return { w: Math.round(g.lebar * s), h: Math.round(g.tinggi * s) }
}

export async function bukuExcelBaru(): Promise<Workbook> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SiKu'
  wb.created = new Date()
  return wb
}

// Logo cukup ditambahkan sekali ke tiap buku kerja, lalu dipakai semua lembarnya
const logoBuku = new WeakMap<Workbook, { yayasan: number; sekolah: number }>()

function idLogo(wb: Workbook, kop: DataKop): { yayasan: number; sekolah: number } {
  const ada = logoBuku.get(wb)
  if (ada) return ada
  const tambah = (g: GambarKop) => wb.addImage({ base64: g.dataUrl, extension: g.format === 'PNG' ? 'png' : 'jpeg' })
  const id = { yayasan: tambah(kop.logoYayasan), sekolah: tambah(kop.logoSekolah) }
  logoBuku.set(wb, id)
  return id
}

const garisBawah = (style: 'thin' | 'thick'): Partial<Borders> => ({ bottom: { style, color: { argb: HITAM } } })

export interface OpsiLembar {
  /** Nama sheet (maks. 31 karakter, tanpa []:*?/\) */
  nama:       string
  /** Lebar tiap kolom tabel dalam karakter */
  lebarKolom: number[]
  judul:      string
  keterangan: string
  lanskap?:   boolean
}

/**
 * Lembar baru berkop: kop, garis ganda, judul laporan, keterangan, dan waktu dibuat.
 * Mengembalikan lembarnya dan nomor baris (1-based) untuk kepala tabel.
 */
export function lembarBerkop(wb: Workbook, kop: DataKop, opsi: OpsiLembar): { ws: Worksheet; baris: number } {
  const ws = wb.addWorksheet(opsi.nama, {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, orientation: opsi.lanskap ? 'landscape' : 'portrait',
      fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  })

  // Kolom yang terlalu sempit untuk kop dilebarkan sebanding
  const jumlahKolom = opsi.lebarKolom.length
  const totalPx = opsi.lebarKolom.reduce((s, l) => s + pxKolom(l), 0)
  const faktor  = totalPx < LEBAR_MIN_PX ? LEBAR_MIN_PX / totalPx : 1
  const lebar   = opsi.lebarKolom.map(l => Math.round(l * faktor * 10) / 10)
  ws.columns = lebar.map(width => ({ width }))
  const kolomPx = lebar.map(pxKolom)
  const lebarPx = kolomPx.reduce((s, p) => s + p, 0)

  // Teks kop: pemenggalan baris alamat sama dengan PDF; nama tanpa skala huruf 80%
  // (Excel tidak punya), jadi ukurannya dicek ulang supaya tetap muat di antara logo
  const logoKiri  = ukuranLogoPx(kop.logoYayasan)
  const logoKanan = ukuranLogoPx(kop.logoSekolah)
  const ruangTeksMm = (lebarPx - 2 * (Math.max(logoKiri.w, logoKanan.w) + CELAH_LOGO_PX)) * MM_PER_PX
  const ukur = new jsPDF({ unit: 'mm' })
  const teks = susunTeksKop(ukur, kop, ruangTeksMm)

  type BarisKop = { tinggi: number; isi: Cell['value']; ukuran: number }
  const kontak = teks.kontak
  const isiKop: BarisKop[] = [
    ...teks.judul.map(j => ({ tinggi: 18, isi: j.teks, ukuran: Math.round(ukuranMuat(ukur, j.teks, 14, 1, ruangTeksMm) * 2) / 2 })),
    ...teks.alamat.baris.map(b => ({ tinggi: 15, isi: b, ukuran: teks.alamat.ukuran })),
    {
      tinggi: 16, ukuran: kontak.ukuran,
      isi: {
        richText: [
          { text: kontak.awalan, font: { name: FONT_KOP, size: kontak.ukuran } },
          { text: kontak.email, font: { name: FONT_KOP, size: kontak.ukuran, underline: true } },
          { text: kontak.akhiran, font: { name: FONT_KOP, size: kontak.ukuran } },
        ],
      },
    },
  ]
  // Kop setinggi logo paling tidak: kekurangannya dibagi ke baris pertama dan terakhir
  const tinggiPerlu = (LOGO_TINGGI_PX + 8) / PX_PER_PT
  const kurang = tinggiPerlu - isiKop.reduce((s, b) => s + b.tinggi, 0)
  if (kurang > 0) {
    isiKop[0].tinggi += kurang / 2
    isiKop[isiKop.length - 1].tinggi += kurang / 2
  }

  isiKop.forEach((b, i) => {
    const r = i + 1
    ws.mergeCells(r, 1, r, jumlahKolom)
    const sel = ws.getCell(r, 1)
    sel.value = b.isi
    sel.font = { name: FONT_KOP, size: b.ukuran }
    sel.alignment = { horizontal: 'center', vertical: 'bottom' }
    ws.getRow(r).height = b.tinggi
  })

  // Garis tipis, lalu garis ganda tebal-tipis
  let r = isiKop.length + 1
  for (const [tinggi, gaya] of [[5, 'thin'], [5, 'thick'], [2.25, 'thin']] as const) {
    ws.getRow(r).height = tinggi
    for (let c = 1; c <= jumlahKolom; c++) ws.getCell(r, c).border = garisBawah(gaya)
    r++
  }

  // Logo: rata kiri dan rata kanan di ujung kop, di tengah tinggi baris teks kop
  const barisPx = isiKop.map(b => b.tinggi * PX_PER_PT)
  const tinggiKopPx = barisPx.reduce((s, p) => s + p, 0)
  const id = idLogo(wb, kop)
  const pasang = (idGambar: number, xPx: number, ukuran: { w: number; h: number }) => {
    const kol = jangkar(xPx, kolomPx)
    const brs = jangkar((tinggiKopPx - ukuran.h) / 2, barisPx)
    // Jangkar "native" (EMU) supaya posisinya tepat; jangkar pecahan ExcelJS memakai
    // perkiraan lebar kolom yang meleset jauh
    const tl = {
      nativeCol: kol.indeks, nativeColOff: Math.round(kol.sisa * EMU_PER_PX),
      nativeRow: brs.indeks, nativeRowOff: Math.round(brs.sisa * EMU_PER_PX),
    }
    ws.addImage(idGambar, { tl: tl as unknown as { col: number; row: number }, ext: { width: ukuran.w, height: ukuran.h }, editAs: 'oneCell' })
  }
  pasang(id.yayasan, 0, logoKiri)
  pasang(id.sekolah, lebarPx - logoKanan.w, logoKanan)

  // Judul laporan
  r++
  const kini = new Date()
  const judul: [string, number, boolean, string, number][] = [
    [opsi.judul, 12, true, HITAM, 19],
    [opsi.keterangan, 10, false, 'FF64748B', 15],
    [`Dibuat pada ${kini.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}, ${kini.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`, 9, false, 'FF64748B', 14],
  ]
  for (const [isi, ukuran, tebal, warna, tinggi] of judul) {
    ws.mergeCells(r, 1, r, jumlahKolom)
    const sel = ws.getCell(r, 1)
    sel.value = isi
    sel.font = { size: ukuran, bold: tebal, color: { argb: warna } }
    sel.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(r).height = tinggi
    r++
  }

  return { ws, baris: r + 1 }
}

type NilaiSel = string | number | null

/** Judul di atas sekelompok kolom yang bersebelahan (mis. nama komponen di atas Tagihan/Terbayar/Sisa) */
export interface GrupKepala {
  label:  string
  /** Indeks kolom pertama kelompok ini (0-based) */
  dari:   number
  jumlah: number
}

/** Kolom `c` termasuk salah satu kelompok */
export const dalamGrupKepala = (grup: GrupKepala[], c: number): boolean =>
  grup.some(g => c >= g.dari && c < g.dari + g.jumlah)

export interface TabelExcel {
  kepala:       string[]
  /** Kepala dua baris: kelompok di baris atas, `kepala` di baris bawah. Kolom di luar
   *  kelompok mana pun setinggi dua baris. */
  grupKepala?:  GrupKepala[]
  baris:        NilaiSel[][]
  /** Indeks kolom Rupiah: tetap angka, tampil "Rp" dengan pemisah ribuan */
  kolomRupiah?: number[]
  /** Sel yang digabung di badan tabel; `baris` dihitung dari baris data pertama (0) */
  gabung?:      { baris: number; kolom: number; sampaiBaris: number; sampaiKolom: number }[]
  /** Baris total di bawah tabel, tebal berlatar abu */
  total?:       NilaiSel[]
  /** Sel yang digabung di baris total, mis. label "Total" selebar beberapa kolom */
  gabungTotal?: { kolom: number; sampaiKolom: number }[]
  /** Kolom yang isinya rata tengah */
  kolomTengah?: number[]
}

const FORMAT_RUPIAH = '"Rp "#,##0;-"Rp "#,##0'
const tepiTipis: Partial<Borders> = {
  top:    { style: 'thin', color: { argb: ABU_GARIS } },
  left:   { style: 'thin', color: { argb: ABU_GARIS } },
  bottom: { style: 'thin', color: { argb: ABU_GARIS } },
  right:  { style: 'thin', color: { argb: ABU_GARIS } },
}

/** Tulis tabel mulai baris `mulai` (kepala tabel); mengembalikan baris sesudah tabel */
export function tulisTabelExcel(ws: Worksheet, mulai: number, t: TabelExcel): number {
  const rupiah = new Set(t.kolomRupiah ?? [])
  const tengah = new Set(t.kolomTengah ?? [])
  const grup   = t.grupKepala ?? []

  const gayaKepala = (sel: Cell, judul: string | null) => {
    sel.value = judul
    sel.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    sel.alignment = { horizontal: 'center', vertical: 'middle' }
    sel.border = tepiTipis
  }

  // Kepala dua baris: baris atas berisi nama kelompok (digabung selebar kelompoknya) dan
  // kolom di luar kelompok (digabung setinggi dua baris)
  let barisKepala = mulai
  if (grup.length > 0) {
    barisKepala = mulai + 1
    ws.getRow(mulai).height = 20
    t.kepala.forEach((judul, c) => {
      if (dalamGrupKepala(grup, c)) return
      gayaKepala(ws.getCell(mulai, c + 1), judul)
      gayaKepala(ws.getCell(barisKepala, c + 1), null)
      ws.mergeCells(mulai, c + 1, barisKepala, c + 1)
    })
    for (const g of grup) {
      for (let c = g.dari; c < g.dari + g.jumlah; c++) gayaKepala(ws.getCell(mulai, c + 1), c === g.dari ? g.label : null)
      if (g.jumlah > 1) ws.mergeCells(mulai, g.dari + 1, mulai, g.dari + g.jumlah)
    }
  }

  const kepala = ws.getRow(barisKepala)
  kepala.height = 20
  t.kepala.forEach((judul, c) => {
    if (grup.length > 0 && !dalamGrupKepala(grup, c)) return
    gayaKepala(kepala.getCell(c + 1), judul)
  })

  const tulisBaris = (r: number, nilai: NilaiSel[], tebal: boolean) => {
    for (let c = 0; c < t.kepala.length; c++) {
      const sel = ws.getCell(r, c + 1)
      const v = nilai[c] ?? null
      sel.value = v
      sel.border = tepiTipis
      sel.alignment = { vertical: 'middle', horizontal: tengah.has(c) ? 'center' : undefined }
      if (rupiah.has(c) && typeof v === 'number') sel.numFmt = FORMAT_RUPIAH
      if (tebal) {
        sel.font = { bold: true }
        sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ABU_MUDA } }
      }
    }
  }

  const awalData = barisKepala + 1
  t.baris.forEach((b, i) => tulisBaris(awalData + i, b, false))
  for (const g of t.gabung ?? []) ws.mergeCells(awalData + g.baris, g.kolom + 1, awalData + g.sampaiBaris, g.sampaiKolom + 1)

  let akhir = awalData + t.baris.length
  if (t.total) {
    tulisBaris(akhir, t.total, true)
    for (const g of t.gabungTotal ?? []) ws.mergeCells(akhir, g.kolom + 1, akhir, g.sampaiKolom + 1)
    akhir++
  }

  // Kepala tabel diulang di setiap halaman cetak
  ws.pageSetup.printTitlesRow = `${mulai}:${barisKepala}`
  return akhir
}

/** Unduh buku kerja sebagai `<namaFile>.xlsx` */
export async function simpanExcel(wb: Workbook, namaFile: string): Promise<void> {
  const isi = await wb.xlsx.writeBuffer()
  const blob = new Blob([isi as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${namaFile}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
