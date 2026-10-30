import { supabase } from './supabase'
import { UKURAN_LOGO_MAKS, type JenisLogo } from './logoSekolah'

// Logo kop laporan dari sisi browser: panggilan /api/sekolah/logo dan penyiapan berkas
// sebelum diunggah (tepi kosong dipangkas, diperkecil, disimpan sebagai PNG). Hanya untuk
// komponen 'use client'.

type Hasil<T> = { data: T; error: null } | { data: null; error: string }

async function panggil<T>(init: RequestInit, query = ''): Promise<Hasil<T>> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/sekolah/logo${query}`, {
      ...init,
      cache: 'no-store',
      headers: { ...init.headers, Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    const json = await res.json().catch(() => null) as { data?: T; error?: string | null } | null
    if (!res.ok || !json?.data) return { data: null, error: json?.error ?? `Server membalas status ${res.status}.` }
    return { data: json.data, error: null }
  } catch {
    return { data: null, error: 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.' }
  }
}

/** Data URL tiap logo; null = belum diunggah */
export type IsiLogo = Record<JenisLogo, string | null>

export const muatLogoSekolah = (): Promise<Hasil<IsiLogo>> => panggil<IsiLogo>({ method: 'GET' })

export function unggahLogoSekolah(jenis: JenisLogo, logo: Blob): Promise<Hasil<{ jenis: JenisLogo; dataUrl: string; path: string }>> {
  const form = new FormData()
  form.append('jenis', jenis)
  form.append('logo', logo, `${jenis}.png`)
  return panggil({ method: 'POST', body: form })
}

export const hapusLogoSekolah = (jenis: JenisLogo): Promise<Hasil<{ jenis: JenisLogo }>> =>
  panggil({ method: 'DELETE' }, `?jenis=${jenis}`)

// ── Logo sekolah di sidebar ──────────────────────────────────────────────────
// Sidebar memakai logo sekolah yang sama dengan kop laporan. Salinan kecilnya (PNG,
// transparansi tetap) disimpan di localStorage supaya tampil tanpa menunggu server;
// perubahan diumumkan lewat event 'storage' seperti siku_auth.

export const KUNCI_LOGO_SIDEBAR = 'siku_logo_sekolah'

interface LogoSidebar { path: string | null; gambar: string | null }

export function bacaLogoSidebar(): LogoSidebar | null {
  try {
    const raw = localStorage.getItem(KUNCI_LOGO_SIDEBAR)
    return raw ? (JSON.parse(raw) as LogoSidebar) : null
  } catch {
    return null
  }
}

function tulisLogoSidebar(isi: LogoSidebar | null): void {
  try {
    const newValue = isi ? JSON.stringify(isi) : null
    if (newValue) localStorage.setItem(KUNCI_LOGO_SIDEBAR, newValue)
    else localStorage.removeItem(KUNCI_LOGO_SIDEBAR)
    window.dispatchEvent(new StorageEvent('storage', { key: KUNCI_LOGO_SIDEBAR, newValue }))
  } catch { /* penyimpanan browser penuh/diblokir: sidebar tetap pakai inisial */ }
}

/** Perkecil logo ke sisi terpanjang 96 px (2× kotak sidebar) */
async function kecilkan(dataUrl: string, sisi = 96): Promise<string | null> {
  const img = new Image()
  img.src = dataUrl
  try { await img.decode() } catch { return null }
  const s = Math.min(1, sisi / Math.max(img.naturalWidth, img.naturalHeight))
  const kanvas = document.createElement('canvas')
  kanvas.width  = Math.max(1, Math.round(img.naturalWidth * s))
  kanvas.height = Math.max(1, Math.round(img.naturalHeight * s))
  const c = kanvas.getContext('2d')
  if (!c) return null
  c.imageSmoothingQuality = 'high'
  c.drawImage(img, 0, 0, kanvas.width, kanvas.height)
  return kanvas.toDataURL('image/png')
}

/** Dipanggil sesudah logo sekolah diunggah (path + isi) atau dihapus (null) */
export async function simpanLogoSidebar(path: string | null, dataUrl: string | null): Promise<void> {
  tulisLogoSidebar({ path, gambar: dataUrl ? await kecilkan(dataUrl) : null })
}

export const hapusLogoSidebarLokal = (): void => {
  try { localStorage.removeItem(KUNCI_LOGO_SIDEBAR) } catch { /* abaikan */ }
}

/**
 * Samakan salinan sidebar dengan logo tersimpan di database. Isi logo hanya diunduh
 * kalau path-nya berubah (logo diganti di perangkat lain, atau akun sekolah lain).
 */
export async function segarkanLogoSidebar(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const { data: profil } = await supabase.from('profiles').select('sekolah_id').eq('id', session.user.id).maybeSingle()
  const sekolahId = (profil as { sekolah_id: string | null } | null)?.sekolah_id
  if (!sekolahId) return
  const { data, error } = await supabase.from('sekolah').select('logo_sekolah_path').eq('id', sekolahId).maybeSingle()
  // Kolom belum dibuat (SQL kop laporan belum dijalankan): biarkan apa adanya
  if (error) return
  const path = (data as { logo_sekolah_path: string | null } | null)?.logo_sekolah_path ?? null
  const kini = bacaLogoSidebar()
  if (kini && kini.path === path) return
  if (!path) {
    tulisLogoSidebar({ path: null, gambar: null })
    return
  }
  const logo = await muatLogoSekolah()
  if (logo.error !== null) return
  await simpanLogoSidebar(path, logo.data.sekolah)
}

// ── Penyiapan berkas ─────────────────────────────────────────────────────────

export const FORMAT_LOGO = ['image/png', 'image/jpeg', 'image/webp']
const BERKAS_MAKS = 10 * 1024 * 1024
/** Sisi terpanjang logo tersimpan — logo di kop ±2,5 cm, jadi ±600 dpi saat dicetak */
const SISI_MAKS = 600
/** Sisi terpanjang salinan untuk mencari tepi kosong — cukup teliti, tetap ringan */
const SISI_PINDAI = 1200

const galat = (error: string): Hasil<Blob> => ({ data: null, error })

/**
 * Siapkan logo pilihan pengguna untuk kop: tepi transparan/putih dipangkas supaya
 * logonya mengisi kotak di kop seperti contoh, diperkecil, lalu disimpan sebagai PNG
 * (transparansi tetap). Server memeriksa ulang isi berkasnya.
 */
export async function siapkanLogo(berkas: File): Promise<Hasil<Blob>> {
  if (!FORMAT_LOGO.includes(berkas.type)) return galat('Format logo harus PNG, JPG, atau WEBP.')
  if (berkas.size > BERKAS_MAKS) return galat('Ukuran berkas logo maksimal 10MB.')

  let gambar: ImageBitmap
  try {
    gambar = await createImageBitmap(berkas)
  } catch {
    return galat('Gambar logo tidak bisa dibaca. Pilih berkas lain.')
  }

  try {
    // 1. Cari kotak isi logo: piksel yang tidak transparan dan tidak nyaris putih
    const skalaPindai = Math.min(1, SISI_PINDAI / Math.max(gambar.width, gambar.height))
    const pw = Math.max(1, Math.round(gambar.width * skalaPindai))
    const ph = Math.max(1, Math.round(gambar.height * skalaPindai))
    const kanvasPindai = document.createElement('canvas')
    kanvasPindai.width = pw
    kanvasPindai.height = ph
    const cp = kanvasPindai.getContext('2d', { willReadFrequently: true })
    if (!cp) return galat('Browser tidak bisa memproses gambar logo.')
    cp.drawImage(gambar, 0, 0, pw, ph)
    const piksel = cp.getImageData(0, 0, pw, ph).data

    let x0 = pw, y0 = ph, x1 = -1, y1 = -1
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const i = (y * pw + x) * 4
        const kosong = piksel[i + 3] < 16 || (piksel[i] >= 245 && piksel[i + 1] >= 245 && piksel[i + 2] >= 245)
        if (kosong) continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
    if (x1 < 0) return galat('Logo tampak kosong. Pilih gambar lain.')

    // 2. Potong di ukuran asli (longgar satu piksel pindai supaya tepi halus tidak
    //    terpotong), perkecil, simpan PNG
    const sx  = Math.max(0, (x0 - 1) / skalaPindai)
    const sy  = Math.max(0, (y0 - 1) / skalaPindai)
    const sx2 = Math.min(gambar.width, (x1 + 2) / skalaPindai)
    const sy2 = Math.min(gambar.height, (y1 + 2) / skalaPindai)
    const sw = sx2 - sx
    const sh = sy2 - sy
    const skala = Math.min(1, SISI_MAKS / Math.max(sw, sh))
    const kanvas = document.createElement('canvas')
    kanvas.width  = Math.max(1, Math.round(sw * skala))
    kanvas.height = Math.max(1, Math.round(sh * skala))
    const c = kanvas.getContext('2d')
    if (!c) return galat('Browser tidak bisa memproses gambar logo.')
    c.imageSmoothingQuality = 'high'
    c.drawImage(gambar, sx, sy, sw, sh, 0, 0, kanvas.width, kanvas.height)

    const blob = await new Promise<Blob | null>(selesai => kanvas.toBlob(selesai, 'image/png'))
    if (!blob) return galat('Gambar logo gagal diproses.')
    if (blob.size > UKURAN_LOGO_MAKS) return galat('Logo terlalu besar setelah diproses. Pilih gambar yang lebih sederhana.')
    return { data: blob, error: null }
  } finally {
    gambar.close()
  }
}
