import type { jsPDF } from 'jspdf'
import type { DataKop, GambarKop, TandaTangan } from './kopLaporan'

// Kop laporan di PDF, tiruan kop contoh dari sekolah. Ukurannya diukur dari gambar kop
// 96 dpi (31 Okt 2026): nama yayasan & nama sekolah Times 14 pt (huruf besar/kecil sesuai isian) dengan skala
// huruf 80%, alamat & email/Hotline Times 11 pt, email bergaris bawah, lalu garis tipis
// dan garis ganda tebal-tipis yang sedikit lebih panjang. Logo yayasan rata kiri dan logo
// sekolah rata kanan di ujung garis. Satu perbedaan yang disengaja: di contoh, dua baris
// nama bergeser ±6 mm ke kanan dari baris alamat (efek Word) — di sini semua baris di
// satu sumbu tengah. Semua ukuran dalam mm; dokumen jsPDF harus memakai satuan mm.

const PT = 25.4 / 72

const UKURAN_JUDUL     = 14
const SKALA_JUDUL      = 0.8
const UKURAN_ISI       = 11
const UKURAN_MIN       = 9
const BARIS_ALAMAT_MAX = 3
/** Alamat dibungkus di lebar ini — di contoh baris alamat pertama selebar ±97 mm */
const LEBAR_ALAMAT_MAX = 105

// Garis dasar tiap baris, berurutan dari tepi atas huruf kapital nama yayasan
const KE_DASAR_JUDUL = 3.24
const JARAK_JUDUL    = 5.55
const KE_ALAMAT      = 4.72
const JARAK_ALAMAT   = 4.99
const KE_KONTAK      = 5.29
/** Garis dasar email/Hotline → tengah garis tipis */
const KE_GARIS_TIPIS = 4.10

const TEBAL_TIPIS    = 0.2
/** Tengah garis tipis → tepi atas garis tebal */
const KE_GARIS_TEBAL = 2.01
const TEBAL_TEBAL    = 1.0
const CELAH_GANDA    = 0.27
const TEBAL_GANDA    = 0.3
/** Garis tipis sedikit lebih pendek dari garis ganda, seperti contoh */
const MASUK_TIPIS    = { kiri: 3.2, kanan: 6.1 }

const LOGO_TINGGI_MAX = 26
const LOGO_LEBAR_MAX  = 28
/** Kotak logo mulai sedikit di bawah tepi atas huruf nama yayasan… */
const LOGO_ATAS       = 0.8
/** …dan berhenti sedikit di atas garis tipis */
const LOGO_KE_GARIS   = 1.1
const CELAH_LOGO_TEKS = 3

// Posisi & tebal garis bawah Times New Roman, dalam em
const GARIS_BAWAH_ATAS  = 0.085
const GARIS_BAWAH_TEBAL = 0.049

// Font bawaan jsPDF tidak menjamin tanda pisah en/em dan tanda minus
const teksPdf = (s: string) => s.replace(/[–—−]/g, '-')

/** Lebar teks (mm) dalam font aktif, tanpa kerning — jsPDF juga menulisnya tanpa kerning */
export function lebarTeks(doc: jsPDF, teks: string, ukuran: number, skala = 1): number {
  return doc.getStringUnitWidth(teks, { fontSize: ukuran, doKerning: false }) * ukuran * PT * skala
}

/** Ukuran huruf terbesar (≤ ukuran, ≥ 9 pt) yang membuat teks muat di lebarMax */
export function ukuranMuat(doc: jsPDF, teks: string, ukuran: number, skala: number, lebarMax: number): number {
  const lebar = lebarTeks(doc, teks, ukuran, skala)
  return lebar <= lebarMax ? ukuran : Math.max(UKURAN_MIN, ukuran * lebarMax / lebar)
}

function bungkus(doc: jsPDF, teks: string, ukuran: number, lebarMax: number): string[] {
  const baris: string[] = []
  let kini = ''
  for (const kata of teks.split(' ')) {
    const coba = kini ? `${kini} ${kata}` : kata
    if (kini && lebarTeks(doc, coba, ukuran) > lebarMax) {
      baris.push(kini)
      kini = kata
    } else {
      kini = coba
    }
  }
  if (kini) baris.push(kini)
  return baris
}

export interface TeksKop {
  judul:  { teks: string; ukuran: number }[]
  alamat: { baris: string[]; ukuran: number }
  kontak: { awalan: string; email: string; akhiran: string; ukuran: number }
}

/**
 * Isi teks kop beserta ukuran hurufnya. Baris baru di alamat dipertahankan; baris yang
 * terlalu panjang dibungkus, dan kalau alamat lebih dari tiga baris hurufnya diperkecil.
 * Dipakai PDF dan Excel supaya pemenggalan barisnya sama.
 */
export function susunTeksKop(doc: jsPDF, kop: DataKop, lebarMax: number): TeksKop {
  doc.setFont('times', 'normal')
  // Huruf besar/kecil mengikuti isian Pengaturan (keputusan user 31 Okt 2026): isian
  // kapital semua tampil kapital semua seperti contoh, "Nurrohmah Bina Insani" tetap begitu
  const judul = [kop.namaYayasan, kop.namaSekolah].map(n => {
    const teks = teksPdf(n)
    return { teks, ukuran: ukuranMuat(doc, teks, UKURAN_JUDUL, SKALA_JUDUL, lebarMax) }
  })

  const paragraf = teksPdf(kop.alamat).split(/\r?\n/).map(p => p.trim().replace(/\s+/g, ' ')).filter(Boolean)
  paragraf[0] = `Alamat: ${paragraf[0] ?? ''}`
  const lebarAlamat = Math.min(lebarMax, LEBAR_ALAMAT_MAX)
  let alamat = { baris: [] as string[], ukuran: UKURAN_ISI }
  for (let ukuran = UKURAN_ISI; ukuran >= UKURAN_MIN; ukuran--) {
    alamat = { baris: paragraf.flatMap(p => bungkus(doc, p, ukuran, lebarAlamat)), ukuran }
    if (alamat.baris.length <= BARIS_ALAMAT_MAX) break
  }

  const kontak = { awalan: 'email: ', email: teksPdf(kop.email), akhiran: `. Hotline: ${kop.telepon}` }
  const ukuranKontak = ukuranMuat(doc, kontak.awalan + kontak.email + kontak.akhiran, UKURAN_ISI, 1, lebarMax)
  return { judul, alamat, kontak: { ...kontak, ukuran: ukuranKontak } }
}

/** Ukuran logo di kop: muat di kotak LOGO_LEBAR_MAX × tinggiMax, perbandingan sisi tetap */
function ukuranLogo(g: GambarKop, tinggiMax = LOGO_TINGGI_MAX): { w: number; h: number } {
  const s = Math.min(LOGO_LEBAR_MAX / g.lebar, tinggiMax / g.tinggi)
  return { w: g.lebar * s, h: g.tinggi * s }
}

export interface TataKop {
  /** Tepi bawah garis ganda — isi halaman dimulai di bawahnya */
  bawah:  number
  /** Gambar kop di halaman yang sedang aktif */
  gambar: (doc: jsPDF) => void
}

/**
 * Hitung tata letak kop sekali, lalu gambar di setiap halaman lewat `gambar`.
 * `atas` = tepi atas huruf nama yayasan; `kiri`/`kanan` = ujung garis kop, samakan
 * dengan tepi tabel di bawahnya.
 */
export function tataKop(doc: jsPDF, kop: DataKop, { atas, kiri, kanan }: { atas: number; kiri: number; kanan: number }): TataKop {
  const tengah    = (kiri + kanan) / 2
  const logoKiri  = ukuranLogo(kop.logoYayasan)
  const logoKanan = ukuranLogo(kop.logoSekolah)
  // Teks di sumbu tengah kop, jadi ruangnya dibatasi logo yang paling lebar
  const lebarTeksMax = kanan - kiri - 2 * (Math.max(logoKiri.w, logoKanan.w) + CELAH_LOGO_TEKS)
  const teks = susunTeksKop(doc, kop, lebarTeksMax)

  const dJudul  = [KE_DASAR_JUDUL, KE_DASAR_JUDUL + JARAK_JUDUL]
  const dAlamat = teks.alamat.baris.map((_, i) => dJudul[1] + KE_ALAMAT + i * JARAK_ALAMAT)
  const dKontak = (dAlamat[dAlamat.length - 1] ?? dJudul[1]) + KE_KONTAK

  // Kop setinggi teks atau setinggi logo, mana yang lebih tinggi; yang lebih pendek
  // diletakkan di tengahnya
  const garisMenurutTeks = dKontak + KE_GARIS_TIPIS
  const garisMenurutLogo = LOGO_ATAS + LOGO_TINGGI_MAX + LOGO_KE_GARIS
  const garis     = Math.max(garisMenurutTeks, garisMenurutLogo)
  const yTeks     = atas + (garis - garisMenurutTeks) / 2
  const yTipis    = atas + garis
  const yTebal    = yTipis + KE_GARIS_TEBAL
  const yGanda    = yTebal + TEBAL_TEBAL + CELAH_GANDA
  const ruangLogo = { atas: atas + LOGO_ATAS, bawah: yTipis - LOGO_KE_GARIS }
  const yLogo     = (h: number) => ruangLogo.atas + (ruangLogo.bawah - ruangLogo.atas - h) / 2

  const gambar = (d: jsPDF) => {
    // Skala huruf (Tz) dan warna tetap berlaku sampai diganti — dikurung q/Q supaya tidak
    // bocor ke teks lain di halaman ini
    d.saveGraphicsState()

    d.addImage(kop.logoYayasan.dataUrl, kop.logoYayasan.format, kiri, yLogo(logoKiri.h), logoKiri.w, logoKiri.h, 'kop-logo-yayasan')
    d.addImage(kop.logoSekolah.dataUrl, kop.logoSekolah.format, kanan - logoKanan.w, yLogo(logoKanan.h), logoKanan.w, logoKanan.h, 'kop-logo-sekolah')

    d.setFont('times', 'normal')
    d.setTextColor(0, 0, 0)
    d.setFillColor(0, 0, 0)
    const tulis = (isi: string, y: number, ukuran: number, skala = 1): number => {
      d.setFontSize(ukuran)
      const x = tengah - lebarTeks(d, isi, ukuran, skala) / 2
      d.text(isi, x, y, { horizontalScale: skala })
      return x
    }

    teks.judul.forEach((j, i) => tulis(j.teks, yTeks + dJudul[i], j.ukuran, SKALA_JUDUL))
    teks.alamat.baris.forEach((b, i) => tulis(b, yTeks + dAlamat[i], teks.alamat.ukuran))

    const { awalan, email, akhiran, ukuran } = teks.kontak
    const yKontak = yTeks + dKontak
    const xKontak = tulis(awalan + email + akhiran, yKontak, ukuran)
    const em      = ukuran * PT
    const xEmail  = xKontak + lebarTeks(d, awalan, ukuran)
    const wEmail  = lebarTeks(d, email, ukuran)
    d.rect(xEmail, yKontak + GARIS_BAWAH_ATAS * em, wEmail, GARIS_BAWAH_TEBAL * em, 'F')
    d.link(xEmail, yKontak - 0.75 * em, wEmail, em, { url: `mailto:${email}` })

    d.rect(kiri + MASUK_TIPIS.kiri, yTipis - TEBAL_TIPIS / 2, kanan - MASUK_TIPIS.kanan - (kiri + MASUK_TIPIS.kiri), TEBAL_TIPIS, 'F')
    d.rect(kiri, yTebal, kanan - kiri, TEBAL_TEBAL, 'F')
    d.rect(kiri, yGanda, kanan - kiri, TEBAL_GANDA, 'F')

    d.restoreGraphicsState()
  }

  return { bawah: yGanda + TEBAL_GANDA, gambar }
}

/** Kop di setiap halaman — dipanggil sesudah semua isi digambar */
export function pasangKopSemuaHalaman(doc: jsPDF, tata: TataKop): void {
  const jumlah = doc.getNumberOfPages()
  for (let p = 1; p <= jumlah; p++) {
    doc.setPage(p)
    tata.gambar(doc)
  }
}

/** Posisi tepi atas huruf nama yayasan dari tepi atas kertas */
export const ATAS_KOP = 13

/** Jarak garis kop → isi halaman lanjutan (tabel yang bersambung) */
export const JARAK_ISI = 4

/**
 * Judul laporan di halaman pertama, tepat di bawah kop: judul tebal, keterangan cakupan,
 * dan waktu dibuat. Mengembalikan y awal isi laporan.
 */
export function judulLaporanPdf(doc: jsPDF, bawahKop: number, judul: string, keterangan: string): number {
  const tengah = doc.internal.pageSize.getWidth() / 2
  const kini   = new Date()
  let y = bawahKop + 6.5
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0)
  doc.text(teksPdf(judul), tengah, y, { align: 'center' })
  y += 5.5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100)
  doc.text(teksPdf(keterangan), tengah, y, { align: 'center' })
  y += 4.5
  doc.text(
    `Dibuat pada ${kini.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}, ${kini.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
    tengah, y, { align: 'center' },
  )
  doc.setTextColor(0)
  return y + 5.5
}

// ── Tanda tangan ─────────────────────────────────────────────────────────────
// Tiruan blok tanda tangan contoh sekolah (gambar 96 dpi, Calibri 11 pt → Helvetica
// 11 pt): baris berjarak ±5,2 mm. Kanan: kota + tanggal, "Bendahara …", ruang tanda
// tangan 4 baris, nama. Kiri: "Kepala …" sejajar jabatan kanan, nama sejajar nama kanan.
// Tengah: "Mengetahui," dan "Ketua Yayasan" tepat di bawah baris nama, ruang 4 baris,
// nama ketua. Kolom kanan mulai di 67,5% lebar isi, seperti contoh.

const UKURAN_TTD  = 11
const BARIS_TTD   = 5.2
const KOLOM_KANAN = 0.675
/** Garis dasar baris pertama → bawah nama ketua yayasan */
const TINGGI_TTD  = 11 * BARIS_TTD + 2
/** Akhir isi laporan → garis dasar baris pertama tanda tangan */
const JARAK_TTD   = 12

/**
 * Blok tanda tangan di akhir laporan, tepat di bawah isi terakhir (`y`). Kalau sisa
 * halaman tidak cukup, pindah utuh ke halaman baru — panggil SEBELUM nomor halaman dan
 * pasangKopSemuaHalaman, supaya halaman baru itu ikut bernomor dan berkop.
 */
export function tandaTanganPdf(
  doc: jsPDF,
  ttd: TandaTangan,
  { y, kiri, kanan, atasHalaman }: { y: number; kiri: number; kanan: number; atasHalaman: number },
): void {
  let dasar = y + JARAK_TTD
  if (dasar + TINGGI_TTD > doc.internal.pageSize.getHeight() - 15) {
    doc.addPage()
    dasar = atasHalaman + 8
  }
  const baris  = (i: number) => dasar + i * BARIS_TTD
  const xKanan = kiri + (kanan - kiri) * KOLOM_KANAN
  const tengah = (kiri + kanan) / 2

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0)
  // Nama yang terlalu panjang untuk kolomnya diperkecil, tidak dipenggal
  const tulis = (teks: string, x: number, yDasar: number, lebarMax: number, align: 'left' | 'center' = 'left') => {
    const isi = teksPdf(teks)
    doc.setFontSize(ukuranMuat(doc, isi, UKURAN_TTD, 1, lebarMax))
    doc.text(isi, x, yDasar, { align })
  }

  const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
  const lebarKanan = kanan - xKanan
  const lebarKiri  = xKanan - kiri - 4

  tulis(`${ttd.kota}, ${tanggal}`, xKanan, baris(0), lebarKanan)
  tulis(`Kepala ${ttd.lembaga}`, kiri, baris(1), lebarKiri)
  tulis(`Bendahara ${ttd.lembaga}`, xKanan, baris(1), lebarKanan)
  tulis(ttd.kepala, kiri, baris(5), lebarKiri)
  tulis(ttd.bendahara, xKanan, baris(5), lebarKanan)
  tulis('Mengetahui,', tengah, baris(6), kanan - kiri, 'center')
  tulis('Ketua Yayasan', tengah, baris(7), kanan - kiri, 'center')
  tulis(ttd.ketuaYayasan, tengah, baris(11), kanan - kiri, 'center')
}
