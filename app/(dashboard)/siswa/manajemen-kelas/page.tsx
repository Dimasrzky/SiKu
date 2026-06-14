'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Pencil, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const WARNA_OPTIONS = [
  '#944949', '#2F1F1F', '#2B7B2B', '#5E3333',
  '#401568', '#704E4E', '#AF9191'
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

function darkenHex(hex: string, amount = 60): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - amount)
  const g = Math.max(0, ((n >> 8) & 0xff) - amount)
  const b = Math.max(0, (n & 0xff) - amount)
  return `rgb(${r},${g},${b})`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KelasPage() {
  const router = useRouter()

  // Core state
  const [tahunAjaran,    setTahunAjaran]    = useState('')
  const [semester,       setSemester]       = useState('')
  const [rawRows,        setRawRows]        = useState<KelasRow[]>([])
  const [setupDone,      setSetupDone]      = useState(false)
  const [dataLoading,    setDataLoading]    = useState(true)
  const [expandedGroup,  setExpandedGroup]  = useState<string | null>(null)
  const [setupSteps,     setSetupSteps]     = useState<Record<string, boolean>>({})
  const [jenjangOptions, setJenjangOptions] = useState<string[]>(JENJANG_MAP['SMP'])

  // Setup form state
  const [showForm,      setShowForm]      = useState(false)
  const [formClosing,   setFormClosing]   = useState(false)
  const [formJenjang,   setFormJenjang]   = useState('')
  const [formNamaKelas, setFormNamaKelas] = useState('')
  const [formWaliKelas, setFormWaliKelas] = useState('')
  const [formWarna,     setFormWarna]     = useState(WARNA_OPTIONS[0])

  // UI state
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState('')
  const [apiError,         setApiError]         = useState('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [showErrorPopup,   setShowErrorPopup]   = useState(false)

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

      if (steps['buat_kelas'] === true) setSetupDone(true)

      const rows = (kData ?? []) as KelasRow[]
      if (rows.length > 0) {
        setTahunAjaran(rows[0].tahun_ajaran)
        setSemester(rows[0].semester)
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
    setFormJenjang(jenjangOptions[0] ?? '')
    setFormNamaKelas('')
    setFormWaliKelas('')
    setFormWarna(WARNA_OPTIONS[0])
    setError('')
  }

  const startCloseForm = () => {
    setFormClosing(true)
    setTimeout(resetForm, 400)
  }

  const handleSimpanForm = async () => {
    setError('')
    if (!formJenjang)           { setError('Tingkat kelas harus dipilih.'); return }
    if (!formNamaKelas.trim())  { setError('Nama kelas harus diisi.'); return }
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
          kelas: [{
            nama:       `${formJenjang}-${formNamaKelas.trim().toUpperCase()}`,
            warna:      formWarna,
            wali_kelas: formWaliKelas.trim() || null,
          }],
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
                {rawRows.length} kelas aktif
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
                  <div key={group.jenjang} style={{
                    position: 'relative', overflow: 'hidden',
                    background: group.warna, borderRadius: 12,
                    boxShadow: `0 4px 12px ${group.warna}55`,
                  }}>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 130, height: 130, background: `linear-gradient(to right, transparent 30%, ${darkenHex(group.warna)} 100%)`, pointerEvents: 'none' }} />
                    <button
                      onClick={() => toggleGroup(group.jenjang)}
                      style={{
                        position: 'relative', zIndex: 1,
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
                        <ChevronDown size={18} color="rgba(255,255,255,0.85)"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                        />
                      </div>
                    </button>

                    <div style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '0 0.875rem 0.875rem', position: 'relative', zIndex: 1 }}>
                          <div style={{ height: 1, background: 'rgba(255,255,255,0.25)', marginBottom: '0.65rem' }} />
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                            {group.items.map(({ id, identitas }) => (
                              <button key={id}
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

          {/* Baris 1: Tingkat + Nama kelas + Wali kelas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={sLabel}>Tingkat kelas</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={formJenjang}
                  onChange={e => setFormJenjang(e.target.value)}
                  style={{ ...sInput, appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}
                >
                  <option value="" disabled hidden>Pilih tingkat</option>
                  {jenjangOptions.map(j => (
                    <option key={j} value={j}>Kelas {j}</option>
                  ))}
                </select>
                <ChevronDown size={16} color="#6F788A" style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>
            <div>
              <label style={sLabel}>Nama kelas</label>
              <input
                type="text"
                placeholder="Contoh: A, 1, Unggulan"
                value={formNamaKelas}
                onChange={e => setFormNamaKelas(e.target.value)}
                style={sInput}
                autoFocus
              />
            </div>
            <div>
              <label style={sLabel}>Wali kelas <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span></label>
              <input
                type="text"
                placeholder="Nama wali kelas"
                value={formWaliKelas}
                onChange={e => setFormWaliKelas(e.target.value)}
                style={sInput}
              />
            </div>
          </div>

          <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

          {/* Pilih warna kelas */}
          <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
            {/* Kiri: label + swatches */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>
                Pilih warna kelas
              </div>
              <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                Membedakan kelas secara visual di seluruh tampilan SiKu
              </div>
              <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', background: '#FFFFFF', border: '3px solid #BABFC7', borderRadius: 13, padding: '0.5rem 0.75rem', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
                {FORM_WARNA.map(w => (
                  <button key={w} onClick={() => setFormWarna(w)}
                    style={{
                      width: 30, height: 30, borderRadius: 8, background: w,
                      border: 'none', cursor: 'pointer', flexShrink: 0,
                      transform: formWarna === w ? 'scale(1)' : 'scale(1)',
                      boxShadow: formWarna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none',
                      transition: 'all 0.15s',
                    }}
                  />
                ))}

                {/* Custom color picker */}
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
                    transform: isCustomWarna ? 'scale(1)' : 'scale(1)',
                    boxShadow: isCustomWarna ? `0 0 0 2px #fff, 0 0 0 4px ${formWarna}` : 'none',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!isCustomWarna && <Image src="/icons/IconPipet.png" width={18} height={18} alt="Pipet" />}
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />
          
           {/* Info */}
          <p style={{ fontSize: '0.9rem', fontWeight: 500, color: '#6F788A', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#6F788A1A', borderRadius: 8, padding: '0.6rem 0.875rem' }}>
            <span style={{ flexShrink: 0 }}>ⓘ</span>
            <span>Kelas ini terikat dengan tahun ajaran aktif <strong style={{ color: 'bold' }}>{tahunAjaran}</strong>. Jumlah siswa terhitung otomatis setelah import siswa.</span>
          </p>

          {/* Footer buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
const sInput:        React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2.5px solid #BABFC7', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.19)', borderRadius: 12, fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const sCard:         React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sBtnPrimary:   React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBadge:        React.CSSProperties = { background: '#F1F5F9', color: 'var(--navy-dark)', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem', borderRadius: 20, border: '1px solid var(--border)' }
