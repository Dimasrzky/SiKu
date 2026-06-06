'use client'

import { Pencil, X } from 'lucide-react'

export type JenisTagihan = 'wajib' | 'beasiswa' | 'ekskul' | 'aktivitas'

export interface TagihanItem {
  id: string
  nama: string
  nominal: number
}

export interface PotonganData {
  kelasJenjang?: string
  namaItem:      string
  nominalAsli:   number
  persenPotong:  number
}

export interface TagihanCardData {
  id: string
  jenis: JenisTagihan
  // wajib only
  kelasJenjang?: string
  kelasWarna?: string
  kelasJumlah?: number
  // beasiswa / ekskul / aktivitas
  nama?: string
  // beasiswa only
  kelasRef?:    string
  potonganData?: PotonganData[]
  // aktivitas only
  scope?: 'semua' | 'perorangan'
  items: TagihanItem[]
}

const HEADER_COLOR: Record<JenisTagihan, (warna?: string) => string> = {
  wajib:     (w) => w ?? '#1D4ED8',
  beasiswa:  ()  => '#B45309',
  ekskul:    ()  => '#047857',
  aktivitas: ()  => '#7C3AED',
}

const TOTAL_LABEL: Record<JenisTagihan, string> = {
  wajib:     'Total / siswa',
  beasiswa:  'Potongan / siswa',
  ekskul:    'Biaya / peserta',
  aktivitas: 'Biaya kegiatan',
}

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

interface Props {
  card: TagihanCardData
  onEdit?: (card: TagihanCardData) => void
  onDelete?: (id: string) => void
  readonly?: boolean
}

export function TagihanCard({ card, onEdit, onDelete, readonly = false }: Props) {
  const total       = card.items.reduce((s, item) => s + item.nominal, 0)
  const headerColor = HEADER_COLOR[card.jenis](card.kelasWarna)

  const headerTitle = card.jenis === 'wajib'
    ? `Kelas ${card.kelasJenjang}`
    : card.nama ?? '-'

  const headerSub = card.jenis === 'wajib'
    ? `${card.kelasJumlah} kelas · ${card.items.length} item tagihan`
    : card.jenis === 'beasiswa'
    ? `Kelas ${card.kelasRef} · ${card.items.length} item potongan`
    : card.jenis === 'ekskul'
    ? `Ekstrakurikuler · ${card.items.length} item`
    : card.scope === 'semua'
    ? `Semua siswa · ${card.items.length} item`
    : `Perorangan · ${card.items.length} item`

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{
        background: headerColor,
        padding: '0.85rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', letterSpacing: '0.02em' }}>
            {headerTitle}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            {headerSub}
          </div>
        </div>
        {!readonly && (
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button onClick={() => onEdit?.(card)} title="Edit" style={iconBtn}>
              <Pencil size={12} />
            </button>
            <button onClick={() => onDelete?.(card.id)} title="Hapus" style={{ ...iconBtn, background: 'rgba(255,255,255,0.15)' }}>
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Items */}
      <div style={{ padding: '0.75rem 1rem' }}>
        {card.items.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
            Belum ada item tagihan
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {card.items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-mid)', fontWeight: 500 }}>{item.nama}</span>
                <span style={{ color: 'var(--navy-dark)', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                  {card.jenis === 'beasiswa' ? '- ' : ''}{formatRp(item.nominal)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div style={{
          marginTop: '0.65rem',
          paddingTop: '0.65rem',
          borderTop: '1.5px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
            {TOTAL_LABEL[card.jenis]}
          </span>
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: headerColor }}>
            {card.jenis === 'beasiswa' ? '- ' : ''}{formatRp(total)}
          </span>
        </div>
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.25)',
  border: 'none',
  cursor: 'pointer',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 6,
  padding: 0,
  flexShrink: 0,
}
