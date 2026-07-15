import { BadgeCheck, UserCog } from 'lucide-react'
import Image from 'next/image'

interface Props {
  namaSekolah: string
  yayasan:     string
  avatar:      string | null
}

const STRIP_ITEMS = (namaSekolah: string) => [
  { icon: BadgeCheck, text: `Halaman resmi ${namaSekolah || 'sekolah'}` },
  { icon: UserCog,    text: 'Dikelola langsung oleh bendahara sekolah' },
  { icon: null,       text: 'Konfirmasi dikirim via WhatsApp' },
]

const STRIP_CSS = `
.bayar-strip-outer { overflow: hidden; }
.bayar-strip-track {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(0.5rem, 4vw, 2.5rem) clamp(0.5rem, 3vw, 1.5rem);
}
.bayar-strip-dup { display: none; }

@media (max-width: 640px) {
  .bayar-strip-track {
    flex-wrap: nowrap;
    justify-content: flex-start;
    width: max-content;
    gap: 2.25rem;
    animation: bayar-strip-scroll 16s linear infinite;
  }
  .bayar-strip-dup { display: flex; }
}

@keyframes bayar-strip-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
`

export default function BayarHeader({ namaSekolah, yayasan, avatar }: Props) {
  const initial = (namaSekolah || 'S').trim().charAt(0).toUpperCase()
  const isImage = !!avatar && (avatar.startsWith('data:') || avatar.startsWith('http'))

  return (
    <header>
      <div style={{ background: '#1A2C4E', padding: 'clamp(0.85rem, 4vw, 1.1rem) clamp(0.9rem, 5vw, 1.5rem)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#33456B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', color: '#fff', fontWeight: 800, fontSize: '1rem' }}>
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar!} alt={namaSekolah} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {namaSekolah || 'Sekolah'}
            </div>
            {yayasan && (
              <div style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {yayasan}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#A3CDFE', borderRadius: 20, padding: '0.4rem 0.85rem', flexShrink: 0 }}>
          <BadgeCheck size={14} color="#1A2C4E" />
          <span style={{ color: '#1A2C4E', fontSize: '0.75rem', fontWeight: 700 }}>Halaman resmi sekolah</span>
        </div>
      </div>

      <style>{STRIP_CSS}</style>
      <div className="bayar-strip-outer" style={{ background: '#A3CDFE', padding: '0.65rem clamp(0.9rem, 5vw, 1.5rem)', marginBottom: '1.5rem' }}>
        <div className="bayar-strip-track">
          {STRIP_ITEMS(namaSekolah).map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {Icon ? <Icon size={14} color="#1A2C4E" /> : <Image src="/icons/WABiru.png" alt="" width={14} height={14} />}
              <span style={{ color: '#1A2C4E', fontSize: 'clamp(0.72rem, 2.6vw, 0.9rem)', fontWeight: 600 }}>{text}</span>
            </div>
          ))}
          {STRIP_ITEMS(namaSekolah).map(({ icon: Icon, text }) => (
            <div key={`dup-${text}`} className="bayar-strip-dup" aria-hidden="true" style={{ alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {Icon ? <Icon size={14} color="#1A2C4E" /> : <Image src="/icons/WABiru.png" alt="" width={14} height={14} />}
              <span style={{ color: '#1A2C4E', fontSize: 'clamp(0.72rem, 2.6vw, 0.9rem)', fontWeight: 600 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}
