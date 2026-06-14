'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Pencil, CheckCircle2, XCircle, ChevronDown, Trash2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const WARNA_OPTIONS = [
  '#944949', '#2F1F1F', '#2B7B2B', '#5E3333',
  '#401568', '#704E4E', '#AF9191'
]

const JENJANG_MAP: Record<string, string[]> = {
  TK:  ['A', 'B', 'C'],
  SD:  ['1', '2', '3', '4', '5', '6'],
  SMP: ['7', '8', '9'],
  SMA: ['10', '11', '12'],
  SMK: ['10', '11', '12'],
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
  wali_kelas?:  string | null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KelasPage() {
  const router = useRouter()

  // Core state
  const [tahunAjaran,    setTahunAjaran]    = useState('')
  const [semester,       setSemester]       = useState('')
  const [rawRows,        setRawRows]        = useState<KelasRow[]>([])
  const [siswaCounts,    setSiswaCounts]    = useState<Record<string, number>>({})
  const [setupDone,      setSetupDone]      = useState(false)
  const [dataLoading,    setDataLoading]    = useState(true)
  const [setupSteps,     setSetupSteps]     = useState<Record<string, boolean>>({})
  const [jenjangOptions, setJenjangOptions] = useState<string[]>(JENJANG_MAP['SMP'])

  // View mode state
  const [filterJenjang,  setFilterJenjang]  = useState('')
  const [searchQuery,    setSearchQuery]    = useState('')
  const [deleteTarget,   setDeleteTarget]   = useState<KelasRow | null>(null)
  const [deleteLoading,  setDeleteLoading]  = useState(false)

  // Setup form state
  const [showForm,          setShowForm]          = useState(false)
  const [formClosing,       setFormClosing]       = useState(false)
  const [formJenjang,       setFormJenjang]       = useState('')
  const [formIdentitasList, setFormIdentitasList] = useState<string[]>([''])
  const [formWarna,         setFormWarna]         = useState(WARNA_OPTIONS[0])

  // UI state
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState('')
  const [apiError,         setApiError]         = useState('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [showErrorPopup,   setShowErrorPopup]   = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: pData }, kResult, { data: taData }, { data: siswaData }] = await Promise.all([
        supabase.from('pengaturan').select('jenjang_sekolah, setup_steps').maybeSingle(),
        supabase.from('kelas').select('id, nama, jenjang, warna, tahun_ajaran, semester, wali_kelas').order('jenjang'),
        supabase.from('tahun_ajaran').select('nama, semester_ganjil_mulai, semester_ganjil_selesai').eq('is_aktif', true).maybeSingle(),
        supabase.from('siswa').select('kelas_id').limit(2000),
      ])

      const peng = pData as { jenjang_sekolah?: string; setup_steps?: Record<string, unknown> } | null

      if (!peng?.setup_steps?.['komponen_tagihan']) {
        router.replace('/tagihan/komponen')
        return
      }

      const steps = (peng?.setup_steps ?? {}) as Record<string, boolean>
      setSetupSteps(steps)

      const opts = JENJANG_MAP[peng?.jenjang_sekolah ?? 'SMP'] ?? JENJANG_MAP['SMP']
      setJenjangOptions(opts)

      if (steps['buat_kelas'] === true) setSetupDone(true)

      // Kelas rows — fallback jika kolom wali_kelas belum ada
      let kRows: KelasRow[]
      if (!kResult.error && kResult.data) {
        kRows = kResult.data as KelasRow[]
      } else {
        const { data: kBase } = await supabase.from('kelas').select('id, nama, jenjang, warna, tahun_ajaran, semester').order('jenjang')
        kRows = (kBase ?? []) as KelasRow[]
      }

      if (kRows.length > 0) {
        setTahunAjaran(kRows[0].tahun_ajaran)
        setSemester(kRows[0].semester)
        setRawRows(kRows)
      } else if (taData) {
        type TaRow = { nama: string; semester_ganjil_mulai: string; semester_ganjil_selesai: string }
        const ta = taData as TaRow
        const today    = new Date()
        const gMulai   = new Date(ta.semester_ganjil_mulai)
        const gSelesai = new Date(ta.semester_ganjil_selesai)
        setTahunAjaran(ta.nama)
        setSemester(today >= gMulai && today <= gSelesai ? 'Ganjil' : 'Genap')
      }

      // Hitung jumlah siswa per kelas
      if (siswaData) {
        const counts: Record<string, number> = {}
        for (const s of siswaData as { kelas_id: string | null }[]) {
          if (s.kelas_id) counts[s.kelas_id] = (counts[s.kelas_id] ?? 0) + 1
        }
        setSiswaCounts(counts)
      }

      setDataLoading(false)
    }

    load().catch(() => setDataLoading(false))
  }, [router])

  useEffect(() => {
    if (!showSuccessPopup) return
    const nav = setTimeout(() => router.push('/siswa/daftar-siswa'), 5000)
    return () => clearTimeout(nav)
  }, [showSuccessPopup, router])

  useEffect(() => {
    if (!showErrorPopup) return
    const close = setTimeout(() => setShowErrorPopup(false), 5000)
    return () => clearTimeout(close)
  }, [showErrorPopup])

  // ── Form helpers ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setShowForm(false)
    setFormClosing(false)
    setFormJenjang('')
    setFormIdentitasList([''])
    setFormWarna(WARNA_OPTIONS[0])
    setError('')
  }

  const addIdentitas    = () => setFormIdentitasList(prev => [...prev, ''])
  const removeIdentitas = (i: number) => setFormIdentitasList(prev => prev.filter((_, idx) => idx !== i))
  const updateIdentitas = (i: number, val: string) => setFormIdentitasList(prev => prev.map((v, idx) => idx === i ? val : v))

  const handleDeleteKelas = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const { error } = await supabase.from('kelas').delete().eq('id', deleteTarget.id)
    if (error) { setApiError(error.message); setShowErrorPopup(true); setDeleteLoading(false); return }
    setRawRows(prev => prev.filter(r => r.id !== deleteTarget.id))
    setSiswaCounts(prev => { const n = { ...prev }; delete n[deleteTarget.id]; return n })
    setDeleteTarget(null)
    setDeleteLoading(false)
  }

  const startCloseForm = () => {
    setFormClosing(true)
    setTimeout(resetForm, 400)
  }

  const handleSimpanForm = async () => {
    setError('')
    if (!formJenjang) { setError('Tingkat kelas harus dipilih.'); return }
    const validIdentitas = formIdentitasList.filter(i => i.trim())
    if (validIdentitas.length === 0) { setError('Identitas kelas harus diisi.'); return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/setup-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        step: 'buat_kelas',
        data: {
          tahun_ajaran: tahunAjaran,
          semester,
          kelas: validIdentitas.map(id => ({
            nama:  `${formJenjang}-${id.trim().toUpperCase()}`,
            warna: formWarna,
          })),
        },
      }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setApiError(json.error ?? 'Gagal menyimpan.'); setShowErrorPopup(true); setSaving(false); return }
    setSaving(false)
    setShowSuccessPopup(true)
  }

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
    const filteredRows = rawRows.filter(r => {
      const matchJenjang = !filterJenjang || r.jenjang === filterJenjang
      const matchSearch  = !searchQuery  || r.nama.toLowerCase().includes(searchQuery.toLowerCase())
      return matchJenjang && matchSearch
    })

    const groups: { jenjang: string; warna: string; items: KelasRow[] }[] = []
    const groupMap = new Map<string, typeof groups[0]>()
    for (const row of filteredRows) {
      if (!groupMap.has(row.jenjang)) {
        const g = { jenjang: row.jenjang, warna: row.warna, items: [] as KelasRow[] }
        groupMap.set(row.jenjang, g)
        groups.push(g)
      }
      groupMap.get(row.jenjang)!.items.push(row)
    }

    const uniqueJenjang = [...new Set(rawRows.map(r => r.jenjang))]
    const totalSiswa    = Object.values(siswaCounts).reduce((a, b) => a + b, 0)
    const sudahWali     = rawRows.filter(r => r.wali_kelas).length
    const belumWali     = rawRows.filter(r => !r.wali_kelas).length

    const statCards = [
      { label: 'Total kelas',            value: rawRows.length, highlight: undefined       },
      { label: 'Total siswa',            value: totalSiswa,     highlight: undefined       },
      { label: 'Sudah ada wali kelas',   value: sudahWali,      highlight: '#22C55E'       },
      { label: 'Belum ada wali kelas',   value: belumWali,      highlight: '#F59E0B'       },
    ]

    return (
      <div className="dashboard-content">
        <style>{`
          @keyframes modalBackdrop { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalCard { from { opacity: 0; transform: scale(0.88) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          @keyframes popupBar { from { width: 100%; } to { width: 0%; } }
        `}</style>

        {/* Header */}
        <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 className="dashboard-title">Manajemen Kelas</h1>
            <p className="dashboard-subtitle">{tahunAjaran} · Semester {semester}</p>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {statCards.map(({ label, value, highlight }) => (
            <div key={label} style={{ background: '#1A2C4E', borderRadius: 14, padding: '1.1rem 1.25rem', boxShadow: '6px 6px 8px rgba(18,47,102,0.22)' }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 0.4rem' }}>{label}</p>
              <p style={{ color: highlight ?? '#fff', fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filter + Action bar */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} color="#6F788A" style={{ position: 'absolute', left: '0.85rem', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Cari kelas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ ...sInput, paddingLeft: '2.5rem', width: 200 }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <select
              value={filterJenjang}
              onChange={e => setFilterJenjang(e.target.value)}
              style={{ ...sInput, appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem', width: 200 }}
            >
              <option value="">Semua tingkat</option>
              {uniqueJenjang.map(j => <option key={j} value={j}>Kelas {j}</option>)}
            </select>
            <ChevronDown size={16} color="#6F788A" style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          <button
            onClick={() => router.push('/siswa/manajemen-kelas/tambah')}
            style={{ marginLeft: 'auto', background: '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 5px 2px rgba(18,47,102,0.25)', whiteSpace: 'nowrap' }}
          >
            + Tambah Kelas
          </button>
        </div>

        {/* List card */}
        <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18,47,102,0.18)' }}>
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <Image src="/icons/IconNotSave.png" width={80} height={80} alt="Tidak Ada Kelas" style={{ margin: '0 auto 0.875rem', display: 'block' }} />
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#6F788A', margin: '0 0 0.25rem' }}>Tidak ada kelas ditemukan</p>
              <p style={{ fontSize: '0.875rem', color: '#6F788A', margin: 0 }}>Coba ubah filter atau tambah kelas baru</p>
            </div>
          ) : groups.map((group, gIdx) => (
            <div key={group.jenjang} style={{ marginBottom: gIdx < groups.length - 1 ? '1rem' : 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.35rem 0 0.6rem', borderBottom: '1.5px solid #F1F5F9', marginBottom: '0.15rem' }}>
                Kelas {group.jenjang}
              </div>
              {group.items.map((kelas, iIdx) => {
                const dashIdx    = kelas.nama.indexOf('-')
                const identitas  = dashIdx >= 0 ? kelas.nama.slice(dashIdx + 1) : kelas.nama
                const inisial    = identitas.slice(0, 2).toUpperCase()
                const hasWali    = !!kelas.wali_kelas
                const siswaCount = siswaCounts[kelas.id] ?? 0
                const isLast     = iIdx === group.items.length - 1
                return (
                  <div key={kelas.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderBottom: isLast ? 'none' : '1px solid #F8FAFC' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: kelas.warna, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.82rem', letterSpacing: '0.01em' }}>{inisial}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>Kelas {kelas.nama}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: hasWali ? '#DCFCE7' : '#FEF3C7', color: hasWali ? '#15803D' : '#92400E', flexShrink: 0 }}>
                          {hasWali ? '✓ Lengkap' : '⚠ Belum ada wali kelas'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        Wali kelas: {kelas.wali_kelas || '—'} · {siswaCount} siswa
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        onClick={() => router.push(`/siswa/manajemen-kelas/${kelas.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.875rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.82rem', color: 'var(--navy-dark)', boxShadow: '2px 2px 4px rgba(18,47,102,0.08)' }}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(kelas)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', boxShadow: '2px 2px 4px rgba(18,47,102,0.08)', flexShrink: 0 }}
                      >
                        <Trash2 size={14} color="#EF4444" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Delete modal */}
        {deleteTarget && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.18s ease' }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, padding: '2rem 1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <Trash2 size={24} color="#DC2626" />
              </div>
              <h3 style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.5rem' }}>Hapus Kelas?</h3>
              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                Kelas <strong>{deleteTarget.nama}</strong> akan dihapus permanen. Data siswa terkait tidak ikut terhapus.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading} style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: 'var(--navy-dark)' }}>
                  Batal
                </button>
                <button onClick={handleDeleteKelas} disabled={deleteLoading} style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: deleteLoading ? 'not-allowed' : 'pointer' }}>
                  {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error popup */}
        {showErrorPopup && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.18s ease' }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div style={{ padding: '2rem 1.75rem 1.5rem', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <XCircle size={32} color="#DC2626" />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.5rem' }}>Gagal</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>{apiError}</p>
                <button onClick={() => setShowErrorPopup(false)} style={{ ...sBtnSecondary, width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}>Tutup</button>
              </div>
              <div style={{ height: 4, background: '#E5E7EB' }}>
                <div style={{ height: '100%', background: '#DC2626', animation: 'popupBar 5s linear forwards' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── SETUP MODE ────────────────────────────────────────────────────────────

  const completedBefore = STEP_ORDER.slice(0, THIS_STEP_INDEX).filter(k => setupSteps[k]).length
  const greenCount      = completedBefore + 1
  const FORM_WARNA      = WARNA_OPTIONS.slice(0, 7)
  const isCustomWarna   = !FORM_WARNA.includes(formWarna)

  return (
    <>
    <style>{`
      @keyframes dot-blink {
        0%, 100% { background-color: #69C183; }
        50%       { background-color: #CBD5E1; }
      }
      .dot-active { animation: dot-blink 1.8s ease-in-out infinite; }
      @keyframes popupBackdrop { from { opacity: 0; } to { opacity: 1; } }
      @keyframes popupCard { from { opacity: 0; transform: scale(0.88) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      @keyframes popupBar { from { width: 100%; } to { width: 0%; } }
      @keyframes formSlideDown { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      @keyframes formSlideUp   { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.92); } }
    `}</style>
    <div className="dashboard-content">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)' }}>
            <Image src="/icons/IconGroup.png" width={35} height={35} alt="Kelas" style={{ display: 'block' }} />
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: '#1A2C4E', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', color: '#fff', boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)' }}>
        <p style={{ flex: 1, fontSize: '1.1rem', lineHeight: 1.65, margin: 0 }}>
          Buat daftar kelas yang ada di sekolah. Setiap kelas memiliki tingkat, identitas (A, B, 1, 2...), dan warna untuk memudahkan pengelolaan tagihan per kelas.
        </p>
        <div style={{ flexShrink: 0, marginLeft: 'auto', width: 40, height: 40, background: '#F7DD7D', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', top: '-0.4rem', right: '-0.65rem' }}>
          <Image src="/icons/IconTSeru.png" width={3.5} height={3.5} alt="Info" style={{ display: 'block' }} />
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Form card — grid-template-rows transition */}
      <div style={{ display: 'grid', gridTemplateRows: showForm && !formClosing ? '1fr' : '0fr', transition: 'grid-template-rows 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
      <div style={{ overflow: 'hidden', paddingBottom: showForm && !formClosing ? '1.1rem' : 0, paddingRight: '1.5rem', marginRight: '-1.5rem' }}>
      {showForm && (
        <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)', animation: formClosing ? 'formSlideUp 0.26s cubic-bezier(0.22,1,0.36,1) forwards' : 'formSlideDown 0.3s cubic-bezier(0.22,1,0.36,1)' }}>

          {/* Baris 1: Tingkat kelas — toggle single-select */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={sLabel}>Tingkat kelas</label>
            <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Pilih satu tingkat untuk kelas yang akan dibuat
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {jenjangOptions.map(j => {
                const selected = formJenjang === j
                return (
                  <button
                    key={j}
                    onClick={() => setFormJenjang(prev => prev === j ? '' : j)}
                    style={{
                      padding: '0.55rem 1.1rem', borderRadius: 10, fontFamily: 'inherit',
                      fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s',
                      border: selected ? '3px solid #1A2C4E' : '3px solid #BABFC7',
                      background: selected ? '#A3CDFE' : '#fff',
                      color: selected ? '#1A2C4E' : 'var(--text-mid)',
                      boxShadow: selected ? '0 4px 12px rgba(26,44,78,0.3)' : '6px 6px 8px rgba(18,47,102,0.10)',
                    }}
                  >
                    Kelas {j}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ height: 2, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

          {/* Baris 2: Identitas kelas — dynamic list */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={sLabel}>Identitas kelas</label>
            <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Akan digabung dengan tingkat. Contoh: {formJenjang || '7'} + A → &ldquo;{formJenjang || '7'}-A&rdquo;
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {formIdentitasList.map((val, i) => {
                const isLast = i === formIdentitasList.length - 1
                return (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', width: '60%' }}>
                    <input
                      type="text"
                      placeholder="Contoh: A, 1, Unggulan, MIPA"
                      value={val}
                      onChange={e => updateIdentitas(i, e.target.value)}
                      style={{ ...sInput, flex: 1 }}
                      autoFocus={i === 0}
                    />
                    {isLast ? (
                      <button
                        onClick={addIdentitas}
                        style={{ flexShrink: 0, marginLeft: '0.5rem', padding: '0 1rem', borderRadius: 10, background: '#1A2C4E', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', color: '#ffffff', whiteSpace: 'nowrap', boxShadow: '6px 6px 8px rgba(18,47,102,0.10)' }}
                      >
                        + Tambah
                      </button>
                    ) : (
                      <button
                        onClick={() => removeIdentitas(i)}
                        style={{ flexShrink: 0, marginLeft: '3.2rem', padding: '0 0.9rem', border: '2.5px solid #c7504e', borderRadius: 10, background: '#dab1b1', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '1.8rem', color: '#000000', lineHeight: 1, boxShadow: '6px 6px 8px rgba(18,47,102,0.10)' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ height: 2, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

          {/* Pilih warna kelas */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>
              Pilih warna kelas
            </div>
            <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
              Berlaku untuk semua kelas baru di batch ini
            </div>
            <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', background: '#FFFFFF', border: '3px solid #BABFC7', borderRadius: 13, padding: '0.5rem 0.75rem', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
              {FORM_WARNA.map(w => (
                <button key={w} onClick={() => setFormWarna(w)}
                  style={{
                    width: 30, height: 30, borderRadius: 8, background: w,
                    border: 'none', cursor: 'pointer', flexShrink: 0,
                    boxShadow: formWarna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none',
                    transition: 'all 0.15s',
                  }}
                />
              ))}
              <label title="Pilih warna kustom" style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, cursor: 'pointer' }}>
                <input
                  type="color"
                  value={formWarna}
                  onChange={e => setFormWarna(e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }}
                />
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: isCustomWarna ? formWarna : 'transparent',
                  boxShadow: isCustomWarna ? `0 0 0 2px #fff, 0 0 0 4px ${formWarna}` : 'none',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!isCustomWarna && <Image src="/icons/IconPipet.png" width={18} height={18} alt="Pipet" />}
                </div>
              </label>
            </div>
          </div>

          <div style={{ height: 2, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

          {/* Review tampilan */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>
              Review tampilan
            </div>
            <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
              Kelas yang akan dibuat dalam batch ini
            </div>

            {(() => {
              const validIds = formIdentitasList.filter(i => i.trim())
              const hasData  = formJenjang && validIds.length > 0
              if (!hasData) {
                return (
                  <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1.1rem 1.4rem', background: '#F8FAFC' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#64748B', marginBottom: '0.25rem' }}>Kelas yang akan dibuat</div>
                    <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>Pilih tingkat &amp; tambahkan identitas kelas</div>
                  </div>
                )
              }
              return (
                <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.25rem', background: '#F8FAFC', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)', }}>
                  {validIds.map((id, i) => (
                    <div key={i} style={{ background: formWarna, color: '#fff', fontWeight: 800, fontSize: '0.95rem', padding: '0.45rem 1rem', borderRadius: 10, letterSpacing: '0.01em', boxShadow: `0 3px 8px ${formWarna}55` }}>
                      {formJenjang} {id.trim()}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Info */}
          <p style={{ fontSize: '0.9rem', fontWeight: 500, color: '#6F788A', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#6F788A1A', borderRadius: 8, padding: '0.6rem 0.875rem' }}>
            <span style={{ flexShrink: 0 }}>ⓘ</span>
            <span>Kelas ini terikat dengan tahun ajaran aktif <strong>{tahunAjaran}</strong>. Jumlah siswa terhitung otomatis setelah import siswa.</span>
          </p>

          {/* Footer buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.5rem', marginTop: '2rem' }}>
            <button
              onClick={startCloseForm}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: '2.8rem', padding: '0 1.25rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, border: 'none', background: '#F7DD7D', color: '#1A2C4E', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)' }}
            >
              Batalkan Pembuatan <Image src="/icons/IconsXCircle.png" width={16} height={16} alt="Batal" style={{ display: 'block' }} />
            </button>
            <button
              onClick={handleSimpanForm}
              disabled={saving}
              style={{
                background: saving ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E',
                border: 'none', padding: '0.7rem 1.5rem', borderRadius: 10,
                fontWeight: 700, fontSize: '0.9rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background 0.15s',
                boxShadow: saving ? 'none' : '0 5px 2px rgba(18, 47, 102, 0.31)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {saving ? 'Menyimpan...' : 'Simpan & Lanjutkan'} <Image src="/icons/IconArrowKanan.png" width={12} height={12} alt="Simpan" />
            </button>
          </div>
        </div>
      )}
      </div>
      </div>

      {/* Daftar kelas / empty state */}
      <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
        {(!showForm || formClosing) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button
              onClick={() => setShowForm(true)}
              style={{
                background: '#F7DD7D', color: '#1A2C4E',
                border: 'none', padding: '0.6rem 1.1rem', borderRadius: 10,
                fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 15,
                boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)',
              }}
            >
              Buat Kelas Baru <Image src="/icons/IconEdit2.png" width={20} height={20} alt="Tambah" style={{ display: 'block' }} />
            </button>
          </div>
        )}
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <Image src="/icons/IconNotSave.png" width={80} height={80} alt="Tidak Ada Kelas" style={{ margin: '0 auto 0.875rem', display: 'block' }} />
          <p style={{ fontWeight: 700, fontSize: '1.2rem', color: '#6F788A', margin: '0 0 0.35rem' }}>Belum ada kelas</p>
          <p style={{ fontSize: '1rem', color: '#6F788A', margin: 0 }}>Tambahkan kelas baru</p>
        </div>
      </div>

      {/* Popups */}
      {showSuccessPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'popupBackdrop 0.2s ease' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', textAlign: 'center', overflow: 'hidden', animation: 'popupCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ padding: '2rem 1.75rem 1.5rem' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <CheckCircle2 size={32} color="#059669" />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.5rem' }}>Berhasil Disimpan!</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>Data kelas berhasil disimpan.</p>
              <button onClick={() => router.push('/siswa/daftar-siswa')} style={{ ...sBtnPrimary, width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}>
                Lanjutkan Langkah Berikutnya →
              </button>
            </div>
            <div style={{ height: 4, background: '#E5E7EB' }}>
              <div style={{ height: '100%', background: '#059669', animation: 'popupBar 5s linear forwards' }} />
            </div>
          </div>
        </div>
      )}

      {showErrorPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'popupBackdrop 0.2s ease' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', textAlign: 'center', overflow: 'hidden', animation: 'popupCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ padding: '2rem 1.75rem 1.5rem' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <XCircle size={32} color="#DC2626" />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.5rem' }}>Gagal Tersimpan</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>{apiError}</p>
              <button onClick={() => setShowErrorPopup(false)} style={{ ...sBtnSecondary, width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}>
                Tutup
              </button>
            </div>
            <div style={{ height: 4, background: '#E5E7EB' }}>
              <div style={{ height: '100%', background: '#DC2626', animation: 'popupBar 5s linear forwards' }} />
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sLabel:        React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--text-mid)', marginBottom: 4 }
const sInput:        React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2.5px solid #BABFC7', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.19)', borderRadius: 10, fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const sCard:         React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sBtnPrimary:   React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
