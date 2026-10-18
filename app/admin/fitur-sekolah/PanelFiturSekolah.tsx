'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Puzzle, Search, X } from 'lucide-react'
import { KATALOG_FITUR, infoFitur, type KodeFitur } from '@/lib/fiturSekolah'

export interface SekolahFitur {
  id:    string
  nama:  string
  fitur: KodeFitur[]
}

type Dialog =
  | { jenis: 'tambah'; sekolah: SekolahFitur }
  | { jenis: 'cabut'; sekolah: SekolahFitur; fitur: KodeFitur }

const KOLOM = ['No', 'Sekolah', 'Subfitur aktif', 'Aksi'] as const

const sKartu = { background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as const

export default function PanelFiturSekolah({ daftar }: { daftar: SekolahFitur[] }) {
  const router = useRouter()
  const [cari, setCari] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [pilihan, setPilihan] = useState<KodeFitur | null>(null)
  const [memproses, setMemproses] = useState(false)
  const [galat, setGalat] = useState('')

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return q ? daftar.filter(s => s.nama.toLowerCase().includes(q)) : daftar
  }, [daftar, cari])

  const belumDipasang = (s: SekolahFitur) => KATALOG_FITUR.filter(f => !s.fitur.includes(f.kode))

  const bukaTambah = (s: SekolahFitur) => {
    setGalat('')
    setPilihan(belumDipasang(s)[0]?.kode ?? null)
    setDialog({ jenis: 'tambah', sekolah: s })
  }

  const bukaCabut = (s: SekolahFitur, fitur: KodeFitur) => {
    setGalat('')
    setDialog({ jenis: 'cabut', sekolah: s, fitur })
  }

  const tutup = () => { if (!memproses) setDialog(null) }

  const kirim = async () => {
    if (!dialog || memproses) return
    const fitur = dialog.jenis === 'tambah' ? pilihan : dialog.fitur
    if (!fitur) return
    setMemproses(true)
    setGalat('')
    try {
      const res = await fetch(`/api/admin/fitur/${dialog.sekolah.id}`, {
        method:  dialog.jenis === 'tambah' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fitur }),
      })
      const json = await res.json().catch(() => null) as { error?: string | null } | null
      if (!res.ok) {
        setGalat(json?.error ?? 'Gagal menyimpan, coba lagi.')
        return
      }
      setDialog(null)
      router.refresh()
    } catch {
      setGalat('Gagal menghubungi server. Coba lagi.')
    } finally {
      setMemproses(false)
    }
  }

  return (
    <>
      {/* Katalog subfitur yang sudah dibuat */}
      <section style={{ ...sKartu, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1A2C4E', margin: 0 }}>Subfitur tersedia</h2>
        <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0.15rem 0 0.9rem' }}>
          Subfitur hanya muncul di sekolah yang ditambahkan. Mencabut subfitur tidak menghapus data yang sudah dicatat sekolah.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {KATALOG_FITUR.map(f => (
            <div key={f.kode} style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '0.875rem 1rem', display: 'flex', gap: '0.75rem' }}>
              <div style={{ width: 38, height: 38, background: '#DCE9FF', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Puzzle size={18} color="#1A2C4E" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>{f.nama}</div>
                <div style={{ fontSize: '0.72rem', color: '#3C75B7', fontWeight: 700, marginTop: 1 }}>Menu {f.menu}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748B', lineHeight: 1.5, marginTop: 4 }}>{f.deskripsi}</div>
                <div style={{ fontSize: '0.75rem', color: '#0F172A', fontWeight: 700, marginTop: 6 }}>
                  Dipakai {daftar.filter(s => s.fitur.includes(f.kode)).length} sekolah
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Daftar sekolah */}
      <section style={{ ...sKartu, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem 1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1A2C4E', margin: 0 }}>Sekolah</h2>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0.15rem 0 0' }}>Sekolah yang kemitraannya sudah dikonfirmasi</p>
          </div>
          <div style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={cari}
              onChange={e => setCari(e.target.value)}
              placeholder="Cari nama sekolah..."
              aria-label="Cari nama sekolah"
              style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2rem', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box', background: '#F8FAFC' }}
            />
          </div>
        </div>

        {tersaring.length === 0 ? (
          <div style={{ padding: '1.5rem', borderTop: '1px solid #F1F5F9', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
            {daftar.length === 0 ? 'Belum ada sekolah yang dikonfirmasi.' : 'Tidak ada sekolah yang cocok.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#1A2C4E' }}>
                  {KOLOM.map(h => (
                    <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tersaring.map((s, idx) => {
                  const sisa = belumDipasang(s)
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: '#64748B', fontWeight: 600, width: 48 }}>{idx + 1}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{s.nama}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {s.fitur.length === 0 ? (
                          <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Belum ada</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {s.fitur.map(k => (
                              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '0.2rem 0.35rem 0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>
                                {infoFitur(k).nama}
                                <button
                                  onClick={() => bukaCabut(s, k)}
                                  aria-label={`Cabut ${infoFitur(k).nama} dari ${s.nama}`}
                                  title="Cabut subfitur"
                                  style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(22,101,52,0.12)', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                                >
                                  <X size={11} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', width: 180 }}>
                        <button
                          onClick={() => bukaTambah(s)}
                          disabled={sisa.length === 0}
                          title={sisa.length === 0 ? 'Semua subfitur sudah ditambahkan' : undefined}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.4rem 0.75rem', background: sisa.length === 0 ? '#E2E8F0' : '#1A2C4E', color: sisa.length === 0 ? '#94A3B8' : '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: sisa.length === 0 ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                          <Plus size={13} /> Tambah Subfitur
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog && (
        <div
          onClick={tutup}
          style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            role="dialog" aria-modal="true" aria-labelledby="judul-dialog-fitur"
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', padding: '1.5rem' }}
            onClick={e => e.stopPropagation()}
          >
            {dialog.jenis === 'tambah' ? (
              <>
                <div id="judul-dialog-fitur" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 4 }}>
                  Tambah subfitur
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6, marginBottom: '1rem' }}>
                  Pilih subfitur untuk <strong style={{ color: '#0F172A' }}>{dialog.sekolah.nama}</strong>. Menunya langsung muncul di dashboard sekolah ini.
                </div>
                <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
                  {belumDipasang(dialog.sekolah).map(f => {
                    const aktif = pilihan === f.kode
                    return (
                      <button
                        key={f.kode}
                        role="radio" aria-checked={aktif}
                        onClick={() => setPilihan(f.kode)}
                        style={{ textAlign: 'left', border: `1.5px solid ${aktif ? '#1A2C4E' : '#E2E8F0'}`, background: aktif ? '#EFF6FF' : '#fff', borderRadius: 10, padding: '0.7rem 0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>{f.nama} <span style={{ color: '#3C75B7', fontSize: '0.72rem' }}>· Menu {f.menu}</span></div>
                        <div style={{ fontSize: '0.76rem', color: '#64748B', lineHeight: 1.5, marginTop: 2 }}>{f.deskripsi}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <div id="judul-dialog-fitur" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 6 }}>
                  Cabut subfitur {infoFitur(dialog.fitur).nama}?
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6, marginBottom: '1rem' }}>
                  Menu {infoFitur(dialog.fitur).nama} hilang dari dashboard <strong style={{ color: '#0F172A' }}>{dialog.sekolah.nama}</strong>.
                  Data yang sudah dicatat tetap tersimpan dan muncul lagi kalau subfitur ini ditambahkan kembali.
                </div>
              </>
            )}

            {galat && <div style={{ fontSize: '0.78rem', color: '#DC2626', marginBottom: '1rem' }}>{galat}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={tutup}
                disabled={memproses}
                style={{ flex: 1, padding: '0.65rem', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: memproses ? 'default' : 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={kirim}
                disabled={memproses || (dialog.jenis === 'tambah' && !pilihan)}
                style={{ flex: 1, padding: '0.65rem', background: dialog.jenis === 'cabut' ? '#DC2626' : '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: memproses ? 'default' : 'pointer', opacity: memproses ? 0.7 : 1 }}
              >
                {memproses ? 'Memproses...' : dialog.jenis === 'tambah' ? 'Tambahkan' : 'Ya, cabut'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
