'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { KelasCard, type KelasCardData } from '@/components/KelasCard'

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface KelasRow {
  id:           string
  nama:         string
  jenjang:      string
  warna:        string
  tahun_ajaran: string
  semester:     string
}

interface ModalState {
  open:     boolean
  mode:     'add' | 'edit'
  editId?:  string
  jenjang:  string
  identitas: string[]
  warna:    string
}

const defaultModal = (firstJenjang = 'VII'): ModalState => ({
  open: false, mode: 'add', jenjang: firstJenjang, identitas: [], warna: '#1D4ED8',
})

function buildCards(rows: KelasRow[]): KelasCardData[] {
  const grouped = new Map<string, { warna: string; identitas: string[] }>()
  for (const row of rows) {
    const dashIdx   = row.nama.indexOf('-')
    const identitas = dashIdx >= 0 ? row.nama.slice(dashIdx + 1) : row.nama
    if (!grouped.has(row.jenjang)) grouped.set(row.jenjang, { warna: row.warna, identitas: [] })
    grouped.get(row.jenjang)!.identitas.push(identitas)
  }
  return Array.from(grouped.entries()).map(([jenjang, { warna, identitas }]) => ({
    id: `grp-${jenjang}`, jenjang, identitas, warna,
  }))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditKelasSetupPage() {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [tahunAjaran,   setTahunAjaran]   = useState('')
  const [semester,      setSemester]      = useState('')
  const [cards,         setCards]         = useState<KelasCardData[]>([])
  const [modal,         setModal]         = useState<ModalState>(defaultModal())
  const [newSuffix,     setNewSuffix]     = useState('')
  const [jenjangOptions, setJenjangOptions] = useState<string[]>(JENJANG_MAP['SMP'])

  useEffect(() => {
    ;(async () => {
      const [{ data: pData }, { data: kData }] = await Promise.all([
        supabase.from('pengaturan').select('jenjang_sekolah').maybeSingle(),
        supabase.from('kelas').select('id, nama, jenjang, warna, tahun_ajaran, semester').order('jenjang'),
      ])

      const peng = pData as { jenjang_sekolah?: string } | null
      const opts = JENJANG_MAP[peng?.jenjang_sekolah ?? 'SMP'] ?? JENJANG_MAP['SMP']
      setJenjangOptions(opts)
      setModal(defaultModal(opts[0]))

      const rows = (kData ?? []) as KelasRow[]
      if (rows.length > 0) {
        setTahunAjaran(rows[0].tahun_ajaran)
        setSemester(rows[0].semester)
        setCards(buildCards(rows))
      }

      setLoading(false)
    })()
  }, [])

  // ── Modal helpers ─────────────────────────────────────────────────────────

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

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSimpan = async () => {
    setError('')
    if (cards.length === 0) { setError('Tambahkan minimal 1 kelas.'); return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const kelasFlat = cards.flatMap(c => c.identitas.map(id => ({ nama: `${c.jenjang}-${id}`, warna: c.warna })))
    const res = await fetch('/api/setup-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ step: 'buat_kelas', data: { tahun_ajaran: tahunAjaran, semester, kelas: kelasFlat } }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setError(json.error ?? 'Gagal menyimpan.'); setSaving(false); return }
    router.push('/siswa/manajemen-kelas')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="dashboard-content">

      {/* Header */}
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => router.push('/siswa/manajemen-kelas')}
            style={{ background: 'none', border: '1.5px solid #1A2C4E', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--navy)', flexShrink: 0, padding: 0 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="dashboard-title">Edit Kelas</h1>
            <p className="dashboard-subtitle">{tahunAjaran} · Semester {semester}</p>
          </div>
        </div>
        <button onClick={handleSimpan} disabled={saving}
          style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1.25rem', opacity: saving ? 0.6 : 1 }}>
          <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#DC2626' }}>
          {error}
        </div>
      )}

      {/* Form Card */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem 1.75rem' }}>

        {/* Periode Aktif — text only */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Periode Aktif</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={sViewItem}>
              <span style={sViewLabel}>Tahun Ajaran</span>
              <span style={sViewValue}>{tahunAjaran || '—'}</span>
            </div>
            <div style={sViewItem}>
              <span style={sViewLabel}>Semester</span>
              <span style={sViewValue}>Semester {semester || '—'}</span>
            </div>
          </div>
        </div>

        {/* Daftar Kelas */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.9rem' }}>Daftar Kelas</div>
            {!jenjangOptions.every(j => cards.some(c => c.jenjang === j)) && (
              <button onClick={openAdd} style={{ ...sBtnPrimary, padding: '0.45rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Plus size={14} /> Tambah Kelas
              </button>
            )}
          </div>

          {cards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Belum ada kelas. Klik <strong>Tambah Kelas</strong> untuk memulai.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {cards.map(c => (
                <KelasCard key={c.id} card={c} onEdit={openEdit} onDelete={id => setCards(prev => prev.filter(x => x.id !== id))} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>

    {/* Modal tambah / edit kelas */}
    {modal.open && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={closeModal}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontFamily: 'var(--font-serif,Georgia,serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '1.25rem' }}>
            {modal.mode === 'add' ? 'Tambah Kelas Baru' : 'Edit Kelas'}
          </h3>

          {modal.mode === 'add' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={sLabel}>Kelas</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {jenjangOptions.map(j => {
                  const sudahAda = cards.some(c => c.jenjang === j)
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
          )}

          {/* Warna kelas — hybrid picker */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={sLabel}>Warna Kelas</label>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
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

              {/* Rainbow custom picker */}
              <label title="Pilih warna kustom" style={{ position: 'relative', width: 30, height: 30, cursor: 'pointer' }}>
                <input type="color" value={modal.warna} onChange={e => setModal(m => ({ ...m, warna: e.target.value }))}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%' }} />
                <div style={{
                  width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: !WARNA_OPTIONS.includes(modal.warna)
                    ? modal.warna
                    : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                  transform: !WARNA_OPTIONS.includes(modal.warna) ? 'scale(1.18)' : 'scale(1)',
                  boxShadow: !WARNA_OPTIONS.includes(modal.warna) ? `0 0 0 2px #fff, 0 0 0 4px ${modal.warna}` : 'none',
                  transition: 'transform 0.12s',
                }}>
                  {WARNA_OPTIONS.includes(modal.warna) && (
                    <span style={{ fontSize: '0.65rem', color: '#fff', lineHeight: 1 }}>✦</span>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Identitas kelas */}
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
    </>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sLabel:        React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 4 }
const sInput:        React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', outline: 'none', background: '#fff' }
const sBtnPrimary:   React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sViewItem:     React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.875rem' }
const sViewLabel:    React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const sViewValue:    React.CSSProperties = { fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-dark)' }
