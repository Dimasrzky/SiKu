import { CheckCircle2, Receipt, Bell } from 'lucide-react'
import { BULAN_NAMES, formatRp, formatTanggalWaktu, tanggalTagihanBerikutnya } from './format'

interface Props {
  namaSiswa:    string
  kelasNama:    string
  totalNominal: number
  waktuLunas:   string
  bulan:        number
  tahun:        number
}

export default function PembayaranLunasView({ namaSiswa, kelasNama, totalNominal, waktuLunas, bulan, tahun }: Props) {
  const periode = `${BULAN_NAMES[bulan]} ${tahun}`

  return (
    <div>
      {/* Banner */}
      <div style={{ background: '#14532D', borderRadius: 16, padding: '2rem 1.5rem', textAlign: 'center', marginBottom: '1.25rem' }}>
        <div style={{ width: 60, height: 60, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <CheckCircle2 size={28} color="#14532D" />
        </div>
        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#fff', marginBottom: 8 }}>Pembayaran Lunas!</div>
        <div style={{ color: '#BBF7D0', fontSize: '0.85rem', lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
          Tagihan <strong style={{ color: '#fff' }}>{namaSiswa}</strong> bulan {periode} telah lunas. Terima kasih atas kepercayaan Bapak/Ibu.
        </div>
      </div>

      {/* Card bukti pembayaran */}
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 10px #21396B', marginBottom: '1rem' }}>

        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '2px solid #C1C6CF' }}>
          <div style={{ width: 40, height: 40, background: '#FEF3C7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Receipt size={20} color="#D97706" />
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A2C4E' }}>Bukti Pembayaran</div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          <InfoRow label="Siswa"        value={`${namaSiswa}${kelasNama ? ` - ${kelasNama}` : ''}`} />
          <InfoRow label="Total dibayar" value={formatRp(totalNominal)} bold />
          <InfoRow label="Metode"       value="Transfer" />
          <InfoRow label="Waktu lunas"  value={formatTanggalWaktu(waktuLunas)} uppercase />
          <InfoRow label="Status" value="Lunas" last badgeBg="#D1FAE5" badgeColor="#059669" />
        </div>
      </div>

      {/* Tagihan berikutnya */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 10px #21396B', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <div style={{ width: 32, height: 32, background: '#FEF3C7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell size={16} color="#D97706" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>Tagihan Berikutnya</div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 1 }}>
              Pengingat akan dikirim via WhatsApp 7 &amp; 3 hari sebelum jatuh tempo
            </div>
          </div>
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1A2C4E', whiteSpace: 'nowrap' }}>
          {tanggalTagihanBerikutnya(bulan, tahun)}
        </span>
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
