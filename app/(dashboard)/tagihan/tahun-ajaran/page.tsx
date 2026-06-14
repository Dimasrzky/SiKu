'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Pencil, Plus, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
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

const TA_SELECT = 'id, nama, tanggal_mulai, tanggal_selesai, semester_ganjil_mulai, semester_ganjil_selesai, semester_genap_mulai, semester_genap_selesai'

const formatTgl = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TahunAjaranPage() {
  const router = useRouter()

  const [pageLoading,      setPageLoading]      = useState(true)
  const [setupDone,        setSetupDone]        = useState(false)
  const [setupSteps,       setSetupSteps]       = useState<Record<string, boolean>>({})
  const [taData,           setTaData]           = useState<TahunAjaranData | null>(null)
  const [upcomingData,     setUpcomingData]     = useState<TahunAjaranData | null>(null)
  const [showWarningModal, setShowWarningModal] = useState(false)

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
        supabase.from('tahun_ajaran').select(TA_SELECT).eq('is_aktif', false)
          .order('tanggal_mulai', { ascending: true }).limit(1).maybeSingle(),
      ])

      const steps = (pData?.setup_steps ?? {}) as Record<string, boolean>
      setSetupSteps(steps)

      if (steps['tahun_ajaran']) {
        setSetupDone(true)
        if (ta) setTaData(ta as TahunAjaranData)

        if (upcoming) {
          const upcomingTyped = upcoming as TahunAjaranData
          const today     = new Date(); today.setHours(0, 0, 0, 0)
          const startDate = new Date(upcomingTyped.tanggal_mulai); startDate.setHours(0, 0, 0, 0)
          if (startDate <= today) {
            // Waktunya sudah tiba — aktifkan otomatis
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

  if (setupDone && taData) {
    const handleTambah = () => {
      const today    = new Date(); today.setHours(0, 0, 0, 0)
      const endDate  = new Date(taData.tanggal_selesai); endDate.setHours(0, 0, 0, 0)
      const h2Minggu = new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000)
      if (today >= h2Minggu) {
        router.push('/tagihan/tahun-ajaran/baru')
      } else {
        setShowWarningModal(true)
      }
    }

    const daysLeft = upcomingData
      ? Math.ceil((new Date(upcomingData.tanggal_mulai).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))
      : 0

    return (
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Tahun Ajaran</h1>
            <p className="dashboard-subtitle">{taData.nama} · Aktif</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => router.push('/tagihan/tahun-ajaran/edit')}
              style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
              <Pencil size={13} /> Edit
            </button>
            {!upcomingData && (
              <button onClick={handleTambah}
                style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
                <Plus size={13} /> Tambah Tahun Ajaran
              </button>
            )}
          </div>
        </div>

        {/* Info Card — Aktif */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 4 }}>NAMA TAHUN AJARAN</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-dark)' }}>{taData.nama}</div>
            </div>
            <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '0.75rem', fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>
              Aktif
            </span>
          </div>

          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={sViewItem}>
              <span style={sViewLabel}>Tanggal Mulai</span>
              <span style={sViewValue}>{formatTgl(taData.tanggal_mulai)}</span>
            </div>
            <div style={sViewItem}>
              <span style={sViewLabel}>Tanggal Selesai</span>
              <span style={sViewValue}>{formatTgl(taData.tanggal_selesai)}</span>
            </div>
          </div>

          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy-dark)', whiteSpace: 'nowrap' }}>Semester Ganjil</span>
            </div>
            <div style={sViewItem}>
              <span style={sViewLabel}>Mulai</span>
              <span style={sViewValue}>{formatTgl(taData.semester_ganjil_mulai)}</span>
            </div>
            <div style={sViewItem}>
              <span style={sViewLabel}>Selesai</span>
              <span style={sViewValue}>{formatTgl(taData.semester_ganjil_selesai)}</span>
            </div>
          </div>

          <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy-dark)', whiteSpace: 'nowrap' }}>Semester Genap</span>
            </div>
            <div style={sViewItem}>
              <span style={sViewLabel}>Mulai</span>
              <span style={sViewValue}>{formatTgl(taData.semester_genap_mulai)}</span>
            </div>
            <div style={sViewItem}>
              <span style={sViewLabel}>Selesai</span>
              <span style={sViewValue}>{formatTgl(taData.semester_genap_selesai)}</span>
            </div>
          </div>

        </div>

        {/* Info Card — Mendatang */}
        {upcomingData && (
          <div style={{ marginTop: '1rem', background: '#fff', border: '1.5px dashed #94A3B8', borderRadius: 12, overflow: 'hidden' }}>

            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 4 }}>TAHUN AJARAN MENDATANG</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-dark)' }}>{upcomingData.nama}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>
                  {daysLeft > 0 ? `Aktif dalam ${daysLeft} hari` : 'Menunggu Aktivasi'}
                </span>
                <button
                  onClick={() => router.push(`/tagihan/tahun-ajaran/edit?id=${upcomingData.id}`)}
                  style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', padding: '4px 12px' }}>
                  <Pencil size={12} /> Edit
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: '#F8FAFC' }}>
              <div style={sViewItem}>
                <span style={sViewLabel}>Tanggal Mulai</span>
                <span style={sViewValue}>{formatTgl(upcomingData.tanggal_mulai)}</span>
              </div>
              <div style={sViewItem}>
                <span style={sViewLabel}>Tanggal Selesai</span>
                <span style={sViewValue}>{formatTgl(upcomingData.tanggal_selesai)}</span>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '1.5rem', alignItems: 'center', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy-dark)', whiteSpace: 'nowrap' }}>Semester Ganjil</span>
              </div>
              <div style={sViewItem}>
                <span style={sViewLabel}>Mulai</span>
                <span style={sViewValue}>{formatTgl(upcomingData.semester_ganjil_mulai)}</span>
              </div>
              <div style={sViewItem}>
                <span style={sViewLabel}>Selesai</span>
                <span style={sViewValue}>{formatTgl(upcomingData.semester_ganjil_selesai)}</span>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '1.5rem', alignItems: 'center', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy-dark)', whiteSpace: 'nowrap' }}>Semester Genap</span>
              </div>
              <div style={sViewItem}>
                <span style={sViewLabel}>Mulai</span>
                <span style={sViewValue}>{formatTgl(upcomingData.semester_genap_mulai)}</span>
              </div>
              <div style={sViewItem}>
                <span style={sViewLabel}>Selesai</span>
                <span style={sViewValue}>{formatTgl(upcomingData.semester_genap_selesai)}</span>
              </div>
            </div>

          </div>
        )}

        {/* Modal peringatan belum waktunya */}
        {showWarningModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
            onClick={e => { if (e.target === e.currentTarget) setShowWarningModal(false) }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
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
                <button onClick={() => { setShowWarningModal(false); router.push('/tagihan/tahun-ajaran/baru') }}
                  style={{ ...sBtnPrimary, flex: 1, textAlign: 'center' }}>
                  Buat Tetap
                </button>
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
                    <input type="date" value={semester.ganjil.mulai} onChange={e => setSemester(s => ({ ...s, ganjil: { ...s.ganjil, mulai: e.target.value } }))} style={{ ...sInput, fontSize: '1rem', fontWeight:'bold', color: '#435D84', backgroundColor: '#A3CDFE', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: 'none', borderRadius: 10, transform: 'translateX(60px)' }} className="custom-date-input" />
                    <Image src="/icons/IconEdit.png" width={20} height={20} alt="Kalender" style={{ position: 'absolute', right: -40, top: '50%', transform: 'translateY(-10px)', pointerEvents: 'none', }} />
                  </div>
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A', marginLeft: '5.3rem' }}>Selesai</label>
                  <div style={{ position: 'relative', marginLeft: '5rem' }}>
                    <input type="date" value={semester.ganjil.selesai} onChange={e => setSemester(s => ({ ...s, ganjil: { ...s.ganjil, selesai: e.target.value } }))} style={{ ...sInput, fontSize: '1rem', fontWeight:'bold', color: '#435D84', backgroundColor: '#A3CDFE', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: 'none', borderRadius: 10 }} className="custom-date-input" />
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
                    <input type="date" value={semester.genap.mulai} onChange={e => setSemester(s => ({ ...s, genap: { ...s.genap, mulai: e.target.value } }))} style={{ ...sInput, fontSize: '1rem', fontWeight:'bold', color: '#435D84', backgroundColor: '#A3CDFE', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: 'none', borderRadius: 10, transform: 'translateX(60px)' }} className="custom-date-input" />
                    <Image src="/icons/IconEdit.png" width={20} height={20} alt="Kalender" style={{ position: 'absolute', right: -40, top: '50%', transform: 'translateY(-10px)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3, fontSize: '0.75rem', color: '#6F788A', marginLeft: '5rem' }}>Selesai</label>
                  <div style={{ position: 'relative', marginLeft: '5rem' }}>
                    <input type="date" value={semester.genap.selesai} onChange={e => setSemester(s => ({ ...s, genap: { ...s.genap, selesai: e.target.value } }))} style={{ ...sInput, fontSize: '1rem', fontWeight:'bold', color: '#435D84', backgroundColor: '#A3CDFE', boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)', border: 'none', borderRadius: 10 }} className="custom-date-input" />
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

const sLabel: React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--text-mid)', marginBottom: 6 }
const sInput: React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '3px solid #BABFC7', borderRadius: 10, fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', outline: 'none', background: '#fff', boxShadow: '0 0 12px rgba(31, 86, 167, 0.437)' }
const sBtnPrimary:   React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sViewItem:  React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.875rem' }
const sViewLabel: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const sViewValue: React.CSSProperties = { fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-dark)' }
