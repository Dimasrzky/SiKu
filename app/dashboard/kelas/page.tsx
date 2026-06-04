'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, GraduationCap, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { KelasCard, type KelasCardData } from '@/components/KelasCard'

const SEMESTER_OPTIONS     = ['Ganjil', 'Genap']
const TAHUN_AJARAN_OPTIONS = (() => {
  const base = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => `${base - 1 + i}/${base + i}`)
})()
const WARNA_OPTIONS = [
  '#1E3A8A', '#1D4ED8', '#0891B2', '#059669',
  '#7C3AED', '#BE185D', '#DC2626', '#D97706',
  '#92400E', '#374151',
]

const JENJANG_MAP: Record<string, string[]> = {
  TK:  ['A', 'B', 'C'],
  SD:  ['I', 'II', 'III', 'IV', 'V', 'VI'],
  SMP: ['VII', 'VIII', 'IX'],
  SMA: ['X', 'XI', 'XII'],
  SMK: ['X', 'XI', 'XII'],
}

interface KelasRow {
  id:           string
  nama:         string
  jenjang:      string
  warna:        string
  tahun_ajaran: string
  semester:     string
}

interface ModalState {
  open:      boolean
  mode:      'add' | 'edit'
  editId?:   string
  jenjang:   string
  identitas: string[]
  warna:     string
}

const defaultModal = (firstJenjang = 'VII'): ModalState => ({
  open: false, mode: 'add', jenjang: firstJenjang, identitas: [], warna: '#1D4ED8',
})

function buildCards(rows: KelasRow[]): KelasCardData[] {
  const grouped = new Map<string, { warna: string; identitas: string[]; ids: string[] }>()
  for (const row of rows) {
    const dashIdx   = row.nama.indexOf('-')
    const identitas = dashIdx >= 0 ? row.nama.slice(dashIdx + 1) : row.nama
    if (!grouped.has(row.jenjang)) grouped.set(row.jenjang, { warna: row.warna, identitas: [], ids: [] })
    const entry = grouped.get(row.jenjang)!
    entry.identitas.push(identitas)
    entry.ids.push(row.id)
  }
  return Array.from(grouped.entries()).map(([jenjang, { warna, identitas }]) => ({
    id: `grp-${jenjang}`, jenjang, identitas, warna,
  }))
}

export default function KelasPage() {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [tahunAjaran,    setTahunAjaran]    = useState('2025/2026')
  const [semester,       setSemester]       = useState('Genap')
  const [cards,          setCards]          = useState<KelasCardData[]>([])
  const [modal,          setModal]          = useState<ModalState>(defaultModal())
  const [newSuffix,      setNewSuffix]      = useState('')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [jenjangOptions, setJenjangOptions] = useState<string[]>(JENJANG_MAP['SMP'])
  const [setupDone,      setSetupDone]      = useState(false)
  const [dataLoading,    setDataLoading]    = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('pengaturan')
        .select('jenjang_sekolah, setup_steps')
        .maybeSingle(),
      supabase
        .from('kelas')
        .select('id, nama, jenjang, warna, tahun_ajaran, semester')
        .order('jenjang'),
    ]).then(([{ data: pData }, { data: kData }]) => {
      const opts = JENJANG_MAP[(pData as { jenjang_sekolah?: string } | null)?.jenjang_sekolah ?? 'SMP'] ?? JENJANG_MAP['SMP']
      setJenjangOptions(opts)
      setModal(defaultModal(opts[0]))

      if ((pData as { setup_steps?: Record<string, unknown> } | null)?.setup_steps?.['kelas_tahun_ajaran'] === true) {
        setSetupDone(true)
      }

      const rows = (kData ?? []) as KelasRow[]
      if (rows.length > 0) {
        setTahunAjaran(rows[0].tahun_ajaran)
        setSemester(rows[0].semester)
        setCards(buildCards(rows))
      }

      setDataLoading(false)
    })
  }, [])

  const openAdd  = () => { setModal({ open: true, mode: 'add', jenjang: jenjangOptions[0] ?? 'VII', identitas: [], warna: '#1D4ED8' }); setNewSuffix('') }
  const openEdit = (c: KelasCardData) => { setModal({ open: true, mode: 'edit', editId: c.id, jenjang: c.jenjang, identitas: [...c.identitas], warna: c.warna }); setNewSuffix('') }
  const closeModal = () => { setModal(defaultModal()); setNewSuffix('') }

  const addIdentitas = () => {
    const val = newSuffix.trim().toUpperCase()
    if (!val || modal.identitas.includes(val)) return
    setModal(m => ({ ...m, identitas: [...m.identitas, val] }))
    setNewSuffix('')
    inputRef.current?.focus()
  }

  const removeIdentitas = (val: string) =>
    setModal(m => ({ ...m, identitas: m.identitas.filter(x => x !== val) }))

  const handleSubmitModal = () => {
    if (modal.identitas.length === 0) return
    if (modal.mode === 'add') {
      if (cards.some(c => c.jenjang === modal.jenjang)) return
      setCards(prev => [...prev, { id: `${Date.now()}`, jenjang: modal.jenjang, identitas: modal.identitas, warna: modal.warna }])
    } else if (modal.editId) {
      setCards(prev => prev.map(c => c.id === modal.editId ? { ...c, jenjang: modal.jenjang, identitas: modal.identitas, warna: modal.warna } : c))
    }
    closeModal()
  }

  const handleSimpan = async () => {
    setError('')
    if (cards.length === 0) { setError('Tambahkan minimal 1 jenjang kelas.'); return }
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const kelasFlat = cards.flatMap(c => c.identitas.map(id => ({ nama: `${c.jenjang}-${id}`, warna: c.warna })))
    const res = await fetch('/api/setup-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ step: 'kelas_tahun_ajaran', data: { tahun_ajaran: tahunAjaran, semester, kelas: kelasFlat } }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setError(json.error ?? 'Gagal menyimpan.'); setLoading(false); return }
    router.push('/dashboard')
  }

  const totalKelas = cards.reduce((s, c) => s + c.identitas.length, 0)

  if (dataLoading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  // ── VIEW MODE ─────────────────────────────────────────────────────────
  if (setupDone) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Kelas &amp; Tahun Ajaran</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
              <span style={sBadge}>{tahunAjaran}</span>
              <span style={sBadge}>Semester {semester}</span>
              <span style={{ ...sBadge, background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
                {totalKelas} kelas aktif
              </span>
            </div>
          </div>
          <button
            onClick={() => setSetupDone(false)}
            style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            <Pencil size={13} /> Edit
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {cards.map(c => (
            <KelasCard key={c.id} card={c} readonly />
          ))}
        </div>
      </div>
    )
  }

  // ── SETUP MODE ────────────────────────────────────────────────────────
  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Kelas &amp; Tahun Ajaran</h1>
          <p className="dashboard-subtitle">Setup kelas dan periode aktif sekolah</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>

        <div>
          {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <div style={sCard}>
            <div style={sCardTitle}>Periode Aktif</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={sLabel}>Tahun Ajaran</label>
                <select style={{ ...sInput, appearance: 'auto' }} value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)}>
                  {TAHUN_AJARAN_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={sLabel}>Semester</label>
                <select style={{ ...sInput, appearance: 'auto' }} value={semester} onChange={e => setSemester(e.target.value)}>
                  {SEMESTER_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={sCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={sCardTitle}>Daftar Kelas</div>
              <button onClick={openAdd} style={{ ...sBtnPrimary, padding: '0.45rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Plus size={14} /> Tambah Kelas
              </button>
            </div>

            {cards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Belum ada kelas. Klik <strong>Tambah Kelas</strong> untuk memulai.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {cards.map(c => (
                  <KelasCard key={c.id} card={c} onEdit={openEdit} onDelete={id => setCards(prev => prev.filter(x => x.id !== id))} />
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => router.push('/dashboard')} style={sBtnSecondary}>← Kembali</button>
            <button onClick={handleSimpan} disabled={loading} style={{ ...sBtnPrimary, flex: 1, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Menyimpan...' : 'Simpan & Lanjut →'}
            </button>
          </div>
        </div>

        <div style={{ position: 'sticky', top: '1.5rem' }}>
          <div style={sCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <GraduationCap size={16} color="var(--navy)" />
              <span style={sCardTitle}>Preview</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <span style={sBadge}>{tahunAjaran}</span>
              <span style={sBadge}>Semester {semester}</span>
            </div>

            {cards.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1.5rem 0' }}>
                Belum ada kelas ditambahkan
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {cards.map(c => (
                    <KelasCard key={c.id} card={c} readonly />
                  ))}
                </div>
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total kelas</span>
                  <strong style={{ color: 'var(--navy-dark)' }}>{totalKelas} kelas</strong>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={closeModal}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-serif,Georgia,serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '1.25rem' }}>
              {modal.mode === 'add' ? 'Tambah Kelas Baru' : 'Edit Kelas'}
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={sLabel}>Kelas</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {jenjangOptions.map(j => {
                  const sudahAda = modal.mode === 'add' && cards.some(c => c.jenjang === j)
                  return (
                    <button key={j} onClick={() => !sudahAda && setModal(m => ({ ...m, jenjang: j }))}
                      disabled={sudahAda}
                      style={{
                        flex: 1, padding: '0.6rem', borderRadius: 8, fontFamily: 'inherit',
                        fontWeight: 700, fontSize: '0.875rem', cursor: sudahAda ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s', opacity: sudahAda ? 0.4 : 1,
                        border: `2px solid ${modal.jenjang === j ? 'var(--navy)' : 'var(--border)'}`,
                        background: modal.jenjang === j ? 'var(--navy)' : '#fff',
                        color: modal.jenjang === j ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {j}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={sLabel}>Warna Kelas</label>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                {WARNA_OPTIONS.map(w => (
                  <button key={w} onClick={() => setModal(m => ({ ...m, warna: w }))}
                    style={{
                      width: 30, height: 30, borderRadius: 8, background: w, cursor: 'pointer',
                      border: modal.warna === w ? '3px solid #1E3A8A' : '2px solid transparent',
                      outline: modal.warna === w ? '2px solid #fff' : 'none', outlineOffset: -4,
                      boxShadow: `0 2px 6px ${w}55`,
                      transform: modal.warna === w ? 'scale(1.18)' : 'scale(1)', transition: 'transform 0.12s',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={sLabel}>Identitas Kelas</label>

              {modal.identitas.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  {modal.identitas.map(id => (
                    <span key={id} style={{
                      background: `${modal.warna}18`, color: modal.warna,
                      border: `1px solid ${modal.warna}44`, borderRadius: 6,
                      padding: '0.25rem 0.6rem', fontSize: '0.82rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                    }}>
                      {modal.jenjang}-{id}
                      <button onClick={() => removeIdentitas(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: modal.warna, padding: 0, lineHeight: 1, fontSize: '1rem' }}>×</button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)', whiteSpace: 'nowrap' }}>
                  {modal.jenjang} -
                </span>
                <input
                  ref={inputRef}
                  type="text" style={{ ...sInput, flex: 1 }}
                  placeholder="A, B, 1, 2 ..."
                  value={newSuffix} maxLength={4}
                  onChange={e => setNewSuffix(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addIdentitas()}
                />
                <button onClick={addIdentitas} disabled={!newSuffix.trim()}
                  style={{ ...sBtnPrimary, padding: '0.6rem 0.9rem', opacity: newSuffix.trim() ? 1 : 0.5, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={14} /> Tambah
                </button>
              </div>
              <p style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Tekan Enter atau klik Tambah untuk menambah identitas
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={closeModal} style={{ ...sBtnSecondary, flex: 1 }}>Batal</button>
              <button onClick={handleSubmitModal} disabled={modal.identitas.length === 0}
                style={{ ...sBtnPrimary, flex: 2, opacity: modal.identitas.length > 0 ? 1 : 0.5 }}>
                {modal.mode === 'add' ? `Tambah Kelas (${modal.identitas.length})` : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sLabel: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 4 }
const sInput: React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', outline: 'none', background: '#fff' }
const sCard: React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sCardTitle: React.CSSProperties = { fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.9rem', marginBottom: '1rem' }
const sBadge: React.CSSProperties = { background: '#F1F5F9', color: 'var(--navy-dark)', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem', borderRadius: 20, border: '1px solid var(--border)' }
const sBtnPrimary: React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
