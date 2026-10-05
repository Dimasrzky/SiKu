import type { CSSProperties, ReactNode } from 'react'

// Kit kerangka (skeleton) halaman dashboard. Aturannya (keputusan 5 Okt 2026): teks
// statis — judul halaman, judul kartu, label, nama kolom tabel — tetap teks asli;
// angka, nama, grafik, tombol, dan isian menjadi blok berkilau. Kilaunya di kelas
// .skeleton (app/(dashboard)/dashboard.css).
//
// Kerangka juga dirender server (layout, sebelum data login terbaca), jadi isinya
// harus deterministik: tanpa tanggal, localStorage, atau angka acak.

type Ukuran = number | string

const css = (u: Ukuran) => (typeof u === 'number' ? `${u}px` : u)

/** Lebar bergiliran supaya baris kerangka tidak seragam */
export const giliran = <T,>(daftar: readonly T[], i: number): T => daftar[i % daftar.length]

/** Lebar nama siswa di baris tabel kerangka — kira-kira nama lengkap dua sampai tiga kata */
export const LEBAR_NAMA = [136, 108, 148, 120, 96, 142, 114, 128, 102, 134] as const

/** Satu blok berkilau */
export const Blok = ({ lebar = '100%', tinggi = 14, sudut = 6, gelap = false, style }: {
  lebar?:  Ukuran
  tinggi?: Ukuran
  sudut?:  Ukuran
  /** Untuk latar navy atau berwarna */
  gelap?:  boolean
  style?:  CSSProperties
}) => (
  <span aria-hidden className={gelap ? 'skeleton skeleton--gelap' : 'skeleton'}
    style={{ width: lebar, height: tinggi, borderRadius: sudut, ...style }} />
)

/**
 * Pengganti satu baris teks. Wadahnya setinggi baris teks aslinya (ukuran huruf ×
 * line-height; bawaan body 1.6), bloknya lebih tipis — jadi tinggi kartu tidak
 * berubah saat data datang.
 */
export const BlokTeks = ({ lebar, ukuran = '0.875rem', tinggiBaris = 1.6, gelap = false, style }: {
  lebar:        Ukuran
  ukuran?:      Ukuran
  tinggiBaris?: number
  gelap?:       boolean
  style?:       CSSProperties
}) => (
  <span aria-hidden style={{ display: 'flex', alignItems: 'center', height: `calc(${css(ukuran)} * ${tinggiBaris})`, ...style }}>
    <Blok lebar={lebar} tinggi={`calc(${css(ukuran)} * 0.72)`} sudut={4} gelap={gelap} />
  </span>
)

/** Cincin donat. `dalam` dan `luar` = jari-jari lubang dan tepi luar, dalam persen setengah lebar. */
export const BlokDonat = ({ lebar, dalam, luar = 100, style }: {
  lebar:  Ukuran
  dalam:  number
  luar?:  number
  style?: CSSProperties
}) => {
  const cincin = `radial-gradient(circle closest-side, transparent ${dalam}%, #000 ${dalam + 0.5}%, #000 ${luar - 0.5}%, transparent ${luar}%)`
  return (
    <Blok lebar={lebar} tinggi="auto" sudut="50%"
      style={{ aspectRatio: '1 / 1', WebkitMaskImage: cincin, maskImage: cincin, ...style }} />
  )
}

/** Wadah halaman selama memuat. `label` dibacakan pembaca layar: "Memuat {label}…" */
export const KerangkaHalaman = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="dashboard-content" aria-busy="true">
    <span role="status" className="skeleton-sr">Memuat {label}…</span>
    {children}
  </div>
)

/** Badge hijau "Aktif" di kartu tahun ajaran aktif — teks statis, jadi tampil asli */
export const BadgeAktif = () => (
  <span style={{ background: '#69C183', border: '2.5px solid #C1E6CC', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, padding: '1px 14px', borderRadius: 20 }}>
    Aktif
  </span>
)

const BAYANGAN_IKON = '2px 3px 10px rgba(18, 47, 102, 0.54)'

/**
 * Judul halaman: ikon navy, judul, dan subjudul teks asli; aksi di kanan berupa blok.
 * `kecil` untuk Tagihan Aktif, Tahun Ajaran, dan Komponen — ikon 56 px, judul 1.6rem.
 */
export const KepalaHalaman = ({ ikon, judul, subjudul, kecil = false, jarakBawah = '1.5rem', bayanganIkon = BAYANGAN_IKON, jejak, kanan }: {
  ikon:          ReactNode
  judul:         ReactNode
  subjudul:      ReactNode
  kecil?:        boolean
  jarakBawah?:   string
  bayanganIkon?: string
  /** Jejak Laporan › Jenjang › Kelas di atas judul */
  jejak?:        ReactNode
  kanan?:        ReactNode
}) => (
  <div style={{ marginBottom: jarakBawah }}>
    {jejak && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.82rem', marginBottom: '0.9rem' }}>
        {jejak}
      </div>
    )}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: kecil ? 56 : 60, height: kecil ? 56 : 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: bayanganIkon }}>
          {ikon}
        </div>
        <div>
          <h1 style={{ fontSize: kecil ? '1.6rem' : '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: kecil ? 1.1 : 1.2 }}>
            {judul}
          </h1>
          <p style={{ fontSize: kecil ? '1.1rem' : '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: kecil ? '0.15rem 0 0' : '0.2rem 0 0' }}>
            {subjudul}
          </p>
        </div>
      </div>
      {kanan && <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>{kanan}</div>}
    </div>
  </div>
)

/**
 * Baris daftar Komponen Tagihan, Komponen Individu, dan Manajemen Kelas: avatar 48 px,
 * nama + badge, keterangan, pemisah tegak, satu nilai berlabel, tiga tombol aksi.
 */
export const BarisDaftar = ({ label, i, garis }: { label: string; i: number; garis: boolean }) => (
  <div style={{ paddingLeft: '1.5rem', paddingRight: '2.5rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 0' }}>
      <Blok lebar={48} tinggi={48} sudut={10} />
      <div style={{ width: 240, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <BlokTeks lebar={giliran([96, 124, 76, 108, 88], i)} ukuran="0.95rem" />
          <Blok lebar={giliran([84, 70, 92, 78, 86], i)} tinggi={20} sudut={20} />
        </div>
        <BlokTeks lebar={giliran([150, 118, 172, 134, 108], i)} ukuran="0.82rem" />
      </div>
      <div style={{ width: 1.5, height: 40, background: '#CBD5E1', flexShrink: 0, marginLeft: '1%' }} />
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
        <BlokTeks lebar={giliran([92, 70, 104, 80, 96], i)} ukuran="0.95rem" />
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0, position: 'relative', right: 20 }}>
        <Blok lebar={30} tinggi={30} sudut={6} />
        <Blok lebar={28} tinggi={28} sudut={6} />
        <Blok lebar={32} tinggi={32} sudut={4} />
      </div>
    </div>
    {garis && <div style={{ height: 1, background: '#C1C6CF' }} />}
  </div>
)
