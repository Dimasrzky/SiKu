'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, GraduationCap, Pencil, ChevronDown } from 'lucide-react'
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

const STEP_ORDER      = ['profil_sekolah', 'tahun_ajaran', 'komponen_tagihan', 'buat_kelas', 'import_siswa']
const THIS_STEP_INDEX = 3

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KelasPage() {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [tahunAjaran,    setTahunAjaran]    = useState('')
  const [semester,       setSemester]       = useState('')
  const [cards,          setCards]          = useState<KelasCardData[]>([])
  const [modal,          setModal]          = useState<ModalState>(defaultModal())
  const [newSuffix,      setNewSuffix]      = useState('')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [jenjangOptions, setJenjangOptions] = useState<string[]>(JENJANG_MAP['SMP'])
  const [setupDone,      setSetupDone]      = useState(false)
  const [dataLoading,    setDataLoading]    = useState(true)
  const [rawRows,        setRawRows]        = useState<KelasRow[]>([])
  const [expandedGroup,  setExpandedGroup]  = useState<string | null>(null)
  const [setupSteps,     setSetupSteps]     = useState<Record<string, boolean>>({})

  useEffect(() => {
    Promise.all([
      supabase.from('pengaturan').select('jenjang_sekolah, setup_steps').maybeSingle(),
      supabase.from('kelas').select('id, nama, jenjang, warna, tahun_ajaran, semester').order('jenjang'),
      supabase.from('tahun_ajaran')
        .select('nama, semester_ganjil_mulai, semester_ganjil_selesai')
        .eq('is_aktif', true)
        .maybeSingle(),
    ]).then(([{ data: pData }, { data: kData }, { data: taData }]) => {
      const peng = pData as { jenjang_sekolah?: string; setup_steps?: Record<string, unknown> } | null

      if (!peng?.setup_steps?.['komponen_tagihan']) {
        router.replace('/tagihan/komponen')
        return
      }

      const steps = (peng?.setup_steps ?? {}) as Record<string, boolean>
      setSetupSteps(steps)

      const opts = JENJANG_MAP[peng?.jenjang_sekolah ?? 'SMP'] ?? JENJANG_MAP['SMP']
      setJenjangOptions(opts)
      setModal(defaultModal(opts[0]))

      if (steps['buat_kelas'] === true) {
        setSetupDone(true)
      }

      const rows = (kData ?? []) as KelasRow[]
      if (rows.length > 0) {
        setTahunAjaran(rows[0].tahun_ajaran)
        setSemester(rows[0].semester)
        setCards(buildCards(rows))
        setRawRows(rows)
      } else if (taData) {
        type TaRow = { nama: string; semester_ganjil_mulai: string; semester_ganjil_selesai: string }
        const ta = taData as TaRow
        const today    = new Date()
        const gMulai   = new Date(ta.semester_ganjil_mulai)
        const gSelesai = new Date(ta.semester_ganjil_selesai)
        setTahunAjaran(ta.nama)
        setSemester(today >= gMulai && today <= gSelesai ? 'Ganjil' : 'Genap')
      }

      setDataLoading(false)
    })
  }, [router])

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

  const handleSimpan = async () => {
    setError('')
    if (cards.length === 0) { setError('Tambahkan minimal 1 kelas.'); return }
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const kelasFlat = cards.flatMap(c => c.identitas.map(id => ({ nama: `${c.jenjang}-${id}`, warna: c.warna })))
    const res = await fetch('/api/setup-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ step: 'buat_kelas', data: { tahun_ajaran: tahunAjaran, semester, kelas: kelasFlat } }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setError(json.error ?? 'Gagal menyimpan.'); setLoading(false); return }
    router.push('/dashboard')
  }

  const totalKelas = cards.reduce((s, c) => s + c.identitas.length, 0)

  // ── Loading ───────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  // ── VIEW MODE ─────────────────────────────────────────────────────────────

  if (setupDone) {
    const groups: { jenjang: string; warna: string; items: { id: string; identitas: string }[] }[] = []
    const groupMap = new Map<string, typeof groups[0]>()
    for (const row of rawRows) {
      const dashIdx   = row.nama.indexOf('-')
      const identitas = dashIdx >= 0 ? row.nama.slice(dashIdx + 1) : row.nama
      if (!groupMap.has(row.jenjang)) {
        const g = { jenjang: row.jenjang, warna: row.warna, items: [] as { id: string; identitas: string }[] }
        groupMap.set(row.jenjang, g)
        groups.push(g)
      }
      groupMap.get(row.jenjang)!.items.push({ id: row.id, identitas })
    }

    const toggleGroup = (jenjang: string) =>
      setExpandedGroup(prev => prev === jenjang ? null : jenjang)

    const NUM_COLS = 3
    const columns: typeof groups[0][][] = Array.from({ length: NUM_COLS }, () => [])
    groups.forEach((g, i) => columns[i % NUM_COLS].push(g))

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
            onClick={() => router.push('/siswa/manajemen-kelas/edit')}
            style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            <Pencil size={13} /> Edit
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${NUM_COLS}, 1fr)`, gap: '0.75rem', alignItems: 'start' }}>
          {columns.map((col, colIdx) => (
            <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {col.map(group => {
                const isExpanded = expandedGroup === group.jenjang
                return (
                  <div key={group.jenjang} style={{ background: group.warna, borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                    <button
                      onClick={() => toggleGroup(group.jenjang)}
                      style={{
                        width: '100%', aspectRatio: '2 / 1',
                        display: 'flex', flexDirection: 'column',
                        justifyContent: 'space-between', padding: '1.1rem 1.25rem',
                        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#fff', lineHeight: 1.2 }}>Kelas {group.jenjang}</div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: 3, fontWeight: 500 }}>{group.items.length} kelas</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <ChevronDown
                          size={18}
                          color="rgba(255,255,255,0.85)"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                        />
                      </div>
                    </button>

                    <div style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '0 0.875rem 0.875rem' }}>
                          <div style={{ height: 1, background: 'rgba(255,255,255,0.25)', marginBottom: '0.65rem' }} />
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                            {group.items.map(({ id, identitas }) => (
                              <button
                                key={id}
                                onClick={() => router.push(`/siswa/manajemen-kelas/${id}`)}
                                style={{
                                  background: 'rgba(255,255,255,0.18)', color: '#fff',
                                  border: '1px solid rgba(255,255,255,0.3)',
                                  borderRadius: 8, padding: '0.45rem 0.25rem',
                                  fontWeight: 700, fontSize: '0.82rem',
                                  cursor: 'pointer', fontFamily: 'inherit',
                                  textAlign: 'center', transition: 'background 0.15s',
                                }}
                              >
                                {group.jenjang}-{identitas}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── SETUP MODE ────────────────────────────────────────────────────────────

  const completedBefore = STEP_ORDER.slice(0, THIS_STEP_INDEX).filter(k => setupSteps[k]).length
  const greenCount      = completedBefore + 1

  return (
    <>
    <style>{`
      @keyframes dot-blink {
        0%, 100% { background-color: #69C183; }
        50%       { background-color: #CBD5E1; }
      }
      .dot-active { animation: dot-blink 1.8s ease-in-out infinite; }
    `}</style>
    <div className="dashboard-content">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)' }}>
            <GraduationCap size={30} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>
              Buat kelas
            </h1>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>Langkah 4 dari 5</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
          {STEP_ORDER.map((_, i) => {
            const isActive = i === greenCount - 1
            return (
              <div key={i} className={isActive ? 'dot-active' : undefined}
                style={{ width: 16, height: 16, borderRadius: '50%', position: 'relative', bottom: 10, right: 6, background: i < greenCount ? '#69C183' : '#CBD5E1', transition: 'background 0.2s', boxShadow: '3px 6px 14px rgba(26, 44, 78, 0.58)' }}
              />
            )
          })}
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: '#1A2C4E', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1rem', color: '#fff', boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)' }}>
        <p style={{ flex: 1, fontSize: '1.25rem', lineHeight: 1.65, margin: 0 }}>
          Buat daftar kelas yang ada di sekolah. Setiap kelas memiliki jenjang, identitas (A, B, 1, 2...), dan warna untuk memudahkan pengelolaan tagihan per kelas.
        </p>
        <div style={{ flexShrink: 0, marginLeft: 'auto', width: 40, height: 40, background: '#F7DD7D', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', top: '-0.4rem', right: '-0.65rem' }}>
          <Image src="/icons/IconTSeru.png" width={3.5} height={3.5} alt="Info" style={{ display: 'block' }} />
        </div>
      </div>

      {/* Form Card */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderLeft: '30px solid var(--navy)', borderRadius: 12, padding: '1.5rem 1.75rem', boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)' }}>

        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '0.65rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#DC2626' }}>
            {error}
          </div>
        )}

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
            {(() => {
              const semuaTerisi = jenjangOptions.every(j => cards.some(c => c.jenjang === j))
              return (
                <button
                  onClick={openAdd}
                  disabled={semuaTerisi}
                  style={{
                    ...sBtnPrimary, padding: '0.45rem 0.9rem', fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', gap: 5,
                    ...(semuaTerisi ? { background: '#9CA3AF', borderColor: '#9CA3AF', cursor: 'not-allowed', opacity: 0.7 } : {}),
                  }}
                >
                  <Plus size={14} /> Tambah Kelas
                </button>
              )
            })()}
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

        {/* Simpan */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
            <span style={{ fontWeight: 700 }}>ⓘ</span>{' '}
            Data kelas akan disimpan untuk <strong>{tahunAjaran || 'tahun ajaran aktif'}</strong>.
          </p>
          <button onClick={handleSimpan} disabled={loading}
            style={{ flexShrink: 0, background: loading ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.7rem 1.5rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'background 0.15s', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)' }}>
            {loading ? 'Menyimpan...' : 'Simpan & Lanjutkan →'}
          </button>
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {jenjangOptions.filter(j => !cards.some(c => c.jenjang === j)).map(j => (
                  <button key={j} onClick={() => setModal(m => ({ ...m, jenjang: j }))}
                    style={{
                      flex: 1, padding: '0.6rem', borderRadius: 8, fontFamily: 'inherit',
                      fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                      transition: 'all 0.15s',
                      border: `2px solid ${modal.jenjang === j ? 'var(--navy)' : 'var(--border)'}`,
                      background: modal.jenjang === j ? 'var(--navy)' : '#fff',
                      color: modal.jenjang === j ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Warna Kelas — hybrid picker */}
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

          {/* Identitas Kelas */}
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

const sLabel:      React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 4 }
const sInput:      React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', outline: 'none', background: '#fff' }
const sBadge:      React.CSSProperties = { background: '#F1F5F9', color: 'var(--navy-dark)', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem', borderRadius: 20, border: '1px solid var(--border)' }
const sBtnPrimary:   React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sViewItem:  React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.875rem' }
const sViewLabel: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const sViewValue: React.CSSProperties = { fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-dark)' }
