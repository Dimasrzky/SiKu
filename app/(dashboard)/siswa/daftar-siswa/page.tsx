'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, Upload,
  Plus, Download, X,
  AlertCircle, CheckCircle2, Users,
  Search, ChevronDown,
  Eye, Trash2,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

const SekolahId = ''

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_ORDER      = ['profil_sekolah', 'tahun_ajaran', 'komponen_tagihan', 'buat_kelas', 'import_siswa']
const THIS_STEP_INDEX = 4

const TEMPLATE_HEADERS = ['Nama Lengkap', 'NIS', 'Nama Kelas', 'Nama Orang Tua', 'No WhatsApp']

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
  kelas:     { id: string; nama: string; warna: string; jenjang: string } | null
  nama_wali: string | null
  no_wa:     string | null
  status:    string
}

interface BeasiswaProgram { id: string; nama: string; jenis: string; persen: number | null; nominal: number | null; count: number }
interface SiswaBeasiswaInfo { beasiswa_id: string; nama: string; jenis: string; persen: number | null; nominal: number | null }

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Preset filter tingkat dari URL, mis. /siswa/daftar-siswa?jenjang=9.
 * String kosong berarti "semua tingkat".
 */
const readJenjangParam = (): string =>
  typeof window === 'undefined'
    ? ''
    : new URLSearchParams(window.location.search).get('jenjang') ?? ''

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DaftarSiswaPage() {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // App state
  const [loading,   setLoading]   = useState(true)
  const [setupDone, setSetupDone] = useState(false)

  // Sekolah
  const [sekolahId, setSekolahId] = useState('')

  // Data
  const [kelasList, setKelasList] = useState<KelasOption[]>([])
  const [siswaList, setSiswaList] = useState<SiswaRow[]>([])

  // Filter & search (View Mode)
  // Dibaca sekali saat inisialisasi — halaman menampilkan layar loading dulu,
  // jadi filter belum ikut render awal dan tidak ada risiko hydration mismatch
  const [filterJenjang,       setFilterJenjang]       = useState(readJenjangParam)
  const [filterBeasiswa,      setFilterBeasiswa]      = useState('')
  const [searchQuery,         setSearchQuery]         = useState('')
  const [showJenjangDropdown, setShowJenjangDropdown] = useState(false)
  const [showBsDropdown,      setShowBsDropdown]      = useState(false)
  const dropdownRef  = useRef<HTMLDivElement>(null)
  const bsDropRef    = useRef<HTMLDivElement>(null)

  // Beasiswa data
  const [beasiswaPrograms, setBeasiswaPrograms] = useState<BeasiswaProgram[]>([])
  const [siswaBeasiswaMap, setSiswaBeasiswaMap] = useState<Map<string, SiswaBeasiswaInfo[]>>(new Map())

  // View detail
  const [viewSiswa,     setViewSiswa]     = useState<SiswaRow | null>(null)

  // Delete
  const [deleteSiswa,   setDeleteSiswa]   = useState<SiswaRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Edit siswa
  const [editSiswa,     setEditSiswa]     = useState<SiswaRow | null>(null)
  const [editNama,      setEditNama]      = useState('')
  const [editNis,       setEditNis]       = useState('')
  const [editKelasId,   setEditKelasId]   = useState('')
  const [editNamaWali,  setEditNamaWali]  = useState('')
  const [editNoWa,      setEditNoWa]      = useState('')
  const [editNoWaError, setEditNoWaError] = useState('')
  const [editSaving,    setEditSaving]    = useState(false)
  const [editError,     setEditError]     = useState('')
  const [editToast,     setEditToast]     = useState(false)

  // Import Excel flow
  const [previewRows,       setPreviewRows]       = useState<ParsedRow[] | null>(null)
  const [importing,         setImporting]         = useState(false)
  const [importError,       setImportError]       = useState('')
  const [dragging,          setDragging]          = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [modalDragging,     setModalDragging]     = useState(false)

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
  const [mNisError,  setMNisError]  = useState('')
  const [mSaving,    setMSaving]    = useState(false)
  const [mError,     setMError]     = useState('')

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadSiswa = async (sid: string) => {
    const { data } = await supabase
      .from('siswa')
      .select('id, nama, nis, kelas:kelas_id(id, nama, warna, jenjang), nama_wali, no_wa, status')
      .eq('sekolah_id', sid)
      .neq('status', 'alumni')
      .order('nama')
      .limit(500)
    setSiswaList((data ?? []) as unknown as SiswaRow[])
  }

  const loadBeasiswa = async (sid: string) => {
    const { data: programs } = await supabase
      .from('beasiswa')
      .select('id, nama, jenis, persen, nominal')
      .eq('sekolah_id', sid)
      .limit(100)

    const progIds = (programs ?? []).map((p: { id: string }) => p.id)
    const { data: assignments } = progIds.length > 0
      ? await supabase.from('beasiswa_siswa').select('siswa_id, beasiswa_id').in('beasiswa_id', progIds).limit(1000)
      : { data: [] }

    type ProgRaw = { id: string; nama: string; jenis: string; persen: number | null; nominal: number | null }
    const progMap = new Map<string, ProgRaw>(((programs ?? []) as ProgRaw[]).map(p => [p.id, p]))
    const countMap = new Map<string, number>()
    const siswaMap = new Map<string, SiswaBeasiswaInfo[]>()
    for (const a of (assignments ?? []) as { siswa_id: string; beasiswa_id: string }[]) {
      countMap.set(a.beasiswa_id, (countMap.get(a.beasiswa_id) ?? 0) + 1)
      const prog = progMap.get(a.beasiswa_id)
      if (prog) {
        if (!siswaMap.has(a.siswa_id)) siswaMap.set(a.siswa_id, [])
        siswaMap.get(a.siswa_id)!.push({ beasiswa_id: a.beasiswa_id, nama: prog.nama, jenis: prog.jenis, persen: prog.persen, nominal: prog.nominal })
      }
    }
    setBeasiswaPrograms((programs ?? []).map((p: ProgRaw): BeasiswaProgram => ({ id: p.id, nama: p.nama, jenis: p.jenis, persen: p.persen, nominal: p.nominal, count: countMap.get(p.id) ?? 0 })))
    setSiswaBeasiswaMap(siswaMap)
  }

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
      const sid = (prof?.sekolah_id as string) ?? ''
      setSekolahId(sid)

      const [{ data: pData }, { data: kData }] = await Promise.all([
        supabase.from('pengaturan').select('setup_steps').maybeSingle(),
        supabase.from('kelas').select('id, nama, warna, jenjang').eq('sekolah_id', sid).order('nama').limit(100),
      ])

      const steps = (pData?.setup_steps ?? {}) as Record<string, boolean>

      if (!steps['buat_kelas']) {
        router.replace('/siswa/manajemen-kelas')
        return
      }

      const done = !!steps['import_siswa']
      setSetupDone(done)
      setKelasList((kData ?? []) as KelasOption[])

      if (done) await Promise.all([loadSiswa(sid), loadBeasiswa(sid)])

      setLoading(false)
    })()
  }, [router])

  // ── Delete siswa ──────────────────────────────────────────────────────────

  const handleDeleteSiswa = async () => {
    if (!deleteSiswa) return
    setDeleteLoading(true)
    try {
      await supabase.from('siswa').delete().eq('id', deleteSiswa.id)
      await Promise.all([loadSiswa(sekolahId), loadBeasiswa(sekolahId)])
      setDeleteSiswa(null)
    } finally { setDeleteLoading(false) }
  }

  // ── Dropdown click-outside ────────────────────────────────────────────────

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowJenjangDropdown(false)
      if (bsDropRef.current && !bsDropRef.current.contains(e.target as Node)) setShowBsDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Excel template ────────────────────────────────────────────────────────

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS])
    ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa')

    const kelasRows: (string | number)[][] = [['Nama Kelas (gunakan persis seperti ini)'], ...kelasList.map(k => [k.nama])]
    const wsKelas = XLSX.utils.aoa_to_sheet(kelasRows)
    wsKelas['!cols'] = [{ wch: 35 }]
    XLSX.utils.book_append_sheet(wb, wsKelas, 'Daftar Kelas')

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

        const kelasMap = new Map<string, string>()
        kelasList.forEach(k => {
          const upper = k.nama.toUpperCase()
          kelasMap.set(upper, k.id)
          // juga petakan versi tanpa dash/spasi, misal "1-A" → "1A"
          kelasMap.set(upper.replace(/[-\s]/g, ''), k.id)
        })

        const parsed: ParsedRow[] = rows.map((row, i) => {
          const nama      = String(row['Nama Lengkap'] ?? '').trim()
          const nis       = String(row['NIS'] ?? '').trim()
          const namaKelas = String(row['Nama Kelas'] ?? '').trim()
          const namaWali  = String(row['Nama Orang Tua'] ?? '').trim()
          const noWa      = String(row['No WhatsApp'] ?? '').trim()
          const kelasId   = kelasMap.get(namaKelas.toUpperCase()) ?? kelasMap.get(namaKelas.toUpperCase().replace(/[-\s]/g, ''))

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
    if (file) {
      if (showImportConfirm) {
        setPendingImportFile(file)
      } else {
        parseFile(file)
      }
    }
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
    await loadSiswa(sekolahId)
    setImporting(false)
  }

  // ── Manual add ────────────────────────────────────────────────────────────

  const openModal = () => {
    setMNama(''); setMNis(''); setMKelasId(''); setMNamaWali(''); setMNoWa(''); setMNoWaError(''); setMNisError(''); setMError('')
    setShowModal(true)
  }

  const handleManualSave = async () => {
    if (!mNama.trim() || !mNis.trim() || !mKelasId || !mNamaWali.trim() || !mNoWa.trim()) {
      setMError('Semua field wajib diisi.'); return
    }
    if (mNisError) return
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

    await loadSiswa(sekolahId)
    setMSaving(false)
    setShowModal(false)
    setSavedInSetupMode(wasSetupMode)
    setShowSuccessModal(true)
  }

  // ── Edit siswa ────────────────────────────────────────────────────────────

  const openEdit = (s: SiswaRow) => {
    setEditSiswa(s)
    setEditNama(s.nama)
    setEditNis(s.nis ?? '')
    setEditKelasId(s.kelas?.id ?? '')
    setEditNamaWali(s.nama_wali ?? '')
    setEditNoWa(s.no_wa ?? '')
    setEditNoWaError('')
    setEditError('')
    setEditSaving(false)
  }

  const handleEditSave = async () => {
    if (!editSiswa) return
    if (!editNama.trim() || !editNis.trim() || !editKelasId) {
      setEditError('Nama, NIS, dan Kelas wajib diisi.'); return
    }
    if (editNoWa.trim() && !/^\d+$/.test(editNoWa.trim())) {
      setEditNoWaError('Nomor WhatsApp hanya boleh berisi angka.'); return
    }
    setEditNoWaError(''); setEditSaving(true); setEditError('')

    const { error } = await supabase
      .from('siswa')
      .update({
        nama:      editNama.trim(),
        nis:       editNis.trim(),
        kelas_id:  editKelasId,
        nama_wali: editNamaWali.trim() || null,
        no_wa:     editNoWa.trim() || null,
      })
      .eq('id', editSiswa.id)

    if (error) { setEditError(error.message); setEditSaving(false); return }

    await loadSiswa(sekolahId)
    setEditSiswa(null)
    setEditSaving(false)
    setEditToast(true)
    setTimeout(() => setEditToast(false), 2500)
  }

  // ── View Mode computed ───────────────────────────────────────────────────

  const uniqueJenjang = [...new Set(kelasList.map(k => k.jenjang).filter(Boolean))]
  const filteredList = siswaList.filter(s => {
    const matchJenjang  = !filterJenjang || s.kelas?.jenjang === filterJenjang
    const q = searchQuery.toLowerCase()
    const matchSearch   = !q || s.nama.toLowerCase().includes(q) || (s.nama_wali ?? '').toLowerCase().includes(q)
    const matchBeasiswa = !filterBeasiswa || (siswaBeasiswaMap.get(s.id) ?? []).some(b =>
      filterBeasiswa === 'beasiswa' ? b.jenis === 'beasiswa' : b.jenis !== 'beasiswa'
    )
    return matchJenjang && matchSearch && matchBeasiswa
  })

  // Donut chart data — grouped per jenjang
  const r = 35, circumference = 2 * Math.PI * r
  const jenjangGroups = uniqueJenjang.map(j => ({
    jenjang: j,
    count: siswaList.filter(s => s.kelas?.jenjang === j).length,
    warna: kelasList.find(k => k.jenjang === j)?.warna ?? '#CBD5E1',
  })).filter(g => g.count > 0)
  const donutTotal = siswaList.length
  const donutSegments = (() => {
    let cum = 0
    return jenjangGroups.map(g => {
      const arc = donutTotal > 0 ? (g.count / donutTotal) * circumference : 0
      const dashoffset = circumference / 4 - cum
      cum += arc
      return { ...g, arc, dashoffset }
    })
  })()

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
      mNisError={mNisError} setMNisError={setMNisError}
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
    {editToast && (
      <div style={{
        position: 'fixed', top: '1.25rem', left: '50%',
        zIndex: 9999, display: 'flex', alignItems: 'center', gap: '0.6rem',
        background: '#1A2C4E', color: '#fff', borderRadius: 12, padding: '0.75rem 1.25rem',
        boxShadow: '0 12px 32px rgba(0,0,0,0.25)', fontSize: '0.875rem', fontWeight: 700,
        animation: 'toastEnter 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        willChange: 'transform, opacity',
      }}>
        <CheckCircle2 size={18} color="#4ADE80" />
        Data berhasil diubah
      </div>
    )}
    <div className="dashboard-content">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18,47,102,0.31)' }}>
            <GraduationCap size={30} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>Daftar siswa</h1>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>kelola data siswa dan keterhubungan dengan kelas</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={() => setShowImportConfirm(true)} style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
            <Upload size={14} /> Import Excel
          </button>
          <button onClick={openModal} style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
            <Plus size={14} />  Tambah Siswa
          </button>
        </div>
      </div>

      {previewRows && renderPreview()}

      {/* Ringkasan card */}
      <div style={{ background: '#ffffff', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 24px rgba(26,44,78,0.3)', borderLeft:'28px solid #1A2C4E' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '2rem' }}>
          <div style={{ width: 46, height: 46, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A2C4E' }}>Ringkasan data siswa</div>
            <div style={{ fontSize: '0.83rem', color: '#1A2C4E' }}>Pantau jumlah dan sebaran siswa di setiap tingkat</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom:20, }}>

          {/* Total siswa — donut */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem', boxShadow: '0 4px 24px rgba(26,44,78,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#1A2C4E' }}>Total siswa</span>
              <Users size={22} color="#94A3B8" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <svg viewBox="0 0 100 100" style={{ width: 150, height: 150, flexShrink: 0 }}>
                {donutTotal === 0
                  ? <circle cx={50} cy={50} r={r} fill="none" stroke="#E2E8F0" strokeWidth={12} />
                  : donutSegments.map(seg => (
                    <circle key={seg.jenjang} cx={50} cy={50} r={r} fill="none"
                      stroke={seg.warna} strokeWidth={12}
                      strokeDasharray={`${seg.arc} ${circumference - seg.arc}`}
                      strokeDashoffset={seg.dashoffset} />
                  ))}
                <text x="50" y="47" textAnchor="middle" style={{ fontSize: '14px', fontWeight: 800, fill: '#1A2C4E' }}>{donutTotal}</text>
                <text x="50" y="58" textAnchor="middle" style={{ fontSize: '7px', fill: '#94A3B8' }}>Siswa</text>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
                {jenjangGroups.map(g => (
                  <div key={g.jenjang} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8rem' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.warna, flexShrink: 0,position:'relative', left:110,  }} />
                      <span style={{ fontSize: '0.8rem', color: '#475569' }}>Kelas {g.jenjang}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A2C4E' }}>{g.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Beasiswa & potongan */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem', boxShadow: '0 4px 24px rgba(26,44,78,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#1A2C4E' }}>Beasiswa &amp; potongan</span>
              <GraduationCap size={22} color="#94A3B8" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1A2C4E', marginBottom: '0.75rem' }}>
              {siswaBeasiswaMap.size} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748B' }}>Siswa</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: 110, overflowY: 'auto' }}>
              {beasiswaPrograms.filter(p => p.count > 0).length === 0
                ? <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Belum ada program aktif</span>
                : beasiswaPrograms.filter(p => p.count > 0).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ background: p.jenis === 'beasiswa' ? '#DCFCE7' : '#FEF3C7', color: p.jenis === 'beasiswa' ? '#15803D' : '#92400E', fontSize: '0.72rem', fontWeight: 700, padding: '2px 9px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {p.jenis === 'beasiswa'
                        ? <><GraduationCap size={10} /> {p.nama}</>
                        : <>✂ Potongan {p.persen != null ? `${p.persen}%` : p.nama}</>}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>{p.count} <span style={{ fontWeight: 400, color: '#94A3B8' }}>Siswa</span></span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Semua siswa card */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 2px 16px rgba(26,44,78,0.07)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A2C4E' }}>Semua siswa</div>
          <div style={{ fontSize: '0.83rem', color: '#64748B' }}>Cari, lihat, dan kelola data siswa secara individual</div>
        </div>

        {/* Filter toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.5rem', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button onClick={() => { setShowJenjangDropdown(p => !p); setShowBsDropdown(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#fff', border: '1.5px solid #CBD5E1', borderRadius: 8, padding: '0.45rem 0.85rem', fontSize: '0.85rem', fontWeight: 600, color: '#1A2C4E', cursor: 'pointer', fontFamily: 'inherit' }}>
              {filterJenjang ? `Kelas ${filterJenjang}` : 'Semua tingkat'}
              <ChevronDown size={13} style={{ transform: showJenjangDropdown ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
            </button>
            {showJenjangDropdown && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1.5px solid #E2E8F0', zIndex: 100, minWidth: 160, overflow: 'hidden' }}>
                <button onClick={() => { setFilterJenjang(''); setShowJenjangDropdown(false) }}
                  style={{ display: 'block', width: '100%', padding: '0.6rem 1rem', background: !filterJenjang ? '#A3CDFE' : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: !filterJenjang ? 700 : 500, fontSize: '0.875rem', color: '#1A2C4E', textAlign: 'left' }}>
                  Semua tingkat
                </button>
                {uniqueJenjang.map(j => (
                  <button key={j} onClick={() => { setFilterJenjang(j); setShowJenjangDropdown(false) }}
                    style={{ display: 'block', width: '100%', padding: '0.6rem 1rem', background: filterJenjang === j ? '#A3CDFE' : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: filterJenjang === j ? 700 : 500, fontSize: '0.875rem', color: '#1A2C4E', textAlign: 'left' }}>
                    Kelas {j}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }} ref={bsDropRef}>
            <button onClick={() => { setShowBsDropdown(p => !p); setShowJenjangDropdown(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#fff', border: '1.5px solid #CBD5E1', borderRadius: 8, padding: '0.45rem 0.85rem', fontSize: '0.85rem', fontWeight: 600, color: '#1A2C4E', cursor: 'pointer', fontFamily: 'inherit' }}>
              {filterBeasiswa === 'beasiswa' ? 'Penerima beasiswa' : filterBeasiswa === 'potongan_personal' ? 'Potongan personal' : 'Semua siswa'}
              <ChevronDown size={13} style={{ transform: showBsDropdown ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
            </button>
            {showBsDropdown && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1.5px solid #E2E8F0', zIndex: 100, minWidth: 190, overflow: 'hidden' }}>
                {[{ val: '', label: 'Semua siswa' }, { val: 'beasiswa', label: 'Penerima beasiswa' }, { val: 'potongan_personal', label: 'Potongan personal' }].map(opt => (
                  <button key={opt.val} onClick={() => { setFilterBeasiswa(opt.val); setShowBsDropdown(false) }}
                    style={{ display: 'block', width: '100%', padding: '0.6rem 1rem', background: filterBeasiswa === opt.val ? '#A3CDFE' : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: filterBeasiswa === opt.val ? 700 : 500, fontSize: '0.875rem', color: '#1A2C4E', textAlign: 'left' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 200, position: 'relative', marginLeft: 'auto' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama siswa"
              style={{ width: '100%', border: '1.5px solid #CBD5E1', borderRadius: 8, padding: '0.45rem 0.75rem 0.45rem 2.1rem', fontSize: '0.875rem', color: '#1A2C4E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', padding: '0 1.5rem 1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#1A2C4E', color: '#fff', position: 'sticky', top: 0, zIndex: 1 }}>
                {['Nama', 'NIS', 'Kelas', 'Orang tua', 'Beasiswa/potongan', 'Aksi'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>Tidak ada siswa yang sesuai filter.</td></tr>
              ) : filterJenjang ? (
                filteredList.map(s => (
                  <SiswaTableRow key={s.id} s={s} bsMap={siswaBeasiswaMap} onDelete={setDeleteSiswa} onEdit={openEdit} onView={setViewSiswa} />
                ))
              ) : (
                uniqueJenjang.flatMap(j => {
                  const groupItems = filteredList.filter(s => s.kelas?.jenjang === j)
                  if (groupItems.length === 0) return []
                  const kelasCount = kelasList.filter(k => k.jenjang === j).length
                  return [
                    <tr key={`hdr-${j}`}>
                      <td colSpan={6} style={{ padding: '0.5rem 0.1rem' }}>
                        <div style={{ background: '#A3CDFE', borderRadius: 6, padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Image src="/icons/IconLayer.png" width={16} height={16} alt="" />
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2C4E', flex: 1 }}>Kelas {j}</span>
                          <span style={{ fontSize: '0.8rem', color: '#1A2C4E', opacity: 0.75, fontWeight: 600 }}>{kelasCount} kelas · {groupItems.length} siswa</span>
                        </div>
                      </td>
                    </tr>,
                    ...groupItems.map(s => (
                      <SiswaTableRow key={s.id} s={s} bsMap={siswaBeasiswaMap} onDelete={setDeleteSiswa} onEdit={openEdit} onView={setViewSiswa} />
                    ))
                  ]
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>

    {showModal && <ModalContent
      kelasList={kelasList}
      mNama={mNama} setMNama={setMNama}
      mNis={mNis} setMNis={setMNis}
      mKelasId={mKelasId} setMKelasId={setMKelasId}
      mNamaWali={mNamaWali} setMNamaWali={setMNamaWali}
      mNoWa={mNoWa} setMNoWa={setMNoWa}
      mNoWaError={mNoWaError} setMNoWaError={setMNoWaError}
      mNisError={mNisError} setMNisError={setMNisError}
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
        } else { setShowSuccessModal(false) }
      }}
    />}

    {viewSiswa && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        onClick={() => setViewSiswa(null)}>
        <div
          style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A2C4E', margin: 0 }}>Detail Siswa</h3>
            <button onClick={() => setViewSiswa(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.25rem' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            {[
              { label: 'Nama Lengkap', value: viewSiswa.nama },
              { label: 'NIS',          value: viewSiswa.nis ?? '—' },
              { label: 'Kelas',        value: viewSiswa.kelas?.nama ?? '—' },
              { label: 'Nama Wali',    value: viewSiswa.nama_wali ?? '—' },
              { label: 'No. WA Wali',  value: viewSiswa.no_wa ?? '—' },
              { label: 'Status',       value: viewSiswa.status === 'aktif' ? 'Aktif' : 'Tidak Aktif' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B', fontWeight: 600, minWidth: 120 }}>{label}</span>
                <span style={{ color: '#1A2C4E', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setViewSiswa(null)}
            style={{ marginTop: '1.5rem', width: '100%', padding: '0.65rem', borderRadius: 10, border: 'none', background: '#1A2C4E', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            Tutup
          </button>
        </div>
      </div>
    )}

    {editSiswa && <EditSiswaModal
      siswa={editSiswa} kelasList={kelasList}
      editNama={editNama} setEditNama={setEditNama}
      editNis={editNis} setEditNis={setEditNis}
      editKelasId={editKelasId} setEditKelasId={setEditKelasId}
      editNamaWali={editNamaWali} setEditNamaWali={setEditNamaWali}
      editNoWa={editNoWa} setEditNoWa={setEditNoWa}
      editNoWaError={editNoWaError} setEditNoWaError={setEditNoWaError}
      editSaving={editSaving} editError={editError}
      onSave={handleEditSave} onClose={() => setEditSiswa(null)}
    />}

    {deleteSiswa && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Trash2 size={24} color="#EF4444" />
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1A2C4E', margin: '0 0 0.4rem' }}>Hapus siswa?</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
            Data <strong>{deleteSiswa.nama}</strong> akan dihapus permanen beserta seluruh riwayat yang terkait.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={() => setDeleteSiswa(null)} style={{ ...sBtnSecondary, flex: 1, padding: '0.65rem' }}>Batal</button>
            <button onClick={handleDeleteSiswa} disabled={deleteLoading}
              style={{ flex: 1, padding: '0.65rem', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', opacity: deleteLoading ? 0.7 : 1 }}>
              {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </div>
        </div>
      </div>
    )}

    {showImportConfirm && (
      <>
      <style>{`@keyframes ic-in { from{opacity:0;transform:scale(0.94) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)} }`}</style>
      <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.4)' }}
        onClick={() => { setShowImportConfirm(false); setPendingImportFile(null) }}>
        <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'ic-in 0.22s cubic-bezier(0.34,1.56,0.64,1)', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Upload size={18} color="#64748B" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1A2C4E' }}>Import excel</div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Import data siswa dari file Excel</div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>

            {/* Info card */}
            <div style={{ border: '1.5px solid #DBEAFE', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1rem', background: '#F8FAFF' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 52, height: 52, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Download size={22} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A2C4E' }}>Import via Excel</div>
                    <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 2 }}>Harus download template *</div>
                  </div>
                </div>
                <button onClick={downloadTemplate}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FBCECE', color: '#C0392B', border: 'none', borderRadius: 20, padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  <Download size={13} /> Download Template
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setModalDragging(true) }}
                onDragLeave={() => setModalDragging(false)}
                onDrop={e => {
                  e.preventDefault(); setModalDragging(false)
                  const file = e.dataTransfer.files[0]
                  if (file) setPendingImportFile(file)
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{ marginTop: '1rem', border: `2px dashed ${modalDragging ? '#1A2C4E' : '#CBD5E1'}`, borderRadius: 12, padding: '1.75rem 1rem', textAlign: 'center', cursor: 'pointer', background: modalDragging ? '#EFF6FF' : '#fff', transition: 'all 0.15s' }}>
                {pendingImportFile ? (
                  <>
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>📄</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1A2C4E', marginBottom: 2 }}>{pendingImportFile.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Klik untuk ganti file</div>
                  </>
                ) : (
                  <>
                    <Upload size={32} style={{ margin: '0 auto 0.6rem', color: modalDragging ? '#1A2C4E' : '#BDC1C9', display: 'block' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: modalDragging ? '#1A2C4E' : '#6F788A', marginBottom: 3 }}>
                      {modalDragging ? 'Lepaskan file di sini' : 'Drag & drop file Excel'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>atau klik untuk pilih file</div>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowImportConfirm(false); setPendingImportFile(null) }} style={{ ...sBtnSecondary, padding: '0.6rem 1.5rem' }}>Batal</button>
              <button
                onClick={() => { if (pendingImportFile) { parseFile(pendingImportFile); setShowImportConfirm(false); setPendingImportFile(null) } }}
                disabled={!pendingImportFile}
                style={{ ...sBtnPrimary, padding: '0.6rem 1.5rem', opacity: pendingImportFile ? 1 : 0.45, cursor: pendingImportFile ? 'pointer' : 'not-allowed' }}>
                Simpan
              </button>
            </div>
          </div>
        </div>
      </div>
      </>
    )}

    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
    </>
  )
}

// ── Siswa table row ───────────────────────────────────────────────────────────

function SiswaTableRow({ s, bsMap, onDelete, onEdit, onView }: {
  s:        SiswaRow
  bsMap:    Map<string, SiswaBeasiswaInfo[]>
  onDelete: (s: SiswaRow) => void
  onEdit:   (s: SiswaRow) => void
  onView:   (s: SiswaRow) => void
}) {
  const p = s.nama.trim().split(' ').filter(Boolean)
  const inisial = p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : s.nama.slice(0, 2).toUpperCase()
  const bsList = bsMap.get(s.id) ?? []
  return (
    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
      <td style={{ padding: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.kelas?.warna ?? '#1A2C4E', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', color: '#fff' }}>{inisial}</div>
          <span style={{ fontWeight: 600, color: '#1A2C4E' }}>{s.nama}</span>
        </div>
      </td>
      <td style={{ padding: '0.75rem 1.25rem', fontFamily: 'monospace', fontSize: '0.82rem', color: '#64748B' }}>{s.nis ?? '—'}</td>
      <td style={{ padding: '0.75rem 1.25rem' }}>
        {s.kelas
          ? <span style={{ background: s.kelas.warna, color: '#fff', padding: '2px 10px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700 }}>{s.kelas.nama}</span>
          : '—'}
      </td>
      <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.85rem', color: '#64748B' }}>{s.nama_wali ?? '—'}</td>
      <td style={{ padding: '0.75rem 1.25rem' }}>
        {bsList.length === 0
          ? <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>—</span>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {bsList.map(bs => (
                <span key={bs.beasiswa_id} style={{ background: bs.jenis === 'beasiswa' ? '#DCFCE7' : '#FEF3C7', color: bs.jenis === 'beasiswa' ? '#15803D' : '#92400E', fontSize: '0.72rem', fontWeight: 700, padding: '2px 9px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  {bs.jenis === 'beasiswa'
                    ? <><GraduationCap size={10} /> {bs.nama}</>
                    : <>✂ Potongan {bs.persen != null ? `${bs.persen}%` : bs.nama}</>}
                </span>
              ))}
            </div>}
      </td>
      <td style={{ padding: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => onView(s)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.35rem', display: 'flex' }}><Eye size={16} /></button>
          <button onClick={() => onEdit(s)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.35rem', display: 'flex' }}>
            <Image src="/icons/IconEdit2.png" width={15} height={15} alt="edit" />
          </button>
          <button onClick={() => onDelete(s)} style={{ background: '#DA8181', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#fff', padding: '0.35rem', display: 'flex', boxShadow: '2px 4px 4px #a8a8a88c' }}><Trash2 size={16} /></button>
        </div>
      </td>
    </tr>
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
  mNisError:    string; setMNisError: (v: string) => void
  mSaving:      boolean
  mError:       string
  onSave:       () => void
  onClose:      () => void
}

function ModalContent({ kelasList, mNama, setMNama, mNis, setMNis, mKelasId, setMKelasId, mNamaWali, setMNamaWali, mNoWa, setMNoWa, mNoWaError, setMNoWaError, mNisError, setMNisError, mSaving, mError, onSave, onClose }: ModalProps) {
  const [kelasOpen, setKelasOpen] = useState(false)
  const nisTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNisChange = (val: string) => {
    setMNis(val)
    setMNisError('')
    if (nisTimer.current) clearTimeout(nisTimer.current)
    if (!val.trim()) return
    nisTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('siswa').select('id').eq('nis', val.trim()).eq('sekolah_id', SekolahId).maybeSingle()
      if (data) setMNisError('NIS sudah digunakan')
    }, 400)
  }

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
          <input type="text" style={{ ...sInput, borderColor: mNisError ? '#DC2626' : undefined }} placeholder="Nomor Induk Siswa" value={mNis} onChange={e => handleNisChange(e.target.value)} />
          {mNisError && <div style={{ fontSize: '0.78rem', color: '#DC2626', marginTop: '0.3rem', fontWeight: 500 }}>{mNisError}</div>}
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
            style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 360, maxHeight: 'calc(100vh - 4rem)', boxShadow: '0 24px 64px rgba(64, 132, 234, 0.28)', animation: 'kelas-popup-in 0.22s cubic-bezier(0.34,1.56,0.64,1)', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--navy-dark)' }}>Pilih Kelas</span>
              <button onClick={() => setKelasOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: 4 }}>
                <X size={28} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', overflowY: 'auto' }}>
              {kelasList.map(k => {
                const active = mKelasId === k.id
                return (
                  <button key={k.id} type="button"
                    onClick={() => { setMKelasId(k.id); setKelasOpen(false) }}
                    style={{
                      minHeight: 56, padding: '0.4rem 0.3rem', borderRadius: 7,
                      fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.25,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                      background: k.warna, color: '#fff', whiteSpace: 'normal',
                      wordBreak: 'break-word', textAlign: 'center',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border:    active ? '3px solid #fff' : '2px solid transparent',
                      outline:   active ? `3px solid ${k.warna}` : 'none',
                      boxShadow: active ? `0 4px 14px ${k.warna}88` : `0 2px 6px ${k.warna}44`,
                      transform: active ? 'scale(1.07)' : 'scale(1)',
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

// ── EditSiswaModal ────────────────────────────────────────────────────────────

interface EditSiswaModalProps {
  siswa:          SiswaRow
  kelasList:      KelasOption[]
  editNama:       string; setEditNama:      (v: string) => void
  editNis:        string; setEditNis:       (v: string) => void
  editKelasId:    string; setEditKelasId:   (v: string) => void
  editNamaWali:   string; setEditNamaWali:  (v: string) => void
  editNoWa:       string; setEditNoWa:      (v: string) => void
  editNoWaError:  string; setEditNoWaError: (v: string) => void
  editSaving:     boolean
  editError:      string
  onSave:         () => void
  onClose:        () => void
}

function EditSiswaModal({ siswa, kelasList, editNama, setEditNama, editNis, setEditNis, editKelasId, setEditKelasId, editNamaWali, setEditNamaWali, editNoWa, setEditNoWa, editNoWaError, setEditNoWaError, editSaving, editError, onSave, onClose }: EditSiswaModalProps) {
  const [kelasOpen, setKelasOpen] = useState(false)
  const selectedKelas = kelasList.find(k => k.id === editKelasId)

  return (
    <>
    <style>{`.edit-modal::-webkit-scrollbar { display: none; }`}</style>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={() => !editSaving && onClose()}>
      <div className="edit-modal" style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 450, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--sans-serif)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--navy-dark)', margin: 0 }}>
            Edit: {siswa.nama}
          </h3>
          <button onClick={onClose} disabled={editSaving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ marginBottom: '0.875rem' }}>
          <label style={sLabel}>Nama Lengkap <span style={{ color: '#DC2626' }}>*</span></label>
          <input type="text" style={sInput} placeholder="Nama lengkap siswa" value={editNama} onChange={e => setEditNama(e.target.value)} />
        </div>

        <div style={{ marginBottom: '0.875rem' }}>
          <label style={sLabel}>NIS <span style={{ color: '#DC2626' }}>*</span></label>
          <input type="text" style={sInput} placeholder="Nomor Induk Siswa" value={editNis} onChange={e => setEditNis(e.target.value)} />
        </div>

        <div style={{ marginBottom: '1.1rem' }}>
          <label style={sLabel}>Kelas <span style={{ color: '#DC2626' }}>*</span></label>
          <button type="button" onClick={() => setKelasOpen(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.875rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', background: '#fff', border: selectedKelas ? `1.5px solid ${selectedKelas.warna}` : '2.5px solid #BABFC7', color: '#6F788A', transition: 'border-color 0.15s', boxShadow: '0 2px 4px #BABFC7' }}>
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

        <div style={{ borderTop: '3.5px solid var(--border)', paddingTop: '0.875rem', marginBottom: '0.875rem' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1A2C4E', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>
            Informasi Orang Tua
          </div>
          <div style={{ marginBottom: '0.875rem' }}>
            <label style={sLabel}>Nama Orang Tua</label>
            <input type="text" style={sInput} placeholder="Nama orang tua / wali" value={editNamaWali} onChange={e => setEditNamaWali(e.target.value)} />
          </div>
          <div>
            <label style={sLabel}>Nomor WhatsApp</label>
            <input type="tel" style={{ ...sInput, ...(editNoWaError ? { border: '1.5px solid #EF4444' } : {}) }} placeholder="62812xxxx" value={editNoWa}
              onChange={e => { setEditNoWa(e.target.value); if (editNoWaError) setEditNoWaError('') }} />
            {editNoWaError && <p style={{ fontSize: '0.73rem', color: '#EF4444', margin: '0.3rem 0 0' }}>{editNoWaError}</p>}
          </div>
        </div>

        {editError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '0.65rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.82rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={13} /> {editError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.8rem' }}>
          <button onClick={onClose} disabled={editSaving} style={{ ...sBtnSecondary, flex: 1 }}>Batal</button>
          <button onClick={onSave} disabled={editSaving} style={{ ...sBtnPrimary, flex: 2, opacity: editSaving ? 0.6 : 1 }}>
            {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>

      {kelasOpen && (
        <>
        <style>{`
          @keyframes kelas-edit-in {
            from { opacity: 0; transform: scale(0.92) translateY(12px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);    }
          }
        `}</style>
        <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setKelasOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 360, maxHeight: 'calc(100vh - 4rem)', boxShadow: '0 24px 64px rgba(64,132,234,0.28)', animation: 'kelas-edit-in 0.22s cubic-bezier(0.34,1.56,0.64,1)', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.8rem', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--navy-dark)' }}>Pilih Kelas</span>
              <button onClick={() => setKelasOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: 4 }}>
                <X size={28} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', overflowY: 'auto' }}>
              {kelasList.map(k => {
                const active = editKelasId === k.id
                return (
                  <button key={k.id} type="button"
                    onClick={() => { setEditKelasId(k.id); setKelasOpen(false) }}
                    style={{
                      minHeight: 56, padding: '0.4rem 0.3rem', borderRadius: 7,
                      fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.25,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                      background: k.warna, color: '#fff', whiteSpace: 'normal',
                      wordBreak: 'break-word', textAlign: 'center',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border:    active ? '3px solid #fff' : '2px solid transparent',
                      outline:   active ? `3px solid ${k.warna}` : 'none',
                      boxShadow: active ? `0 4px 14px ${k.warna}88` : `0 2px 6px ${k.warna}44`,
                      transform: active ? 'scale(1.07)' : 'scale(1)',
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
