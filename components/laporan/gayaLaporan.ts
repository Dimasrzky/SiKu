import type { CSSProperties } from 'react'

// Gaya kartu laporan — dipakai bersama level Sekolah, Jenjang, dan Kelas supaya
// ketiganya terlihat sebagai satu halaman yang sama saat berpindah level.

/** Padding sisi kartu. Tabel tren memakainya untuk membentangkan header sampai tepi kartu. */
export const PADDING_KARTU = '1.1rem'

export const sKartu:       CSSProperties = { background: '#ffffff', borderRadius: 12, padding: PADDING_KARTU, boxShadow:'0 2px 10px #3244736e', minWidth: 0 }
export const sKepalaKartu: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }
export const sJudulKartu:  CSSProperties = { fontSize: '1rem', fontWeight: 600, color: '#101010' }
export const sIkonKartu:   CSSProperties = { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
export const sNilaiKartu:  CSSProperties = { fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: '0.35rem', overflowWrap: 'anywhere' }
export const sKetKartu:    CSSProperties = { fontSize: '0.76rem', color: '#6F788A', lineHeight: 1.45 }
export const sBarisKartu:  CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }

/** Judul dan subjudul di dalam kartu grafik/daftar */
export const sJudulPanel:    CSSProperties = { fontWeight: 800, fontSize: '1rem', color: '#101010', marginBottom: 4 }
export const sSubjudulPanel: CSSProperties = { fontSize: '0.75rem', color: '#94A3B8', marginBottom: '1rem' }

/**
 * Palet mockup Laporan utama (Figma, Okt 2026) — sama dengan palet Dashboard, dan
 * sengaja berbeda dari palet lembut lib/statusTagihan yang dipakai Tagihan Aktif.
 */
export const WARNA_LAPORAN = {
  navy:       '#1A2C4E',
  abu:        '#6F788A',
  abuMuda:    '#8A91A0',
  abuLabel:   '#B7BBC4',
  garis:      '#DCDEE2',
  /** Pemisah daftar komponen dan kepala umur tunggakan — lebih tegas di mockup */
  garisTegas: '#B4BAC5',
  track:      '#DCDEE3',
  hijau:      '#69C183',
  kuning:     '#F7DD7D',
  biruMuda:   '#A3CDFE',
  merah:      '#DA8181',
  coklat:     '#BB8848',
  oranye:     '#D8994A',
  oranyeMuda: '#FEDDB2',
} as const

const RADIUS_KARTU_TAB = 14

/** Kartu Laporan utama — judulnya tab biru muda di pojok kiri atas (lihat KartuTab) */
export const sKartuTab: CSSProperties = {
  background: '#ffffff', borderRadius: RADIUS_KARTU_TAB, boxShadow: '0 2px 10px #3244736e',
  minWidth: 0, display: 'flex', flexDirection: 'column',
}
export const sJudulTab: CSSProperties = {
  margin: 0, alignSelf: 'flex-start', background: WARNA_LAPORAN.biruMuda, color: WARNA_LAPORAN.navy,
  fontSize: '1.2rem', fontWeight: 500, lineHeight: 1.2, padding: '0.55rem 1.4rem',
  borderRadius: `${RADIUS_KARTU_TAB}px 8px 8px 0`, boxShadow: '0 2px 4px rgba(26, 44, 78, 0.22)',
}

/** Bingkai besar berisi seluruh ringkasan — border kiri navy khas dashboard */
export const sBingkai: CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  borderTop: '1.5px solid #F1F5F9',
  borderRight: '1.5px solid #F1F5F9',
  borderBottom: '1.5px solid #F1F5F9',
  borderLeft: '28px solid #1A2C4E',
  boxShadow: '0 0 18px rgba(39, 74, 156, 0.51)',
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.875rem',
}
