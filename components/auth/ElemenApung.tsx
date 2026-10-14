import Image from 'next/image'
import { Check } from 'lucide-react'
import { ukuranIkon } from './satuan'

// Tiga elemen mengambang di kiri mockup dasbor. Isinya statis; posisi, kemiringan,
// dan animasinya diatur auth.css.

const RINCIAN_TRANSFER = [
  ['Tanggal', '12/07/26 08.56'],
  ['Ke', 'SMP Nusantara'],
  ['No. Ref', '3391 0057 80'],
] as const

export const KartuTransfer = () => (
  <div className="auth-transfer">
    <span className="auth-transfer-cek">
      <Check style={ukuranIkon(22)} strokeWidth={3} aria-hidden="true" />
    </span>
    <span className="auth-transfer-judul">TRANSFER BERHASIL</span>
    <span className="auth-transfer-garis" />
    <span className="auth-transfer-nominal">Rp 500.000</span>
    <div className="auth-transfer-rincian">
      {RINCIAN_TRANSFER.map(([label, nilai]) => (
        <div key={label} className="auth-transfer-baris">
          <span>{label}</span>
          <span>{nilai}</span>
        </div>
      ))}
    </div>
  </div>
)

export const GelembungWA = () => (
  <div className="auth-wa">
    <span className="auth-wa-ikon">
      <Image src="/icons/IconWA.png" width={25} height={20} alt="" loading="eager" />
    </span>
    <span className="auth-wa-teks">Ibu Siti: Bukti ekskul + SPP jadi satu</span>
  </div>
)

/** siap → ditekan (sesaat, efek klik) → mengirim (3 detik) → kembali siap */
export type FaseIngatkan = 'siap' | 'ditekan' | 'mengirim'

export const TombolIngatkanDemo = ({ fase }: { fase: FaseIngatkan }) => (
  <div className={`auth-ingatkan auth-ingatkan--${fase}`}>
    <span className="auth-ingatkan-riak" />
    <Image src="/icons/IconWA.png" width={31} height={25} alt="" loading="eager" />
    <span>{fase === 'mengirim' ? 'Mengirim…' : 'Ingatkan'}</span>
  </div>
)
