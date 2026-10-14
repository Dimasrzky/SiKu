import type { CSSProperties } from 'react'

// Ikon yang bentuknya tidak ada di lucide-react: mockup memakai mata dengan garis
// coret miring "/" (lucide EyeOff berarah "\") dan ikon "widgets" (tiga kotak + satu
// belah ketupat) untuk kartu Kelas aktif. Ukuran diatur lewat style karena atribut
// width/height SVG tidak menerima calc().

interface IkonProps {
  className?: string
  style?: CSSProperties
}

const atributDasar = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const MATA = 'M1.5 12c2.4-4.1 6.1-6.3 10.5-6.3s8.1 2.2 10.5 6.3c-2.4 4.1-6.1 6.3-10.5 6.3S3.9 16.1 1.5 12z'

export const IkonMataCoret = ({ className, style }: IkonProps) => (
  <svg {...atributDasar} className={className} style={style}>
    <path d={MATA} />
    <circle cx="12" cy="12" r="3" />
    <path d="M19.5 3.5 4.5 20.5" />
  </svg>
)

export const IkonMata = ({ className, style }: IkonProps) => (
  <svg {...atributDasar} className={className} style={style}>
    <path d={MATA} />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const IkonWidget = ({ className, style, tebal = 2 }: IkonProps & { tebal?: number }) => (
  <svg {...atributDasar} strokeWidth={tebal} className={className} style={style}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <path d="M17.25 2.4 21.6 6.75l-4.35 4.35-4.35-4.35z" />
  </svg>
)
