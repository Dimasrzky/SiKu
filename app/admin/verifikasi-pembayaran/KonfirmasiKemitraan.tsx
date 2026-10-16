'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck, School } from 'lucide-react'

export interface PendaftaranSekolah {
  id:            string
  namaSekolah:   string
  jenjang:       string | null
  /** Nomor WhatsApp sekolah dengan awalan 62, tanpa tanda + */
  noWa:          string | null
  namaBendahara: string | null
  email:         string | null
  /** Waktu daftar, sudah diformat (WIB) */
  terdaftar:     string
}

const KOLOM = ['No', 'Sekolah', 'Bendahara', 'WhatsApp Sekolah', 'Terdaftar', 'Aksi'] as const

export default function KonfirmasiKemitraan({ daftar }: { daftar: PendaftaranSekolah[] }) {
  const router = useRouter()
  const [dipilih, setDipilih] = useState<PendaftaranSekolah | null>(null)
  const [memproses, setMemproses] = useState(false)
  const [galat, setGalat] = useState('')

  const buka = (p: PendaftaranSekolah) => {
    setGalat('')
    setDipilih(p)
  }

  const konfirmasi = async () => {
    if (!dipilih || memproses) return
    setMemproses(true)
    setGalat('')
    try {
      const res = await fetch(`/api/admin/kemitraan/${dipilih.id}`, { method: 'POST' })
      const json = await res.json().catch(() => null) as { error?: string | null } | null
      if (!res.ok) {
        setGalat(json?.error ?? 'Gagal mengonfirmasi, coba lagi.')
        return
      }
      setDipilih(null)
      router.refresh()
    } catch {
      setGalat('Gagal menghubungi server. Coba lagi.')
    } finally {
      setMemproses(false)
    }
  }

  return (
    <section id="kemitraan" style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.5rem', overflow: 'hidden', scrollMarginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem' }}>
        <div style={{ width: 38, height: 38, background: '#DCE9FF', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <School size={19} color="#1A2C4E" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1A2C4E', margin: 0 }}>Konfirmasi Kemitraan Sekolah</h2>
            {daftar.length > 0 && (
              <span style={{ minWidth: 22, height: 22, padding: '0 7px', background: '#DC2626', color: '#fff', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {daftar.length}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0.15rem 0 0' }}>
            Sekolah yang baru mendaftar. Pastikan sekolah terdaftar sebagai mitra Equanusa sebelum dikonfirmasi.
          </p>
        </div>
      </div>

      {daftar.length === 0 ? (
        <div style={{ padding: '1.25rem', borderTop: '1px solid #F1F5F9', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
          Tidak ada pendaftaran sekolah yang menunggu konfirmasi.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ background: '#1A2C4E' }}>
                {KOLOM.map(h => (
                  <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daftar.map((p, idx) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F8FAFC', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: '#64748B', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{p.namaSekolah}</div>
                    {p.jenjang && <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>{p.jenjang}</div>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#0F172A' }}>{p.namaBendahara ?? '-'}</div>
                    {p.email && <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2, wordBreak: 'break-all' }}>{p.email}</div>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', whiteSpace: 'nowrap' }}>
                    {p.noWa ? (
                      <a href={`https://wa.me/${p.noWa}`} target="_blank" rel="noopener noreferrer" style={{ color: '#15803D', fontWeight: 700, textDecoration: 'none' }}>
                        +{p.noWa}
                      </a>
                    ) : <span style={{ color: '#94A3B8' }}>-</span>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>{p.terdaftar}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button
                      onClick={() => buka(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.4rem 0.75rem', background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <BadgeCheck size={13} /> Konfirmasi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dipilih && (
        <div
          onClick={() => !memproses && setDipilih(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            role="dialog" aria-modal="true" aria-labelledby="judul-konfirmasi-kemitraan"
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', padding: '1.5rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 48, height: 48, background: '#D1FAE5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <BadgeCheck size={24} color="#059669" />
            </div>

            <div id="judul-konfirmasi-kemitraan" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 6 }}>
              Konfirmasi kemitraan sekolah
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6, marginBottom: '1rem' }}>
              Pastikan <strong style={{ color: '#0F172A' }}>{dipilih.namaSekolah}</strong> terdaftar sebagai mitra Equanusa.
              Setelah dikonfirmasi, {dipilih.namaBendahara ? <strong style={{ color: '#0F172A' }}>{dipilih.namaBendahara}</strong> : 'bendahara'} langsung
              bisa membuka dashboard SiKu. Tindakan ini tidak dapat dibatalkan.
            </div>

            {galat && <div style={{ fontSize: '0.78rem', color: '#DC2626', marginBottom: '1rem' }}>{galat}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setDipilih(null)}
                disabled={memproses}
                style={{ flex: 1, padding: '0.65rem', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: memproses ? 'default' : 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={konfirmasi}
                disabled={memproses}
                style={{ flex: 1, padding: '0.65rem', background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: memproses ? 'default' : 'pointer', opacity: memproses ? 0.7 : 1 }}
              >
                {memproses ? 'Memproses...' : 'Ya, konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
