import { Fragment } from 'react'
import { Check } from 'lucide-react'
import { ukuranIkon } from './satuan'

interface LangkahDaftarProps {
  /** 3 = pendaftaran selesai: kedua langkah bercentang */
  langkah: 1 | 2 | 3
}

// Dua lingkaran bernomor dihubungkan garis. Sesuai mockup, lingkaran yang belum
// aktif tetap navy; langkah yang sudah lewat berganti centang.
export const LangkahDaftar = ({ langkah }: LangkahDaftarProps) => (
  <div className="auth-langkah">
    {([1, 2] as const).map((n) => (
      <Fragment key={n}>
        {n === 2 && <span className="auth-langkah-garis" aria-hidden="true" />}
        <span
          className="auth-langkah-bulat"
          aria-label={langkah > n ? `Langkah ${n} selesai` : `Langkah ${n}`}
          aria-current={langkah === n ? 'step' : undefined}
        >
          {langkah > n ? <Check style={ukuranIkon(17)} strokeWidth={3} aria-hidden="true" /> : n}
        </span>
      </Fragment>
    ))}
  </div>
)
