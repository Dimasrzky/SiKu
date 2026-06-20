'use client'

import { useState, useEffect, useCallback, useRef, CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Award, Scissors, X, Plus, Eye, Pencil, Trash2, ChevronDown, Users, AlertTriangle, Bell, Search } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

interface KomponenItem   { id: string; nama: string }
interface KelasItem      { id: string; nama: string; jenjang: string; warna: string | null }
interface SiswaResult    { id: string; nama: string; kelas_id: string; kelas_nama: string; kelas_jenjang: string; kelas_warna: string | null }

interface ProgramItem {
  id: string; nama: string; keterangan: string | null
  jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null
  jumlah_komponen: number; jumlah_penerima: number; jumlah_segera_berakhir: number
}

interface AssignRow { siswa_id: string; nama: string; kelas_nama: string; kelas_warna: string | null; berlaku_sampai: string }

interface PotonganRow {
  id: string; beasiswa_id: string; siswa_id: string
  siswa_nama: string; inisial: string; kelas_nama: string; kelas_warna: string | null
  alasan: string | null; jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null
  berlaku_sampai: string | null; status: 'aktif' | 'segera_berakhir' | 'berakhir'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const getInisial = (nama: string) => {
  const p = nama.trim().split(' ').filter(Boolean)
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : nama.slice(0, 2).toUpperCase()
}

const getStatus = (tgl: string | null): 'aktif' | 'segera_berakhir' | 'berakhir' => {
  if (!tgl) return 'aktif'
  const diff = Math.ceil((new Date(tgl).getTime() - Date.now()) / 86400000)
  return diff < 0 ? 'berakhir' : diff <= 7 ? 'segera_berakhir' : 'aktif'
}

const getDays = (tgl: string) => Math.ceil((new Date(tgl).getTime() - Date.now()) / 86400000)

const fRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const fTgl = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BeasiswaPage() {
  const router = useRouter()

  const [loading,     setLoading]     = useState(true)
  const [sekolahId,   setSekolahId]   = useState('')
  const [activeTab,   setActiveTab]   = useState<'program' | 'potongan'>('program')
  const [komponenList, setKomponenList] = useState<KomponenItem[]>([])
  const [kelasList,    setKelasList]    = useState<KelasItem[]>([])

  // Program Beasiswa states
  const [programList,  setProgramList]  = useState<ProgramItem[]>([])
  const [showForm,     setShowForm]     = useState(false)
  const [formClosing,  setFormClosing]  = useState(false)
  const [formSaving,   setFormSaving]   = useState(false)
  const [fNama,        setFNama]        = useState('')
  const [fKet,         setFKet]         = useState('')
  const [fKomponen,    setFKomponen]    = useState<Set<string>>(new Set())
  const [fJenis,       setFJenis]       = useState<'persen' | 'nominal'>('persen')
  const [fBesaran,     setFBesaran]     = useState('')

  // Assign modal states
  const [assignProg,   setAssignProg]   = useState<ProgramItem | null>(null)
  const [assignJenjang, setAssignJenjang] = useState('')
  const [assignSearch, setAssignSearch] = useState('')
  const [assignResults, setAssignResults] = useState<SiswaResult[]>([])
  const [assignRows,   setAssignRows]   = useState<AssignRow[]>([])
  const [assignGlobal, setAssignGlobal] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)

  // Detail modals
  const [detailProg,   setDetailProg]   = useState<ProgramItem | null>(null)
  const [detailPot,    setDetailPot]    = useState<PotonganRow | null>(null)

  // Potongan Personal states
  const [potonganList, setPotonganList] = useState<PotonganRow[]>([])
  const [ptShowForm,   setPtShowForm]   = useState(false)
  const [ptClosing,    setPtClosing]    = useState(false)
  const [ptSaving,     setPtSaving]     = useState(false)
  const [ptJenjang,    setPtJenjang]    = useState('')
  const [ptSearch,     setPtSearch]     = useState('')
  const [ptResults,    setPtResults]    = useState<SiswaResult[]>([])
  const [ptRows,       setPtRows]       = useState<{ siswa: SiswaResult; berlaku_sampai: string }[]>([])
  const [ptAlasan,     setPtAlasan]     = useState('')
  const [ptKomponen,   setPtKomponen]   = useState<Set<string>>(new Set())
  const [ptJenis,      setPtJenis]      = useState<'persen' | 'nominal'>('persen')
  const [ptBesaran,    setPtBesaran]    = useState('')
  const [ptFilter,     setPtFilter]     = useState('Semua')
  const [ptSearchQ,    setPtSearchQ]    = useState('')

  const assignTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ptTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadProgram = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('beasiswa')
      .select('id, nama, keterangan, jenis_potongan, persen, nominal, beasiswa_komponen(komponen_id), beasiswa_siswa(id, berlaku_sampai)')
      .eq('sekolah_id', sid).eq('jenis', 'beasiswa')
      .order('created_at', { ascending: false }).limit(100)

    type Raw = {
      id: string; nama: string; keterangan: string | null
      jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null
      beasiswa_komponen: { komponen_id: string }[]
      beasiswa_siswa: { id: string; berlaku_sampai: string | null }[]
    }
    setProgramList(((data ?? []) as Raw[]).map(r => ({
      id: r.id, nama: r.nama, keterangan: r.keterangan,
      jenis_potongan: r.jenis_potongan, persen: r.persen, nominal: r.nominal,
      jumlah_komponen: r.beasiswa_komponen.length,
      jumlah_penerima: r.beasiswa_siswa.length,
      jumlah_segera_berakhir: r.beasiswa_siswa.filter(s => s.berlaku_sampai && getStatus(s.berlaku_sampai) === 'segera_berakhir').length,
    })))
  }, [])

  const loadPotongan = useCallback(async (sid: string) => {
    const { data: overrides } = await supabase
      .from('beasiswa').select('id, keterangan, jenis_potongan, persen, nominal')
      .eq('sekolah_id', sid).eq('jenis', 'override')
    if (!overrides || overrides.length === 0) { setPotonganList([]); return }

    type OvRaw = { id: string; keterangan: string | null; jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null }
    const ids = overrides.map((o: OvRaw) => o.id)
    const ovMap = new Map((overrides as OvRaw[]).map(o => [o.id, o]))

    const { data: rows } = await supabase
      .from('beasiswa_siswa')
      .select('id, beasiswa_id, berlaku_sampai, siswa:siswa_id(id, nama, kelas:kelas_id(nama, jenjang, warna))')
      .in('beasiswa_id', ids).limit(500)

    type RawRow = {
      id: string; beasiswa_id: string; berlaku_sampai: string | null
      siswa: { id: string; nama: string; kelas: { nama: string; jenjang: string; warna: string | null } | null } | null
    }
    setPotonganList(((rows ?? []) as RawRow[]).filter(r => r.siswa).map(r => {
      const ov = ovMap.get(r.beasiswa_id)!
      return {
        id: r.id, beasiswa_id: r.beasiswa_id, siswa_id: r.siswa!.id,
        siswa_nama: r.siswa!.nama, inisial: getInisial(r.siswa!.nama),
        kelas_nama: r.siswa!.kelas?.nama ?? '—', kelas_warna: r.siswa!.kelas?.warna ?? null,
        alasan: ov.keterangan, jenis_potongan: ov.jenis_potongan, persen: ov.persen, nominal: ov.nominal,
        berlaku_sampai: r.berlaku_sampai, status: getStatus(r.berlaku_sampai),
      }
    }))
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data: pData } = await supabase.from('pengaturan').select('setup_steps').maybeSingle()
      const steps = (pData as { setup_steps?: Record<string, boolean> } | null)?.setup_steps ?? {}
      if (!steps['import_siswa']) { router.replace('/dashboard'); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      const { data: prof } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).single()
      const sid = (prof as { sekolah_id: string } | null)?.sekolah_id ?? ''
      if (!sid) return
      setSekolahId(sid)

      const [{ data: komps }, { data: kelas }] = await Promise.all([
        supabase.from('komponen_tagihan').select('id, nama').eq('sekolah_id', sid).order('nama').limit(100),
        supabase.from('kelas').select('id, nama, jenjang, warna').eq('sekolah_id', sid).order('jenjang').limit(100),
      ])
      const kompArr = (komps ?? []) as KomponenItem[]
      setKomponenList(kompArr)
      setFKomponen(new Set(kompArr.map(k => k.id)))
      setPtKomponen(new Set(kompArr.map(k => k.id)))
      setKelasList((kelas ?? []) as KelasItem[])

      await Promise.all([loadProgram(sid), loadPotongan(sid)])
      setLoading(false)
    })()
  }, [router, loadProgram, loadPotongan])

  // ── Search siswa ──────────────────────────────────────────────────────────

  const doSearch = useCallback(async (q: string, jenjang: string, sid: string, setter: (r: SiswaResult[]) => void) => {
    if (!q) { setter([]); return }
    const { data } = await supabase
      .from('siswa')
      .select('id, nama, kelas:kelas_id(id, nama, jenjang, warna)')
      .eq('sekolah_id', sid).ilike('nama', `%${q}%`).limit(20)

    type RS = { id: string; nama: string; kelas: { id: string; nama: string; jenjang: string; warna: string | null } | null }
    setter(((data ?? []) as RS[])
      .filter(s => s.kelas && (!jenjang || s.kelas.jenjang === jenjang))
      .map(s => ({ id: s.id, nama: s.nama, kelas_id: s.kelas!.id, kelas_nama: s.kelas!.nama, kelas_jenjang: s.kelas!.jenjang, kelas_warna: s.kelas!.warna })))
  }, [])

  // ── Program handlers ──────────────────────────────────────────────────────

  const openForm = () => { setFormClosing(false); setShowForm(true) }
  const closeForm = () => {
    setFormClosing(true)
    setTimeout(() => {
      setShowForm(false); setFormClosing(false)
      setFNama(''); setFKet(''); setFJenis('persen'); setFBesaran('')
      setFKomponen(new Set(komponenList.map(k => k.id)))
    }, 320)
  }

  const saveProgram = async () => {
    if (!fNama.trim()) return
    setFormSaving(true)
    try {
      const { data: prog, error } = await supabase.from('beasiswa').insert({
        sekolah_id: sekolahId, jenis: 'beasiswa', nama: fNama.trim(),
        keterangan: fKet.trim() || null, jenis_potongan: fJenis,
        persen: fJenis === 'persen' ? Number(fBesaran) : null,
        nominal: fJenis === 'nominal' ? Number(fBesaran) : null,
      }).select('id').single()
      if (error || !prog) throw error
      if (fKomponen.size > 0)
        await supabase.from('beasiswa_komponen').insert([...fKomponen].map(kid => ({ beasiswa_id: prog.id, komponen_id: kid })))
      await loadProgram(sekolahId)
      closeForm()
    } finally { setFormSaving(false) }
  }

  // ── Assign handlers ───────────────────────────────────────────────────────

  const uniqueJenjang = [...new Set(kelasList.map(k => k.jenjang).filter(Boolean))]

  const openAssign = (p: ProgramItem) => {
    setAssignProg(p); setAssignJenjang(uniqueJenjang[0] ?? '')
    setAssignSearch(''); setAssignResults([]); setAssignRows([]); setAssignGlobal('')
  }

  const handleAssignSearch = (q: string) => {
    setAssignSearch(q)
    if (assignTimer.current) clearTimeout(assignTimer.current)
    assignTimer.current = setTimeout(() => doSearch(q, assignJenjang, sekolahId, setAssignResults), 280)
  }

  const addToAssign = (s: SiswaResult) => {
    if (assignRows.find(r => r.siswa_id === s.id)) return
    setAssignRows(prev => [...prev, { siswa_id: s.id, nama: s.nama, kelas_nama: s.kelas_nama, kelas_warna: s.kelas_warna, berlaku_sampai: '' }])
    setAssignSearch(''); setAssignResults([])
  }

  const saveAssign = async () => {
    if (!assignProg || assignRows.length === 0) return
    setAssignSaving(true)
    try {
      await supabase.from('beasiswa_siswa').upsert(
        assignRows.map(r => ({ beasiswa_id: assignProg.id, siswa_id: r.siswa_id, berlaku_sampai: r.berlaku_sampai || null })),
        { onConflict: 'beasiswa_id,siswa_id' }
      )
      await loadProgram(sekolahId)
      setAssignProg(null)
    } finally { setAssignSaving(false) }
  }

  // ── Potongan handlers ─────────────────────────────────────────────────────

  const openPtForm = () => { setPtClosing(false); setPtShowForm(true) }
  const closePtForm = () => {
    setPtClosing(true)
    setTimeout(() => {
      setPtShowForm(false); setPtClosing(false)
      setPtJenjang(''); setPtSearch(''); setPtResults([]); setPtRows([])
      setPtAlasan(''); setPtJenis('persen'); setPtBesaran('')
      setPtKomponen(new Set(komponenList.map(k => k.id)))
    }, 320)
  }

  const handlePtSearch = (q: string) => {
    setPtSearch(q)
    if (ptTimer.current) clearTimeout(ptTimer.current)
    ptTimer.current = setTimeout(() => doSearch(q, ptJenjang, sekolahId, setPtResults), 280)
  }

  const addToPt = (s: SiswaResult) => {
    if (ptRows.find(r => r.siswa.id === s.id)) return
    setPtRows(prev => [...prev, { siswa: s, berlaku_sampai: '' }])
    setPtSearch(''); setPtResults([])
  }

  const savePt = async () => {
    if (ptRows.length === 0) return
    setPtSaving(true)
    try {
      const { data: prog, error } = await supabase.from('beasiswa').insert({
        sekolah_id: sekolahId, jenis: 'override', keterangan: ptAlasan.trim() || null,
        jenis_potongan: ptJenis,
        persen: ptJenis === 'persen' ? Number(ptBesaran) : null,
        nominal: ptJenis === 'nominal' ? Number(ptBesaran) : null,
      }).select('id').single()
      if (error || !prog) throw error
      if (ptKomponen.size > 0)
        await supabase.from('beasiswa_komponen').insert([...ptKomponen].map(kid => ({ beasiswa_id: prog.id, komponen_id: kid })))
      await supabase.from('beasiswa_siswa').insert(
        ptRows.map(r => ({ beasiswa_id: prog.id, siswa_id: r.siswa.id, berlaku_sampai: r.berlaku_sampai || null }))
      )
      await loadPotongan(sekolahId)
      closePtForm()
    } finally { setPtSaving(false) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredPot = potonganList.filter(r => {
    const fs = ptFilter === 'Semua' || (ptFilter === 'Aktif' && r.status === 'aktif') || (ptFilter === 'Segera berakhir' && r.status === 'segera_berakhir') || (ptFilter === 'Berakhir' && r.status === 'berakhir')
    return fs && (!ptSearchQ || r.siswa_nama.toLowerCase().includes(ptSearchQ.toLowerCase()))
  })

  const isProgram = activeTab === 'program'

  if (loading) return (
    <div className="dashboard-content">
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Memuat data...</div>
    </div>
  )

  return (
    <div className="dashboard-content">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18,47,102,0.31)' }}>
          <Award size={28} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>Beasiswa</h1>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>Kelola program beasiswa untuk siswa</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'inline-flex', gap: '2rem', marginBottom: '1.5rem' }}>
        {(['program', 'potongan'] as const).map(tab => {
          const label = tab === 'program' ? 'Program Beasiswa' : 'Potongan Personal'
          const active = activeTab === tab
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem 0', fontFamily: 'inherit' }}>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: active ? '#1A2C4E' : '#6F788A', borderBottom: active ? '4px solid #1A2C4E' : '4px solid transparent', paddingBottom: 4, transition: 'all 0.15s' }}>{label}</span>
            </button>
          )
        })}
      </div>

      {/* ══ TAB: PROGRAM BEASISWA ══════════════════════════════════════════ */}
      {isProgram && (
        <>
          {/* Form slide — di luar card utama */}
          <div style={{ display: 'grid', gridTemplateRows: showForm && !formClosing ? '1fr' : '0fr', transition: 'grid-template-rows 0.32s cubic-bezier(0.4,0,0.2,1)' }}>
            <div style={{ overflow: 'hidden', paddingBottom: showForm && !formClosing ? '1.25rem' : 0, transition: 'padding-bottom 0.32s cubic-bezier(0.4,0,0.2,1)' }}>
              {showForm && (
                <div style={sCard}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <label style={sLbl}>Nama program</label>
                      <input value={fNama} onChange={e => setFNama(e.target.value)} placeholder="Contoh: Beasiswa Tahfidz" style={sInp} />
                    </div>
                    <div>
                      <label style={sLbl}>Keterangan <span style={{ fontWeight: 400, color: '#94A3B8' }}>(Opsional)</span></label>
                      <input value={fKet} onChange={e => setFKet(e.target.value)} placeholder="Contoh: Untuk penghapal Quran" style={sInp} />
                    </div>
                  </div>
                  <div style={sDivider} />
                  <KomponenSelector label="Komponen yang dipotong" list={komponenList} selected={fKomponen} onChange={setFKomponen} />
                  <div style={sDivider} />
                  <JenisRow jenis={fJenis} besaran={fBesaran} onJenis={setFJenis} onBesaran={setFBesaran} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button onClick={closeForm} style={sBtnYellow}>Batalkan Pembuatan <X size={15} /></button>
                    <button onClick={saveProgram} disabled={formSaving || !fNama.trim()} style={{ ...sBtnYellow, opacity: !fNama.trim() ? 0.6 : 1 }}>
                      {formSaving ? 'Menyimpan...' : <>Simpan &amp; Lanjutkan →</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Empty state */}
          {programList.length === 0 && !showForm && (
            <div style={{ ...sCard, minHeight: 340, display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                <button onClick={openForm} style={sBtnYellow}>Buat Beasiswa <Image src="/icons/IconEdit2.png" width={18} height={18} alt="edit" /></button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center', marginBottom: -30 }}>
                <Award size={68} strokeWidth={0.9} color="#CBD5E1" style={{ marginBottom: '1rem' }} />
                <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#6F788A', marginBottom: '0.35rem' }}>Belum ada program beasiswa</div>
                <div style={{ fontSize: '1rem', color: '#94A3B8', maxWidth: 290, lineHeight: 1.6 }}>Buat program beasiswa lalu assign ke siswa yang berhak menerimanya</div>
              </div>
            </div>
          )}

          {/* Card utama: header + grid */}
          {programList.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '0.85rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>📁</span>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1A2C4E' }}>{programList.length} program aktif</span>
                </div>
                {!showForm && (
                  <button onClick={openForm} style={{ marginLeft: 'auto', background: '#1A2C4E', color: '#fff', border: 'none', padding: '0.55rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Plus size={14} /> Tambah Program Baru
                  </button>
                )}
              </div>
              {/* Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1.25rem' }}>
                {programList.map(p => (
                  <div key={p.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A2C4E' }}>{p.nama}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Award size={11} /> {p.jenis_potongan === 'persen' ? `${p.persen ?? 0}%` : fRp(p.nominal ?? 0)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={() => setDetailProg(p)} style={sIcon}><Eye size={13} /></button>
                        <button style={sIcon}><Pencil size={13} /></button>
                        <button style={{ ...sIcon, color: '#DC2626', background: '#FEF2F2' }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                      {[
                        { icon: '❖', val: p.jumlah_komponen, label: 'Komponen' },
                        { icon: <Users size={11} />, val: p.jumlah_penerima, label: 'Penerima' },
                        { icon: <AlertTriangle size={11} />, val: p.jumlah_segera_berakhir, label: 'Segera berakhir' },
                      ].map(s => (
                        <div key={s.label} style={{ background: '#DBEAFE', borderRadius: 8, padding: '0.45rem 0.3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#1E40AF' }}>
                            {typeof s.icon === 'string' ? <span style={{ fontSize: '0.7rem' }}>{s.icon}</span> : s.icon}
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1A2C4E' }}>{s.val}</span>
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#3B82F6', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => openAssign(p)} style={{ background: '#F7DD7D', color: '#1A2C4E', border: 'none', borderRadius: 8, padding: '0.55rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Users size={14} /> Assign Siswa
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ TAB: POTONGAN PERSONAL ═════════════════════════════════════════ */}
      {!isProgram && (
        <>
          {potonganList.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ width: 52, height: 52, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Scissors size={22} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A2C4E' }}>Potongan personal</div>
                  <div style={{ fontSize: '0.83rem', color: '#64748B' }}>Berikan potongan kepada siswa yang membutuhkan</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', maxWidth: 400 }}>
                {[
                  { label: 'Potongan aktif', val: potonganList.filter(r => r.status !== 'berakhir').length, icon: <Bell size={16} color="#3B82F6" /> },
                  { label: 'Segera berakhir', val: potonganList.filter(r => r.status === 'segera_berakhir').length, icon: <AlertTriangle size={16} color="#F59E0B" /> },
                ].map(c => (
                  <div key={c.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>{c.label}</div>{c.icon}
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A2C4E', marginTop: '0.25rem' }}>{c.val}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pt form slide */}
          <div style={{ display: 'grid', gridTemplateRows: ptShowForm && !ptClosing ? '1fr' : '0fr', transition: 'grid-template-rows 0.32s cubic-bezier(0.4,0,0.2,1)', marginBottom: ptShowForm && !ptClosing ? '1.25rem' : 0 }}>
            <div style={{ overflow: 'hidden' }}>
              {ptShowForm && (
                <div style={sCard}>
                  {/* Jenjang */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2C4E', marginBottom: '0.2rem' }}>Filter jenjang</div>
                    <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '0.6rem' }}>Pilih jenjang dulu, bisa ganti untuk tambah siswa dari jenjang lain</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {uniqueJenjang.map(j => (
                        <button key={j} onClick={() => { setPtJenjang(j); setPtSearch(''); setPtResults([]) }}
                          style={{ padding: '0.35rem 0.85rem', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: ptJenjang === j ? '#DBEAFE' : '#fff', color: ptJenjang === j ? '#1E40AF' : '#475569', borderColor: ptJenjang === j ? '#93C5FD' : '#CBD5E1', transition: 'all 0.15s' }}>
                          Kelas {j}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SiswaSearchRow search={ptSearch} results={ptResults} onSearch={handlePtSearch} onAdd={addToPt} />
                  {ptRows.length > 0 && (
                    <SiswaTable rows={ptRows.map(r => ({ siswa_id: r.siswa.id, nama: r.siswa.nama, kelas_nama: r.siswa.kelas_nama, kelas_warna: r.siswa.kelas_warna, berlaku_sampai: r.berlaku_sampai }))}
                      onDateChange={(i, v) => setPtRows(prev => prev.map((x, j) => j === i ? { ...x, berlaku_sampai: v } : x))}
                      onRemove={i => setPtRows(prev => prev.filter((_, j) => j !== i))} />
                  )}
                  <div style={sDivider} />
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={sLbl}>Alasan potongan</label>
                    <input value={ptAlasan} onChange={e => setPtAlasan(e.target.value)} placeholder="Contoh: Orang tua meninggal, Pemenang lomba cerdas cermat" style={sInp} />
                  </div>
                  <div style={sDivider} />
                  <KomponenSelector label="Komponen yang dipotong" list={komponenList} selected={ptKomponen} onChange={setPtKomponen} />
                  <div style={sDivider} />
                  <JenisRow jenis={ptJenis} besaran={ptBesaran} onJenis={setPtJenis} onBesaran={setPtBesaran} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button onClick={closePtForm} style={sBtnYellow}>Batalkan Pembuatan <X size={15} /></button>
                    <button onClick={savePt} disabled={ptSaving || ptRows.length === 0} style={{ ...sBtnYellow, opacity: ptRows.length === 0 ? 0.6 : 1 }}>
                      {ptSaving ? 'Menyimpan...' : <>Simpan &amp; Lanjutkan →</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Empty or list */}
          {potonganList.length === 0 && !ptShowForm ? (
            <div style={{ ...sCard, minHeight: 340, display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                <button onClick={openPtForm} style={sBtnYellow}>Tambah Potongan <Image src="/icons/IconEdit2.png" width={18} height={18} alt="edit" /></button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center', marginBottom: -30 }}>
                <Scissors size={68} strokeWidth={0.9} color="#CBD5E1" style={{ marginBottom: '1rem' }} />
                <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#6F788A', marginBottom: '0.35rem' }}>Belum ada potongan personal</div>
                <div style={{ fontSize: '1rem', color: '#94A3B8', maxWidth: 290, lineHeight: 1.6 }}>Tambahkan potongan untuk kondisi mendadak</div>
              </div>
            </div>
          ) : potonganList.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <select value={ptFilter} onChange={e => setPtFilter(e.target.value)}
                  style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#1A2C4E' }}>
                  {['Semua', 'Aktif', 'Segera berakhir', 'Berakhir'].map(f => <option key={f}>{f}</option>)}
                </select>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input value={ptSearchQ} onChange={e => setPtSearchQ(e.target.value)} placeholder="Cari nama siswa" style={{ ...sInp, paddingLeft: '2.2rem', width: 220 }} />
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#1A2C4E', color: '#fff' }}>
                      {['Nama', 'Potongan', 'Kelas', 'Aksi'].map(h => <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPot.map((r, i) => (
                      <tr key={r.id} style={{ borderTop: i > 0 ? '1px solid #F1F5F9' : undefined }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: r.kelas_warna ?? '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', color: '#1A2C4E', flexShrink: 0 }}>{r.inisial}</div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontWeight: 600, color: '#1A2C4E' }}>{r.siswa_nama}</span>
                                {r.status === 'aktif'           && <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '0.68rem', fontWeight: 700, padding: '1px 8px', borderRadius: 20 }}>Aktif</span>}
                                {r.status === 'segera_berakhir' && <span style={{ background: '#FEF3C7', color: '#D97706', fontSize: '0.68rem', fontWeight: 700, padding: '1px 8px', borderRadius: 20 }}>⏱ {getDays(r.berlaku_sampai!)} hari lagi</span>}
                                {r.status === 'berakhir'        && <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: '0.68rem', fontWeight: 700, padding: '1px 8px', borderRadius: 20 }}>Berakhir</span>}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{r.alasan}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: '#1A2C4E' }}>{r.jenis_potongan === 'persen' ? `${r.persen ?? 0}%` : fRp(r.nominal ?? 0)}</div>
                          {r.berlaku_sampai && <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{fTgl(r.berlaku_sampai)}</div>}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ background: r.kelas_warna ?? '#DBEAFE', color: '#1A2C4E', padding: '2px 10px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 700 }}>{r.kelas_nama}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button onClick={() => setDetailPot(r)} style={sIcon}><Eye size={13} /></button>
                            <button style={sIcon}><Pencil size={13} /></button>
                            <button style={{ ...sIcon, color: '#DC2626', background: '#FEF2F2' }}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!ptShowForm && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={openPtForm} style={{ background: '#1A2C4E', color: '#fff', border: 'none', padding: '0.55rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Plus size={14} /> Tambah Potongan Baru
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ══ MODAL: ASSIGN SISWA ═══════════════════════════════════════════ */}
      {assignProg && (
        <Modal onClose={() => setAssignProg(null)}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A2C4E' }}>Assign siswa</div>
                <div style={{ fontSize: '0.82rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>📁 {assignProg.nama}</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
            {/* Jenjang */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2C4E', marginBottom: '0.2rem' }}>Filter jenjang</div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '0.6rem' }}>Pilih jenjang dulu, bisa ganti untuk tambah siswa dari jenjang lain</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {uniqueJenjang.map(j => (
                  <button key={j} onClick={() => { setAssignJenjang(j); setAssignSearch(''); setAssignResults([]) }}
                    style={{ padding: '0.35rem 0.85rem', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: assignJenjang === j ? '#DBEAFE' : '#fff', color: assignJenjang === j ? '#1E40AF' : '#475569', borderColor: assignJenjang === j ? '#93C5FD' : '#CBD5E1' }}>
                    Kelas {j}
                  </button>
                ))}
              </div>
            </div>
            <SiswaSearchRow search={assignSearch} results={assignResults} onSearch={handleAssignSearch} onAdd={addToAssign} />
            {assignRows.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2C4E' }}>Siswa &amp; tanggal berakhir</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {assignRows.length} siswa dipilih</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="date" value={assignGlobal} onChange={e => setAssignGlobal(e.target.value)} style={{ ...sInp, padding: '0.35rem 0.6rem', fontSize: '0.8rem', width: 150 }} />
                    <button onClick={() => setAssignRows(prev => prev.map(r => ({ ...r, berlaku_sampai: assignGlobal })))}
                      style={{ background: '#fff', border: '1.5px solid #1A2C4E', color: '#1A2C4E', borderRadius: 8, padding: '0.4rem 0.85rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      + Samakan Tanggal
                    </button>
                  </div>
                </div>
                <SiswaTable rows={assignRows}
                  onDateChange={(i, v) => setAssignRows(prev => prev.map((x, j) => j === i ? { ...x, berlaku_sampai: v } : x))}
                  onRemove={i => setAssignRows(prev => prev.filter((_, j) => j !== i))} />
              </>
            )}
            <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 5, marginTop: '0.75rem' }}>
              <Bell size={13} /> Notifikasi H-7 dikirimkan otomatis per siswa
            </div>
          </div>
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button onClick={() => setAssignProg(null)} style={{ background: '#fff', border: '1.5px solid #E2E8F0', color: '#475569', borderRadius: 8, padding: '0.55rem 1.25rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
            <button onClick={saveAssign} disabled={assignSaving || assignRows.length === 0} style={{ background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: assignRows.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: assignRows.length === 0 ? 0.6 : 1 }}>
              {assignSaving ? 'Menyimpan...' : 'Simpan Siswa'}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: DETAIL PROGRAM ════════════════════════════════════════ */}
      {detailProg && (
        <Modal onClose={() => setDetailProg(null)} maxWidth={460}>
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A2C4E' }}>{detailProg.nama}</div>
                {detailProg.keterangan && <div style={{ fontSize: '0.83rem', color: '#64748B', marginTop: 2 }}>{detailProg.keterangan}</div>}
              </div>
              <button onClick={() => setDetailProg(null)} style={sBtnX}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
              {[['Komponen', detailProg.jumlah_komponen], ['Penerima', detailProg.jumlah_penerima], ['Segera berakhir', detailProg.jumlah_segera_berakhir]].map(([l, v]) => (
                <div key={String(l)} style={{ background: '#DBEAFE', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1A2C4E' }}>{v}</div>
                  <div style={{ fontSize: '0.68rem', color: '#3B82F6', fontWeight: 600 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '0.25rem' }}>Nilai potongan</div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A2C4E' }}>{detailProg.jenis_potongan === 'persen' ? `${detailProg.persen ?? 0}%` : fRp(detailProg.nominal ?? 0)}</div>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: DETAIL POTONGAN ══════════════════════════════════════ */}
      {detailPot && (
        <Modal onClose={() => setDetailPot(null)} maxWidth={420}>
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: detailPot.kelas_warna ?? '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#1A2C4E' }}>{detailPot.inisial}</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1A2C4E' }}>{detailPot.siswa_nama}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{detailPot.kelas_nama}</div>
                </div>
              </div>
              <button onClick={() => setDetailPot(null)} style={sBtnX}><X size={20} /></button>
            </div>
            {[
              { label: 'Alasan', val: detailPot.alasan ?? '—' },
              { label: 'Potongan', val: detailPot.jenis_potongan === 'persen' ? `${detailPot.persen ?? 0}%` : fRp(detailPot.nominal ?? 0) },
              { label: 'Berlaku sampai', val: detailPot.berlaku_sampai ? fTgl(detailPot.berlaku_sampai) : 'Tidak ada batas' },
              { label: 'Status', val: detailPot.status === 'aktif' ? 'Aktif' : detailPot.status === 'segera_berakhir' ? 'Segera berakhir' : 'Berakhir' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '0.83rem', color: '#64748B' }}>{item.label}</span>
                <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#1A2C4E' }}>{item.val}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Modal({ children, onClose, maxWidth = 640 }: { children: ReactNode; onClose: () => void; maxWidth?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function KomponenSelector({ label, list, selected, onChange }: { label: string; list: KomponenItem[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.6rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2C4E' }}>{label}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => onChange(new Set(list.map(k => k.id)))} style={sBtnOutline}>Pilih Semua</button>
          <button onClick={() => onChange(new Set())} style={{ ...sBtnOutline, background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5' }}>Hapus Semua</button>
        </div>
      </div>
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.75rem 1rem', minHeight: 52, maxHeight: 96, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignContent: 'flex-start' }}>
        {list.map(k => {
          const sel = selected.has(k.id)
          return (
            <button key={k.id} onClick={() => { const n = new Set(selected); if (sel) n.delete(k.id); else n.add(k.id); onChange(n) }}
              style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: sel ? 'none' : '1.5px solid #CBD5E1', background: sel ? '#22C55E' : '#fff', color: sel ? '#fff' : '#475569', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {k.nama}
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '0.4rem' }}>ⓘ {selected.size} dari {list.length} komponen terpilih</div>
    </div>
  )
}

function JenisRow({ jenis, besaran, onJenis, onBesaran }: { jenis: 'persen' | 'nominal'; besaran: string; onJenis: (v: 'persen' | 'nominal') => void; onBesaran: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <div>
        <label style={sLbl}>Jenis potongan</label>
        <div style={{ position: 'relative' }}>
          <select value={jenis} onChange={e => onJenis(e.target.value as 'persen' | 'nominal')} style={{ ...sInp, appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}>
            <option value="persen">Persen (%)</option>
            <option value="nominal">Nominal (Rp)</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748B' }} />
        </div>
      </div>
      <div>
        <label style={sLbl}>Besaran default</label>
        <div style={{ position: 'relative' }}>
          <input type="number" value={besaran} onChange={e => onBesaran(e.target.value)} placeholder="0" style={{ ...sInp, paddingRight: '2.5rem' }} />
          <span style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>{jenis === 'persen' ? '%' : 'Rp'}</span>
        </div>
      </div>
    </div>
  )
}

function highlightText(text: string, query: string): ReactNode {
  if (!query.trim()) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  const matchRe = new RegExp(`^${escaped}$`, 'i')
  return (
    <>
      {parts.map((part, i) =>
        matchRe.test(part)
          ? <span key={i} style={{ color: '#eb2c25', fontWeight: 700 }}>{part}</span>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

function SiswaSearchRow({ search, results, onSearch, onAdd }: { search: string; results: { id: string; nama: string; kelas_nama: string }[]; onSearch: (q: string) => void; onAdd: (s: { id: string; nama: string; kelas_id: string; kelas_nama: string; kelas_jenjang: string; kelas_warna: string | null }) => void }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Cari nama siswa di jenjang ini..." style={{ ...sInp, paddingLeft: '2.2rem' }} />
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 20, maxHeight: 190, overflowY: 'auto' }}>
              {results.map(s => (
                <div key={s.id} onClick={() => onAdd(s as SiswaResult)}
                  style={{ padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <span>{highlightText(s.nama, search)}</span><span style={{ fontSize: '0.75rem', color: '#64748B' }}>{s.kelas_nama}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { if (results.length > 0) onAdd(results[0] as SiswaResult) }}
          style={{ background: '#fff', border: '1.5px solid #1A2C4E', color: '#1A2C4E', borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          + Tambah
        </button>
      </div>
      <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.3rem' }}>ⓘ Ketik minimal 1 huruf untuk melihat hasil pencarian</div>
    </div>
  )
}

function SiswaTable({ rows, onDateChange, onRemove }: {
  rows: { siswa_id: string; nama: string; kelas_nama: string; kelas_warna: string | null; berlaku_sampai: string }[]
  onDateChange: (i: number, v: string) => void
  onRemove: (i: number) => void
}) {
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', marginBottom: '1.25rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: '#1A2C4E', color: '#fff' }}>
            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600 }}>Nama</th>
            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Kelas</th>
            <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Berlaku sampai</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.siswa_id} style={{ borderTop: i > 0 ? '1px solid #F1F5F9' : undefined }}>
              <td style={{ padding: '0.55rem 1rem', fontWeight: 500, color: '#1A2C4E' }}>{r.nama}</td>
              <td style={{ padding: '0.55rem 0.75rem' }}>
                <span style={{ background: r.kelas_warna ?? '#DBEAFE', color: '#1A2C4E', padding: '2px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700 }}>{r.kelas_nama}</span>
              </td>
              <td style={{ padding: '0.55rem 0.75rem' }}>
                <input type="date" value={r.berlaku_sampai} onChange={e => onDateChange(i, e.target.value)} style={{ ...sInp, padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} />
              </td>
              <td style={{ padding: '0.55rem 0.5rem' }}>
                <button onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><X size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const sCard:      CSSProperties = { background: '#fff', border: '1px solid #DBEAFE', borderLeft: '28px solid #1A2C4E', borderRadius: 12, position: 'relative', padding: '1.5rem' }
const sLbl:       CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }
const sInp:       CSSProperties = { width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.55rem 0.85rem', fontSize: '0.875rem', color: '#1A2C4E', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const sDivider:   CSSProperties = { height: 1, background: '#F1F5F9', margin: '0 0 1.25rem' }
const sBtnOutline:CSSProperties = { background: '#fff', border: '1.5px solid #CBD5E1', color: '#475569', borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const sBtnYellow: CSSProperties = { background: '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.55rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }
const sIcon:      CSSProperties = { background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', borderRadius: 6, padding: '0.3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const sBtnX:      CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.25rem', display: 'flex' }
