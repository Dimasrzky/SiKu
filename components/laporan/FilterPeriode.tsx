'use client'

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Filter, X } from 'lucide-react'

// Filter periode yang bisa dilipat, dipakai Laporan (semua level) dan Pengeluaran.
// Tertutup: satu tombol navy "Filter Periode". Diklik: melebar ke kiri menjadi
// dropdown-dropdown putih (children) dengan tombol × bulat di kanan. × menutup kembali
// DAN mengembalikan periode ke bawaan (onTutup) — tombol yang tertutup selalu berarti
// "periode bawaan", jadi data yang tampil tidak pernah tersaring tanpa terlihat.
//
// Animasinya hanya lebar wadah, clip-path, opacity, dan transform. Lebar diukur dari
// kedua lapisan dan ditulis langsung ke DOM, supaya tidak ada render ulang per frame.

const KURVA  = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DURASI = 380

/**
 * Batas potong panel saat terbuka: lebih lebar dari panelnya sendiri, supaya bayangan
 * dan daftar pilihan dropdown (yang muncul di bawah, bisa menjorok ke kiri) tidak terpotong.
 */
const POTONG_BUKA  = 'inset(-24px -24px -440px -320px)'
/** Saat tertutup hanya selebar tombol, menempel di kanan — dari sinilah panel "melebar" */
const POTONG_TUTUP = 'inset(-24px -24px -440px calc(100% - var(--fp-lebar-tombol, 0px)))'

export function FilterPeriode({ children, terbukaAwal = false, onTutup, label = 'Filter Periode' }: {
  /** Dropdown-dropdown filter */
  children:     ReactNode
  /** Mulai terbuka — mis. filter di URL bukan periode bawaan */
  terbukaAwal?: boolean
  /** Dipanggil tombol ×: kembalikan periode ke bawaan */
  onTutup:      () => void
  label?:       string
}) {
  const [buka, setBuka] = useState(terbukaAwal)
  const idPanel   = useId()
  const wadahRef  = useRef<HTMLDivElement>(null)
  const tombolRef = useRef<HTMLSpanElement>(null)
  const panelRef  = useRef<HTMLDivElement>(null)
  const bukaRef   = useRef(buka)
  const pertamaRef = useRef(true)
  // Fokus hanya dipindah kalau tombolnya dipakai lewat papan ketik (klik keyboard: detail 0).
  // Dengan tetikus, memindah fokus memunculkan garis fokus di dropdown yang tidak diklik.
  const pindahFokusRef = useRef(false)

  // Lebar wadah = lebar lapisan yang tampil; tinggi = yang tertinggi dari keduanya
  useLayoutEffect(() => {
    bukaRef.current = buka
    const wadah = wadahRef.current
    if (!wadah) return
    if (pertamaRef.current) {
      // Tampilan pertama tanpa animasi
      wadah.style.transition = 'none'
      ukurWadah(wadah, tombolRef.current, panelRef.current, buka)
      void wadah.offsetWidth
      wadah.style.transition = ''
      pertamaRef.current = false
      return
    }
    ukurWadah(wadah, tombolRef.current, panelRef.current, buka)
    // Fokus pindah ke lapisan yang baru tampil, supaya pengguna papan ketik tidak tersesat
    if (pindahFokusRef.current) {
      const sasaran = buka ? panelRef.current?.querySelector<HTMLElement>('button') : tombolRef.current?.querySelector<HTMLElement>('button')
      sasaran?.focus({ preventScroll: true })
    }
  }, [buka])

  // Isi panel bisa berubah lebar (label pilihan berganti, dropdown Bulan muncul/hilang)
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => {
      if (wadahRef.current) ukurWadah(wadahRef.current, tombolRef.current, panelRef.current, bukaRef.current)
    })
    if (tombolRef.current) ro.observe(tombolRef.current)
    if (panelRef.current) ro.observe(panelRef.current)
    return () => ro.disconnect()
  }, [])

  const bukaFilter = (e: React.MouseEvent) => {
    pindahFokusRef.current = e.detail === 0
    setBuka(true)
  }

  const tutup = (e: React.MouseEvent) => {
    pindahFokusRef.current = e.detail === 0
    setBuka(false)
    onTutup()
  }

  return (
    <div ref={wadahRef} className="fp-wadah" style={{ position: 'relative', flexShrink: 0 }}>
      {/* ── Tertutup: tombol navy ── */}
      <span ref={tombolRef} inert={buka} style={{
        position: 'absolute', top: 0, right: 0, display: 'flex',
        opacity: buka ? 0 : 1,
        transform: buka ? 'scale(0.94)' : 'none',
        transformOrigin: 'right center',
        pointerEvents: buka ? 'none' : 'auto',
        // Menghilang cepat saat membuka; muncul sedikit belakangan saat menutup
        transition: buka
          ? `opacity 150ms ease, transform 220ms ${KURVA}`
          : `opacity 240ms ease 120ms, transform ${DURASI}ms ${KURVA} 80ms`,
      }}>
        <button type="button" onClick={bukaFilter} aria-expanded={buka} aria-controls={idPanel}
          className="fp-tekan fp-tombol" style={sTombol}>
          <Filter size={17} strokeWidth={2.2} /> {label}
        </button>
      </span>

      {/* ── Terbuka: dropdown + tombol × ── */}
      <div ref={panelRef} id={idPanel} role="group" aria-label={label} inert={!buka} style={{
        position: 'absolute', top: 0, right: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'max-content',
        opacity: buka ? 1 : 0,
        clipPath: buka ? POTONG_BUKA : POTONG_TUTUP,
        pointerEvents: buka ? 'auto' : 'none',
        transition: buka
          ? `opacity 240ms ease 40ms, clip-path ${DURASI}ms ${KURVA}`
          : `opacity 200ms ease, clip-path ${DURASI}ms ${KURVA}`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          transform: buka ? 'none' : 'translateX(18px)',
          transition: `transform ${DURASI}ms ${KURVA}`,
        }}>
          {children}
        </div>
        <span style={{
          display: 'flex',
          opacity: buka ? 1 : 0,
          transform: buka ? 'none' : 'scale(0.6) rotate(-90deg)',
          transition: buka
            ? `opacity 200ms ease 140ms, transform 340ms ${KURVA} 140ms`
            : 'opacity 140ms ease, transform 180ms ease',
        }}>
          <button type="button" onClick={tutup} aria-label="Tutup filter dan kembali ke periode bawaan"
            title="Tutup filter (kembali ke periode bawaan)" className="fp-tekan fp-silang" style={sSilang}>
            <X size={16} strokeWidth={2.4} />
          </button>
        </span>
      </div>
    </div>
  )
}

function ukurWadah(wadah: HTMLElement, tombol: HTMLElement | null, panel: HTMLElement | null, buka: boolean) {
  if (!tombol || !panel) return
  wadah.style.width  = `${(buka ? panel : tombol).offsetWidth}px`
  wadah.style.height = `${Math.max(tombol.offsetHeight, panel.offsetHeight)}px`
  wadah.style.setProperty('--fp-lebar-tombol', `${tombol.offsetWidth}px`)
}

const sTombol: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 1.15rem 0 1rem',
  background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer',
  fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-dm-sans), sans-serif', letterSpacing: '-0.01em',
  whiteSpace: 'nowrap',
}

const sSilang: React.CSSProperties = {
  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#fff', color: '#475569', border: '1.5px solid #E2E8F0', cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(26,44,78,0.08)',
}
