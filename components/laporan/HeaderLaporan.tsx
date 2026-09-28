'use client'

import Link from 'next/link'
import { BarChart2, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export interface JejakLaporan { label: string; href?: string }

/**
 * Judul halaman laporan di setiap level drill-down, dengan jejak
 * Sekolah › Jenjang › Kelas di atasnya. `kanan` berisi filter dan aksi halaman.
 */
export function HeaderLaporan({ judul, subjudul, jejak, kanan }: {
  judul:    string
  subjudul: string
  jejak?:   JejakLaporan[]
  kanan?:   ReactNode
}) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {jejak && jejak.length > 0 && (
        <nav aria-label="Jejak laporan" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.82rem', marginBottom: '0.9rem' }}>
          {jejak.map((j, i) => (
            <span key={`${j.label}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {i > 0 && <ChevronRight size={13} color="#94A3B8" />}
              {j.href
                ? <Link href={j.href} style={{ color: '#3C75B7', fontWeight: 600, textDecoration: 'none' }}>{j.label}</Link>
                : <span aria-current="page" style={{ color: '#0F172A', fontWeight: 700 }}>{j.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '2px 3px 10px rgba(18, 47, 102, 0.54)' }}>
            <BarChart2 size={30} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>
              {judul}
            </h1>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              {subjudul}
            </p>
          </div>
        </div>
        {kanan && <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>{kanan}</div>}
      </div>
    </div>
  )
}
