import type { ReactNode } from 'react'

interface JudulPanelProps {
  judul: ReactNode
  /** Kalimat abu-abu di bawah judul (halaman daftar) */
  sub?: ReactNode
  /** Judul yang tidak muat satu baris (langkah 3) boleh turun baris */
  panjang?: boolean
}

// Judul panel kanan dengan titik kuning sesudahnya, seperti di mockup
export const JudulPanel = ({ judul, sub, panjang = false }: JudulPanelProps) => (
  <>
    <h1 className={panjang ? 'auth-judul auth-judul--panjang' : 'auth-judul'}>
      {judul}
      <span className="auth-titik" aria-hidden="true" />
    </h1>
    {sub && <p className="auth-subjudul">{sub}</p>}
  </>
)
