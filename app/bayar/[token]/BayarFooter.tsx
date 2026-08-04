import Image from 'next/image'

interface Props {
  namaBendahara: string
  noWaBendahara: string
}

function formatWaDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const local = digits.startsWith('62') ? '0' + digits.slice(2) : digits
  return local.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3')
}

function toWaHref(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const intl   = digits.startsWith('0') ? '62' + digits.slice(1) : digits
  return `https://wa.me/${intl}`
}

export default function BayarFooter({ namaBendahara, noWaBendahara }: Props) {
  const waDisplay = formatWaDisplay(noWaBendahara)

  return (
    <footer style={{ background: '#1A2C4E' }}>
      <div style={{ width: '100%', boxSizing: 'border-box', padding: 'clamp(1rem, 5vw, 1.5rem) clamp(1rem, 6vw, 3rem)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/image/SimbolSiKu.png" alt="" width={60} height={60} style={{ objectFit: 'contain', width: 'clamp(48px, 12vw, 60px)', height: 'clamp(48px, 12vw,60px)' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Image src="/image/LogoSiKuText.png" alt="SiKu" width={80} height={40} style={{ objectFit: 'contain', width: 'clamp(48px, 12vw, 80px)', height: 'auto' }} />
          </div>
        </div>

        {(namaBendahara || waDisplay) && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#ffffff', fontSize: 'clamp(0.72rem, 2.8vw, 1rem)', fontWeight: 700 }}>Hubungi bendahara</div>
            {namaBendahara && (
              <div style={{ color: '#7B8DAA', fontSize: 'clamp(0.72rem, 2.8vw, 1rem)', fontWeight: 700, marginTop: 2 }}>{namaBendahara}</div>
            )}
            {waDisplay && (
              <a
                href={toWaHref(noWaBendahara)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginTop: 3, textDecoration: 'none' }}
              >
                <Image src="/image/IconWA.png" alt="WhatsApp" width={25} height={25} style={{ objectFit: 'contain', width: 'clamp(18px, 5vw, 25px)', height: 'clamp(18px, 5vw, 25px)' }} />
                <span style={{ color: '#4ADE80', fontSize: 'clamp(0.72rem, 2.8vw, 1rem)', fontWeight: 600 }}>{waDisplay}</span>
              </a>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', padding: 'clamp(1rem, 5vw, 1.5rem) clamp(1rem, 6vw, 3rem)', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', borderTop: '3px solid #7B8DAA', marginBottom: '1.5rem' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: '#ffffff', fontSize: 'clamp(0.68rem, 2.6vw, 0.9rem)', fontWeight: 600 }}>© 2025 Equanusa. Semua hak dilindungi.</span>
          <a href="https://equanusa.vercel.app/" target="_blank" rel="noopener noreferrer">
            <Image src="/image/LogoEquanusaWhite.png" alt="Equanusa" width={30} height={30} style={{ objectFit: 'contain' }} />
          </a>
        </div>
      </div>
    </footer>
  )
}
