import type { CSSProperties, ReactNode } from 'react'
import { PADDING_KARTU, sJudulTab, sKartuTab } from './gayaLaporan'

/**
 * Kartu halaman Laporan utama (mockup Okt 2026): judulnya tab biru muda di pojok
 * kiri atas. `aksi` tampil di kanan, sejajar bagian bawah tab — dipakai legenda dan
 * tombol grafik/tabel.
 */
export const KartuTab = ({ judul, aksi, children, style }: {
  judul:    string
  aksi?:    ReactNode
  children: ReactNode
  style?:   CSSProperties
}) => (
  <section style={{ ...sKartuTab, ...style }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem 1rem', flexWrap: 'wrap' }}>
      <h3 style={sJudulTab}>{judul}</h3>
      {aksi && <div style={{ padding: `2rem ${PADDING_KARTU} 0` }}>{aksi}</div>}
    </div>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: `1rem ${PADDING_KARTU} ${PADDING_KARTU}` }}>
      {children}
    </div>
  </section>
)
