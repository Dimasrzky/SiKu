'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Pencil, Plus, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Users2, LayoutGrid, BookOpen, Save, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SemesterState {
  ganjil: { mulai: string; selesai: string }
  genap:  { mulai: string; selesai: string }
}

interface TahunAjaranData {
  id:                      string
  nama:                    string
  tanggal_mulai:           string
  tanggal_selesai:         string
  semester_ganjil_mulai:   string
  semester_ganjil_selesai: string
  semester_genap_mulai:    string
  semester_genap_selesai:  string
  diarsipkan_pada:         string | null
  kenaikan_kelas_pada:     string | null
}

interface StatsData {
  totalSiswa:    number
  totalKomponen: number
  totalKelas:    number
}

interface ArsipItem extends TahunAjaranData {
  jumlahSiswa: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_ORDER      = ['profil_sekolah', 'tahun_ajaran', 'komponen_tagihan', 'buat_kelas', 'import_siswa']
const THIS_STEP_INDEX = 1

const TAHUN_AJARAN_OPTIONS = (() => {
  const now  = new Date()
  const year = now.getFullYear()
  const base = now.getMonth() + 1 >= 7 ? year : year - 1
  return Array.from({ length: 5 }, (_, i) => `${base - 1 + i}/${base + i}`)
})()
const DEFAULT_TAHUN_AJARAN = (() => {
  const now  = new Date()
  const year = now.getFullYear()
  const base = now.getMonth() + 1 >= 7 ? year : year - 1
  return `${base}/${base + 1}`
})()

const TA_SELECT = 'id, nama, tanggal_mulai, tanggal_selesai, semester_ganjil_mulai, semester_ganjil_selesai, semester_genap_mulai, semester_genap_selesai, diarsipkan_pada, kenaikan_kelas_pada'

const formatTgl = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcSemesterProgress(mulai: string, selesai: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(mulai); start.setHours(0, 0, 0, 0)
  const end   = new Date(selesai); end.setHours(0, 0, 0, 0)
  if (today > end)    return { pct: 100, status: 'selesai'  as const }
  if (today >= start) {
    const total   = end.getTime() - start.getTime()
    const elapsed = today.getTime() - start.getTime()
    return { pct: Math.round((elapsed / total) * 100), status: 'berjalan' as const }
  }
  return { pct: 0, status: 'belum' as const }
}

type ProgressResult = ReturnType<typeof calcSemesterProgress>

function nextTahunAjaran(current: string): string {
  const parts = current.split('/')
  if (parts.length === 2) {
    const y2 = parseInt(parts[1], 10)
    if (!isNaN(y2)) return `${y2}/${y2 + 1}`
  }
  const year = new Date().getFullYear()
  return `${year}/${year + 1}`
}

function buildOptions(current: string): string[] {
  const next  = nextTahunAjaran(current)
  const parts = next.split('/')
  const base  = parseInt(parts[0], 10)
  if (isNaN(base)) return [next]
  return Array.from({ length: 3 }, (_, i) => `${base + i}/${base + i + 1}`)
}

function SemesterRow({ nama, mulai, selesai, progress }: {
  nama: string; mulai: string; selesai: string; progress: ProgressResult
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {progress.status === 'selesai'  && <Image src="/icons/IconCheckMarkTahun.png" width={32} height={32} alt="Selesai" />}
            {progress.status === 'berjalan' && <Image src="/icons/IconPlayTahun.png"       width={32} height={32} alt="Berjalan" />}
            {progress.status === 'belum'    && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#9CA3AF' }} />}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#6F788A' }}>{nama}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 1 }}>
              {formatTgl(mulai)} – {formatTgl(selesai)}
            </div>
          </div>
        </div>
        {progress.status === 'selesai'  && <span style={{ background: '#1A2C4E', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '3px 12px', marginRight: '1.5rem', borderRadius: 20 }}>Selesai</span>}
        {progress.status === 'berjalan' && <span style={{ background: '#F3F4F6', color: '#374151', fontSize: '0.7rem', fontWeight: 700, padding: '3px 12px', marginRight: '1.5rem', borderRadius: 20 }}>Berjalan</span>}
      </div>
      <div style={{ height: 10, width: '95%', background: '#E5E7EB', borderRadius: 99, overflow: 'hidden', marginLeft: 45, boxShadow: '0 4px 10px rgba(31, 85, 167, 0.27)' }}>
        <div style={{ height: '100%', width: '100%', background: progress.status === 'belum' ? 'transparent' : '#69C183', borderRadius: 99, transformOrigin: 'left', transform: `scaleX(${progress.pct / 100})`, transition: 'transform 0.4s ease' }} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TahunAjaranPage() {
  const router = useRouter()

  const [pageLoading,      setPageLoading]      = useState(true)
  const [setupDone,        setSetupDone]        = useState(false)
  const [setupSteps,       setSetupSteps]       = useState<Record<string, boolean>>({})
  const [taData,           setTaData]           = useState<TahunAjaranData | null>(null)
  const [upcomingData,     setUpcomingData]     = useState<TahunAjaranData | null>(null)
  const [statsData,        setStatsData]        = useState<StatsData>({ totalSiswa: 0, totalKomponen: 0, totalKelas: 0 })
  const [arsipList,        setArsipList]        = useState<ArsipItem[]>([])
  const [showWarningModal, setShowWarningModal] = useState(false)

  // Inline form state (view mode)
  const [showNewForm,    setShowNewForm]    = useState(false)
  const [newFormClosing, setNewFormClosing] = useState(false)
  const [newNamaOpts,    setNewNamaOpts]    = useState<string[]>([])
  const [newNama,        setNewNama]        = useState('')
  const [newMulai,       setNewMulai]       = useState('')
  const [newSelesai,     setNewSelesai]     = useState('')
  const [newSemester,    setNewSemester]    = useState<SemesterState>({ ganjil: { mulai: '', selesai: '' }, genap: { mulai: '', selesai: '' } })
  const [newSaving,      setNewSaving]      = useState(false)
  const [newError,       setNewError]       = useState('')

  // Edit modal state (view mode)
  const [showEditModal,  setShowEditModal]  = useState(false)
  const [editTarget,     setEditTarget]     = useState<'aktif' | 'upcoming'>('aktif')
  const [editRecordId,   setEditRecordId]   = useState('')
  const [editNama,       setEditNama]       = useState('')
  const [editMulai,      setEditMulai]      = useState('')
  const [editSelesai,    setEditSelesai]    = useState('')
  const [editSemester,   setEditSemester]   = useState<SemesterState>({ ganjil: { mulai: '', selesai: '' }, genap: { mulai: '', selesai: '' } })
  const [editSaving,     setEditSaving]     = useState(false)
  const [editError,      setEditError]      = useState('')

  // Setup mode state
  const [nama,     setNama]     = useState(DEFAULT_TAHUN_AJARAN)
  const [mulai,    setMulai]    = useState('')
  const [selesai,  setSelesai]  = useState('')
  const [semester, setSemester] = useState<SemesterState>({
    ganjil: { mulai: '', selesai: '' },
    genap:  { mulai: '', selesai: '' },
  })
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState('')
  const [apiError,         setApiError]         = useState('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [showErrorPopup,   setShowErrorPopup]   = useState(false)

  useEffect(() => {
    ;(async () => {
      const [{ data: pData }, { data: ta }, { data: upcoming }] = await Promise.all([
        supabase.from('pengaturan').select('setup_steps').maybeSingle(),
        supabase.from('tahun_ajaran').select(TA_SELECT).eq('is_aktif', true).maybeSingle(),
        // Mendatang = belum aktif DAN belum diarsipkan. Tanpa filter arsip, tahun ajaran
        // yang sudah lewat ikut terjaring dan justru diaktifkan ulang.
        supabase.from('tahun_ajaran').select(TA_SELECT).eq('is_aktif', false)
          .is('diarsipkan_pada', null)
          .order('tanggal_mulai', { ascending: true }).limit(1).maybeSingle(),
      ])

      const steps = (pData?.setup_steps ?? {}) as Record<string, boolean>
      setSetupSteps(steps)

      if (steps['tahun_ajaran']) {
        setSetupDone(true)
        if (ta) setTaData(ta as TahunAjaranData)

        let upcomingTyped: TahunAjaranData | null = null

        if (upcoming) {
          upcomingTyped = upcoming as TahunAjaranData
          const today     = new Date(); today.setHours(0, 0, 0, 0)
          const startDate = new Date(upcomingTyped.tanggal_mulai); startDate.setHours(0, 0, 0, 0)
          if (startDate <= today) {
            const { data: { session } } = await supabase.auth.getSession()
            await fetch('/api/tahun-ajaran', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
              body: JSON.stringify({ id: upcomingTyped.id }),
            })
            window.location.reload()
            return
          }
          setUpcomingData(upcomingTyped)
        }

        const [
          { count: siswaCount },
          { count: komponenCount },
          { count: kelasCount },
          { data: arsipRaw },
        ] = await Promise.all([
          supabase.from('siswa').select('id', { count: 'exact', head: true }),
          supabase.from('komponen_tagihan').select('id', { count: 'exact', head: true }),
          supabase.from('kelas').select('id', { count: 'exact', head: true }),
          supabase.from('tahun_ajaran').select(TA_SELECT)
            .not('diarsipkan_pada', 'is', null)
            .order('tanggal_mulai', { ascending: false })
            .limit(20),
        ])

        setStatsData({
          totalSiswa:    siswaCount    ?? 0,
          totalKomponen: komponenCount ?? 0,
          totalKelas:    kelasCount    ?? 0,
        })

        // Arsip dan mendatang sudah saling lepas lewat filter diarsipkan_pada di query
        const arsipWithCounts = await Promise.all(
          ((arsipRaw ?? []) as TahunAjaranData[]).map(async (arsip) => {
            const { count } = await supabase
              .from('siswa')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', arsip.tanggal_mulai)
              .lte('created_at', arsip.tanggal_selesai)
            return { ...arsip, jumlahSiswa: count ?? 0 } as ArsipItem
          })
        )

        setArsipList(arsipWithCounts)
      }

      setPageLoading(false)
    })()
  }, [router])

  useEffect(() => {
    if (!showSuccessPopup) return
    const nav = setTimeout(() => router.push('/tagihan/komponen'), 5000)
    return () => clearTimeout(nav)
  }, [showSuccessPopup, router])

  useEffect(() => {
    if (!showErrorPopup) return
    const close = setTimeout(() => setShowErrorPopup(false), 5000)
    return () => clearTimeout(close)
  }, [showErrorPopup])

  // ── Setup mode helpers ────────────────────────────────────────────────────

  function calcSemester(tMulai: string, tSelesai: string): SemesterState | null {
    const d1 = new Date(tMulai).getTime()
    const d2 = new Date(tSelesai).getTime()
    if (!tMulai || !tSelesai || d2 <= d1) return null
    const mid     = new Date(Math.floor((d1 + d2) / 2))
    const midNext = new Date(mid.getTime() + 86400000)
    return {
      ganjil: { mulai: tMulai,                              selesai: mid.toISOString().split('T')[0] },
      genap:  { mulai: midNext.toISOString().split('T')[0], selesai: tSelesai },
    }
  }

  const handleSimpan = async () => {
    setError('')
    if (!nama.trim())         { setError('Nama tahun ajaran wajib diisi.'); return }
    if (!mulai)               { setError('Tanggal mulai wajib diisi.'); return }
    if (!selesai)             { setError('Tanggal selesai wajib diisi.'); return }
    if (new Date(selesai) <= new Date(mulai)) { setError('Tanggal selesai harus setelah tanggal mulai.'); return }
    if (!semester.ganjil.mulai || !semester.ganjil.selesai ||
        !semester.genap.mulai  || !semester.genap.selesai) {
      setError('Pembagian semester belum lengkap.'); return
    }

    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/setup-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        step: 'tahun_ajaran',
        data: {
          nama:                    nama.trim(),
          tanggal_mulai:           mulai,
          tanggal_selesai:         selesai,
          semester_ganjil_mulai:   semester.ganjil.mulai,
          semester_ganjil_selesai: semester.ganjil.selesai,
          semester_genap_mulai:    semester.genap.mulai,
          semester_genap_selesai:  semester.genap.selesai,
        },
      }),
    })

    const json = await res.json() as { error?: string }
    if (!res.ok) { setApiError(json.error ?? 'Gagal menyimpan.'); setShowErrorPopup(true); setSaving(false); return }

    try { localStorage.removeItem('siku_setup_steps') } catch { /* ignore */ }
    setSaving(false)
    setShowSuccessPopup(true)
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat...
        </div>
      </div>
    )
  }

  // ── VIEW MODE ─────────────────────────────────────────────────────────────

  // Setup mode hanya untuk sekolah yang benar-benar belum pernah setup. Begitu langkah
  // tahun ajaran selesai, pembuatan periode berikutnya selalu lewat form "Tambah Ajaran
  // Baru" di view mode — termasuk saat tidak ada tahun ajaran aktif sama sekali.
  if (setupDone) {
    // Tahun ajaran aktif yang tanggal selesainya sudah lewat (inklusif hari terakhir).
    // Belum diarsipkan — pengarsipan baru terjadi saat tahun ajaran baru diaktifkan.
    // Tanpa tahun ajaran aktif, pembuatan yang baru otomatis wajib.
    const berakhir = !taData || (() => {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const end   = new Date(taData.tanggal_selesai); end.setHours(0, 0, 0, 0)
      return end <= today
    })()

    const bukaFormBaru = () => {
      const opts = buildOptions(taData?.nama ?? DEFAULT_TAHUN_AJARAN)
      setNewNamaOpts(opts)
      setNewNama(opts[0] ?? '')
      setShowWarningModal(false)
      setNewFormClosing(false)
      setShowNewForm(true)
    }

    // Setelah periode berakhir, kenaikan kelas wajib dijalankan lebih dulu sebelum
    // tahun ajaran baru boleh dibuat. Syarat `taData` penting: tanpa tahun ajaran aktif
    // tidak ada periode untuk dinaikkan, dan memblokir di situ membuat buntu.
    const tungguKenaikanKelas = berakhir && !!taData && !taData.kenaikan_kelas_pada

    // Kalau tahun ajaran sudah berakhir, membuat yang baru justru diwajibkan —
    // jangan hadang dengan peringatan "belum saatnya".
    const handleTambah = () => {
      if (tungguKenaikanKelas) return
      return berakhir ? bukaFormBaru() : setShowWarningModal(true)
    }

    function calcSemesterNew(tMulai: string, tSelesai: string): SemesterState | null {
      const d1 = new Date(tMulai).getTime()
      const d2 = new Date(tSelesai).getTime()
      if (!tMulai || !tSelesai || d2 <= d1) return null
      const mid     = new Date(Math.floor((d1 + d2) / 2))
      const midNext = new Date(mid.getTime() + 86400000)
      return {
        ganjil: { mulai: tMulai,                              selesai: mid.toISOString().split('T')[0] },
        genap:  { mulai: midNext.toISOString().split('T')[0], selesai: tSelesai },
      }
    }

    const startCloseNewForm = () => {
      setNewFormClosing(true)
      setTimeout(() => {
        setShowNewForm(false)
        setNewFormClosing(false)
        setNewNama('')
        setNewMulai('')
        setNewSelesai('')
        setNewSemester({ ganjil: { mulai: '', selesai: '' }, genap: { mulai: '', selesai: '' } })
        setNewError('')
      }, 400)
    }

    const handleSimpanNew = async () => {
      setNewError('')
      if (!newNama.trim())   { setNewError('Nama tahun ajaran wajib diisi.'); return }
      if (!newMulai)         { setNewError('Tanggal mulai wajib diisi.'); return }
      if (!newSelesai)       { setNewError('Tanggal selesai wajib diisi.'); return }
      if (new Date(newSelesai) <= new Date(newMulai)) { setNewError('Tanggal selesai harus setelah tanggal mulai.'); return }
      if (!newSemester.ganjil.mulai || !newSemester.ganjil.selesai ||
          !newSemester.genap.mulai  || !newSemester.genap.selesai) {
        setNewError('Pembagian semester belum lengkap.'); return
      }
      setNewSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/tahun-ajaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({
          nama:                    newNama.trim(),
          tanggal_mulai:           newMulai,
          tanggal_selesai:         newSelesai,
          semester_ganjil_mulai:   newSemester.ganjil.mulai,
          semester_ganjil_selesai: newSemester.ganjil.selesai,
          semester_genap_mulai:    newSemester.genap.mulai,
          semester_genap_selesai:  newSemester.genap.selesai,
        }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) { setNewError(json.error ?? 'Gagal menyimpan.'); setNewSaving(false); return }
      window.location.reload()
    }

    const openEditModal = (target: 'aktif' | 'upcoming') => {
      const src = target === 'aktif' ? taData : upcomingData
      if (!src) return
      setEditTarget(target)
      setEditRecordId(src.id)
      setEditNama(src.nama)
      setEditMulai(src.tanggal_mulai)
      setEditSelesai(src.tanggal_selesai)
      setEditSemester({
        ganjil: { mulai: src.semester_ganjil_mulai, selesai: src.semester_ganjil_selesai },
        genap:  { mulai: src.semester_genap_mulai,  selesai: src.semester_genap_selesai  },
      })
      setEditError('')
      setShowEditModal(true)
    }

    function calcSemesterEdit(tMulai: string, tSelesai: string): SemesterState | null {
      const d1 = new Date(tMulai).getTime()
      const d2 = new Date(tSelesai).getTime()
      if (!tMulai || !tSelesai || d2 <= d1) return null
      const mid     = new Date(Math.floor((d1 + d2) / 2))
      const midNext = new Date(mid.getTime() + 86400000)
      return {
        ganjil: { mulai: tMulai,                              selesai: mid.toISOString().split('T')[0] },
        genap:  { mulai: midNext.toISOString().split('T')[0], selesai: tSelesai },
      }
    }

    const handleSimpanEdit = async () => {
      setEditError('')
      if (!editNama.trim())   { setEditError('Nama tahun ajaran wajib diisi.'); return }
      if (!editMulai)         { setEditError('Tanggal mulai wajib diisi.'); return }
      if (!editSelesai)       { setEditError('Tanggal selesai wajib diisi.'); return }
      if (new Date(editSelesai) <= new Date(editMulai)) { setEditError('Tanggal selesai harus setelah tanggal mulai.'); return }
      if (!editSemester.ganjil.mulai || !editSemester.ganjil.selesai ||
          !editSemester.genap.mulai  || !editSemester.genap.selesai) {
        setEditError('Pembagian semester belum lengkap.'); return
      }
      setEditSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      let res: Response
      if (editTarget === 'upcoming') {
        res = await fetch('/api/tahun-ajaran', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
          body: JSON.stringify({
            id:                      editRecordId,
            nama:                    editNama.trim(),
            tanggal_mulai:           editMulai,
            tanggal_selesai:         editSelesai,
            semester_ganjil_mulai:   editSemester.ganjil.mulai,
            semester_ganjil_selesai: editSemester.ganjil.selesai,
            semester_genap_mulai:    editSemester.genap.mulai,
            semester_genap_selesai:  editSemester.genap.selesai,
          }),
        })
      } else {
        res = await fetch('/api/setup-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
          body: JSON.stringify({
            step: 'tahun_ajaran',
            data: {
              nama:                    editNama.trim(),
              tanggal_mulai:           editMulai,
              tanggal_selesai:         editSelesai,
              semester_ganjil_mulai:   editSemester.ganjil.mulai,
              semester_ganjil_selesai: editSemester.ganjil.selesai,
              semester_genap_mulai:    editSemester.genap.mulai,
              semester_genap_selesai:  editSemester.genap.selesai,
            },
          }),
        })
      }
      const json = await res.json() as { error?: string }
      if (!res.ok) { setEditError(json.error ?? 'Gagal menyimpan.'); setEditSaving(false); return }
      window.location.reload()
    }

    const daysLeft = upcomingData
      ? Math.ceil((new Date(upcomingData.tanggal_mulai).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))
      : 0

    const ganjilProgress = taData ? calcSemesterProgress(taData.semester_ganjil_mulai, taData.semester_ganjil_selesai) : null
    const genapProgress  = taData ? calcSemesterProgress(taData.semester_genap_mulai,  taData.semester_genap_selesai)  : null

    return (
      <>
      <style>{`
        @keyframes formSlideDown  { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes formSlideUp    { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
        @keyframes modalBackdrop  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalCard      { from { opacity: 0; transform: scale(0.88) translateY(24px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
      <div className="dashboard-content">

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 56, height: 56, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '2px 3px 10px rgba(18, 47, 102, 0.54)' }}>
              <Image src="/icons/IconCalender.png" width={30} height={30} alt="Kalender" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-dark)', margin: 0, lineHeight: 1.1, fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                Tahun Ajaran
              </h1>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                Kelola periode aktif
              </p>
            </div>
          </div>
          {!upcomingData && !showNewForm && (
            <button onClick={handleTambah}
              disabled={tungguKenaikanKelas}
              title={tungguKenaikanKelas ? 'Jalankan proses kenaikan kelas dulu sebelum membuat tahun ajaran baru' : undefined}
              style={{
                ...sBtnPrimary,
                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', padding: '0.6rem 1.25rem',
                ...(tungguKenaikanKelas && { opacity: 0.45, filter: 'grayscale(1)', cursor: 'not-allowed' }),
              }}>
              <Plus size={15} /> Tambah Ajaran Baru
            </button>
          )}
        </div>

        {/* ── Banner wajib buat tahun ajaran baru ── */}
        {berakhir && !upcomingData && !showNewForm && (
          <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={20} color="#D97706" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#92400E' }}>
                {taData
                  ? `Tahun ajaran ${taData.nama.replace('/', ' / ')} telah berakhir`
                  : 'Belum ada tahun ajaran aktif'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#B45309', marginTop: 2, lineHeight: 1.5 }}>
                {!taData
                  ? 'Tagihan, paket kelas, dan laporan butuh tahun ajaran aktif. Buat tahun ajaran baru untuk melanjutkan.'
                  : taData.kenaikan_kelas_pada
                    ? 'Kenaikan kelas sudah dijalankan. Buat tahun ajaran baru untuk memindahkan periode ini ke Riwayat.'
                    : 'Proses kenaikan kelas dulu, lalu buat tahun ajaran baru. Periode ini pindah ke Riwayat begitu yang baru diaktifkan.'}
              </div>
            </div>
            {taData && !taData.kenaikan_kelas_pada && (
              <a href="/siswa/naik-kelas"
                style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                Kenaikan Kelas <ChevronRight size={14} />
              </a>
            )}
          </div>
        )}

        {/* ── Inline Form Tambah Tahun Ajaran ── */}
        <div style={{
          display: 'grid',
          gridTemplateRows: showNewForm && !newFormClosing ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.38s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <div style={{ overflow: 'hidden', paddingBottom: showNewForm && !newFormClosing ? '1.5rem' : 0, transition: 'padding-bottom 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
            {showNewForm && (
              <div style={{ animation: newFormClosing ? 'formSlideUp 0.26s cubic-bezier(0.22,1,0.36,1) forwards' : 'formSlideDown 0.3s cubic-bezier(0.22,1,0.36,1)' }}>
                <div style={{ background: '#fff', borderLeft: '30px solid #1A2C4E', borderRadius: 16, padding: '1.5rem 1.75rem', boxShadow: '0 0 20px rgba(26, 44, 78, 0.15)' }}>

                  {/* Form header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--navy-dark)' }}>Tambah Tahun Ajaran Baru</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>Akan diset sebagai tahun ajaran mendatang</div>
                    </div>
                  </div>

                  {newError && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#DC2626' }}>
                      {newError}
                    </div>
                  )}

                  {/* Baris atas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <label style={sLabel}>Nama tahun ajaran</label>
                      <select value={newNama} onChange={e => setNewNama(e.target.value)}
                        style={{ ...sInput, appearance: 'auto', cursor: 'pointer', fontSize: '1rem', fontWeight: '500', height: 50 }}
                        className="custom-select">
                        {newNamaOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={sLabel}>Tanggal mulai</label>
                      <div style={{ position: 'relative' }}>
                        <input type="date" value={newMulai}
                          onChange={e => { setNewMulai(e.target.value); const c = calcSemesterNew(e.target.value, newSelesai); if (c) setNewSemester(c) }}
                          style={{ ...sInput, paddingRight: '2.5rem', fontSize: '1rem', fontWeight: '500', color: newMulai ? 'var(--text-dark)' : '#6F788A' }}
                          className="custom-date-input" />
                        <Image src="/icons/IconDate2.png" width={20} height={20} alt="Kalender" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      </div>
                    </div>
                    <div>
                      <label style={sLabel}>Tanggal selesai</label>
                      <div style={{ position: 'relative' }}>
                        <input type="date" value={newSelesai}
                          onChange={e => { setNewSelesai(e.target.value); const c = calcSemesterNew(newMulai, e.target.value); if (c) setNewSemester(c) }}
                          style={{ ...sInput, paddingRight: '2.5rem', fontSize: '1rem', fontWeight: '500', color: newSelesai ? 'var(--text-dark)' : '#6F788A' }}
                          className="custom-date-input" />
                        <Image src="/icons/IconDate2.png" width={20} height={20} alt="Kalender" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      </div>
                    </div>
                  </div>

                  {/* Pembagian semester */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ ...sLabel, marginBottom: 0 }}>Pembagian semester</label>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Otomatis dan dapat diedit</span>
                    </div>
                    {(!newMulai || !newSelesai || new Date(newSelesai) <= new Date(newMulai)) ? (
                      <div style={{ border: '3px solid #BABFC7', borderRadius: 15, padding: '2rem', textAlign: 'center', color: '#6F788A', display: 'flex', flexDirection: 'column', fontWeight: 600, fontSize: '0.9rem', alignItems: 'center', gap: '1.6rem', boxShadow: '0 0 12px rgba(31, 85, 167, 0.58)' }}>
                        <Image src="/icons/IconNotDate.png" width={65} height={65} alt="Belum ada tanggal" />
                        <span style={{ fontSize: '0.875rem' }}>Isi tanggal mulai &amp; selesai untuk melihat pembagian semester</span>
                      </div>
                    ) : (
                      <div style={{ border: '2px solid #6F788A', borderRadius: 10, overflow: 'hidden', boxShadow: '0 0 12px #BABFC7' }}>
                        {/* Semester Ganjil */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem 1.25rem', borderBottom: '3px solid #C1C6CF', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy-dark)', whiteSpace: 'nowrap' }}>Semester Ganjil</span>
                          </div>
                          <div>
                            <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A', marginLeft: '5.3rem', transform: 'translateX(60px)' }}>Mulai</label>
                            <div style={{ position: 'relative', marginLeft: '5rem' }}>
                              <input type="date" value={newSemester.ganjil.mulai}
                                onChange={e => setNewSemester(s => ({ ...s, ganjil: { ...s.ganjil, mulai: e.target.value } }))}
                                style={{ ...sInput, fontSize: '1rem', fontWeight: '500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10, transform: 'translateX(60px)' }}
                                className="custom-date-input" />
                              <Image src="/icons/IconEdit.png" width={20} height={20} alt="" style={{ position: 'absolute', right: -40, top: '50%', transform: 'translateY(-10px)', pointerEvents: 'none' }} />
                            </div>
                          </div>
                          <div>
                            <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A', marginLeft: '5.3rem' }}>Selesai</label>
                            <div style={{ position: 'relative', marginLeft: '5rem' }}>
                              <input type="date" value={newSemester.ganjil.selesai}
                                onChange={e => setNewSemester(s => ({ ...s, ganjil: { ...s.ganjil, selesai: e.target.value } }))}
                                style={{ ...sInput, fontSize: '1rem', fontWeight: '500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10 }}
                                className="custom-date-input" />
                              <Image src="/icons/IconEdit.png" width={20} height={20} alt="" style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-10px)', pointerEvents: 'none' }} />
                            </div>
                          </div>
                        </div>
                        {/* Semester Genap */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem 1.25rem', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy-dark)', whiteSpace: 'nowrap' }}>Semester Genap</span>
                          </div>
                          <div>
                            <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A', marginLeft: '5.3rem', transform: 'translateX(60px)' }}>Mulai</label>
                            <div style={{ position: 'relative', marginLeft: '5rem' }}>
                              <input type="date" value={newSemester.genap.mulai}
                                onChange={e => setNewSemester(s => ({ ...s, genap: { ...s.genap, mulai: e.target.value } }))}
                                style={{ ...sInput, fontSize: '1rem', fontWeight: '500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10, transform: 'translateX(60px)' }}
                                className="custom-date-input" />
                              <Image src="/icons/IconEdit.png" width={20} height={20} alt="" style={{ position: 'absolute', right: -40, top: '50%', transform: 'translateY(-10px)', pointerEvents: 'none' }} />
                            </div>
                          </div>
                          <div>
                            <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A', marginLeft: '5rem' }}>Selesai</label>
                            <div style={{ position: 'relative', marginLeft: '5rem' }}>
                              <input type="date" value={newSemester.genap.selesai}
                                onChange={e => setNewSemester(s => ({ ...s, genap: { ...s.genap, selesai: e.target.value } }))}
                                style={{ ...sInput, fontSize: '1rem', fontWeight: '500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10 }}
                                className="custom-date-input" />
                              <Image src="/icons/IconEdit.png" width={20} height={20} alt="" style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-10px)', pointerEvents: 'none' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={startCloseNewForm}
                      style={{ ...sBtnSecondary, padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Image src="/icons/IconsXCircle.png" width={16} height={16} alt="" /> Batalkan Pembuatan
                    </button>
                    <button onClick={handleSimpanNew} disabled={newSaving}
                      style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', gap: 6, opacity: newSaving ? 0.6 : 1 }}>
                      <Save size={14} /> {newSaving ? 'Menyimpan...' : 'Simpan Ajaran Baru'}
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Card Aktif ── */}
        {taData && ganjilProgress && genapProgress && (
        <div style={{ background: '#fff', borderLeft: '30px solid #1A2C4E', borderRadius: 16, overflow: 'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom: '2rem' }}>

          {/* Header card */}
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 70, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Image src="/icons/IconWaktu.png" width={26} height={26} alt="Waktu" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1.2 }}>
                    {taData.nama.replace('/', ' / ')}
                  </div>
                  {berakhir ? (
                    <span style={{ background: '#FEF3C7', border: '2.5px solid #FDE68A', color: '#92400E', fontSize: '0.75rem', fontWeight: 700, padding: '1px 14px', borderRadius: 20 }}>
                      Telah berakhir
                    </span>
                  ) : (
                    <span style={{ background: '#69C183', border: '2.5px solid #C1E6CC', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, padding: '1px 14px', borderRadius: 20 }}>
                      Aktif
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>
                  {formatTgl(taData.tanggal_mulai)} – {formatTgl(taData.tanggal_selesai)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Periode yang sudah berakhir tidak boleh diubah lagi — tanggalnya
                  sudah dipakai sebagai dasar tagihan dan proses kenaikan kelas */}
              <button onClick={() => openEditModal('aktif')}
                disabled={berakhir}
                title={berakhir ? 'Tahun ajaran sudah berakhir dan tidak bisa diubah lagi' : undefined}
                style={{
                  ...sBtnSecondary,
                  display: 'flex', alignItems: 'center', gap: 15, fontSize: '0.9rem', fontWeight: 800, padding: '0.5rem 1rem',
                  ...(berakhir && { opacity: 0.45, filter: 'grayscale(1)', cursor: 'not-allowed', boxShadow: 'none' }),
                }}>
                 Edit <Image src="/icons/IconEdit2.png" width={18} height={18} alt="Arrow" />
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', gap: '0.5rem' }}>
            <div style={sStatCard}>
              <div>
                <div style={sStatLabel}>Total siswa</div>
                <div style={sStatValue}>{statsData.totalSiswa}</div>
              </div>
              <Users2 size={22} color="#1A2C4E" />
            </div>
            <div style={sStatCard}>
              <div>
                <div style={sStatLabel}>Komponen tagihan</div>
                <div style={sStatValue}>{statsData.totalKomponen}</div>
              </div>
              <LayoutGrid size={22} color="#1A2C4E" />
            </div>
            <div style={sStatCard}>
              <div>
                <div style={sStatLabel}>Total kelas</div>
                <div style={sStatValue}>{statsData.totalKelas}</div>
              </div>
              <BookOpen size={22} color="#1A2C4E" />
            </div>
          </div>

          <div style={{ padding: '0 1.5rem' }}>
            <div style={{ height: 1.5, background: '#C1C6CF', width: '100%' }} />
          </div>

          {/* Pembagian semester */}
          <div style={{ padding: '1.25rem 1.5rem 2.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--navy-dark)', marginBottom: '1.25rem' }}>
              Pembagian semester
            </div>
            <SemesterRow
              nama="Semester ganjil"
              mulai={taData.semester_ganjil_mulai}
              selesai={taData.semester_ganjil_selesai}
              progress={ganjilProgress}
            />
            <div style={{ height: 2, background: '#C1C6CF', margin: '1rem 0', marginBottom: '1rem', marginTop:'2rem' }} />
            <SemesterRow
              nama="Semester genap"
              mulai={taData.semester_genap_mulai}
              selesai={taData.semester_genap_selesai}
              progress={genapProgress}
            />
          </div>

        </div>
        )}

        {/* ── Card Upcoming ── */}
        {upcomingData && (
          <div style={{ marginTop: '1rem', background: '#fff', border: '1.5px dashed #94A3B8', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 48, height: 48, background: '#334155', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Image src="/icons/IconCalender.png" width={26} height={26} alt="Kalender" />
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 3 }}>TAHUN AJARAN MENDATANG</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1.2 }}>
                    {upcomingData.nama.replace('/', ' / ')}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatTgl(upcomingData.tanggal_mulai)} – {formatTgl(upcomingData.tanggal_selesai)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>
                  {daysLeft > 0 ? `Aktif dalam ${daysLeft} hari` : 'Menunggu Aktivasi'}
                </span>
                <button onClick={() => openEditModal('upcoming')}
                  style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', padding: '0.45rem 1rem' }}>
                  <Pencil size={13} /> Edit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Card Arsip ── */}
        <div style={{ marginTop: '1rem', marginBottom: '1.5rem', background: '#fff', borderLeft: '30px solid #1A2C4E', borderRadius: 16, overflow: 'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.07)'}}>
          <div style={{ padding: '1rem 1.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--navy-dark)' }}>Riwayat tahun ajaran</span>
          </div>
          {arsipList.length === 0 ? (
            <div style={{ padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
              <Image src="/icons/JamAbu.png" width={48} height={48} alt="" />
              Belum ada riwayat tahun ajaran
            </div>
          ) : (
            arsipList.map((arsip, i) => (
              <div key={arsip.id}
                onClick={() => router.push(`/tagihan/tahun-ajaran/arsip/${arsip.id}`)}
                style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < arsipList.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{ width: 36, height: 36, background: '#1A2C4E', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Image src="/icons/IconCalender.png" width={20} height={20} alt="Arsip" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy-dark)' }}>
                        {arsip.nama.replace('/', ' / ')}
                      </span>
                      <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '0.65rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
                        Diarsipkan
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatTgl(arsip.tanggal_mulai)} – {formatTgl(arsip.tanggal_selesai)}
                      {' · '}
                      <span style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{arsip.jumlahSiswa} siswa</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} color="#94A3B8" />
              </div>
            ))
          )}
        </div>

        {/* ── Modal Edit ── */}
        {showEditModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', animation: 'modalBackdrop 0.2s ease', overflowY: 'auto' }}
            onClick={e => { if (e.target === e.currentTarget) setShowEditModal(false) }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 700, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)', margin: 'auto' }}>

              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 40, height: 40, background: '#1A2C4E', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Image src="/icons/IconWaktu.png" width={20} height={20} alt="" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--navy-dark)' }}>
                      {editTarget === 'aktif' ? 'Edit Tahun Ajaran' : 'Edit Tahun Ajaran Mendatang'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                      {editNama.replace('/', ' / ')}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowEditModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Modal body */}
              <div style={{ padding: '1.5rem 1.75rem' }}>

                {editError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#DC2626' }}>
                    {editError}
                  </div>
                )}

                {/* Baris atas */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={sLabel}>Nama tahun ajaran</label>
                    <select value={editNama} onChange={e => setEditNama(e.target.value)}
                      style={{ ...sInput, appearance: 'auto', cursor: 'pointer', fontSize: '1rem', fontWeight: '500', height: 50 }}
                      className="custom-select">
                      {TAHUN_AJARAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={sLabel}>Tanggal mulai</label>
                    <div style={{ position: 'relative' }}>
                      <input type="date" value={editMulai}
                        onChange={e => { setEditMulai(e.target.value); const c = calcSemesterEdit(e.target.value, editSelesai); if (c) setEditSemester(c) }}
                        style={{ ...sInput, paddingRight: '2.5rem', fontSize: '1rem', fontWeight: '500', color: editMulai ? 'var(--text-dark)' : '#6F788A' }}
                        className="custom-date-input" />
                      <Image src="/icons/IconDate2.png" width={20} height={20} alt="" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <label style={sLabel}>Tanggal selesai</label>
                    <div style={{ position: 'relative' }}>
                      <input type="date" value={editSelesai}
                        onChange={e => { setEditSelesai(e.target.value); const c = calcSemesterEdit(editMulai, e.target.value); if (c) setEditSemester(c) }}
                        style={{ ...sInput, paddingRight: '2.5rem', fontSize: '1rem', fontWeight: '500', color: editSelesai ? 'var(--text-dark)' : '#6F788A' }}
                        className="custom-date-input" />
                      <Image src="/icons/IconDate2.png" width={20} height={20} alt="" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                  </div>
                </div>

                {/* Pembagian semester */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ ...sLabel, marginBottom: 0 }}>Pembagian semester</label>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Otomatis dan dapat diedit</span>
                  </div>
                  {(!editMulai || !editSelesai || new Date(editSelesai) <= new Date(editMulai)) ? (
                    <div style={{ border: '3px solid #BABFC7', borderRadius: 15, padding: '2rem', textAlign: 'center', color: '#6F788A', display: 'flex', flexDirection: 'column', fontWeight: 600, alignItems: 'center', gap: '1.6rem', boxShadow: '0 0 12px rgba(31, 85, 167, 0.58)' }}>
                      <Image src="/icons/IconNotDate.png" width={65} height={65} alt="" />
                      <span style={{ fontSize: '0.875rem' }}>Isi tanggal mulai &amp; selesai untuk melihat pembagian semester</span>
                    </div>
                  ) : (
                    <div style={{ border: '2px solid #6F788A', borderRadius: 10, overflow: 'hidden', boxShadow: '0 0 12px #BABFC7' }}>
                      {/* Semester Ganjil */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem 1.25rem', borderBottom: '3px solid #C1C6CF', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy-dark)', whiteSpace: 'nowrap' }}>Semester Ganjil</span>
                        <div>
                          <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A' }}>Mulai</label>
                          <div style={{ position: 'relative' }}>
                            <input type="date" value={editSemester.ganjil.mulai}
                              onChange={e => setEditSemester(s => ({ ...s, ganjil: { ...s.ganjil, mulai: e.target.value } }))}
                              style={{ ...sInput, fontSize: '0.875rem', fontWeight: '500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10, paddingRight: '2.5rem' }}
                              className="custom-date-input" />
                            <Image src="/icons/IconEdit.png" width={18} height={18} alt="" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A' }}>Selesai</label>
                          <div style={{ position: 'relative' }}>
                            <input type="date" value={editSemester.ganjil.selesai}
                              onChange={e => setEditSemester(s => ({ ...s, ganjil: { ...s.ganjil, selesai: e.target.value } }))}
                              style={{ ...sInput, fontSize: '0.875rem', fontWeight: '500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10, paddingRight: '2.5rem' }}
                              className="custom-date-input" />
                            <Image src="/icons/IconEdit.png" width={18} height={18} alt="" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                          </div>
                        </div>
                      </div>
                      {/* Semester Genap */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem 1.25rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy-dark)', whiteSpace: 'nowrap' }}>Semester Genap</span>
                        <div>
                          <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A' }}>Mulai</label>
                          <div style={{ position: 'relative' }}>
                            <input type="date" value={editSemester.genap.mulai}
                              onChange={e => setEditSemester(s => ({ ...s, genap: { ...s.genap, mulai: e.target.value } }))}
                              style={{ ...sInput, fontSize: '0.875rem', fontWeight: '500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10, paddingRight: '2.5rem' }}
                              className="custom-date-input" />
                            <Image src="/icons/IconEdit.png" width={18} height={18} alt="" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A' }}>Selesai</label>
                          <div style={{ position: 'relative' }}>
                            <input type="date" value={editSemester.genap.selesai}
                              onChange={e => setEditSemester(s => ({ ...s, genap: { ...s.genap, selesai: e.target.value } }))}
                              style={{ ...sInput, fontSize: '0.875rem', fontWeight: '500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10, paddingRight: '2.5rem' }}
                              className="custom-date-input" />
                            <Image src="/icons/IconEdit.png" width={18} height={18} alt="" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Modal footer */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1rem 1.75rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setShowEditModal(false)}
                  style={{ ...sBtnSecondary, padding: '0.55rem 1.25rem' }}>
                  Batal
                </button>
                <button onClick={handleSimpanEdit} disabled={editSaving}
                  style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', gap: 6, opacity: editSaving ? 0.6 : 1 }}>
                  <Save size={14} /> {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ── Modal Peringatan ── */}
        {showWarningModal && taData && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', animation: 'modalBackdrop 0.2s ease' }}
            onClick={e => { if (e.target === e.currentTarget) setShowWarningModal(false) }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={20} color="#D97706" />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--navy-dark)', lineHeight: 1.3 }}>
                    Belum saatnya buat tahun ajaran baru
                  </h2>
                </div>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-mid)', lineHeight: 1.6, margin: '0 0 0.5rem' }}>
                Tahun ajaran <strong>{taData.nama}</strong> baru berakhir pada{' '}
                <strong>{formatTgl(taData.tanggal_selesai)}</strong>.
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-mid)', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                Waktu ideal untuk membuat tahun ajaran baru adalah <strong>H-2 minggu</strong> sebelum tahun ajaran aktif berakhir. Apakah Anda yakin ingin membuatnya sekarang?
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setShowWarningModal(false)}
                  style={{ ...sBtnSecondary, flex: 1, textAlign: 'center' }}>
                  Batal
                </button>
                <button onClick={bukaFormBaru}
                  style={{ ...sBtnPrimary, flex: 1, textAlign: 'center' }}>
                  Buat Tetap
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      </>
    )
  }

  // ── SETUP MODE ────────────────────────────────────────────────────────────

  const completedBefore = STEP_ORDER.slice(0, THIS_STEP_INDEX).filter(k => setupSteps[k]).length
  const greenCount      = completedBefore + 1
  const hasDates        = !!mulai && !!selesai && new Date(selesai) > new Date(mulai)

  return (
    <>
    <style>{`
      @keyframes dot-blink {
        0%, 100% { background-color: #69C183; }
        50%       { background-color: #CBD5E1; }
      }
      .dot-active { animation: dot-blink 1.8s ease-in-out infinite; }
      @keyframes popupBackdrop {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes popupCard {
        from { opacity: 0; transform: scale(0.88) translateY(20px); }
        to   { opacity: 1; transform: scale(1)    translateY(0);    }
      }
      @keyframes popupBar {
        from { width: 100%; }
        to   { width: 0%;   }
      }
    `}</style>
    <div className="dashboard-content">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)' }}>
            <Image src="/icons/IconCalender.png" width={35} height={35} alt="Kalender" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>
              Atur tahun ajaran
            </h1>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>Langkah 2 dari 5</p>
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
          Tahun ajaran adalah fondasi dari semua tagihan di SiKu. Isi periode di bawah
          lalu sistem akan <br />otomatis membagi semester Ganjil dan Genap.
        </p>
        <div style={{ flexShrink: 0, marginLeft: 'auto', width: 40, height: 40, background: '#F7DD7D', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', top: '-0.4rem', right: '-0.65rem' }}>
          <Image src="/icons/IconTSeru.png" width={3.5} height={3.5} alt="Info" style={{ display: 'block' }} />
        </div>
      </div>

      {/* Card Form */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderLeft: '30px solid var(--navy)', borderRadius: 12, padding: '1.5rem 1.75rem', boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)' }}>

        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '0.65rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#DC2626' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={sLabel}>Nama tahun ajaran</label>
            <select value={nama} onChange={e => setNama(e.target.value)} style={{ ...sInput, appearance: 'auto', cursor: 'pointer', fontSize: '1rem', fontWeight:'500', height: 50 }} className="custom-select">
              {TAHUN_AJARAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label style={sLabel}>Tanggal mulai</label>
            <div style={{ position: 'relative' }}>
              <input type="date" value={mulai} onChange={e => { setMulai(e.target.value); const c = calcSemester(e.target.value, selesai); if (c) setSemester(c) }} style={{ ...sInput, paddingRight: '2.5rem', fontSize: '1rem', fontWeight:'500', color: mulai ? 'var(--text-dark)' : '#6F788A' }} className="custom-date-input" />
              <Image src="/icons/IconDate2.png" width={20} height={20} alt="Kalender" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
          <div>
            <label style={sLabel}>Tanggal selesai</label>
            <div style={{ position: 'relative' }}>
              <input type="date" value={selesai} onChange={e => { setSelesai(e.target.value); const c = calcSemester(mulai, e.target.value); if (c) setSemester(c) }} style={{ ...sInput, paddingRight: '2.5rem', fontSize: '1rem', fontWeight:'500', color: selesai ? 'var(--text-dark)' : '#6F788A' }} className="custom-date-input" />
              <Image src="/icons/IconDate2.png" width={20} height={20} alt="Kalender" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ ...sLabel, marginBottom: 0 }}>Pembagian semester</label>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Otomatis dan dapat diedit</span>
          </div>

          {!hasDates ? (
            <div style={{ border: '3px solid #BABFC7', borderRadius: 15, padding: '2rem', textAlign: 'center', color: '#6F788A', display: 'flex', flexDirection: 'column', fontWeight: 600, fontSize: '0.9rem', alignItems: 'center', gap: '1.6rem', boxShadow: '0 0 12px rgba(31, 85, 167, 0.58)' }}>
              <Image src="/icons/IconNotDate.png" width={65} height={65} alt="Belum ada tanggal" />
              <span style={{ fontSize: '0.875rem' }}>Isi tanggal mulai &amp; selesai untuk melihat pembagian semester</span>
            </div>
          ) : (
            <div style={{ border: '2px solid #6F788A', borderRadius: 10, overflow: 'hidden', boxShadow: '0 0 12px #BABFC7' }}>
              {/* Semester Ganjil */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem 1.25rem', borderBottom: '3px solid #C1C6CF', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--navy-dark)' }}>Semester Ganjil</span>
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A', marginLeft: '5.3rem', transform: 'translateX(60px)' }}>Mulai</label>
                  <div style={{ position: 'relative', marginLeft: '5rem' }}>
                    <input type="date" value={semester.ganjil.mulai} onChange={e => setSemester(s => ({ ...s, ganjil: { ...s.ganjil, mulai: e.target.value } }))} style={{ ...sInput, fontSize: '1rem', fontWeight:'500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10, transform: 'translateX(60px)' }} className="custom-date-input" />
                    <Image src="/icons/IconEdit.png" width={20} height={20} alt="Kalender" style={{ position: 'absolute', right: -40, top: '50%', transform: 'translateY(-10px)', pointerEvents: 'none', }} />
                  </div>
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A', marginLeft: '5.3rem' }}>Selesai</label>
                  <div style={{ position: 'relative', marginLeft: '5rem' }}>
                    <input type="date" value={semester.ganjil.selesai} onChange={e => setSemester(s => ({ ...s, ganjil: { ...s.ganjil, selesai: e.target.value } }))} style={{ ...sInput, fontSize: '1rem', fontWeight:'500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10 }} className="custom-date-input" />
                    <Image src="/icons/IconEdit.png" width={20} height={20} alt="Kalender" style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-10px)', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
              {/* Semester Genap */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem 1.25rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--navy-dark)' }}>Semester Genap</span>
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A', marginLeft: '5.3rem', transform: 'translateX(60px)' }}>Mulai</label>
                  <div style={{ position: 'relative', marginLeft: '5rem' }}>
                    <input type="date" value={semester.genap.mulai} onChange={e => setSemester(s => ({ ...s, genap: { ...s.genap, mulai: e.target.value } }))} style={{ ...sInput, fontSize: '1rem', fontWeight:'500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10, transform: 'translateX(60px)' }} className="custom-date-input" />
                    <Image src="/icons/IconEdit.png" width={20} height={20} alt="Kalender" style={{ position: 'absolute', right: -40, top: '50%', transform: 'translateY(-10px)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A', marginLeft: '5rem' }}>Selesai</label>
                  <div style={{ position: 'relative', marginLeft: '5rem' }}>
                    <input type="date" value={semester.genap.selesai} onChange={e => setSemester(s => ({ ...s, genap: { ...s.genap, selesai: e.target.value } }))} style={{ ...sInput, fontSize: '1rem', fontWeight:'500', color: '#1A2C4E', backgroundColor: '#FFFFFF', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: '2px solid #1A2C4E', borderRadius: 10 }} className="custom-date-input" />
                    <Image src="/icons/IconEdit.png" width={20} height={20} alt="Kalender" style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-10px)', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0, position: 'relative', top: '-2rem', fontWeight: 500 }}>
            <span style={{ fontWeight: 700 }}>ⓘ</span>{' '}
            Tahun ajaran ini akan langsung diset sebagai aktif karena ini setup pertama.
          </p>
          <button onClick={handleSimpan} disabled={saving}
            style={{ flexShrink: 0, background: saving ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.7rem 1.5rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'background 0.15s', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', marginTop: '2.2rem' }}>
            {saving ? 'Menyimpan...' : 'Simpan & Lanjutkan →'}
          </button>
        </div>

      </div>
    </div>

    {showSuccessPopup && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'popupBackdrop 0.2s ease' }}>
        <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', textAlign: 'center', overflow: 'hidden', animation: 'popupCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div style={{ padding: '2rem 1.75rem 1.5rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <CheckCircle2 size={32} color="#059669" />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.5rem' }}>Berhasil Disimpan!</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>Tahun ajaran berhasil disimpan.</p>
            <button onClick={() => router.push('/tagihan/komponen')} style={{ ...sBtnPrimary, width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}>
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
    </>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sLabel: React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 6 }
const sInput: React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '3px solid #BABFC7', borderRadius: 10, fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', outline: 'none', background: '#fff', boxShadow: '0 0 12px rgba(31, 86, 167, 0.437)' }
const sBtnPrimary:   React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary: React.CSSProperties = { background: '#F7DD7D', color: 'var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow:'0 2px 10px #3244736e' }
const sStatCard: React.CSSProperties = { background: '#ffffff', borderRadius: 16, padding: '0.875rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', boxShadow:'0 2px 10px #3244736e', width: 320, flexShrink: 0, marginLeft:'1.5rem' }
const sStatLabel: React.CSSProperties = { fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 12, position: 'relative', bottom: 5 }
const sStatValue: React.CSSProperties = { fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1, position: 'relative', left: 12 }
