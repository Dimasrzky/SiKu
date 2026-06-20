'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle2, XCircle, ChevronDown, Trash2, Search, LayoutGrid, Users, AlertCircle, Eye, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const WARNA_OPTIONS = [
  '#944949', '#2F1F1F', '#2B7B2B', '#5E3333',
  '#401568', '#704E4E', '#AF9191'
]

const JENJANG_MAP: Record<string, string[]> = {
  'TK/PAUD': ['A', 'B', 'C'],
  'SD/MI':   ['1', '2', '3', '4', '5', '6'],
  'SMP/MTs': ['7', '8', '9'],
  'SMA/MA':  ['10', '11', '12'],
  'SMK':     ['10', '11', '12'],
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
  const [taMulai,        setTaMulai]        = useState('')
  const [taSelesai,      setTaSelesai]      = useState('')
  const [semester,       setSemester]       = useState('')
  const [rawRows,        setRawRows]        = useState<KelasRow[]>([])
  const [siswaCounts,    setSiswaCounts]    = useState<Record<string, number>>({})
  const [setupDone,      setSetupDone]      = useState(false)
  const [dataLoading,    setDataLoading]    = useState(true)
  const [setupSteps,     setSetupSteps]     = useState<Record<string, boolean>>({})
  const [jenjangOptions, setJenjangOptions] = useState<string[]>(JENJANG_MAP['SMP/MTs'])

  // View mode state
  const [filterJenjang,        setFilterJenjang]        = useState('')
  const [showJenjangDropdown,  setShowJenjangDropdown]  = useState(false)
  const [searchQuery,          setSearchQuery]          = useState('')
  const [deleteTarget,         setDeleteTarget]         = useState<KelasRow | null>(null)
  const [deleteLoading,        setDeleteLoading]        = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // View mode inline add form
  const [showViewAdd,          setShowViewAdd]          = useState(false)
  const [viewAddClosing,       setViewAddClosing]       = useState(false)
  const [viewAddJenjang,       setViewAddJenjang]       = useState('')
  const [viewAddIdentitasList, setViewAddIdentitasList] = useState<string[]>([''])
  const [viewAddWarna,         setViewAddWarna]         = useState(WARNA_OPTIONS[0])
  const [viewAddSaving,        setViewAddSaving]        = useState(false)
  const [viewAddError,         setViewAddError]         = useState('')
  const [showKelasPenuhPopup,  setShowKelasPenuhPopup]  = useState(false)

  // Detail slide panel
  const [detailTarget,  setDetailTarget]  = useState<KelasRow | null>(null)
  const [detailClosing, setDetailClosing] = useState(false)

  // Edit modal
  const [editTarget,     setEditTarget]     = useState<KelasRow | null>(null)
  const [editIdentitas,  setEditIdentitas]  = useState('')
  const [editWaliKelas,  setEditWaliKelas]  = useState('')
  const [editWarna,      setEditWarna]      = useState(WARNA_OPTIONS[0])
  const [editSaving,     setEditSaving]     = useState(false)
  const [editError,      setEditError]      = useState('')

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
        supabase.from('tahun_ajaran').select('nama, tanggal_mulai, tanggal_selesai, semester_ganjil_mulai, semester_ganjil_selesai').eq('is_aktif', true).maybeSingle(),
        supabase.from('siswa').select('kelas_id').limit(2000),
      ])

      const peng = pData as { jenjang_sekolah?: string; setup_steps?: Record<string, unknown> } | null

      if (!peng?.setup_steps?.['komponen_tagihan']) {
        router.replace('/tagihan/komponen')
        return
      }

      const steps = (peng?.setup_steps ?? {}) as Record<string, boolean>
      setSetupSteps(steps)

      const opts = JENJANG_MAP[peng?.jenjang_sekolah ?? 'SMP/MTs'] ?? JENJANG_MAP['SMP/MTs']
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
        type TaRow = { nama: string; tanggal_mulai: string; tanggal_selesai: string; semester_ganjil_mulai: string; semester_ganjil_selesai: string }
        const ta = taData as TaRow
        const today    = new Date()
        const gMulai   = new Date(ta.semester_ganjil_mulai)
        const gSelesai = new Date(ta.semester_ganjil_selesai)
        setTahunAjaran(ta.nama)
        setSemester(today >= gMulai && today <= gSelesai ? 'Ganjil' : 'Genap')
      }

      if (taData) {
        type TaRow = { nama: string; tanggal_mulai: string; tanggal_selesai: string; semester_ganjil_mulai: string; semester_ganjil_selesai: string }
        const ta = taData as TaRow
        if (ta.tanggal_mulai)  setTaMulai(ta.tanggal_mulai)
        if (ta.tanggal_selesai) setTaSelesai(ta.tanggal_selesai)
        if (!kResult.data?.length) setTahunAjaran(ta.nama)
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

  // Tutup dropdown ketika klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowJenjangDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  // View mode inline add
  const openViewAdd = () => {
    const available = jenjangOptions.filter(j => !rawRows.some(r => r.jenjang === j))
    if (available.length === 0) { setShowKelasPenuhPopup(true); return }
    setViewAddJenjang('')
    setViewAddIdentitasList([''])
    setViewAddWarna(WARNA_OPTIONS[0])
    setViewAddError('')
    setViewAddClosing(false)
    setShowViewAdd(true)
  }

  const closeViewAdd = () => {
    setViewAddClosing(true)
    setTimeout(() => { setShowViewAdd(false); setViewAddClosing(false) }, 400)
  }

  const addViewIdentitas    = () => setViewAddIdentitasList(prev => [...prev, ''])
  const removeViewIdentitas = (i: number) => setViewAddIdentitasList(prev => prev.filter((_, idx) => idx !== i))
  const updateViewIdentitas = (i: number, val: string) => setViewAddIdentitasList(prev => prev.map((v, idx) => idx === i ? val : v))

  const handleViewAddSimpan = async () => {
    setViewAddError('')
    if (!viewAddJenjang) { setViewAddError('Tingkat kelas harus dipilih.'); return }
    const validIds = viewAddIdentitasList.filter(i => i.trim())
    if (validIds.length === 0) { setViewAddError('Identitas kelas harus diisi.'); return }
    setViewAddSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setViewAddError('Sesi tidak ditemukan.'); setViewAddSaving(false); return }

    const { data: profile } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).single()
    if (!profile?.sekolah_id) { setViewAddError('Data sekolah tidak ditemukan.'); setViewAddSaving(false); return }

    const rows = validIds.map(id => ({
      sekolah_id: profile.sekolah_id as string,
      nama: `${viewAddJenjang}-${id.trim().toUpperCase()}`,
      jenjang: viewAddJenjang,
      warna: viewAddWarna,
      tahun_ajaran: tahunAjaran,
      semester,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('kelas')
      .insert(rows)
      .select('id, nama, jenjang, warna, tahun_ajaran, semester, wali_kelas')

    if (insertError) { setViewAddError(insertError.message); setViewAddSaving(false); return }
    if (inserted) setRawRows(prev => [...prev, ...(inserted as KelasRow[])])
    setViewAddSaving(false)
    closeViewAdd()
  }

  // Detail panel handlers
  const openDetail  = (kelas: KelasRow) => { setDetailClosing(false); setDetailTarget(kelas) }
  const closeDetail = () => { setDetailClosing(true); setTimeout(() => { setDetailTarget(null); setDetailClosing(false) }, 350) }

  // Edit modal
  const openEdit = (kelas: KelasRow) => {
    setEditTarget(kelas)
    const dashIdx = kelas.nama.indexOf('-')
    setEditIdentitas(dashIdx >= 0 ? kelas.nama.slice(dashIdx + 1) : kelas.nama)
    setEditWaliKelas(kelas.wali_kelas ?? '')
    setEditWarna(kelas.warna)
    setEditError('')
    setEditSaving(false)
  }

  const handleEditSimpan = async () => {
    if (!editTarget) return
    if (!editIdentitas.trim()) { setEditError('Identitas kelas harus diisi.'); return }
    setEditSaving(true)
    const newNama = `${editTarget.jenjang}-${editIdentitas.trim().toUpperCase()}`
    const { error: updateError } = await supabase
      .from('kelas')
      .update({ nama: newNama, wali_kelas: editWaliKelas.trim() || null, warna: editWarna })
      .eq('id', editTarget.id)
    if (updateError) { setEditError(updateError.message); setEditSaving(false); return }
    setRawRows(prev => prev.map(r => r.id === editTarget.id ? { ...r, nama: newNama, wali_kelas: editWaliKelas.trim() || null, warna: editWarna } : r))
    setEditTarget(null)
    setEditSaving(false)
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
    const filteredRows = rawRows
      .filter(r => {
        const matchJenjang = !filterJenjang || r.jenjang === filterJenjang
        const normalize    = (s: string) => s.toLowerCase().replace(/[-\s]/g, '')
        const matchSearch  = !searchQuery || [
          r.nama,
          `Kelas ${r.nama.replace('-', ' ')}`,
          `kelas${r.nama.replace('-', '')}`,
        ].some(s => normalize(s).includes(normalize(searchQuery)))
        return matchJenjang && matchSearch
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))

    const groups: { jenjang: string; items: KelasRow[] }[] = []
    const groupMap = new Map<string, typeof groups[0]>()
    for (const row of filteredRows) {
      if (!groupMap.has(row.jenjang)) {
        const g = { jenjang: row.jenjang, items: [] as KelasRow[] }
        groupMap.set(row.jenjang, g)
        groups.push(g)
      }
      groupMap.get(row.jenjang)!.items.push(row)
    }

    const uniqueJenjang = [...new Set(rawRows.map(r => r.jenjang))]
    const totalSiswa    = Object.values(siswaCounts).reduce((a, b) => a + b, 0)
    const belumWali     = rawRows.filter(r => !r.wali_kelas).length

    return (
      <div className="dashboard-content">
        <style>{`
          @keyframes modalBackdrop { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalCard { from { opacity: 0; transform: scale(0.88) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          @keyframes popupBar { from { width: 100%; } to { width: 0%; } }
          @keyframes formSlideDown { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
          @keyframes formSlideUp   { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
          @keyframes panelSlideIn  { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes panelSlideOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
          @keyframes panelFadeIn   { from { opacity: 0; } to { opacity: 1; } }
          @keyframes panelFadeOut  { from { opacity: 1; } to { opacity: 0; } }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18,47,102,0.31)' }}>
              <Image src="/icons/IconGroup.png" width={35} height={35} alt="Kelas" style={{ display: 'block' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>
                Manajemen Kelas
              </h1>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                Kelola daftar kelas sekolah
              </p>
            </div>
          </div>
          {!showViewAdd && (
            <button
              onClick={openViewAdd}
              style={{ background: '#1A2C4E', color: '#fff', border: 'none', padding: '0.7rem 1.4rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 5px 2px rgba(18,47,102,0.31)', whiteSpace: 'nowrap' }}
            >
              + Tambah Kelas Baru
            </button>
          )}
        </div>

        {/* Inline add form */}
        <div style={{ display: 'grid', gridTemplateRows: showViewAdd && !viewAddClosing ? '1fr' : '0fr', transition: 'grid-template-rows 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
          <div style={{ overflow: 'hidden', paddingBottom: showViewAdd && !viewAddClosing ? '1.5rem' : 0, transition: 'padding-bottom 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
            {showViewAdd && (
              <div style={{ animation: viewAddClosing ? 'formSlideUp 0.26s cubic-bezier(0.22,1,0.36,1) forwards' : 'formSlideDown 0.3s cubic-bezier(0.22,1,0.36,1)' }}>
              <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18,47,102,0.18)', marginBottom: 0 }}>

                {viewAddError && <div className="login-error" style={{ marginBottom: '1rem' }}>{viewAddError}</div>}

                {/* Tingkat kelas */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={sLabel}>Tingkat kelas</label>
                  <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Pilih satu tingkat untuk kelas yang akan dibuat
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {jenjangOptions.filter(j => !rawRows.some(r => r.jenjang === j)).map(j => {
                      const selected = viewAddJenjang === j
                      return (
                        <button key={j} onClick={() => setViewAddJenjang(prev => prev === j ? '' : j)}
                          style={{ padding: '0.55rem 1.1rem', borderRadius: 10, fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s', border: selected ? '2px solid #8CA6D0' : '2px solid #BABFC7', background: selected ? '#A3CDFE' : '#fff', color: selected ? '#1A2C4E' : 'var(--text-mid)', boxShadow: selected ? '0 4px 12px rgba(26,44,78,0.3)' : '6px 6px 8px rgba(18,47,102,0.10)' }}>
                          Kelas {j}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ height: 2, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                {/* Identitas kelas */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={sLabel}>Identitas kelas</label>
                  <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Akan digabung dengan tingkat. Contoh: {viewAddJenjang || '7'} + A → &ldquo;{viewAddJenjang || '7'}-A&rdquo;
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {viewAddIdentitasList.map((val, i) => {
                      const isLast = i === viewAddIdentitasList.length - 1
                      return (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', width: '60%' }}>
                          <input type="text" placeholder="Contoh: A, 1, Unggulan, MIPA" value={val} onChange={e => updateViewIdentitas(i, e.target.value)} style={{ ...sInput, flex: 1 }} autoFocus={i === 0} />
                          {isLast ? (
                            <button onClick={addViewIdentitas} style={{ flexShrink: 0, marginLeft: '0.5rem', padding: '0 1rem', borderRadius: 10, background: '#1A2C4E', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', color: '#ffffff', whiteSpace: 'nowrap', boxShadow: '6px 6px 8px rgba(18,47,102,0.10)', border: 'none' }}>
                              + Tambah
                            </button>
                          ) : (
                            <button onClick={() => removeViewIdentitas(i)} style={{ flexShrink: 0, marginLeft: '3.2rem', padding: '0 0.9rem', border: '2.5px solid #c7504e', borderRadius: 10, background: '#dab1b1', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '1.8rem', color: '#000000', lineHeight: 1, boxShadow: '6px 6px 8px rgba(18,47,102,0.10)' }}>
                              ×
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ height: 2, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                {/* Pilih warna */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Pilih warna kelas</div>
                  <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>Berlaku untuk semua kelas baru di batch ini</div>
                  <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', background: '#FFFFFF', border: '3px solid #BABFC7', borderRadius: 13, padding: '0.5rem 0.75rem', boxShadow: '6px 6px 8px rgba(18,47,102,0.18)' }}>
                    {WARNA_OPTIONS.map(w => (
                      <button key={w} onClick={() => setViewAddWarna(w)} style={{ width: 30, height: 30, borderRadius: 8, background: w, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: viewAddWarna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none', transition: 'all 0.15s' }} />
                    ))}
                    <label title="Pilih warna kustom" style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, cursor: 'pointer' }}>
                      <input type="color" value={viewAddWarna} onChange={e => setViewAddWarna(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }} />
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: !WARNA_OPTIONS.includes(viewAddWarna) ? viewAddWarna : 'transparent', boxShadow: !WARNA_OPTIONS.includes(viewAddWarna) ? `0 0 0 2px #fff, 0 0 0 4px ${viewAddWarna}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        {WARNA_OPTIONS.includes(viewAddWarna) && <Image src="/icons/IconPipet.png" width={18} height={18} alt="Pipet" />}
                      </div>
                    </label>
                  </div>
                </div>

                <div style={{ height: 2, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                {/* Review tampilan */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Review tampilan</div>
                  <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>Kelas yang akan dibuat dalam batch ini</div>
                  {(() => {
                    const validIds = viewAddIdentitasList.filter(i => i.trim())
                    const hasData  = viewAddJenjang && validIds.length > 0
                    if (!hasData) {
                      return (
                        <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1.1rem 1.4rem', background: '#F8FAFC' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#64748B', marginBottom: '0.25rem' }}>Kelas yang akan dibuat</div>
                          <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>Pilih tingkat &amp; tambahkan identitas kelas</div>
                        </div>
                      )
                    }
                    return (
                      <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.25rem', background: '#F8FAFC', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', boxShadow: '6px 6px 8px rgba(18,47,102,0.18)' }}>
                        {validIds.map((id, i) => (
                          <div key={i} style={{ background: viewAddWarna, color: '#fff', fontWeight: 800, fontSize: '0.95rem', padding: '0.45rem 1rem', borderRadius: 10, letterSpacing: '0.01em', boxShadow: `0 3px 8px ${viewAddWarna}55` }}>
                            {viewAddJenjang} {id.trim()}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                <p style={{ fontSize: '0.9rem', fontWeight: 500, color: '#6F788A', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#6F788A1A', borderRadius: 8, padding: '0.6rem 0.875rem' }}>
                  <span style={{ flexShrink: 0 }}>ⓘ</span>
                  <span>Kelas ini terikat dengan tahun ajaran aktif <strong>{tahunAjaran}</strong>. Jumlah siswa terhitung otomatis setelah import siswa.</span>
                </p>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.5rem', marginTop: '2rem' }}>
                  <button onClick={closeViewAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, height: '2.8rem', padding: '0 1.25rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, border: 'none', background: '#F7DD7D', color: '#1A2C4E', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 5px 2px rgba(18,47,102,0.31)' }}>
                    Batalkan Pembuatan <Image src="/icons/IconsXCircle.png" width={16} height={16} alt="Batal" style={{ display: 'block' }} />
                  </button>
                  <button onClick={handleViewAddSimpan} disabled={viewAddSaving} style={{ background: viewAddSaving ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.7rem 1.5rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: viewAddSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.15s', boxShadow: viewAddSaving ? 'none' : '0 5px 2px rgba(18,47,102,0.31)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {viewAddSaving ? 'Menyimpan...' : 'Simpan Kelas'} {!viewAddSaving && <Image src="/icons/IconArrowKanan.png" width={12} height={12} alt="Simpan" />}
                  </button>
                </div>
              </div>
              </div>
            )}
          </div>
        </div>

        {/* Main card */}
        <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '0 0 0 1px rgba(26,44,78,0.08), 6px 6px 24px rgba(26,44,78,0.14)' }}>

          {/* Card header — TA info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 70, height: 48, background: '#1A2C4E', borderRadius: 12, padding: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Image src="/icons/IconWaktu.png" width={26} height={26} alt="Siswa" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--navy-dark)' }}>{tahunAjaran}</span>
              <span style={{ background: '#69C183', border: '2.5px solid #C1E6CC', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, padding: '1px 14px', borderRadius: 20 }}>
                Aktif
              </span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500, margin: 0 }}>
                {taMulai && taSelesai ? `${fmtDate(taMulai)} – ${fmtDate(taSelesai)}` : `Semester ${semester}`}
              </p>
            </div>
          </div>

          {/* 3 Stat cards */}
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', maxWidth: '70%', marginLeft: 30, }}>
            <div style={sStatCard}>
              <div>
                <div style={sStatLabel}>Total kelas</div>
                <div style={sStatValue}>{rawRows.length}</div>
              </div>
              <LayoutGrid size={28} color="#1A2C4E" style={{ opacity: 0.55 }} />
            </div>
            <div style={sStatCard}>
              <div>
                <div style={sStatLabel}>Total siswa</div>
                <div style={sStatValue}>{totalSiswa}</div>
              </div>
              <Users size={28} color="#1A2C4E" style={{ opacity: 0.55 }} />
            </div>
            <div style={sStatCard}>
              <div>
                <div style={sStatLabel}>Belum ada wali kelas</div>
                <div style={sStatValue}>{belumWali}</div>
              </div>
              <AlertCircle size={28} color="#F59E0B" style={{ opacity: 0.8 }} />
            </div>
          </div>

          {/* Separator */}
          <div style={{ padding: '0 1.5rem' }}>
            <div style={{ height: 1.5, background: '#C1C6CF', width: '100%', marginBottom: '2rem' }} />
          </div>

          {/* Tabs + Search */}
          <div style={{ padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.6rem' }}>
            <div style={{ display: 'flex', marginLeft: '-0.75rem', position: 'relative' }} ref={dropdownRef}>
              {/* Tab Semua */}
              <button
                onClick={() => { setFilterJenjang(''); setShowJenjangDropdown(false) }}
                style={{ background: 'none', borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', fontWeight: !filterJenjang ? 700 : 700, color: '#1A2C4E', padding: '0.3rem 0.75rem', transition: 'all 0.15s' }}
              >
                <span style={{ display: 'inline-block', borderBottom: !filterJenjang ? '4px solid #1A2C4E' : '3px solid transparent', paddingBottom: '0.25rem', transition: 'border-color 0.15s' }}>
                  Semua
                </span>
              </button>

              {/* Tab Pilih tingkat kelas (dropdown) */}
              <button
                onClick={() => setShowJenjangDropdown(prev => !prev)}
                style={{ background: 'none', borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', fontWeight: filterJenjang ? 700 : 700, color: '#1A2C4E', padding: '0.3rem 0.75rem', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <span style={{ display: 'inline-block', borderBottom: filterJenjang ? '4px solid #1A2C4E' : '3px solid transparent', paddingBottom: '0.25rem', transition: 'border-color 0.15s' }}>
                  {filterJenjang ? `Kelas ${filterJenjang}` : 'Pilih tingkat kelas'}
                </span>
                <ChevronDown size={14} color="#1A2C4E" style={{ transform: showJenjangDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>

              {/* Dropdown panel */}
              {showJenjangDropdown && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: '5.5rem', background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1.5px solid #E2E8F0', overflow: 'hidden', zIndex: 100, minWidth: 160 }}>
                  {uniqueJenjang.map(j => (
                    <button
                      key={j}
                      onClick={() => { setFilterJenjang(j); setShowJenjangDropdown(false) }}
                      style={{ display: 'block', width: '100%', padding: '0.65rem 1rem', background: filterJenjang === j ? '#A3CDFE' : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: filterJenjang === j ? 700 : 500, fontSize: '0.9rem', color: '#1A2C4E', textAlign: 'left', transition: 'background 0.12s' }}
                    >
                      Kelas {j}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                placeholder="Cari kelas"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ ...sInput, padding: '0.3rem 0.85rem 0.3rem 2.25rem', width: 300, border: '3px solid #C1C6CF', boxShadow: 'none', fontSize: '0.875rem' }}
              />
            </div>
          </div>

          {/* Scrollable list */}
          <div style={{ maxHeight: '480px', overflowY: 'auto', marginRight: '1.3rem' }}>
            {filteredRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {rawRows.length === 0 ? 'Belum ada kelas.' : 'Tidak ada kelas yang sesuai filter.'}
              </div>
            ) : filterJenjang ? (
              /* Flat list — no group headers */
              filteredRows.map((kelas, i) => {
                const dashIdx    = kelas.nama.indexOf('-')
                const identitas  = dashIdx >= 0 ? kelas.nama.slice(dashIdx + 1) : kelas.nama
                const inisial    = identitas.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
                const hasWali    = !!kelas.wali_kelas
                const siswaCount = siswaCounts[kelas.id] ?? 0
                return (
                  <div key={kelas.id} style={{ paddingLeft: '1.5rem', paddingRight: '2.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 0' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 10, background: kelas.warna, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.02em' }}>{inisial}</span>
                      </div>
                      <div style={{ width: 240, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Kelas {kelas.nama.replace('-', ' ')}</span>
                          <span style={{ background: hasWali ? '#DCFCE7' : '#FEF3C7', color: hasWali ? '#15803D' : '#92400E', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                            {hasWali ? '✓ Lengkap' : '⚠ Tanpa wali'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Wali kelas: {kelas.wali_kelas || '—'}
                        </div>
                      </div>
                      <div style={{ width: 1.5, height: 40, background: '#CBD5E1', flexShrink: 0, marginLeft: '1%' }} />
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Jumlah siswa</div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>{siswaCount} siswa</div>
                      </div>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0, position: 'relative', right: 20 }}>
                        <button onClick={() => openDetail(kelas)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.45rem', display: 'flex', alignItems: 'center' }}>
                          <Eye size={18} />
                        </button>
                        <button onClick={() => openEdit(kelas)}
                          style={{ background: 'transparent', borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.45rem', display: 'flex', alignItems: 'center' }}>
                          <Image src="/icons/IconEdit2.png" width={16} height={16} alt="Edit" />
                        </button>
                        <button onClick={() => setDeleteTarget(kelas)}
                          style={{ background: '#DA8181', borderRadius: '4px', cursor: 'pointer', color: '#ffffff', padding: '0.45rem', display: 'flex', alignItems: 'center', boxShadow: '2px 4px 4px #a8a8a88c', border: 'none' }}>
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    {i < filteredRows.length - 1 && (
                      <div style={{ height: 1, background: '#C1C6CF' }} />
                    )}
                  </div>
                )
              })
            ) : (
              /* Grouped list — with #A3CDFE group headers */
              groups.map((group, gIdx) => {
                const groupSiswa = group.items.reduce((sum, k) => sum + (siswaCounts[k.id] ?? 0), 0)
                return (
                  <div key={group.jenjang}>
                    {/* Group header */}
                    <div style={{ background: '#A3CDFE', width: '94%', borderRadius: 6, marginLeft: 20, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Image src="/icons/IconLayer.png" width={16} height={16} alt="Edit" />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2C4E', position:'relative', right:'40%', }}>Kelas {group.jenjang}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A2C4E', opacity: 0.75 }}>
                        {group.items.length} kelas · {groupSiswa} siswa
                      </span>
                    </div>
                    {/* Items */}
                    {group.items.map((kelas, i) => {
                      const dashIdx    = kelas.nama.indexOf('-')
                      const identitas  = dashIdx >= 0 ? kelas.nama.slice(dashIdx + 1) : kelas.nama
                      const inisial    = identitas.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
                      const hasWali    = !!kelas.wali_kelas
                      const siswaCount = siswaCounts[kelas.id] ?? 0
                      return (
                        <div key={kelas.id} style={{ paddingLeft: '1.5rem', paddingRight: '2.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 0' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 10, background: kelas.warna, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.02em' }}>{inisial}</span>
                            </div>
                            <div style={{ width: 240, minWidth: 0, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'nowrap', overflow: 'hidden' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>Kelas {kelas.nama.replace('-', ' ')}</span>
                                <span style={{ background: hasWali ? '#DCFCE7' : '#FEF3C7', color: hasWali ? '#15803D' : '#92400E', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, flexShrink: 0 }}>
                                  {hasWali ? '✓ Lengkap' : '⚠ Tanpa wali'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Wali kelas: {kelas.wali_kelas || '—'}
                              </div>
                            </div>
                            <div style={{ width: 1.5, height: 40, background: '#CBD5E1', flexShrink: 0, marginLeft: '1%' }} />
                            <div style={{ flexShrink: 0 }}>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Jumlah siswa</div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>{siswaCount} siswa</div>
                            </div>
                            <div style={{ flex: 1 }} />
                            <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0, position: 'relative', right: 20 }}>
                              <button onClick={() => openDetail(kelas)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.45rem', display: 'flex', alignItems: 'center' }}>
                                <Eye size={18} />
                              </button>
                              <button onClick={() => openEdit(kelas)}
                                style={{ background: 'transparent', borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.45rem', display: 'flex', alignItems: 'center' }}>
                                <Image src="/icons/IconEdit2.png" width={16} height={16} alt="Edit" />
                              </button>
                              <button onClick={() => setDeleteTarget(kelas)}
                                style={{ background: '#DA8181', borderRadius: '4px', cursor: 'pointer', color: '#ffffff', padding: '0.45rem', display: 'flex', alignItems: 'center', boxShadow: '2px 4px 4px #a8a8a88c', border: 'none' }}>
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </div>
                          {i < group.items.length - 1 && (
                            <div style={{ height: 1, background: '#C1C6CF' }} />
                          )}
                        </div>
                      )
                    })}
                    {gIdx < groups.length - 1 && <div style={{ height: 28 }} />}
                  </div>
                )
              })
            )}
          </div>

        </div>

        {/* Kelas penuh popup */}
        {showKelasPenuhPopup && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.2s ease' }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, padding: '2rem 1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <CheckCircle2 size={28} color="#16A34A" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.5rem' }}>Semua Kelas Sudah Dibuat</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
                Seluruh tingkat kelas untuk jenjang sekolah ini sudah ditambahkan. Tidak ada tingkat yang tersisa.
              </p>
              <button onClick={() => setShowKelasPenuhPopup(false)} style={{ width: '100%', padding: '0.7rem', borderRadius: 10, border: 'none', background: '#1A2C4E', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                Mengerti
              </button>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editTarget && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.2s ease' }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460, padding: '2rem 1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 1.5rem' }}>Edit Kelas {editTarget.nama}</h3>

              {editError && <div className="login-error" style={{ marginBottom: '1rem' }}>{editError}</div>}

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ ...sLabel, display: 'block', marginBottom: 4 }}>Identitas kelas</label>
                <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Akan digabung dengan tingkat {editTarget.jenjang}. Contoh: A → &ldquo;{editTarget.jenjang}-A&rdquo;
                </div>
                <input type="text" placeholder="Contoh: A, 1, Unggulan, MIPA" value={editIdentitas} onChange={e => setEditIdentitas(e.target.value)} style={sInput} autoFocus />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ ...sLabel, display: 'block', marginBottom: 6 }}>Wali kelas</label>
                <input type="text" placeholder="Nama wali kelas" value={editWaliKelas} onChange={e => setEditWaliKelas(e.target.value)} style={sInput} />
              </div>

              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ ...sLabel, display: 'block', marginBottom: 10 }}>Warna kelas</label>
                <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', background: '#fff', border: '3px solid #BABFC7', borderRadius: 13, padding: '0.5rem 0.75rem', boxShadow: '6px 6px 8px rgba(18,47,102,0.18)' }}>
                  {WARNA_OPTIONS.map(w => (
                    <button key={w} onClick={() => setEditWarna(w)} style={{ width: 28, height: 28, borderRadius: 8, background: w, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: editWarna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none', transition: 'all 0.15s' }} />
                  ))}
                  <label style={{ position: 'relative', width: 30, height: 30, cursor: 'pointer', flexShrink: 0 }}>
                    <input type="color" value={editWarna} onChange={e => setEditWarna(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }} />
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: !WARNA_OPTIONS.includes(editWarna) ? editWarna : 'transparent', boxShadow: !WARNA_OPTIONS.includes(editWarna) ? `0 0 0 2px #fff, 0 0 0 4px ${editWarna}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                      {WARNA_OPTIONS.includes(editWarna) && <Image src="/icons/IconPipet.png" width={16} height={16} alt="Pipet" />}
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setEditTarget(null)} disabled={editSaving} style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: 'var(--navy-dark)' }}>
                  Batal
                </button>
                <button onClick={handleEditSimpan} disabled={editSaving} style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: 'none', background: editSaving ? '#D1D5DB' : '#1A2C4E', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: editSaving ? 'not-allowed' : 'pointer' }}>
                  {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Slide Panel */}
        {detailTarget && (
          <>
            <div onClick={closeDetail} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9998, animation: detailClosing ? 'panelFadeOut 0.35s ease forwards' : 'panelFadeIn 0.25s ease' }} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: '#fff', zIndex: 9999, boxShadow: '-8px 0 32px rgba(26,44,78,0.22)', display: 'flex', flexDirection: 'column', animation: detailClosing ? 'panelSlideOut 0.35s cubic-bezier(0.4,0,0.2,1) forwards' : 'panelSlideIn 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1.5px solid #E2E8F0' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--navy-dark)' }}>Detail Kelas</span>
                <button onClick={closeDetail} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6F788A', display: 'flex', alignItems: 'center', padding: '0.25rem' }}>
                  <X size={20} />
                </button>
              </div>
              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 1.5rem' }}>
                {/* Avatar + nama */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: detailTarget.warna, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>
                      {(() => { const d = detailTarget.nama.indexOf('-'); return d >= 0 ? detailTarget.nama.slice(d + 1, d + 3).toUpperCase() : detailTarget.nama.slice(0, 2).toUpperCase() })()}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--navy-dark)', marginBottom: '0.3rem' }}>Kelas {detailTarget.nama.replace('-', ' ')}</div>
                    <span style={{ background: '#A3CDFE', color: '#1A2C4E', fontSize: '0.72rem', fontWeight: 700, padding: '3px 12px', borderRadius: 20 }}>Tingkat {detailTarget.jenjang}</span>
                  </div>
                </div>

                <div style={{ height: 1, background: '#E2E8F0', marginBottom: '1.5rem' }} />

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Wali Kelas</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: detailTarget.wali_kelas ? 'var(--navy-dark)' : '#94A3B8' }}>
                    {detailTarget.wali_kelas || 'Belum ada wali kelas'}
                  </div>
                </div>

                <div style={{ height: 1, background: '#E2E8F0', marginBottom: '1.5rem' }} />

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Jumlah Siswa</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                    {siswaCounts[detailTarget.id] ?? 0} siswa
                  </div>
                </div>

                <div style={{ height: 1, background: '#E2E8F0', marginBottom: '1.5rem' }} />

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Tahun Ajaran</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-dark)' }}>{detailTarget.tahun_ajaran} · Semester {detailTarget.semester}</div>
                </div>

                <div style={{ height: 1, background: '#E2E8F0', marginBottom: '1.5rem' }} />

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Warna Kelas</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: detailTarget.warna, boxShadow: `0 2px 8px ${detailTarget.warna}88` }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy-dark)' }}>{detailTarget.warna}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

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

      {/* Form card */}
      <div style={{ display: 'grid', gridTemplateRows: showForm && !formClosing ? '1fr' : '0fr', transition: 'grid-template-rows 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
      <div style={{ overflow: 'hidden', paddingBottom: showForm && !formClosing ? '1.1rem' : 0, paddingRight: '1.5rem', marginRight: '-1.5rem' }}>
      {showForm && (
        <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)', animation: formClosing ? 'formSlideUp 0.26s cubic-bezier(0.22,1,0.36,1) forwards' : 'formSlideDown 0.3s cubic-bezier(0.22,1,0.36,1)' }}>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={sLabel}>Tingkat kelas</label>
            <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Pilih satu tingkat untuk kelas yang akan dibuat
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {jenjangOptions.map(j => {
                const selected = formJenjang === j
                return (
                  <button key={j} onClick={() => setFormJenjang(prev => prev === j ? '' : j)}
                    style={{ padding: '0.55rem 1.1rem', borderRadius: 10, fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s', border: selected ? '2px solid #8CA6D0' : '2px solid #BABFC7', background: selected ? '#A3CDFE' : '#fff', color: selected ? '#1A2C4E' : 'var(--text-mid)', boxShadow: selected ? '0 4px 12px rgba(26,44,78,0.3)' : '6px 6px 8px rgba(18,47,102,0.10)' }}>
                    Kelas {j}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ height: 2, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

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
                    <input type="text" placeholder="Contoh: A, 1, Unggulan, MIPA" value={val} onChange={e => updateIdentitas(i, e.target.value)} style={{ ...sInput, flex: 1 }} autoFocus={i === 0} />
                    {isLast ? (
                      <button onClick={addIdentitas} style={{ flexShrink: 0, marginLeft: '0.5rem', padding: '0 1rem', borderRadius: 10, background: '#1A2C4E', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', color: '#ffffff', whiteSpace: 'nowrap', boxShadow: '6px 6px 8px rgba(18,47,102,0.10)', border: 'none' }}>
                        + Tambah
                      </button>
                    ) : (
                      <button onClick={() => removeIdentitas(i)} style={{ flexShrink: 0, marginLeft: '3.2rem', padding: '0 0.9rem', border: '2.5px solid #c7504e', borderRadius: 10, background: '#dab1b1', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '1.8rem', color: '#000000', lineHeight: 1, boxShadow: '6px 6px 8px rgba(18,47,102,0.10)' }}>
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ height: 2, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Pilih warna kelas</div>
            <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>Berlaku untuk semua kelas baru di batch ini</div>
            <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', background: '#FFFFFF', border: '3px solid #BABFC7', borderRadius: 13, padding: '0.5rem 0.75rem', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
              {FORM_WARNA.map(w => (
                <button key={w} onClick={() => setFormWarna(w)} style={{ width: 30, height: 30, borderRadius: 8, background: w, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: formWarna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none', transition: 'all 0.15s' }} />
              ))}
              <label title="Pilih warna kustom" style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, cursor: 'pointer' }}>
                <input type="color" value={formWarna} onChange={e => setFormWarna(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }} />
                <div style={{ width: 32, height: 32, borderRadius: 8, background: isCustomWarna ? formWarna : 'transparent', boxShadow: isCustomWarna ? `0 0 0 2px #fff, 0 0 0 4px ${formWarna}` : 'none', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {!isCustomWarna && <Image src="/icons/IconPipet.png" width={18} height={18} alt="Pipet" />}
                </div>
              </label>
            </div>
          </div>

          <div style={{ height: 2, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Review tampilan</div>
            <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>Kelas yang akan dibuat dalam batch ini</div>
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
                <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.25rem', background: '#F8FAFC', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
                  {validIds.map((id, i) => (
                    <div key={i} style={{ background: formWarna, color: '#fff', fontWeight: 800, fontSize: '0.95rem', padding: '0.45rem 1rem', borderRadius: 10, letterSpacing: '0.01em', boxShadow: `0 3px 8px ${formWarna}55` }}>
                      {formJenjang} {id.trim()}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          <p style={{ fontSize: '0.9rem', fontWeight: 500, color: '#6F788A', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#6F788A1A', borderRadius: 8, padding: '0.6rem 0.875rem' }}>
            <span style={{ flexShrink: 0 }}>ⓘ</span>
            <span>Kelas ini terikat dengan tahun ajaran aktif <strong>{tahunAjaran}</strong>. Jumlah siswa terhitung otomatis setelah import siswa.</span>
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.5rem', marginTop: '2rem' }}>
            <button onClick={startCloseForm} style={{ display: 'flex', alignItems: 'center', gap: 6, height: '2.8rem', padding: '0 1.25rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, border: 'none', background: '#F7DD7D', color: '#1A2C4E', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)' }}>
              Batalkan Pembuatan <Image src="/icons/IconsXCircle.png" width={16} height={16} alt="Batal" style={{ display: 'block' }} />
            </button>
            <button onClick={handleSimpanForm} disabled={saving} style={{ background: saving ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.7rem 1.5rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.15s', boxShadow: saving ? 'none' : '0 5px 2px rgba(18, 47, 102, 0.31)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving ? 'Menyimpan...' : 'Simpan & Lanjutkan'} <Image src="/icons/IconArrowKanan.png" width={12} height={12} alt="Simpan" />
            </button>
          </div>
        </div>
      )}
      </div>
      </div>

      {/* Empty state card */}
      <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
        {(!showForm || formClosing) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button onClick={() => setShowForm(true)} style={{ background: '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.6rem 1.1rem', borderRadius: 10, fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 15, boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)' }}>
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
              <button onClick={() => setShowErrorPopup(false)} style={{ ...sBtnSecondary, width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}>Tutup</button>
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
const sStatCard:     React.CSSProperties = { background: '#ffffff', borderRadius: 16, padding: '0.875rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', boxShadow: '0 0 20px rgba(31, 85, 167, 0.52)', flex: 1, minWidth: 0  }
const sStatLabel:    React.CSSProperties = { fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6, position:'relative', bottom: 7, }
const sStatValue:    React.CSSProperties = { fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1 }
