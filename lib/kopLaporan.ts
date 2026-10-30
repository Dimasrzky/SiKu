import { supabase } from './supabase'
import { muatLogoSekolah } from './logoSekolahKlien'

// Kop laporan untuk semua unduhan PDF dan Excel di menu Laporan: logo yayasan di kiri,
// logo sekolah di kanan, di tengah nama yayasan, nama sekolah, alamat, email, dan
// Hotline (No. WhatsApp Resmi). Keputusan user 31 Okt 2026: semua isian itu — termasuk
// kedua logo — wajib terisi sebelum laporan bisa diunduh. PDF juga diakhiri blok tanda
// tangan (kota + tanggal, kepala, bendahara, ketua yayasan); isiannya hanya wajib untuk
// unduhan PDF, karena Excel tidak memakai tanda tangan. Hanya untuk 'use client'.

export type FormatUnduhan = 'pdf' | 'excel'

/** Blok tanda tangan di akhir laporan PDF */
export interface TandaTangan {
  /** Kota/kabupaten di depan tanggal, mis. "Bantul" */
  kota:         string
  kepala:       string
  /** Nama Lengkap akun yang mengunduh (Akun Pengguna) */
  bendahara:    string
  ketuaYayasan: string
  /** "Kepala/Bendahara Madrasah" atau "… Sekolah" */
  lembaga:      'Madrasah' | 'Sekolah'
}

/**
 * Madrasah kalau nama sekolah diawali singkatan madrasah (MI, MTs, MA, RA, …) atau kata
 * "Madrasah"; selain itu Sekolah. "Ma'arif …" tidak terhitung MA.
 */
export function sebutanLembaga(namaSekolah: string): TandaTangan['lembaga'] {
  const nama = namaSekolah.trim().toLocaleUpperCase('id-ID')
  return /^(MADRASAH\b|(MI|MIN|MIS|MTS|MTSN|MTSS|MA|MAN|MAS|MAK|RA)(?=[\s.\-]|$))/.test(nama) ? 'Madrasah' : 'Sekolah'
}

export interface GambarKop {
  dataUrl: string
  format:  'PNG' | 'JPEG'
  /** Ukuran asli dalam piksel, untuk menjaga perbandingan sisi */
  lebar:   number
  tinggi:  number
}

export interface DataKop {
  namaYayasan: string
  namaSekolah: string
  /** Boleh berisi baris baru — dipakai sebagai pemisah baris di kop */
  alamat:      string
  email:       string
  /** Bentuk lokal, mis. "082322575580" */
  telepon:     string
  logoYayasan: GambarKop
  logoSekolah: GambarKop
  /** Untuk unduhan Excel isiannya boleh kosong — tidak dipakai */
  tandaTangan: TandaTangan
}

type Hasil<T> = { data: T; error: null } | { data: null; error: string }

/** Kop lengkap, atau daftar isian yang masih kosong */
export type KopLaporan = { kop: DataKop; kurang: [] } | { kop: null; kurang: string[] }

/** "+6282322575580" → "082322575580"; kosong kalau tidak ada angkanya */
export function teleponKop(noWa: string | null | undefined): string {
  const angka = (noWa ?? '').replace(/\D/g, '')
  const lokal = angka.startsWith('62') ? angka.slice(2) : angka.replace(/^0/, '')
  return lokal ? `0${lokal}` : ''
}

/**
 * Nama yayasan untuk kop: kalau isian Pengaturan belum memuat kata "yayasan", kata itu
 * ditambahkan di depan dengan gaya huruf yang sama dengan isiannya — semua kapital →
 * "YAYASAN", huruf awal kapital → "Yayasan", huruf kecil → "yayasan".
 * "NURROHMAH BINA INSANI" → "YAYASAN NURROHMAH BINA INSANI"; "Yayasan X" tetap.
 */
export function namaYayasanKop(isian: string): string {
  const nama = isian.trim().replace(/\s+/g, ' ')
  if (!nama || /(^|[^\p{L}])yayasan($|[^\p{L}])/iu.test(nama)) return nama
  const huruf = nama.replace(/[^\p{L}]/gu, '')
  const kata = huruf && huruf === huruf.toLocaleUpperCase('id-ID') && huruf !== huruf.toLocaleLowerCase('id-ID')
    ? 'YAYASAN'
    : /^\P{L}*\p{Lu}/u.test(nama) ? 'Yayasan' : 'yayasan'
  return `${kata} ${nama}`
}

/** "a", "a dan b", "a, b dan c" */
function daftarKata(kata: string[]): string {
  return kata.length > 1 ? `${kata.slice(0, -1).join(', ')} dan ${kata[kata.length - 1]}` : (kata[0] ?? '')
}

/** Isian kosong yang termasuk blok tanda tangan (bukan kop) */
const ISIAN_TANDA_TANGAN = new Set(['nama kepala sekolah', 'nama ketua yayasan', 'kota/kabupaten', 'nama bendahara'])

/** Judul pop up menurut bagian yang belum lengkap: kop, tanda tangan, atau keduanya */
export function judulBelumLengkap(kurang: string[]): string {
  const ttd = kurang.filter(k => ISIAN_TANDA_TANGAN.has(k)).length
  if (ttd === 0) return 'Kop Laporan Belum Lengkap'
  if (ttd === kurang.length) return 'Tanda Tangan Laporan Belum Lengkap'
  return 'Kop & Tanda Tangan Laporan Belum Lengkap'
}

/** Teks pop up saat isian kop belum lengkap — kalimat dari user */
export function pesanKopBelumLengkap(kurang: string[]): string {
  return `Tidak bisa download laporan dikarenakan ${daftarKata(kurang)} masih kosong, silahkan isi terlebih dahulu.`
}

/** Kolom kop/tanda tangan belum dibuat — SQL kop laporan (31 Okt 2026) belum dijalankan */
const kolomBelumAda = (e: { code?: string; message?: string }) =>
  e.code === '42703' || e.code === 'PGRST204' || /column/i.test(e.message ?? '')

interface SekolahKop {
  nama:                string | null
  yayasan:             string | null
  alamat:              string | null
  email:               string | null
  no_wa:               string | null
  logo_yayasan_path:   string | null
  logo_sekolah_path:   string | null
  nama_kepala_sekolah: string | null
  nama_ketua_yayasan:  string | null
  kota:                string | null
}

/** Nama Lengkap akun yang sedang login — penanda tangan sebagai bendahara */
async function namaBendahara(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return ''
  const { data } = await supabase.from('profiles').select('nama').eq('id', session.user.id).maybeSingle()
  return ((data as { nama: string | null } | null)?.nama ?? '').trim()
}

// Logo yang sudah pernah dimuat, menurut path-nya. Logo yang diganti mendapat path baru,
// jadi isi cache tidak pernah basi.
const cacheLogo = new Map<string, GambarKop>()

async function bacaGambar(dataUrl: string | null): Promise<GambarKop | null> {
  if (!dataUrl) return null
  const format = dataUrl.startsWith('data:image/png') ? 'PNG' : dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : null
  if (!format) return null
  const img = new Image()
  img.src = dataUrl
  try {
    await img.decode()
  } catch {
    return null
  }
  return img.naturalWidth > 0 && img.naturalHeight > 0
    ? { dataUrl, format, lebar: img.naturalWidth, tinggi: img.naturalHeight }
    : null
}

/**
 * Baca isian kop terbaru dari database (bukan dari state halaman, supaya perubahan di
 * Pengaturan langsung berlaku) beserta kedua logonya, lalu periksa kelengkapannya.
 * Isian tanda tangan hanya diperiksa untuk unduhan PDF.
 */
export async function muatKopLaporan(sekolahId: string, format: FormatUnduhan): Promise<Hasil<KopLaporan>> {
  const [{ data, error }, bendahara] = await Promise.all([
    supabase
      .from('sekolah')
      .select('nama, yayasan, alamat, email, no_wa, logo_yayasan_path, logo_sekolah_path, nama_kepala_sekolah, nama_ketua_yayasan, kota')
      .eq('id', sekolahId)
      .maybeSingle(),
    namaBendahara(),
  ])
  if (error) {
    console.error('[Kop laporan] gagal memuat data sekolah:', error)
    return {
      data: null,
      error: kolomBelumAda(error)
        ? 'Kop laporan belum bisa dipakai karena kolom data sekolah (email, logo, tanda tangan) belum dibuat di database.'
        : 'Data kop laporan gagal dimuat. Periksa koneksi lalu coba lagi.',
    }
  }
  const s = data as SekolahKop | null
  if (!s) return { data: null, error: 'Data sekolah tidak ditemukan.' }

  let logoYayasan = s.logo_yayasan_path ? cacheLogo.get(s.logo_yayasan_path) ?? null : null
  let logoSekolah = s.logo_sekolah_path ? cacheLogo.get(s.logo_sekolah_path) ?? null : null
  if ((s.logo_yayasan_path && !logoYayasan) || (s.logo_sekolah_path && !logoSekolah)) {
    const logo = await muatLogoSekolah()
    if (logo.error !== null) return { data: null, error: logo.error }
    const [yayasan, sekolah] = await Promise.all([bacaGambar(logo.data.yayasan), bacaGambar(logo.data.sekolah)])
    logoYayasan = yayasan
    logoSekolah = sekolah
    if (yayasan && s.logo_yayasan_path) cacheLogo.set(s.logo_yayasan_path, yayasan)
    if (sekolah && s.logo_sekolah_path) cacheLogo.set(s.logo_sekolah_path, sekolah)
  }

  const isian = {
    namaYayasan: namaYayasanKop(s.yayasan ?? ''),
    namaSekolah: (s.nama ?? '').trim(),
    alamat:      (s.alamat ?? '').trim(),
    email:       (s.email ?? '').trim(),
    telepon:     teleponKop(s.no_wa),
  }

  // Urutan mengikuti permintaan user: email, alamat, yayasan, telepon — lalu logo
  const kurang: string[] = []
  if (!isian.namaSekolah) kurang.push('nama sekolah')
  if (!isian.email)       kurang.push('email sekolah')
  if (!isian.alamat)      kurang.push('alamat sekolah')
  if (!isian.namaYayasan) kurang.push('nama yayasan')
  if (!isian.telepon)     kurang.push('nomor telepon sekolah')
  if (!logoYayasan)       kurang.push('logo yayasan')
  if (!logoSekolah)       kurang.push('logo sekolah')

  const tandaTangan: TandaTangan = {
    kota:         (s.kota ?? '').trim(),
    kepala:       (s.nama_kepala_sekolah ?? '').trim(),
    bendahara,
    ketuaYayasan: (s.nama_ketua_yayasan ?? '').trim(),
    lembaga:      sebutanLembaga(isian.namaSekolah),
  }
  if (format === 'pdf') {
    if (!tandaTangan.kepala)       kurang.push('nama kepala sekolah')
    if (!tandaTangan.ketuaYayasan) kurang.push('nama ketua yayasan')
    if (!tandaTangan.kota)         kurang.push('kota/kabupaten')
    if (!tandaTangan.bendahara)    kurang.push('nama bendahara')
  }

  if (kurang.length > 0 || !logoYayasan || !logoSekolah) return { data: { kop: null, kurang }, error: null }
  return { data: { kop: { ...isian, logoYayasan, logoSekolah, tandaTangan }, kurang: [] }, error: null }
}
