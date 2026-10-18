import type { CSSProperties } from 'react'

// Gaya modal halaman Pengeluaran — mengikuti modal Catat Pembayaran (kepala navy,
// isian abu muda) supaya formulir pencatatan uang di SiKu terasa sama.

export const sLatar: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
}

export const sKotak = (lebar: number): CSSProperties => ({
  background: '#fff', borderRadius: 16, width: '100%', maxWidth: lebar, maxHeight: 'calc(100vh - 2rem)',
  boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
})

export const sKepala: CSSProperties = {
  background: '#1A2C4E', padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexShrink: 0,
}
export const sJudulKepala: CSSProperties    = { color: '#fff', fontWeight: 800, fontSize: '1rem' }
export const sSubjudulKepala: CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', marginTop: 1 }
export const sTombolTutup: CSSProperties = {
  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 32, height: 32,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0,
}

export const sIsi: CSSProperties = { padding: '1.4rem', overflowY: 'auto' }

export const sLabel: CSSProperties     = { fontSize: '0.8rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }
export const sOpsional: CSSProperties  = { color: '#94A3B8', fontWeight: 500 }
export const sInput: CSSProperties = {
  width: '100%', padding: '0.6rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: '0.85rem',
  boxSizing: 'border-box', outline: 'none', background: '#F8FAFC', fontFamily: 'inherit', color: '#0F172A',
}
export const sBidang: CSSProperties = { marginBottom: '0.875rem' }

export const sGalat: CSSProperties = {
  background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.875rem',
}

export const sTombolUtama = (sibuk: boolean): CSSProperties => ({
  width: '100%', background: sibuk ? '#94A3B8' : 'linear-gradient(135deg,#1A2C4E,#243D6A)', color: '#fff', border: 'none', borderRadius: 10,
  padding: '0.8rem', fontSize: '0.9rem', fontWeight: 800, cursor: sibuk ? 'not-allowed' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit',
})

export const sTombolKedua: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1A2C4E', border: '1.5px solid #E2E8F0',
  borderRadius: 8, padding: '0.45rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}

export const sTombolIkon: CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0,
}
