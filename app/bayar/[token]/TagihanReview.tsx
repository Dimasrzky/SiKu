'use client'

import { Receipt, Scissors, Award, AlertTriangle } from 'lucide-react'
import type { BeasiswaBadge, TagihanItem, TunggakanItem } from './page'

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const getInitials = (nama: string): string => {
  const parts = nama.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return nama.slice(0, 2).toUpperCase()
}

interface Props {
  namaSiswa:     string
  nis:           string
  kelasNama:     string
  items:         TagihanItem[]
  tunggakan:     TunggakanItem[]
  totalNominal:  number
  badges:        BeasiswaBadge[]
  onLanjut:      () => void
}

export default function TagihanReview({ namaSiswa, nis, kelasNama, items, tunggakan, totalNominal, badges, onLanjut }: Props) {
  const totalTunggakan = tunggakan.reduce((s, t) => s + t.nominal, 0)

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 0 6px #21386b7b', marginBottom: '1.8rem' }}>

        {/* Card header */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '2px solid #C1C6CF' }}>
          <div style={{ width: 40, height: 40, background: '#FEF3C7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Receipt size={20} color="#D97706" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 'clamp(0.82rem, 3vw, 0.95rem)', color: '#1A2C4E' }}>Rincian tagihan</div>
            <div style={{ fontSize: 'clamp(0.68rem, 2.4vw, 0.78rem)', color: '#94A3B8', marginTop: 1 }}>Pastikan komponen tagihan sudah sesuai sebelum melanjutkan</div>
          </div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>

          {/* Info siswa + badge beasiswa/potongan */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', background: '#F0F7FF', border: '3px solid #E3F0FF', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontWeight: 800, fontSize: 'clamp(0.7rem, 2.4vw, 0.8rem)' }}>
                {getInitials(namaSiswa || '-')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 'clamp(0.8rem, 2.8vw, 0.9rem)', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {namaSiswa || '-'}
                </div>
                <div style={{ fontSize: 'clamp(0.68rem, 2.4vw, 0.78rem)', color: '#64748B', marginTop: 1 }}>
                  {kelasNama || '-'} {nis && <>&middot; NIS {nis}</>}
                </div>
              </div>
            </div>

            {badges.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {badges.map((b, i) => (
                  <span key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '0.25rem 0.6rem', borderRadius: 20, fontSize: 'clamp(0.6rem, 2vw, 0.68rem)', fontWeight: 700,
                    background: b.label === 'beasiswa' ? '#DCFCE7' : '#FFEDD5',
                    color:      b.label === 'beasiswa' ? '#15803D' : '#C2410C',
                  }}>
                    {b.label === 'beasiswa' ? <Award size={11} /> : <Scissors size={11} />}
                    {b.nama} &middot; {b.nilai}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Rincian komponen */}
          <div style={{ fontWeight: 700, fontSize: 'clamp(0.78rem, 2.8vw, 0.9rem)', color: '#1A2C4E', letterSpacing: 0.5, marginBottom: 8 }}>
            Rincian komponen
          </div>
          <div style={{ maxHeight: 168, overflowY: 'auto', marginBottom: 6, border: '2px solid #BABFC7', borderRadius: 8, padding: '0.5rem 1rem', boxShadow: '0 2px 10px #babfc76f' }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'clamp(0.75rem, 2.6vw, 0.85rem)', color: '#374151', padding: '0.5rem 0', borderBottom: i < items.length - 1 ? '1px dashed #F1F5F9' : 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.warna, flexShrink: 0 }} />
                  {item.nama_komponen}
                </span>
                <span style={{ fontWeight: 700 }}>{formatRp(item.nominal)}</span>
              </div>
            ))}
          </div>
          {items.length > 3 && (
            <div style={{ textAlign: 'center', fontSize: 'clamp(0.64rem, 2vw, 0.72rem)', color: '#1A2C4E', margin: '2rem 2rem' }}>
              ∨ Scroll untuk lihat komponen lain
            </div>
          )}

          {/* Tunggakan periode sebelumnya — ikut ditagihkan, jadi ditempatkan
              sebelum total supaya urutan bacanya masuk akal */}
          {tunggakan.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <AlertTriangle size={14} color="#D97706" />
                <span style={{ fontWeight: 700, fontSize: 'clamp(0.78rem, 2.8vw, 0.9rem)', color: '#92400E', letterSpacing: 0.5 }}>
                  Tunggakan bulan sebelumnya
                </span>
              </div>
              <div style={{ maxHeight: 150, overflowY: 'auto', border: '2px solid #FDE68A', background: '#FFFBEB', borderRadius: 8, padding: '0.5rem 1rem' }}>
                {tunggakan.map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 'clamp(0.75rem, 2.6vw, 0.85rem)', color: '#374151', padding: '0.5rem 0', borderBottom: i < tunggakan.length - 1 ? '1px dashed #FEF3C7' : 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.warna, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nama_komponen}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 'clamp(0.62rem, 2.2vw, 0.7rem)', color: '#92400E', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {BULAN_NAMES[t.bulan]} {t.tahun}
                      </span>
                      <span style={{ fontWeight: 700, color: '#92400E', whiteSpace: 'nowrap' }}>{formatRp(t.nominal)}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
                <span style={{ fontSize: 'clamp(0.72rem, 2.5vw, 0.82rem)', color: '#92400E', fontWeight: 700 }}>Total tunggakan</span>
                <span style={{ fontSize: 'clamp(0.85rem, 3vw, 1rem)', color: '#92400E', fontWeight: 800 }}>{formatRp(totalTunggakan)}</span>
              </div>
              <div style={{ fontSize: 'clamp(0.62rem, 2.2vw, 0.72rem)', color: '#94A3B8', lineHeight: 1.5, marginTop: '0.4rem' }}>
                Sudah termasuk dalam total di bawah dan akan dilunasi bersama tagihan bulan ini.
              </div>
              <div style={{ height: 1.5, background: '#C1C6CF', margin: '0.9rem 0 1rem' }} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'clamp(0.5rem, 3vw, 1rem)', color: '#1A2C4E', fontWeight: 700 }}>Total yang harus dibayar</span>
            <span style={{ fontSize: 'clamp(1.05rem, 4vw, 1.3rem)', color: '#1A2C4E', fontWeight: 800 }}>{formatRp(totalNominal)}</span>
          </div>
          <div style={{ height: 1.5, background: '#C1C6CF', margin: '0.75rem 0 1rem' }} />

          <button
            onClick={onLanjut}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.9rem', background: '#1A2C4E', color: '#fff', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 'clamp(0.85rem, 3vw, 1rem)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Lanjutkan Pembayaran
          </button>
        </div>
      </div>
    </div>
  )
}
