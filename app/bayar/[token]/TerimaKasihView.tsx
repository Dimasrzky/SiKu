'use client'

import { PartyPopper, Receipt, ListChecks } from 'lucide-react'
import { formatRp, formatTanggalWaktu, formatTanggalWIB } from './format'
import type { Pengajuan } from './page'

interface Props {
  namaSiswa:     string
  kelasNama:     string
  pengajuan:     Pengajuan
  waktuKirim:    string
  namaBendahara: string
  noWaBendahara: string
  onLihatStatus: () => void
}

export default function TerimaKasihView({
  namaSiswa, kelasNama, pengajuan, waktuKirim, namaBendahara, noWaBendahara, onLihatStatus,
}: Props) {
  const kontak  = [namaBendahara, noWaBendahara].filter(Boolean).join(' – ')
  const cicilan = pengajuan.jenis === 'cicilan'

  return (
    <div>
      {/* Banner */}
      <div style={{ background: '#21396B', borderRadius: 16, padding: '2rem 1.5rem', textAlign: 'center', marginBottom: '1.25rem' }}>
        <div style={{ width: 60, height: 60, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <PartyPopper size={28} color="#21396B" />
        </div>
        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#fff', marginBottom: 8 }}>Terima Kasih!</div>
        <div style={{ color: '#CBD5E1', fontSize: '0.85rem', lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
          Bukti pembayaran <strong style={{ color: '#fff' }}>{namaSiswa}</strong> sudah kami terima. Kami akan memverifikasi pembayaran tagihan ini.
        </div>
      </div>

      {/* Card ringkasan + langkah */}
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 10px #21396B' }}>

        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '2px solid #C1C6CF' }}>
          <div style={{ width: 40, height: 40, background: '#FEF3C7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Receipt size={20} color="#D97706" />
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A2C4E' }}>Ringkasan Pembayaran</div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          <InfoRow label="Siswa"        value={`${namaSiswa}${kelasNama ? ` ${kelasNama}` : ''}`} />
          <InfoRow label="Total dibayar" value={formatRp(pengajuan.nominal)} bold />
          <InfoRow label="Jenis"        value={cicilan ? 'Cicilan' : 'Lunas'} />
          {cicilan && (
            <>
              <InfoRow label="Sisa" value={formatRp(pengajuan.totalDipilih - pengajuan.nominal)} />
              {pengajuan.rencana && <InfoRow label="Rencana pelunasan" value={formatTanggalWIB(pengajuan.rencana)} />}
            </>
          )}
          <InfoRow label="Metode"       value="Transfer" />
          <InfoRow label="Waktu kirim"  value={formatTanggalWaktu(waktuKirim)} uppercase />
          <InfoRow
            label="Status"
            value="Menunggu Verifikasi"
            last
            badgeBg="#FEF3C7"
            badgeColor="#D97706"
          />
        </div>

        <div style={{ padding: '1.25rem 1.5rem', borderTop: '2px solid #C1C6CF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ width: 34, height: 34, background: '#FEF3C7', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ListChecks size={17} color="#D97706" />
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1A2C4E' }}>Langkah Selanjutnya</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Langkah nomor={1}>
              Tim sekolah akan melakukan verifikasi pembayaran dalam <strong>1x24 jam</strong> di hari kerja.
            </Langkah>
            <Langkah nomor={2}>
              {cicilan
                ? 'Cicilan akan tercatat setelah diverifikasi. Sisanya bisa dibayar lewat tautan yang sama.'
                : 'Konfirmasi lunas akan diperbarui pada halaman ini secara otomatis.'}
            </Langkah>
            <Langkah nomor={3}>
              Jika status pembayaran belum diperbarui lebih dari <strong>1x24 jam</strong>,
              {kontak ? <> silahkan hubungi <strong>{kontak}</strong></> : ' silahkan hubungi bendahara sekolah'}.
            </Langkah>
          </div>
        </div>
        <div style={{ padding: '0 1.5rem 1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onLihatStatus}
            style={{ padding: '0.75rem 1.5rem', background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 'clamp(0.78rem, 2.8vw, 0.9rem)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Halaman Status
          </button>
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

function Langkah({ nomor, children }: { nomor: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 10, padding: '0.75rem 0.9rem' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1A2C4E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
        {nomor}
      </div>
      <div style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}
