'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Satu dropdown filter (mis. "Periode 2026/2027 ⌄") — dipakai di dalam FilterPeriode.
// Kelas fp-* (efek tekan, hover, munculnya daftar) ada di dashboard.css.

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
    const tutupEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false) }
    document.addEventListener('mousedown', tutup)
    document.addEventListener('keydown', tutupEsc)
    return () => {
      document.removeEventListener('mousedown', tutup)
      document.removeEventListener('keydown', tutupEsc)
    }
  }, [buka])

  const terpilih = pilihan.find(p => p.value === nilai)

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        onClick={() => setBuka(b => !b)}
        aria-haspopup="listbox" aria-expanded={buka}
        className="fp-tekan fp-dropdown"
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', height: 40, padding: '0 0.8rem 0 0.9rem',
          background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 9, cursor: 'pointer',
          fontSize: '0.88rem', fontWeight: 500, fontFamily: 'var(--font-dm-sans), sans-serif', letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: '#94A3B8' }}>{judul}</span>
        <span style={{ color: '#101010' }}>{terpilih?.label ?? '—'}</span>
        <ChevronDown size={15} color="#94A3B8" style={{ marginLeft: 3, transform: buka ? 'rotate(180deg)' : 'none', transition: 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
      </button>
      {buka && (
        <div role="listbox" className="fp-daftar" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 220, maxHeight: 340, overflowY: 'auto', zIndex: 100, fontFamily: 'var(--font-dm-sans), sans-serif' }}>
          {pilihan.map(p => {
            const aktif = p.value === nilai
            return (
              <button
                key={p.value}
                type="button"
                role="option" aria-selected={aktif}
                onClick={() => { onPilih(p.value); setBuka(false) }}
                className="fp-pilihan"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 1rem', border: 'none', background: aktif ? '#F8FAFC' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <span style={{ fontSize: '0.84rem', fontWeight: aktif ? 700 : 500, color: aktif ? '#1A2C4E' : '#374151' }}>{p.label}</span>
                {p.sublabel && <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{p.sublabel}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
