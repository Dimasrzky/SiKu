'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface PilihanFilter { value: string; label: string; sublabel?: string }

export function DropdownFilter({ judul, nilai, pilihan, onPilih }: {
  judul:   string
  nilai:   string
  pilihan: PilihanFilter[]
  onPilih: (nilai: string) => void
}) {
  const [buka, setBuka] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!buka) return
    const tutup = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setBuka(false)
    }
    document.addEventListener('mousedown', tutup)
    return () => document.removeEventListener('mousedown', tutup)
  }, [buka])

  const terpilih = pilihan.find(p => p.value === nilai)

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        onClick={() => setBuka(b => !b)}
        aria-haspopup="listbox" aria-expanded={buka}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '0.55rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
      >
        <span style={{ color: '#94A3B8' }}>{judul}</span>
        <span style={{ color: '#101010' }}>{terpilih?.label ?? '—'}</span>
        <ChevronDown size={13} color="#94A3B8" style={{ marginLeft: 2, transform: buka ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {buka && (
        <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 220, maxHeight: 340, overflowY: 'auto', zIndex: 100 }}>
          {pilihan.map(p => {
            const aktif = p.value === nilai
            return (
              <button
                key={p.value}
                role="option" aria-selected={aktif}
                onClick={() => { onPilih(p.value); setBuka(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 1rem', border: 'none', background: aktif ? '#F8FAFC' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: aktif ? 700 : 600, color: aktif ? '#1A2C4E' : '#374151' }}>{p.label}</span>
                {p.sublabel && <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{p.sublabel}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
