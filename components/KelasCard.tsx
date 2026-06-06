'use client'

import { Pencil, X } from 'lucide-react'

export interface KelasCardData {
  id:        string
  jenjang:   string   
  identitas: string[]
  warna:     string
}

interface Props {
  card:            KelasCardData
  onEdit?:         (card: KelasCardData) => void
  onDelete?:       (id: string) => void
  readonly?:       boolean
  showIdentitas?:  boolean
}

export function KelasCard({ card, onEdit, onDelete, readonly = false, showIdentitas = false }: Props) {
  return (
    <div style={{
      background:    card.warna,
      borderRadius:  12,
      padding:       '1rem 1.1rem',
      boxShadow:     `0 4px 16px rgba(0,0,0,0.22), 0 1px 4px ${card.warna}88`,
      position:      'relative',
      minHeight:     showIdentitas ? 120 : undefined,
      display:       'flex',
      flexDirection: 'column',
      gap:           '0.6rem',
    }}>

      {/* Tombol edit & hapus — hanya muncul kalau bukan readonly */}
      {!readonly && (
        <div style={{ position: 'absolute', top: '0.65rem', right: '0.65rem', display: 'flex', gap: '0.3rem' }}>
          <button onClick={() => onEdit?.(card)} title="Edit" style={iconBtn}>
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete?.(card.id)} title="Hapus" style={{ ...iconBtn, background: 'rgba(255,255,255,0.15)' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Judul */}
      <div>
        <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#fff', letterSpacing: '0.02em', lineHeight: 1.2 }}>
          Kelas {card.jenjang}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>
          {card.identitas.length} kelas
        </div>
      </div>

      {/* Identitas — hanya ditampilkan jika showIdentitas */}
      {showIdentitas && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {card.identitas.map(id => (
            <span key={id} style={{
              background:     'rgba(255,255,255,0.2)',
              color:          '#fff',
              borderRadius:   6,
              padding:        '0.2rem 0.6rem',
              fontSize:       '0.8rem',
              fontWeight:     600,
              backdropFilter: 'blur(4px)',
            }}>
              {card.jenjang}-{id}
            </span>
          ))}
        </div>
      )}

    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background:     'rgba(255,255,255,0.25)',
  border:         'none',
  cursor:         'pointer',
  color:          '#fff',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  width:          26,
  height:         26,
  borderRadius:   6,
  padding:        0,
  flexShrink:     0,
}
