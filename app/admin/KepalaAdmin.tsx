import type { LucideIcon } from 'lucide-react'

/** Judul halaman admin: ikon navy, judul, dan subjudul */
export default function KepalaAdmin({ Ikon, judul, subjudul }: { Ikon: LucideIcon; judul: string; subjudul: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem', minWidth: 0 }}>
      <div style={{ width: 48, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Ikon size={24} color="#fff" />
      </div>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1A2C4E', margin: 0, overflowWrap: 'anywhere' }}>{judul}</h1>
        <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.15rem 0 0' }}>{subjudul}</p>
      </div>
    </div>
  )
}
