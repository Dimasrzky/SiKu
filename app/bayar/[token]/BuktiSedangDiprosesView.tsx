import { PackageSearch, Receipt, PartyPopper, Search, CheckCircle2, Phone } from 'lucide-react'
import Image from 'next/image'
import { formatRp, formatTanggalWaktu } from './format'

interface Props {
  namaSiswa:     string
  kelasNama:     string
  totalNominal:  number
  buktiDikirim:  string
  namaBendahara: string
  noWaBendahara: string
}

function toWaHref(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const intl   = digits.startsWith('0') ? '62' + digits.slice(1) : digits
  return `https://wa.me/${intl}`
}

export default function BuktiSedangDiprosesView({
  namaSiswa, kelasNama, totalNominal, buktiDikirim, namaBendahara, noWaBendahara,
}: Props) {
  return (
    <div>
      {/* Banner */}
      <div style={{ background: '#DC832C', borderRadius: 16, padding: '2rem 1.5rem', textAlign: 'center', marginBottom: '1.25rem' }}>
        <div style={{ width: 60, height: 60, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <PackageSearch size={28} color="#DC832C" />
        </div>
        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#fff', marginBottom: 8 }}>Bukti Sedang Diproses</div>
        <div style={{ color: '#FDE9D3', fontSize: '0.85rem', lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
          Kami sudah menerima bukti pembayaran <strong style={{ color: '#fff' }}>{namaSiswa}</strong>. Tim sekolah sedang memverifikasi dalam <strong style={{ color: '#fff' }}>1x24 Jam</strong>.
        </div>
      </div>

      {/* Card detail + status verifikasi */}
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 10px #21396B' }}>

        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '2px solid #C1C6CF' }}>
          <div style={{ width: 40, height: 40, background: '#FEF3C7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Receipt size={20} color="#D97706" />
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A2C4E' }}>Detail Pengiriman Bukti</div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          <InfoRow label="Siswa"        value={`${namaSiswa}${kelasNama ? ` - ${kelasNama}` : ''}`} />
          <InfoRow label="Total dibayar" value={formatRp(totalNominal)} bold />
          <InfoRow label="Metode"       value="Transfer" />
          <InfoRow label="Bukti dikirim" value={formatTanggalWaktu(buktiDikirim)} uppercase />
          <InfoRow label="Status" value="Menunggu Verifikasi" last badgeBg="#FEF3C7" badgeColor="#D97706" />
        </div>

        <div style={{ padding: '1.25rem 1.5rem', borderTop: '2px solid #C1C6CF' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1A2C4E', marginBottom: '1rem' }}>Status Verifikasi</div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Timeline icon={PartyPopper} bg="#1A2C4E" fg="#fff" title="Bukti diterima" desc={formatTanggalWaktu(buktiDikirim)} connector />
            <Timeline icon={Search}      bg="#DC832C" fg="#fff" title="Sedang diverifikasi" desc="Tim sekolah sedang mengecek mutasi rekening" connector />
            <Timeline icon={CheckCircle2} bg="#E2E8F0" fg="#94A3B8" title="Konfirmasi lunas" desc="Status akan berubah menjadi lunas secara otomatis" />
          </div>
        </div>

        <div style={{ margin: '0 1.5rem 1.5rem', background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 10, padding: '0.9rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Phone size={16} color="#C2410C" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: '#9A3412', lineHeight: 1.6 }}>
              Belum ada konfirmasi lebih dari <strong>1x24 jam</strong>? Hubungi bendahara sekolah langsung.
            </div>
          </div>
          {noWaBendahara && (
            <a href={toWaHref(noWaBendahara)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, textDecoration: 'none' }}>
              <Image src="/image/IconWA.png" alt="WhatsApp" width={18} height={18} style={{ objectFit: 'contain' }} />
              <span style={{ color: '#166534', fontSize: '0.85rem', fontWeight: 700 }}>
                {namaBendahara ? `${namaBendahara} – ` : ''}{noWaBendahara}
              </span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, bold, uppercase, last, badgeBg, badgeColor }: {
  label: string; value: string; bold?: boolean; uppercase?: boolean; last?: boolean
  badgeBg?: string; badgeColor?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: last ? 'none' : '1px dashed #F1F5F9' }}>
      <span style={{ fontSize: '0.83rem', color: '#64748B', fontWeight: 600 }}>{label}</span>
      {badgeBg ? (
        <span style={{ background: badgeBg, color: badgeColor, borderRadius: 20, padding: '0.25rem 0.7rem', fontSize: '0.78rem', fontWeight: 700 }}>
          {value}
        </span>
      ) : (
        <span style={{ fontSize: bold ? '0.95rem' : '0.85rem', color: '#0F172A', fontWeight: bold ? 800 : 700, textTransform: uppercase ? 'uppercase' : 'none' }}>
          {value}
        </span>
      )}
    </div>
  )
}

function Timeline({ icon: Icon, bg, fg, title, desc, connector }: {
  icon: React.ComponentType<{ size?: number; color?: string }>
  bg: string; fg: string; title: string; desc: string; connector?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={fg} />
        </div>
        {connector && <div style={{ width: 2, flex: 1, background: '#E2E8F0', minHeight: 24 }} />}
      </div>
      <div style={{ paddingBottom: connector ? 16 : 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  )
}
