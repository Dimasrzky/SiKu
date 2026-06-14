'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, Upload,
  Plus, Download, MessageCircle, X,
  AlertCircle, CheckCircle2, Users,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_ORDER      = ['profil_sekolah', 'tahun_ajaran', 'komponen_tagihan', 'buat_kelas', 'import_siswa']
const THIS_STEP_INDEX = 4

const TEMPLATE_HEADERS = ['Nama Lengkap', 'NIS', 'Nama Kelas', 'Nama Orang Tua', 'No WhatsApp']
const TEMPLATE_EXAMPLE = ['Budi Santoso', '2024001', 'VII-A', 'Santi Dewi', '628123456789']

// ── Types ─────────────────────────────────────────────────────────────────────

interface KelasOption {
  id:      string
  nama:    string
  warna:   string
  jenjang: string
}

interface ParsedRow {
  no:        number
  nama:      string
  nis:       string
  namaKelas: string
  namaWali:  string
  noWa:      string
  kelasId?:  string
  error?:    string
}

interface SiswaRow {
  id:        string
  nama:      string
  nis:       string | null
  kelas:     { id: string; nama: string; warna: string } | null
  nama_wali: string | null
  no_wa:     string | null
  status:    string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DaftarSiswaPage() {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // App state
  const [loading,   setLoading]   = useState(true)
  const [setupDone, setSetupDone] = useState(false)

  // Data
  const [kelasList, setKelasList] = useState<KelasOption[]>([])
  const [siswaList, setSiswaList] = useState<SiswaRow[]>([])

  // Import Excel flow
  const [previewRows,       setPreviewRows]       = useState<ParsedRow[] | null>(null)
  const [importing,         setImporting]         = useState(false)
  const [importError,       setImportError]       = useState('')
  const [dragging,          setDragging]          = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false)

  // Manual modal
  const [showModal,       setShowModal]       = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [savedInSetupMode, setSavedInSetupMode] = useState(false)
  const [mNama,      setMNama]      = useState('')
  const [mNis,       setMNis]       = useState('')
  const [mKelasId,   setMKelasId]   = useState('')
  const [mNamaWali,  setMNamaWali]  = useState('')
  const [mNoWa,      setMNoWa]      = useState('')
  const [mNoWaError, setMNoWaError] = useState('')
  const [mSaving,    setMSaving]    = useState(false)
  const [mError,     setMError]     = useState('')

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadSiswa = async () => {
    const { data } = await supabase
      .from('siswa')
      .select('id, nama, nis, kelas:kelas_id(id, nama, warna), nama_wali, no_wa, status')
      .order('nama')
      .limit(500)
    setSiswaList((data ?? []) as unknown as SiswaRow[])
  }

  useEffect(() => {
    ;(async () => {
      const [{ data: pData }, { data: kData }] = await Promise.all([
        supabase.from('pengaturan').select('setup_steps').maybeSingle(),
        supabase.from('kelas').select('id, nama, warna, jenjang').order('nama').limit(100),
      ])

      const steps = (pData?.setup_steps ?? {}) as Record<string, boolean>

      if (!steps['buat_kelas']) {
        router.replace('/siswa/manajemen-kelas')
        return
      }

      const done = !!steps['import_siswa']
      setSetupDone(done)
      setKelasList((kData ?? []) as KelasOption[])

      if (done) await loadSiswa()

      setLoading(false)
    })()
  }, [router])

  // ── Excel template ────────────────────────────────────────────────────────

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE])
    ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa')
    XLSX.writeFile(wb, 'template-import-siswa.xlsx')
  }

  // ── Excel parse ───────────────────────────────────────────────────────────

  const parseFile = (file: File) => {
    setImportError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data  = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb    = XLSX.read(data, { type: 'array' })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const rows  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

        const kelasMap = new Map(kelasList.map(k => [k.nama.toUpperCase(), k.id]))

        const parsed: ParsedRow[] = rows.map((row, i) => {
          const nama      = String(row['Nama Lengkap'] ?? '').trim()
          const nis       = String(row['NIS'] ?? '').trim()
          const namaKelas = String(row['Nama Kelas'] ?? '').trim()
          const namaWali  = String(row['Nama Orang Tua'] ?? '').trim()
          const noWa      = String(row['No WhatsApp'] ?? '').trim()
          const kelasId   = kelasMap.get(namaKelas.toUpperCase())

          let error: string | undefined
          if (!nama)        error = 'Nama wajib diisi'
          else if (!nis)    error = 'NIS wajib diisi'
          else if (!kelasId) error = `Kelas "${namaKelas}" tidak ditemukan`

          return { no: i + 1, nama, nis, namaKelas, namaWali, noWa, kelasId, error }
        })

        setPreviewRows(parsed)
      } catch {
        setImportError('Gagal membaca file. Pastikan format sesuai template.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
    e.target.value = ''
  }

  // ── Import confirm ────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!previewRows) return
    const valid = previewRows.filter(r => !r.error)
    if (valid.length === 0) return

    setImporting(true); setImportError('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/siswa', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        siswa: valid.map(r => ({ nama: r.nama, nis: r.nis, kelas_id: r.kelasId, nama_wali: r.namaWali || null, no_wa: r.noWa || null })),
      }),
    })

    const json = await res.json() as { error?: string }
    if (!res.ok) { setImportError(json.error ?? 'Gagal mengimpor.'); setImporting(false); return }

    if (!setupDone) {
      await fetch('/api/setup-step', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ step: 'import_siswa' }),
      })
      try { localStorage.setItem('siku_setup_berhasil', '1') } catch { /* ignore */ }
      router.push('/dashboard')
      return
    }

    setPreviewRows(null)
    await loadSiswa()
    setImporting(false)
  }

  // ── Manual add ────────────────────────────────────────────────────────────

  const openModal = () => {
    setMNama(''); setMNis(''); setMKelasId(''); setMNamaWali(''); setMNoWa(''); setMNoWaError(''); setMError('')
    setShowModal(true)
  }

  const handleManualSave = async () => {
    if (!mNama.trim() || !mNis.trim() || !mKelasId || !mNamaWali.trim() || !mNoWa.trim()) {
      setMError('Semua field wajib diisi.'); return
    }
    if (!/^\d+$/.test(mNoWa.trim())) { setMNoWaError('Nomor WhatsApp hanya boleh berisi angka.'); return }
    setMNoWaError(''); setMSaving(true); setMError('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/siswa', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        siswa: [{ nama: mNama.trim(), nis: mNis.trim(), kelas_id: mKelasId, nama_wali: mNamaWali.trim() || null, no_wa: mNoWa.trim() || null }],
      }),
    })

    const json = await res.json() as { error?: string }
    if (!res.ok) { setMError(json.error ?? 'Gagal menyimpan.'); setMSaving(false); return }

    const wasSetupMode = !setupDone
    if (wasSetupMode) {
      await fetch('/api/setup-step', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ step: 'import_siswa' }),
      })
      setSetupDone(true)
    }

    await loadSiswa()
    setMSaving(false)
    setShowModal(false)
    setSavedInSetupMode(wasSetupMode)
    setShowSuccessModal(true)
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderPreview = () => {
    if (!previewRows) return null
    const validCount = previewRows.filter(r => !r.error).length
    const errCount   = previewRows.length - validCount

    return (
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={16} color="#16A34A" />
            <span style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.875rem' }}>
              Preview — {validCount} baris valid
              {errCount > 0 && <span style={{ color: '#DC2626', fontWeight: 400 }}>, {errCount} baris error</span>}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setPreviewRows(null)} style={{ ...sBtnSecondary, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Batal</button>
            <button onClick={handleImport} disabled={importing || validCount === 0}
              style={{ ...sBtnPrimary, padding: '0.4rem 1rem', fontSize: '0.8rem', opacity: (importing || validCount === 0) ? 0.6 : 1 }}>
              {importing ? 'Mengimpor...' : `Import ${validCount} Siswa →`}
            </button>
          </div>
        </div>

        {importError && (
          <div style={{ padding: '0.65rem 1.25rem', background: '#FEF2F2', borderBottom: '1px solid #FECACA', fontSize: '0.8rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={13} /> {importError}
          </div>
        )}

        <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0 }}>
                {['No', 'Nama', 'NIS', 'Kelas', 'Nama Wali', 'No WA', 'Status'].map(h => (
                  <th key={h} style={{ padding: '0.55rem 0.875rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map(row => (
                <tr key={row.no} style={{ background: row.error ? '#FEF2F2' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-muted)', width: 36 }}>{row.no}</td>
                  <td style={{ padding: '0.5rem 0.875rem', fontWeight: 600, color: 'var(--navy-dark)' }}>{row.nama || '—'}</td>
                  <td style={{ padding: '0.5rem 0.875rem', fontFamily: 'monospace', color: 'var(--text-mid)' }}>{row.nis || '—'}</td>
                  <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-mid)' }}>{row.namaKelas || '—'}</td>
                  <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-mid)' }}>{row.namaWali || '—'}</td>
                  <td style={{ padding: '0.5rem 0.875rem', fontFamily: 'monospace', color: 'var(--text-mid)' }}>{row.noWa || '—'}</td>
                  <td style={{ padding: '0.5rem 0.875rem' }}>
                    {row.error ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEE2E2', color: '#DC2626', padding: '0.18rem 0.5rem', borderRadius: 5, fontSize: '0.72rem', fontWeight: 600 }}>
                        <AlertCircle size={10} /> {row.error}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#DCFCE7', color: '#16A34A', padding: '0.18rem 0.5rem', borderRadius: 5, fontSize: '0.72rem', fontWeight: 600 }}>
                        <CheckCircle2 size={10} /> Valid
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  // ── Setup Mode ────────────────────────────────────────────────────────────

  if (!setupDone) return (
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
              Import Siswa
            </h1>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              Langkah {THIS_STEP_INDEX + 1} dari {STEP_ORDER.length}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
          {STEP_ORDER.map((_, i) => (
            <div key={i} className={i === THIS_STEP_INDEX ? 'dot-active' : undefined}
              style={{ width: 16, height: 16, borderRadius: '50%', position: 'relative', bottom: 10, right: 6, background: i <= THIS_STEP_INDEX ? '#69C183' : '#CBD5E1', transition: 'background 0.2s', boxShadow: '3px 6px 14px rgba(26, 44, 78, 0.58)' }}
            />
          ))}
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: '#1A2C4E', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1rem', color: '#fff', boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)' }}>
        <p style={{ flex: 1, fontSize: '1.25rem', lineHeight: 1.65, margin: 0 }}>
          Langkah terakhir — import data siswa dari file Excel atau tambahkan satu per satu.
          <br />Setelah siswa masuk, tagihan bisa langsung dibuat secara otomatis.
        </p>
        <div style={{ flexShrink: 0, marginLeft: 'auto', width: 40, height: 40, background: '#F7DD7D', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', top: '-0.4rem', right: '-0.65rem' }}>
          <Image src="/icons/IconTSeru.png" width={3.5} height={3.5} alt="Info" style={{ display: 'block' }} />
        </div>
      </div>

      {/* Preview atau opsi import */}
      {previewRows ? renderPreview() : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>

          {/* Card: Import Excel */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem',  boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '3rem' }}>
              <div style={{ width: 60, height: 60, borderRadius: 13, background: '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
                <Image src="/icons/IconExcel.png" width={22} height={22} alt="Excel" />
              </div>
              <div style={{ marginLeft: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '1.2rem' }}>Import via Excel</div>
                <div style={{ fontSize: '1rem', color: '#6F788A' }}>Harus Download Template*</div>
              </div>
            </div>

            <button onClick={downloadTemplate} style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '40%',
              padding: '0.5rem 0.875rem', marginBottom: '1.2rem', marginLeft: '19.5rem',
              background: '#f9cece', borderRadius: 8, boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)',
              cursor: 'pointer', fontSize: '1rem', fontWeight: 600, color: '#bb1313', fontFamily: 'inherit',
            }}>
              <Download size={18} /> Download Template
            </button>

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? '#1D4ED8' : '#CBD5E1'}`,
                borderRadius: 14, padding: '1.75rem 1rem',
                textAlign: 'center', cursor: 'pointer',
                background: dragging ? '#ffffff' : '#ffffff',
                transition: 'all 0.15s',
              }}
            >
              <Upload size={35} style={{ margin: '0 auto 0.5rem', color: dragging ? '#1D4ED8' : '#BDC1C9', display: 'block' }} />
              <div style={{ fontSize: '1rem', fontWeight: 600, color: dragging ? '#1D4ED8' : '#6F788A', marginBottom: 4 }}>
                {dragging ? 'Lepaskan file di sini' : 'Drag & drop file Excel'}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>atau klik untuk pilih file</div>
            </div>

            {importError && (
              <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: '0.8rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={13} /> {importError}
              </div>
            )}
          </div>

          {/* Card: Tambah Manual */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', display: 'flex', flexDirection: 'column',  boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{ width: 60, height: 60, borderRadius: 13, background: '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={30} color="#ffffff" />
              </div>
              <div style={{ marginLeft: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '1.2rem' }}>Tambah Manual</div>
                <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Tambah siswa satu per satu</div>
              </div>
            </div>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', lineHeight: 1.6, flex: 1, margin: '0 0 1.25rem', marginTop: '1.4rem', fontWeight: 500 }}>
              Masukkan data siswa langsung melalui form. Cocok untuk <br />menambah sedikit siswa atau melengkapi data yang terlewat.
            </p>
            <button onClick={openModal} style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Plus size={15} /> Tambah Siswa
            </button>
          </div>

        </div>
      )}

    </div>

    {showModal && <ModalContent
      kelasList={kelasList}
      mNama={mNama} setMNama={setMNama}
      mNis={mNis} setMNis={setMNis}
      mKelasId={mKelasId} setMKelasId={setMKelasId}
      mNamaWali={mNamaWali} setMNamaWali={setMNamaWali}
      mNoWa={mNoWa} setMNoWa={setMNoWa}
      mNoWaError={mNoWaError} setMNoWaError={setMNoWaError}
      mSaving={mSaving} mError={mError}
      onSave={handleManualSave}
      onClose={() => setShowModal(false)}
    />}

    {showSuccessModal && <SuccessModal
      savedInSetupMode={savedInSetupMode}
      onAddMore={() => { setShowSuccessModal(false); openModal() }}
      onExit={() => {
        if (savedInSetupMode) {
          try { localStorage.setItem('siku_setup_berhasil', '1') } catch { /* ignore */ }
          router.push('/dashboard')
        } else {
          setShowSuccessModal(false)
        }
      }}
    />}

    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />

    </>
  )

  // ── View Mode ─────────────────────────────────────────────────────────────

  return (
    <>
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Daftar Siswa</h1>
          <p className="dashboard-subtitle">{siswaList.length} siswa terdaftar</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={() => setShowImportConfirm(true)} style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
            <Upload size={14} /> Import Excel
          </button>
          <button onClick={openModal} style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
            <Plus size={14} /> Tambah Siswa
          </button>
        </div>
      </div>

      {previewRows && renderPreview()}

      {siswaList.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👤</div>
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.35rem' }}>Belum ada siswa</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tambah siswa menggunakan tombol di atas.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>NO</th>
                <th>NAMA</th>
                <th>NIS</th>
                <th>KELAS</th>
                <th>NAMA WALI</th>
                <th>NO WA</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {siswaList.map((s, idx) => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', width: 40 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{s.nama}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-mid)' }}>{s.nis ?? '—'}</td>
                  <td>
                    {s.kelas ? (
                      <span style={{ background: s.kelas.warna + '18', color: s.kelas.warna, border: `1px solid ${s.kelas.warna}40`, padding: '0.2rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600 }}>
                        {s.kelas.nama}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-mid)' }}>{s.nama_wali ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-mid)' }}>{s.no_wa ?? '—'}</td>
                  <td>
                    {s.no_wa ? (
                      <a href={`https://wa.me/${s.no_wa.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#DCFCE7', color: '#15803D', borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {showModal && <ModalContent
      kelasList={kelasList}
      mNama={mNama} setMNama={setMNama}
      mNis={mNis} setMNis={setMNis}
      mKelasId={mKelasId} setMKelasId={setMKelasId}
      mNamaWali={mNamaWali} setMNamaWali={setMNamaWali}
      mNoWa={mNoWa} setMNoWa={setMNoWa}
      mNoWaError={mNoWaError} setMNoWaError={setMNoWaError}
      mSaving={mSaving} mError={mError}
      onSave={handleManualSave}
      onClose={() => setShowModal(false)}
    />}

    {showSuccessModal && <SuccessModal
      savedInSetupMode={savedInSetupMode}
      onAddMore={() => { setShowSuccessModal(false); openModal() }}
      onExit={() => {
        if (savedInSetupMode) {
          try { localStorage.setItem('siku_setup_berhasil', '1') } catch { /* ignore */ }
          router.push('/dashboard')
        } else {
          setShowSuccessModal(false)
        }
      }}
    />}

    {/* Popup konfirmasi template */}
    {showImportConfirm && (
      <>
      <style>{`
        @keyframes import-confirm-in {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.35)' }}
        onClick={() => setShowImportConfirm(false)}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', animation: 'import-confirm-in 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📄</div>
            <h3 style={{ fontFamily: 'var(--font-serif,Georgia,serif)', fontWeight: 700, color: 'var(--navy-dark)', fontSize: '1rem', margin: '0 0 0.4rem' }}>
              Sudah memiliki template Excel?
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Gunakan template resmi agar data siswa terbaca dengan benar.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button
              onClick={() => { setShowImportConfirm(false); fileInputRef.current?.click() }}
              style={{ ...sBtnPrimary, width: '100%', textAlign: 'center', padding: '0.7rem' }}>
              Sudah, pilih file
            </button>
            <button
              onClick={() => { downloadTemplate(); setShowImportConfirm(false) }}
              style={{ ...sBtnSecondary, width: '100%', textAlign: 'center', padding: '0.7rem' }}>
              Belum, download template dulu
            </button>
          </div>
        </div>
      </div>
      </>
    )}

    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
    </>
  )
}

// ── Success Modal ─────────────────────────────────────────────────────────────

function SuccessModal({ savedInSetupMode, onAddMore, onExit }: {
  savedInSetupMode: boolean
  onAddMore: () => void
  onExit:    () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '2rem 1.75rem',
        width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#D1FAE5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem',
        }}>
          <CheckCircle2 size={32} color="#059669" />
        </div>

        <h3 style={{
          fontFamily: 'var(--font-serif,Georgia,serif)',
          fontSize: '1.15rem', fontWeight: 700,
          color: 'var(--navy-dark)', margin: '0 0 0.5rem',
        }}>
          Siswa Berhasil Disimpan
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.75rem', lineHeight: 1.5 }}>
          Data siswa telah berhasil ditambahkan ke sistem.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <button
            onClick={onAddMore}
            style={{ ...sBtnPrimary, width: '100%', padding: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Plus size={15} /> Tambah Siswa Lagi
          </button>
          <button
            onClick={onExit}
            style={{ ...sBtnSecondary, width: '100%', padding: '0.7rem' }}
          >
            {savedInSetupMode ? 'Selesai & ke Dashboard →' : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal component ───────────────────────────────────────────────────────────

interface ModalProps {
  kelasList:    KelasOption[]
  mNama:        string; setMNama:    (v: string) => void
  mNis:         string; setMNis:     (v: string) => void
  mKelasId:     string; setMKelasId: (v: string) => void
  mNamaWali:    string; setMNamaWali:(v: string) => void
  mNoWa:        string; setMNoWa:    (v: string) => void
  mNoWaError:   string; setMNoWaError:(v: string) => void
  mSaving:      boolean
  mError:       string
  onSave:       () => void
  onClose:      () => void
}

function ModalContent({ kelasList, mNama, setMNama, mNis, setMNis, mKelasId, setMKelasId, mNamaWali, setMNamaWali, mNoWa, setMNoWa, mNoWaError, setMNoWaError, mSaving, mError, onSave, onClose }: ModalProps) {
  const [kelasOpen, setKelasOpen] = useState(false)

  const selectedKelas = kelasList.find(k => k.id === mKelasId)

  return (
    <>
    <style>{`.daftar-modal::-webkit-scrollbar { display: none; }`}</style>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={() => !mSaving && onClose()}>
      <div className="daftar-modal" style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 450, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--sans-serif)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--navy-dark)', margin: 0 }}>
            Tambah Siswa
          </h3>
        </div>

        {/* Nama */}
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={sLabel}>Nama Lengkap <span style={{ color: '#DC2626' }}>*</span></label>
          <input type="text" style={sInput} placeholder="Nama lengkap siswa" value={mNama} onChange={e => setMNama(e.target.value)} />
        </div>

        {/* NIS */}
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={sLabel}>NIS <span style={{ color: '#DC2626' }}>*</span></label>
          <input type="text" style={sInput} placeholder="Nomor Induk Siswa" value={mNis} onChange={e => setMNis(e.target.value)} />
        </div>

        {/* Pilih Kelas — trigger button */}
        <div style={{ marginBottom: '1.1rem' }}>
          <label style={sLabel}>Kelas <span style={{ color: '#DC2626' }}>*</span></label>
          <button
            type="button"
            onClick={() => setKelasOpen(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.65rem 0.875rem', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.875rem', background: '#fff',
              border: selectedKelas ? `1.5px solid ${selectedKelas.warna}` : '2.5px solid #BABFC7',
              color: selectedKelas ? '#6F788A' : '#6F788A',
              transition: 'border-color 0.15s',
              boxShadow: '0 2px 4px #BABFC7'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {selectedKelas ? (
                <>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: selectedKelas.warna, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>{selectedKelas.nama}</span>
                </>
              ) : 'Pilih kelas'}
            </span>
          </button>
        </div>

        {/* Separator + Informasi Orang Tua */}
        <div style={{ borderTop: '3.5px solid var(--border)', paddingTop: '0.875rem', marginBottom: '0.875rem' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1A2C4E', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>
            Informasi Orang Tua
          </div>

          <div style={{ marginBottom: '0.875rem' }}>
            <label style={sLabel}>Nama Orang Tua <span style={{ color: '#DC2626' }}>*</span></label>
            <input type="text" style={sInput} placeholder="Nama orang tua / wali" value={mNamaWali} onChange={e => setMNamaWali(e.target.value)} />
          </div>

          <div>
            <label style={sLabel}>Nomor WhatsApp <span style={{ color: '#DC2626' }}>*</span></label>
            <input
              type="tel"
              style={{ ...sInput, ...(mNoWaError ? { border: '1.5px solid #EF4444' } : {}) }}
              placeholder="62812xxxx (untuk notifikasi tagihan)"
              value={mNoWa}
              onChange={e => { setMNoWa(e.target.value); if (mNoWaError) setMNoWaError('') }}
            />
            {mNoWaError
              ? <p style={{ fontSize: '0.73rem', color: '#EF4444', margin: '0.3rem 0 0' }}>{mNoWaError}</p>
              : <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: '1rem 0 0' }}> ⓘ Digunakan untuk mengirim informasi tagihan secara otomatis.</p>
            }
          </div>
        </div>

        {mError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '0.65rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.82rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={13} /> {mError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.8rem' }}>
          <button onClick={onClose} disabled={mSaving} style={{ ...sBtnSecondary, flex: 1 }}>Batal</button>
          <button onClick={onSave} disabled={mSaving} style={{ ...sBtnPrimary, flex: 2, opacity: mSaving ? 0.6 : 1 }}>
            {mSaving ? 'Menyimpan...' : 'Simpan Siswa'}
          </button>
        </div>
      </div>

      {/* Popup pilih kelas — fixed overlay di atas modal */}
      {kelasOpen && (
        <>
        <style>{`
          @keyframes kelas-popup-in {
            from { opacity: 0; transform: scale(0.92) translateY(12px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);    }
          }
          @keyframes kelas-backdrop-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'kelas-backdrop-in 0.18s ease' }}
          onClick={() => setKelasOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 360, boxShadow: '0 24px 64px rgba(64, 132, 234, 0.28)', animation: 'kelas-popup-in 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--navy-dark)' }}>Pilih Kelas</span>
              <button onClick={() => setKelasOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: 4 }}>
                <X size={28} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {kelasList.map(k => {
                const active = mKelasId === k.id
                return (
                  <button key={k.id} type="button"
                    onClick={() => { setMKelasId(k.id); setKelasOpen(false) }}
                    style={{
                      padding: '0.65rem 0.4rem', borderRadius: 8, fontSize: '0.83rem', fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                      background: k.warna,
                      color:      '#fff',
                      border:     active ? '3px solid #fff' : '2px solid transparent',
                      outline:    active ? `3px solid ${k.warna}` : 'none',
                      boxShadow:  active ? `0 4px 14px ${k.warna}88` : `0 2px 6px ${k.warna}44`,
                      transform:  active ? 'scale(1.07)' : 'scale(1)',
                    }}
                  >
                    {k.nama}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
    </>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sLabel:        React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 500, color: 'var(--text-mid)', marginBottom: 4 }
const sInput:        React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2.5px solid #BABFC7', borderRadius: 8, fontFamily: 'sans-serif', fontSize: '0.875rem', fontWeight: 500, color: '#6F788A', outline: 'none', background: '#fff', boxShadow: '0 2px 4px #BABFC7' }
const sBtnPrimary:   React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 4px #BABFC7' }
const sBtnSecondary: React.CSSProperties = { background: 'transparent', minWidth: '150px', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 4px #BABFC7' }
