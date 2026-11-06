'use client'

import { useEffect, useState } from 'react'
import { Columns3, ListChecks, Sigma } from 'lucide-react'
import type { ModeKomponen, OpsiKomponen, PilihanKomponen } from '@/lib/komponenLaporan'

// Sebelum laporan berisi rupiah diunduh: centang komponen yang dimasukkan, dan kalau lebih
// dari satu, pilih ditotalkan atau dipisah satu kolom per komponen (lib/komponenLaporan).

const NAVY  = '#1A2C4E'
const GARIS = '#E2E8F0'

// Daftar komponen setinggi 5 baris; komponen lebih dari itu digulir di dalam daftar
const TAMPIL_KOMPONEN = 5
const TINGGI_KOMPONEN = 44
const GAP_KOMPONEN    = 6

interface Props {
  /** Nama laporan, mis. "Laporan transaksi" */
  judul:   string
  format:  'pdf' | 'excel'
  opsi:    OpsiKomponen[]
  awal:    PilihanKomponen
  onBatal: () => void
  onUnduh: (pilihan: PilihanKomponen) => void
}

const PILIHAN_MODE: { mode: ModeKomponen; judul: string; teks: string; ikon: typeof Sigma }[] = [
  { mode: 'total', judul: 'Totalkan langsung',        teks: 'Nominal komponen terpilih dijumlahkan dalam satu kolom', ikon: Sigma },
  { mode: 'pisah', judul: 'Pisah kolom per komponen', teks: 'Setiap komponen punya kolom nominalnya sendiri',         ikon: Columns3 },
]

export const ModalPilihKomponen = ({ judul, format, opsi, awal, onBatal, onUnduh }: Props) => {
  const [dipilih, setDipilih] = useState<Set<string>>(() => new Set(awal.kunci))
  const [mode,    setMode]    = useState<ModeKomponen>(awal.mode)
  const [galat,   setGalat]   = useState('')

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') onBatal() }
    window.addEventListener('keydown', tekan)
    return () => window.removeEventListener('keydown', tekan)
  }, [onBatal])

  const semua      = dipilih.size === opsi.length
  const lebihSatu  = dipilih.size > 1

  const ubah = (kunci: string, centang: boolean) => {
    setGalat('')
    setDipilih(lama => {
      const baru = new Set(lama)
      if (centang) baru.add(kunci)
      else baru.delete(kunci)
      return baru
    })
  }

  const unduh = () => {
    if (dipilih.size === 0) {
      setGalat('Centang paling tidak satu komponen.')
      return
    }
    // Urutan opsi (SPP dulu) juga menjadi urutan kolom di laporan
    onUnduh({ kunci: opsi.map(o => o.kunci).filter(k => dipilih.has(k)), mode })
  }

  return (
    <div
      onClick={onBatal}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="judul-pilih-komponen"
        className="pg-muncul"
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}
      >
        {/* Judul */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1.4rem 1.5rem 1rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ListChecks size={22} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div id="judul-pilih-komponen" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>Pilih Komponen</div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
              {judul} · {format === 'pdf' ? 'PDF' : 'Excel'}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 1.5rem', overflowY: 'auto' }}>
          {/* Pilih semua */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.15rem 0.6rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={semua}
              ref={el => { if (el) el.indeterminate = dipilih.size > 0 && !semua }}
              onChange={e => { setGalat(''); setDipilih(e.target.checked ? new Set(opsi.map(o => o.kunci)) : new Set()) }}
              style={{ width: 16, height: 16, margin: 0, accentColor: NAVY, cursor: 'pointer' }}
            />
            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>Pilih semua</span>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{dipilih.size} dari {opsi.length}</span>
          </label>

          {/* Daftar komponen — paling banyak 5 terlihat, sisanya digulir */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: GAP_KOMPONEN,
            maxHeight: TAMPIL_KOMPONEN * TINGGI_KOMPONEN + (TAMPIL_KOMPONEN - 1) * GAP_KOMPONEN,
            overflowY: 'auto', overscrollBehavior: 'contain',
            // Ruang untuk batang gulir supaya tidak menempel ke kotak centang
            paddingRight: opsi.length > TAMPIL_KOMPONEN ? 6 : 0,
          }}>
            {opsi.map(o => {
              const ya = dipilih.has(o.kunci)
              return (
                <label
                  key={o.kunci}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0 0.8rem', borderRadius: 10, cursor: 'pointer',
                    height: TINGGI_KOMPONEN, minHeight: TINGGI_KOMPONEN, boxSizing: 'border-box', flexShrink: 0,
                    border: `1.5px solid ${ya ? NAVY : GARIS}`, background: ya ? '#F8FAFC' : '#fff',
                    transition: 'border-color 160ms ease, background-color 160ms ease',
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: o.warna, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.86rem', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.nama}
                  </span>
                  <input
                    type="checkbox"
                    checked={ya}
                    onChange={e => ubah(o.kunci, e.target.checked)}
                    style={{ width: 16, height: 16, margin: 0, accentColor: NAVY, cursor: 'pointer', flexShrink: 0 }}
                  />
                </label>
              )
            })}
          </div>

          {/* Cara menampilkan — hanya kalau lebih dari satu komponen; membuka dengan halus */}
          <div
            inert={!lebihSatu}
            style={{ display: 'grid', gridTemplateRows: lebihSatu ? '1fr' : '0fr', opacity: lebihSatu ? 1 : 0, transition: 'grid-template-rows 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease' }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', margin: '1.1rem 0 0.5rem' }}>
                Cara menampilkan nominal
              </div>
              <div role="radiogroup" aria-label="Cara menampilkan nominal" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 2 }}>
                {PILIHAN_MODE.map(p => {
                  const ya = mode === p.mode
                  const Ikon = p.ikon
                  return (
                    <label
                      key={p.mode}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.65rem 0.8rem', borderRadius: 10, cursor: 'pointer',
                        border: `1.5px solid ${ya ? NAVY : GARIS}`, background: ya ? '#F8FAFC' : '#fff',
                        transition: 'border-color 160ms ease, background-color 160ms ease',
                      }}
                    >
                      <input
                        type="radio" name="mode-komponen" checked={ya} onChange={() => setMode(p.mode)}
                        style={{ width: 16, height: 16, margin: 0, accentColor: NAVY, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{p.judul}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 1 }}>{p.teks}</div>
                      </div>
                      <Ikon size={18} color={ya ? NAVY : '#94A3B8'} style={{ flexShrink: 0 }} />
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          {galat && (
            <div role="alert" style={{ fontSize: '0.8rem', color: '#DC2626', marginTop: '0.75rem' }}>{galat}</div>
          )}
        </div>

        {/* Tombol */}
        <div style={{ display: 'flex', gap: 8, padding: '1.25rem 1.5rem 1.4rem' }}>
          <button
            type="button"
            onClick={onBatal}
            style={{ flex: 1, padding: '0.7rem', background: '#fff', color: '#64748B', border: `1.5px solid ${GARIS}`, borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={unduh}
            style={{ flex: 1, padding: '0.7rem', background: dipilih.size === 0 ? '#94A3B8' : NAVY, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'background-color 160ms ease' }}
          >
            {format === 'pdf' ? 'Unduh PDF' : 'Unduh Excel'}
          </button>
        </div>
      </div>
    </div>
  )
}
