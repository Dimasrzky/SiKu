// Logo kop laporan: logo yayasan di kiri kop, logo sekolah di kanan. Berkasnya disimpan
// di bucket privat tanpa policy storage — browser tidak menyentuh storage langsung,
// semua lewat /api/sekolah/logo. Berkas ini dipakai server maupun browser.

export const BUCKET_LOGO_SEKOLAH = 'logo-sekolah'

export type JenisLogo = 'yayasan' | 'sekolah'

export const JENIS_LOGO: readonly JenisLogo[] = ['yayasan', 'sekolah']

export const KOLOM_LOGO: Record<JenisLogo, 'logo_yayasan_path' | 'logo_sekolah_path'> = {
  yayasan: 'logo_yayasan_path',
  sekolah: 'logo_sekolah_path',
}

export const LABEL_LOGO: Record<JenisLogo, string> = {
  yayasan: 'Logo Yayasan',
  sekolah: 'Logo Sekolah',
}

/** Batas berkas yang diterima server — logo sudah diperkecil browser sebelum dikirim */
export const UKURAN_LOGO_MAKS = 2 * 1024 * 1024

export const adalahJenisLogo = (v: unknown): v is JenisLogo => v === 'yayasan' || v === 'sekolah'
