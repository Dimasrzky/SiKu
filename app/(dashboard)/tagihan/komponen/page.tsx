'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle2, XCircle, ChevronDown, Search, Trash2, Plus, LayoutGrid, RefreshCw, Banknote, CalendarDays, Eye, X, Upload, Download, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_ORDER      = ['profil_sekolah', 'tahun_ajaran', 'komponen_tagihan', 'buat_kelas', 'import_siswa']
const THIS_STEP_INDEX = 2

const WARNA_OPTIONS = [
  '#944949', '#2F1F1F', '#2B7B2B', '#5E3333',
  '#401568', '#704E4E', '#AF9191'
]

const TIPE_OPTIONS = [
  { value: 'rutin_bulanan', label: 'Rutin Bulanan' },
  { value: 'sekali_bayar',  label: 'Sekali Bayar'  },
  { value: 'per_semester',  label: 'Per Semester'  },
]

const TIPE_WARNA: Record<string, string> = {
  rutin_bulanan: '#69C183',
  sekali_bayar:  '#3C75B7',
  per_semester:  '#7D7ADC',
}

const DEFAULT_IMPORT_WARNA = '#94A3B8'

const TIPE_ALIAS_MAP: Record<string, string> = {
  'rutin bulanan': 'rutin_bulanan', 'rutin_bulanan': 'rutin_bulanan', 'rutin': 'rutin_bulanan',
  'sekali bayar':  'sekali_bayar',  'sekali_bayar':  'sekali_bayar',  'sekali': 'sekali_bayar',
  'per semester':  'per_semester',  'per_semester':  'per_semester',   'semester': 'per_semester',
}

const IMPORT_TEMPLATE_HEADERS = ['Nama Komponen', 'Tipe Pembayaran', 'Nominal Default', 'Keterangan']

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportKomponenRow {
  no:       number
  nama:     string
  tipeRaw:  string
  tipeVal?: string
  nominal:  string
  keterangan: string
  error?:   string
}

interface KomponenItem {
  id:              string
  jenis:           string
  nama:            string
  warna:           string
  keterangan:      string
  nominal_default: number | null
}

// ── Semester detection ────────────────────────────────────────────────────────

function detectSemester(
  ganjilMulai?:  string, ganjilSelesai?:  string,
  genapMulai?:   string, genapSelesai?:   string,
): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (ganjilMulai && ganjilSelesai) {
    const s = new Date(ganjilMulai); s.setHours(0, 0, 0, 0)
    const e = new Date(ganjilSelesai); e.setHours(23, 59, 59, 999)
    if (today >= s && today <= e) return 'Ganjil'
  }
  if (genapMulai && genapSelesai) {
    const s = new Date(genapMulai); s.setHours(0, 0, 0, 0)
    const e = new Date(genapSelesai); e.setHours(23, 59, 59, 999)
    if (today >= s && today <= e) return 'Genap'
  }
  return today.getMonth() + 1 >= 7 ? 'Ganjil' : 'Genap'
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KomponenTagihanPage() {
  const router = useRouter()

  // ── Core state ──────────────────────────────────────────────────────────────
  const [setupDone,      setSetupDone]      = useState(false)
  const [dataLoading,    setDataLoading]    = useState(true)
  const [tahunAjaran,    setTahunAjaran]    = useState('')
  const [autoSemester,   setAutoSemester]   = useState('')
  const [taMulai,        setTaMulai]        = useState('')
  const [taSelesai,      setTaSelesai]      = useState('')

  // View mode — list + filter
  const [allKomponen,  setAllKomponen]  = useState<KomponenItem[]>([])
  const [searchQuery,  setSearchQuery]  = useState('')
  const [filterTipe,   setFilterTipe]   = useState('semua')

  // Edit modal
  const [editTarget,     setEditTarget]     = useState<KomponenItem | null>(null)
  const [editNama,       setEditNama]       = useState('')
  const [editTipe,       setEditTipe]       = useState('')
  const [editNominal,    setEditNominal]    = useState('')
  const [editKeterangan, setEditKeterangan] = useState('')
  const [editWarna,      setEditWarna]      = useState(WARNA_OPTIONS[0])
  const [editSaving,     setEditSaving]     = useState(false)
  const [editError,      setEditError]      = useState('')

  // Delete modal
  const [deleteTarget,  setDeleteTarget]  = useState<KomponenItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError,   setDeleteError]   = useState('')

  // Detail slide panel
  const [detailTarget,  setDetailTarget]  = useState<KomponenItem | null>(null)
  const [detailClosing, setDetailClosing] = useState(false)

  // Import Excel
  const importFileRef                                       = useRef<HTMLInputElement>(null)
  const [showImportModal,   setShowImportModal]   = useState(false)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [modalDragging,     setModalDragging]     = useState(false)
  const [importPreviewRows, setImportPreviewRows] = useState<ImportKomponenRow[] | null>(null)
  const [importError,       setImportError]       = useState('')
  const [importing,         setImporting]         = useState(false)

  // View mode inline add form
  const [showViewForm,       setShowViewForm]       = useState(false)
  const [viewFormClosing,    setViewFormClosing]    = useState(false)
  const [viewFormNama,       setViewFormNama]       = useState('')
  const [viewFormTipe,       setViewFormTipe]       = useState('')
  const [viewFormNominal,    setViewFormNominal]    = useState('')
  const [viewFormKeterangan, setViewFormKeterangan] = useState('')
  const [viewFormWarna,      setViewFormWarna]      = useState(WARNA_OPTIONS[0])
  const [viewFormSaving,     setViewFormSaving]     = useState(false)
  const [viewFormError,      setViewFormError]      = useState('')

  // Setup mode form state
  const [showForm,       setShowForm]       = useState(false)
  const [formClosing,    setFormClosing]    = useState(false)
  const [formNama,       setFormNama]       = useState('')
  const [formTipe,       setFormTipe]       = useState('')
  const [formNominal,    setFormNominal]    = useState('')
  const [formKeterangan, setFormKeterangan] = useState('')
  const [formWarna,      setFormWarna]      = useState(WARNA_OPTIONS[0])

  // UI state
  const [setupSteps,       setSetupSteps]       = useState<Record<string, boolean>>({})
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState('')
  const [apiError,         setApiError]         = useState('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [showErrorPopup,   setShowErrorPopup]   = useState(false)

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const [{ data: pData }, { data: taData }] = await Promise.all([
        supabase.from('pengaturan').select('setup_steps').maybeSingle(),
        supabase.from('tahun_ajaran')
          .select('nama, tanggal_mulai, tanggal_selesai, semester_ganjil_mulai, semester_ganjil_selesai, semester_genap_mulai, semester_genap_selesai')
          .eq('is_aktif', true)
          .maybeSingle(),
      ])

      const peng = pData as { setup_steps?: Record<string, unknown> } | null
      setSetupSteps((peng?.setup_steps ?? {}) as Record<string, boolean>)

      if (!peng?.setup_steps?.['tahun_ajaran']) {
        router.replace('/tagihan/tahun-ajaran')
        return
      }

      type TaRow = {
        nama: string
        tanggal_mulai: string; tanggal_selesai: string
        semester_ganjil_mulai:  string; semester_ganjil_selesai:  string
        semester_genap_mulai:   string; semester_genap_selesai:   string
      }
      const ta = taData as TaRow | null
      if (ta?.nama) setTahunAjaran(ta.nama)
      if (ta?.tanggal_mulai)  setTaMulai(ta.tanggal_mulai)
      if (ta?.tanggal_selesai) setTaSelesai(ta.tanggal_selesai)
      setAutoSemester(detectSemester(
        ta?.semester_ganjil_mulai, ta?.semester_ganjil_selesai,
        ta?.semester_genap_mulai,  ta?.semester_genap_selesai,
      ))

      if (peng?.setup_steps?.['komponen_tagihan'] === true) {
        setSetupDone(true)

        // Coba fetch dengan kolom lengkap; fallback ke kolom dasar jika kolom baru belum ada
        let kRows: Record<string, unknown>[] | null = null
        const { data: fullRows, error: fullErr } = await supabase
          .from('komponen_tagihan')
          .select('id, jenis, nama, kelas_warna, keterangan, nominal_default')
          .order('created_at')
          .limit(100)

        if (!fullErr) {
          kRows = fullRows as Record<string, unknown>[]
        } else {
          // kolom keterangan/nominal_default belum ada — fallback
          const { data: baseRows } = await supabase
            .from('komponen_tagihan')
            .select('id, jenis, nama, kelas_warna')
            .order('created_at')
            .limit(100)
          kRows = (baseRows ?? []) as Record<string, unknown>[]
        }

        setAllKomponen((kRows ?? []).map(r => ({
          id:              String(r.id ?? ''),
          jenis:           String(r.jenis ?? ''),
          nama:            String(r.nama ?? ''),
          warna:           String(r.kelas_warna ?? WARNA_OPTIONS[0]),
          keterangan:      String(r.keterangan ?? ''),
          nominal_default: typeof r.nominal_default === 'number' ? r.nominal_default : null,
        })))
      }

      setDataLoading(false)
    })()
  }, [router])

  const triggerRecalculate = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    fetch('/api/recalculate-tagihan', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
    }).catch(() => {})
  }

  useEffect(() => {
    if (!showSuccessPopup) return
    const nav = setTimeout(() => router.push('/siswa/manajemen-kelas'), 5000)
    return () => clearTimeout(nav)
  }, [showSuccessPopup, router])

  useEffect(() => {
    if (!showErrorPopup) return
    const close = setTimeout(() => setShowErrorPopup(false), 5000)
    return () => clearTimeout(close)
  }, [showErrorPopup])

  // ── Form helpers ──────────────────────────────────────────────────────────────

  const resetForm = () => {
    setShowForm(false)
    setFormClosing(false)
    setFormNama('')
    setFormTipe('')
    setFormNominal('')
    setFormKeterangan('')
    setFormWarna(WARNA_OPTIONS[0])
    setError('')
  }

  const startCloseForm = () => {
    setFormClosing(true)
    setTimeout(resetForm, 400)
  }

  const handleSimpanForm = async () => {
    setError('')
    if (!formNama.trim()) { setError('Nama komponen harus diisi.'); return }
    if (!formTipe) { setError('Tipe pembayaran harus dipilih.'); return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const nominalNum = parseInt(formNominal.replace(/\./g, ''), 10) || 0
    const res = await fetch('/api/setup-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        step: 'komponen_tagihan',
        data: {
          tahun_ajaran: tahunAjaran,
          semester:     autoSemester,
          komponen: [{
            id:             Date.now().toString(),
            jenis:          formTipe,
            nama:           formNama.trim(),
            kelasWarna:     formWarna,
            keterangan:     formKeterangan.trim() || null,
            nominalDefault: nominalNum > 0 ? nominalNum : null,
            items: nominalNum > 0
              ? [{ id: '1', nama: formNama.trim(), nominal: nominalNum }]
              : [],
          }],
        },
      }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setApiError(json.error ?? 'Gagal menyimpan.'); setShowErrorPopup(true); setSaving(false); return }
    setSaving(false)
    setShowSuccessPopup(true)
  }

  // ── Detail panel handlers ─────────────────────────────────────────────────────

  const openDetail = (k: KomponenItem) => {
    setDetailClosing(false)
    setDetailTarget(k)
  }

  const closeDetail = () => {
    setDetailClosing(true)
    setTimeout(() => { setDetailTarget(null); setDetailClosing(false) }, 350)
  }

  // ── Edit / Delete handlers ────────────────────────────────────────────────────

  const openEdit = (k: KomponenItem) => {
    setEditTarget(k)
    setEditNama(k.nama)
    setEditTipe(k.jenis)
    setEditNominal(k.nominal_default ? k.nominal_default.toLocaleString('id-ID') : '')
    setEditKeterangan(k.keterangan)
    setEditWarna(k.warna)
    setEditError('')
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setEditError('')
    if (!editNama.trim()) { setEditError('Nama komponen harus diisi.'); return }
    if (!editTipe)        { setEditError('Tipe pembayaran harus dipilih.'); return }
    setEditSaving(true)
    const nominalNum = parseInt(editNominal.replace(/\./g, ''), 10) || 0
    const { error } = await supabase
      .from('komponen_tagihan')
      .update({
        nama:            editNama.trim(),
        jenis:           editTipe,
        nominal_default: nominalNum || null,
        keterangan:      editKeterangan.trim() || null,
        kelas_warna:     editWarna,
      })
      .eq('id', editTarget.id)
    if (error) { setEditError(error.message); setEditSaving(false); return }

    // ── Sebarkan perubahan ke paket dan tagihan ──────────────────────────────
    // Penyaringan cukup lewat komponen_id: satu komponen hanya milik satu sekolah.
    type ItemTagihan = { tagihan_id: string; tagihan: { bulan: number; tahun: number; status: string } | null }
    const { data: itemRows } = await supabase
      .from('tagihan_item')
      .select('tagihan_id, tagihan:tagihan_id(bulan, tahun, status)')
      .eq('komponen_id', editTarget.id)
      .limit(5000)
    const items = (itemRows ?? []) as unknown as ItemTagihan[]

    // Nama disebar ke semua tagihan — ini label, bukan uang, jadi aman untuk
    // riwayat dan justru membingungkan kalau tagihan lama memakai nama usang.
    if (editNama.trim() !== editTarget.nama) {
      await supabase
        .from('tagihan_item')
        .update({ nama_komponen: editNama.trim() })
        .eq('komponen_id', editTarget.id)
    }

    if (nominalNum !== (editTarget.nominal_default ?? 0)) {
      await supabase
        .from('paket_komponen')
        .update({ nominal: nominalNum })
        .eq('komponen_id', editTarget.id)

      // Nominal hanya menyentuh tagihan periode berjalan yang masih belum bayar
      // DAN belum punya catatan pembayaran sama sekali. Tagihan periode lalu,
      // yang lunas, dan yang sudah dicicil tetap beku pada nominal terbitnya.
      const now = new Date()
      const kandidat = items
        .filter(i => i.tagihan
          && i.tagihan.bulan  === now.getMonth() + 1
          && i.tagihan.tahun  === now.getFullYear()
          && i.tagihan.status === 'belum_bayar')
        .map(i => i.tagihan_id)

      if (kandidat.length > 0) {
        const { data: bayar } = await supabase
          .from('pembayaran').select('tagihan_id').in('tagihan_id', kandidat)
        const sudahBayar = new Set(((bayar ?? []) as { tagihan_id: string }[]).map(p => p.tagihan_id))
        const target = kandidat.filter(id => !sudahBayar.has(id))

        if (target.length > 0) {
          await supabase
            .from('tagihan_item')
            .update({ nominal: nominalNum })
            .eq('komponen_id', editTarget.id)
            .in('tagihan_id', target)
        }
      }
    }

    setAllKomponen(prev => prev.map(k => k.id === editTarget.id
      ? { ...k, nama: editNama.trim(), jenis: editTipe, nominal_default: nominalNum || null, keterangan: editKeterangan.trim(), warna: editWarna }
      : k
    ))
    setEditTarget(null)
    setEditSaving(false)
    triggerRecalculate()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError('')

    const kompId = deleteTarget.id

    try {
      // Tabel lain mengacu ke komponen ini lewat foreign key, jadi selama acuannya
      // masih ada Postgres menolak penghapusan (23503). Acuan konfigurasi dilepas,
      // tapi riwayat tagihan TIDAK dihapus.
      const lepasAcuan = [
        supabase.from('paket_komponen').delete().eq('komponen_id', kompId),
        supabase.from('siswa_komponen_individu').delete().eq('komponen_id', kompId),
        supabase.from('beasiswa_komponen').delete().eq('komponen_id', kompId),
        supabase.from('komponen_tagihan_item').delete().eq('komponen_id', kompId),
        supabase.from('komponen_tagihan_potongan').delete().eq('komponen_id', kompId),
        // tagihan_item dipertahankan — nama_komponen dan nominalnya adalah snapshot
        // tagihan yang sudah terbit. Cukup acuannya yang dilepas.
        supabase.from('tagihan_item').update({ komponen_id: null }).eq('komponen_id', kompId),
      ]
      // Sebagian tabel turunan tidak ada di semua skema — komponen_tagihan_item dan
      // komponen_tagihan_potongan diacu kode setup tapi belum tentu pernah dibuat.
      // Tabel yang tidak ada berarti tidak ada acuan untuk dilepas, bukan kegagalan.
      const tabelTidakAda = (e: { code?: string; message?: string }) =>
        e.code === 'PGRST205' || e.code === '42P01'
        || (e.message ?? '').includes('Could not find the table')

      for (const q of lepasAcuan) {
        const { error } = await q
        if (error && !tabelTidakAda(error)) throw new Error(error.message)
      }

      const { error } = await supabase.from('komponen_tagihan').delete().eq('id', kompId)
      if (error) throw new Error(error.message)

      setAllKomponen(prev => prev.filter(k => k.id !== kompId))
      setDeleteTarget(null)
      triggerRecalculate()
    } catch (err) {
      setDeleteError(`Gagal menghapus: ${(err as Error).message}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── View mode inline form handlers ────────────────────────────────────────────

  const resetViewForm = () => {
    setShowViewForm(false)
    setViewFormClosing(false)
    setViewFormNama('')
    setViewFormTipe('')
    setViewFormNominal('')
    setViewFormKeterangan('')
    setViewFormWarna(WARNA_OPTIONS[0])
    setViewFormError('')
  }

  const startCloseViewForm = () => {
    setViewFormClosing(true)
    setTimeout(resetViewForm, 400)
  }

  const handleSimpanViewForm = async () => {
    setViewFormError('')
    if (!viewFormNama.trim()) { setViewFormError('Nama komponen harus diisi.'); return }
    if (!viewFormTipe)        { setViewFormError('Tipe pembayaran harus dipilih.'); return }
    setViewFormSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setViewFormError('Sesi tidak ditemukan.'); setViewFormSaving(false); return }

    const { data: profile } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).single()
    if (!profile?.sekolah_id) { setViewFormError('Data sekolah tidak ditemukan.'); setViewFormSaving(false); return }

    const nominalNum = parseInt(viewFormNominal.replace(/\./g, ''), 10) || null

    const { error } = await supabase.from('komponen_tagihan').insert({
      sekolah_id:      profile.sekolah_id,
      jenis:           viewFormTipe,
      nama:            viewFormNama.trim(),
      kelas_warna:     viewFormWarna,
      keterangan:      viewFormKeterangan.trim() || null,
      nominal_default: nominalNum,
      tahun_ajaran:    tahunAjaran,
      semester:        autoSemester,
    })

    if (error) { setViewFormError(error.message); setViewFormSaving(false); return }
    window.location.reload()
  }

  // ── Import Excel handlers ─────────────────────────────────────────────────────

  const downloadKomponenTemplate = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      IMPORT_TEMPLATE_HEADERS,
    ])
    ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Komponen Tagihan')

    const wsTipe = XLSX.utils.aoa_to_sheet([
      ['Tipe Pembayaran (gunakan persis seperti ini)'],
      ['Rutin Bulanan'], ['Sekali Bayar'], ['Per Semester'],
    ])
    wsTipe['!cols'] = [{ wch: 42 }]
    XLSX.utils.book_append_sheet(wb, wsTipe, 'Daftar Tipe')

    XLSX.writeFile(wb, 'template-import-komponen.xlsx')
  }

  const parseKomponenFile = (file: File) => {
    setImportError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

        const parsed: ImportKomponenRow[] = rows.map((row, i) => {
          const nama       = String(row['Nama Komponen']  ?? '').trim()
          const tipeRaw    = String(row['Tipe Pembayaran'] ?? '').trim()
          const nominal    = String(row['Nominal Default'] ?? '').trim()
          const keterangan = String(row['Keterangan']     ?? '').trim()
          const tipeVal    = TIPE_ALIAS_MAP[tipeRaw.toLowerCase()]

          let error: string | undefined
          if (!nama)    error = 'Nama komponen wajib diisi'
          else if (!tipeVal) error = `Tipe "${tipeRaw}" tidak dikenali`

          return { no: i + 1, nama, tipeRaw, tipeVal, nominal, keterangan, error }
        })

        setImportPreviewRows(parsed)
      } catch {
        setImportError('Gagal membaca file. Pastikan format sesuai template.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleKomponenImport = async () => {
    if (!importPreviewRows) return
    const valid = importPreviewRows.filter(r => !r.error)
    if (valid.length === 0) return

    setImporting(true); setImportError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImportError('Sesi tidak ditemukan.'); setImporting(false); return }

    const { data: profile } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).single()
    if (!profile?.sekolah_id) { setImportError('Data sekolah tidak ditemukan.'); setImporting(false); return }

    const rows = valid.map(r => {
      const nominalNum = parseInt(r.nominal.replace(/[^0-9]/g, ''), 10) || null
      return {
        sekolah_id:      profile.sekolah_id as string,
        jenis:           r.tipeVal!,
        nama:            r.nama,
        kelas_warna:     DEFAULT_IMPORT_WARNA,
        keterangan:      r.keterangan || null,
        nominal_default: nominalNum,
        tahun_ajaran:    tahunAjaran,
        semester:        autoSemester,
      }
    })

    const { error } = await supabase.from('komponen_tagihan').insert(rows)
    if (error) { setImportError(error.message); setImporting(false); return }

    setImportPreviewRows(null)
    setShowImportModal(false)
    window.location.reload()
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  // ── SETUP MODE ────────────────────────────────────────────────────────────────

  if (!setupDone) {
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
            <div style={{
              width: 60, height: 60, background: '#1A2C4E', borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)',
            }}>
              <Image src="/icons/IconKomponen.png" width={35} height={35} alt="Komponen Tagihan" style={{ display: 'block' }} />
            </div>
            <div>
              <h1 style={{
                fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)',
                fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2,
              }}>
                Atur komponen tagihan
              </h1>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                Langkah 3 dari 5
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            {STEP_ORDER.map((_, i) => {
              const isActive = i === greenCount - 1
              return (
                <div key={i} className={isActive ? 'dot-active' : undefined}
                  style={{
                    width: 16, height: 16, borderRadius: '50%',
                    position: 'relative', bottom: 10, right: 6,
                    background: i < greenCount ? '#69C183' : '#CBD5E1',
                    transition: 'background 0.2s',
                    boxShadow: '3px 6px 14px rgba(26, 44, 78, 0.58)',
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* Info Banner */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
          background: '#1A2C4E', borderRadius: 12,
          padding: '1rem 1.25rem', marginBottom: '1.5rem', color: '#fff',
          boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)',
        }}>
          <p style={{ flex: 1, fontSize: '1.1rem', lineHeight: 1.65, margin: 0 }}>
            Komponen tagihan menentukan jenis biaya yang akan ditagihkan ke siswa.<br />
            Isi komponen tagihan sesuai dengan kebutuhan sekolahmu.
          </p>
          <div style={{
            flexShrink: 0, marginLeft: 'auto', width: 40, height: 40,
            background: '#F7DD7D', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', top: '-0.4rem', right: '-0.65rem',
          }}>
            <Image src="/icons/IconTSeru.png" width={3.5} height={3.5} alt="Info" style={{ display: 'block' }} />
          </div>
        </div>

        {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Form card — grid-template-rows transition dari tinggi aktual, bukan max-height arbitrary */}
        <div style={{
          display: 'grid',
          gridTemplateRows: showForm && !formClosing ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.38s cubic-bezier(0.4,0,0.2,1)',
        }}>
        <div style={{ overflow: 'hidden', paddingBottom: showForm && !formClosing ? '1.1rem' : 0, paddingRight: '1.5rem', marginRight: '-1.5rem' }}>
        {showForm && (
          <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)', animation: formClosing ? 'formSlideUp 0.26s cubic-bezier(0.22,1,0.36,1) forwards' : 'formSlideDown 0.3s cubic-bezier(0.22,1,0.36,1)' }}>

            {/* Baris 1: Nama komponen + Tipe pembayaran */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={sLabel}>Nama komponen</label>
                <input
                  type="text"
                  placeholder="Contoh: SPP, Uang Gedung"
                  value={formNama}
                  onChange={e => setFormNama(e.target.value)}
                  style={sInput}
                  autoFocus
                />
              </div>
              <div>
                <label style={sLabel}>Tipe pembayaran</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={formTipe}
                    onChange={e => setFormTipe(e.target.value)}
                    style={{
                      ...sInput, appearance: 'none', WebkitAppearance: 'none',
                      paddingRight: '2.5rem',
                      fontWeight: formTipe ? 600 : 600,
                      color: formTipe ? 'var(--text-dark)' : '#1A2C4E',
                    }}
                  >
                    <option value="" disabled hidden>Pilih tipe</option>
                    {TIPE_OPTIONS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} color="#6F788A" style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            {/* Baris 2: Nominal default + Keterangan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.4rem' }}>
              <div>
                <label style={sLabel}>
                  Nominal default{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '0.875rem', color: 'var(--text-muted)', pointerEvents: 'none', userSelect: 'none',
                  }}>
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formNominal}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      const num = parseInt(raw, 10)
                      setFormNominal(raw ? num.toLocaleString('id-ID') : '')
                    }}
                    style={{ ...sInput, padding: '0.65rem 0.85rem 0.65rem 2.5rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={sLabel}>
                  Keterangan{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Dibayar tiap awal bulan"
                  value={formKeterangan}
                  onChange={e => setFormKeterangan(e.target.value)}
                  style={sInput}
                />
              </div>
            </div>

            {/* Info */}
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F788A', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>ⓘ</span>
              Bisa berbeda per kelas saat assign ke paket
            </p>

            <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

            {/* Pilih warna komponen */}
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
              {/* Kiri: label + swatches */}
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>
                  Pilih warna komponen
                </div>
                <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                  Membedakan komponen secara visual di grafik &amp; laporan dashboard
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

            {/* Review tampilan */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.8rem' }}>
                Review tampilan
              </div>

              {!formNama.trim() ? (
                <div style={{
                  border: '2.5px solid #BABFC7', borderRadius: 12,
                  padding: '1.1rem 1.4rem', background: '#E7E9EC',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#64748B', marginBottom: '0.25rem' }}>
                    Komponen tagihan yang akan dibuat
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>
                    Isi nama &amp; tipe pembayaran untuk melihat tampilan
                  </div>
                </div>
              ) : (
                <div style={{
                  border: '2px solid #BABFC7', borderRadius: 12,
                  padding: '1rem 1.25rem', background: '#E7E9EC',
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 10, background: formWarna,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.02em' }}>
                      {formNama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}
                    </span>
                  </div>

                  {/* Nama + badge + keterangan */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>
                        {formNama}
                      </span>
                      {formTipe && (
                        <span style={{
                          background: TIPE_WARNA[formTipe] ?? formWarna, color: '#fff',
                          fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px',
                          borderRadius: 20, flexShrink: 0,
                        }}>
                          {TIPE_OPTIONS.find(t => t.value === formTipe)?.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {formKeterangan.trim() || <span style={{ color: '#8a8e94' }}>Belum ada keterangan</span>}
                    </div>
                  </div>

                  {/* Separator tegak */}
                  <div style={{ width: 1.5, height: 40, background: '#CBD5E1', flexShrink: 0, marginLeft: '1%' }} />

                  {/* Nominal */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Nominal default
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>
                      {formNominal ? `Rp ${formNominal}` : <span style={{ color: '#878c92' }}>—</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <button
                onClick={startCloseForm}
                style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, marginLeft: '640px', height: '2.8rem', fontSize: '0.85rem', fontWeight: 700, border: 'none', background: '#F7DD7D', color: '#1A2C4E', boxShadow: saving ? 'none' : '0 5px 2px rgba(18, 47, 102, 0.31)', }}
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
                  display: 'flex', alignItems: 'center', gap: 14,
                }}
              >
                {saving ? 'Menyimpan...' : 'Simpan & Lanjutkan'} <Image src="/icons/IconArrowKanan.png" width={12} height={12} alt="Simpan" />
              </button>
            </div>
          </div>
        )}
        </div>{/* end overflow:hidden */}
        </div>{/* end grid wrapper */}

        {/* Daftar komponen / empty state */}
        <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)'}}>
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
                Buat Komponen Baru <Image src="/icons/IconEdit2.png" width={20} height={20} alt="Tambah" style={{ display: 'block' }} />
              </button>
            </div>
          )}
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <Image src="/icons/IconNotDocument.png" width={80} height={80} alt="Tidak Ada Komponen" style={{ margin: '0 auto 0.875rem', display: 'block' }} />
            <p style={{ fontWeight: 700, fontSize: '1.2rem', color: '#6F788A', margin: '0 0 0.35rem' }}>
              Belum ada komponen tagihan
            </p>
            <p style={{ fontSize: '1rem', color: '#6F788A', margin: 0 }}>
              Tambahkan komponen baru
            </p>
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
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>Komponen tagihan berhasil disimpan.</p>
                <button onClick={() => router.push('/siswa/manajemen-kelas')} style={{ ...sBtnPrimary, width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}>
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

  // ── VIEW MODE ─────────────────────────────────────────────────────────────────

  const countRutin    = allKomponen.filter(k => k.jenis === 'rutin_bulanan').length
  const countSekali   = allKomponen.filter(k => k.jenis === 'sekali_bayar').length
  const countSemester = allKomponen.filter(k => k.jenis === 'per_semester').length

  const filteredKomponen = allKomponen
    .filter(k => filterTipe === 'semua' || k.jenis === filterTipe)
    .filter(k => k.nama.toLowerCase().includes(searchQuery.toLowerCase()))

  const FORM_WARNA_EDIT   = WARNA_OPTIONS.slice(0, 7)
  const isCustomWarnaEdit = !FORM_WARNA_EDIT.includes(editWarna)
  const isCustomViewWarna = !WARNA_OPTIONS.includes(viewFormWarna)
  const viewFormInisial   = viewFormNama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')

  const TABS = [
    { value: 'semua',         label: 'Semua'        },
    { value: 'rutin_bulanan', label: 'Rutin Bulanan' },
    { value: 'sekali_bayar',  label: 'Sekali Bayar'  },
    { value: 'per_semester',  label: 'Per Semester'  },
  ]

  return (
    <>
    <style>{`
      @keyframes modalBackdrop    { from { opacity: 0; } to { opacity: 1; } }
      @keyframes modalCard        { from { opacity: 0; transform: scale(0.92) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      @keyframes formSlideDown    { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      @keyframes formSlideUp      { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
      @keyframes panelSlideIn     { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes panelSlideOut    { from { transform: translateX(0); } to { transform: translateX(100%); } }
      @keyframes panelFadeIn      { from { opacity: 0; } to { opacity: 1; } }
      @keyframes panelFadeOut     { from { opacity: 1; } to { opacity: 0; } }
    `}</style>
    <div className="dashboard-content">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 56, height: 56, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 16px rgba(26,44,78,0.3)' }}>
            <Image src="/icons/IconKomponen.png" width={30} height={30} alt="Komponen" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-dark)', margin: 0, lineHeight: 1.1, fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Komponen Tagihan
            </h1>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
              Kelola item pembayaran
            </p>
          </div>
        </div>
        {!showViewForm && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { setShowImportModal(true); setPendingImportFile(null); setImportError('') }}
              style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}
            >
              <Upload size={14} /> Import Excel
            </button>
            <button
              onClick={() => { setShowViewForm(true); setViewFormClosing(false) }}
              style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', padding: '0.6rem 1.25rem', background: '#1A2C4E' }}
            >
              <Plus size={15} /> Komponen Baru
            </button>
          </div>
        )}
      </div>

      {/* ── Preview tabel (muncul setelah modal ditutup) ── */}
      {importPreviewRows && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CheckCircle2 size={16} color="#16A34A" />
              <span style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.875rem' }}>
                Preview — {importPreviewRows.filter(r => !r.error).length} baris valid
                {importPreviewRows.filter(r => r.error).length > 0 && (
                  <span style={{ color: '#DC2626', fontWeight: 400 }}>, {importPreviewRows.filter(r => r.error).length} baris error</span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setImportPreviewRows(null)}
                style={{ ...sBtnSecondary, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Batal</button>
              <button onClick={handleKomponenImport} disabled={importing || importPreviewRows.filter(r => !r.error).length === 0}
                style={{ ...sBtnPrimary, padding: '0.4rem 1rem', fontSize: '0.8rem', background: '#1A2C4E', opacity: (importing || importPreviewRows.filter(r => !r.error).length === 0) ? 0.6 : 1 }}>
                {importing ? 'Mengimpor...' : `Import ${importPreviewRows.filter(r => !r.error).length} Komponen →`}
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
                  {['No', 'Nama Komponen', 'Tipe Pembayaran', 'Nominal Default', 'Keterangan', 'Status'].map(h => (
                    <th key={h} style={{ padding: '0.55rem 0.875rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importPreviewRows.map(row => (
                  <tr key={row.no} style={{ background: row.error ? '#FEF2F2' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-muted)', width: 36 }}>{row.no}</td>
                    <td style={{ padding: '0.5rem 0.875rem', fontWeight: 600, color: 'var(--navy-dark)' }}>{row.nama || '—'}</td>
                    <td style={{ padding: '0.5rem 0.875rem' }}>
                      {row.tipeVal
                        ? <span style={{ background: TIPE_WARNA[row.tipeVal] ?? '#94A3B8', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{TIPE_OPTIONS.find(t => t.value === row.tipeVal)?.label}</span>
                        : <span style={{ color: '#DC2626' }}>{row.tipeRaw || '—'}</span>
                      }
                    </td>
                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-mid)' }}>{row.nominal ? `Rp ${parseInt(row.nominal.replace(/[^0-9]/g, ''), 10).toLocaleString('id-ID')}` : '—'}</td>
                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-mid)' }}>{row.keterangan || '—'}</td>
                    <td style={{ padding: '0.5rem 0.875rem' }}>
                      {row.error
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEE2E2', color: '#DC2626', padding: '0.18rem 0.5rem', borderRadius: 5, fontSize: '0.72rem', fontWeight: 600 }}><AlertCircle size={10} /> {row.error}</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#DCFCE7', color: '#16A34A', padding: '0.18rem 0.5rem', borderRadius: 5, fontSize: '0.72rem', fontWeight: 600 }}><CheckCircle2 size={10} /> Valid</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Inline Form Tambah Komponen ── */}
      <div style={{
        display: 'grid',
        gridTemplateRows: showViewForm && !viewFormClosing ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.38s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ overflow: 'hidden', paddingBottom: showViewForm && !viewFormClosing ? '1.5rem' : 0, transition: 'padding-bottom 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
          {showViewForm && (
            <div style={{ animation: viewFormClosing ? 'formSlideUp 0.26s cubic-bezier(0.22,1,0.36,1) forwards' : 'formSlideDown 0.3s cubic-bezier(0.22,1,0.36,1)' }}>
              <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>

                {viewFormError && <div className="login-error" style={{ marginBottom: '1rem' }}>{viewFormError}</div>}

                {/* Baris 1: Nama + Tipe */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={sLabel}>Nama komponen</label>
                    <input type="text" placeholder="Contoh: SPP, Uang Gedung"
                      value={viewFormNama} onChange={e => setViewFormNama(e.target.value)}
                      style={sInput} autoFocus />
                  </div>
                  <div>
                    <label style={sLabel}>Tipe pembayaran</label>
                    <div style={{ position: 'relative' }}>
                      <select value={viewFormTipe} onChange={e => setViewFormTipe(e.target.value)}
                        style={{ ...sInput, appearance: 'none', WebkitAppearance: 'none', padding: '0.65rem 2.5rem 0.65rem 0.85rem', color: viewFormTipe ? 'var(--text-dark)' : '#1A2C4E' }}>
                        <option value="" disabled hidden>Pilih tipe</option>
                        {TIPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <ChevronDown size={16} color="#6F788A" style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                  </div>
                </div>

                {/* Baris 2: Nominal + Keterangan */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.4rem' }}>
                  <div>
                    <label style={sLabel}>Nominal default <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span></label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: 'var(--text-muted)', pointerEvents: 'none', userSelect: 'none' }}>Rp</span>
                      <input type="text" inputMode="numeric" placeholder="0"
                        value={viewFormNominal}
                        onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); const num = parseInt(raw, 10); setViewFormNominal(raw ? num.toLocaleString('id-ID') : '') }}
                        style={{ ...sInput, padding: '0.65rem 0.85rem 0.65rem 2.5rem' }} />
                    </div>
                  </div>
                  <div>
                    <label style={sLabel}>Keterangan <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span></label>
                    <input type="text" placeholder="Contoh: Dibayar tiap awal bulan"
                      value={viewFormKeterangan} onChange={e => setViewFormKeterangan(e.target.value)}
                      style={sInput} />
                  </div>
                </div>

                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F788A', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span>ⓘ</span> Bisa berbeda per kelas saat assign ke paket
                </p>

                <div style={{ height: 1.5, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                {/* Pilih warna */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Pilih warna komponen</div>
                  <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                    Membedakan komponen secara visual di grafik &amp; laporan dashboard
                  </div>
                  <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', background: '#FFFFFF', border: '3px solid #BABFC7', borderRadius: 13, padding: '0.5rem 0.75rem', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
                    {WARNA_OPTIONS.map(w => (
                      <button key={w} onClick={() => setViewFormWarna(w)}
                        style={{ width: 30, height: 30, borderRadius: 8, background: w, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: viewFormWarna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none', transition: 'all 0.15s' }} />
                    ))}
                    <label style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, cursor: 'pointer' }}>
                      <input type="color" value={viewFormWarna} onChange={e => setViewFormWarna(e.target.value)}
                        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }} />
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: isCustomViewWarna ? viewFormWarna : 'transparent', boxShadow: isCustomViewWarna ? `0 0 0 2px #fff, 0 0 0 4px ${viewFormWarna}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        {!isCustomViewWarna && <Image src="/icons/IconPipet.png" width={18} height={18} alt="Pipet" />}
                      </div>
                    </label>
                  </div>
                </div>

                <div style={{ height: 1.5, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                {/* Review tampilan */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.8rem' }}>Review tampilan</div>
                  {!viewFormNama.trim() ? (
                    <div style={{ border: '2.5px solid #BABFC7', borderRadius: 12, padding: '1.1rem 1.4rem', background: '#E7E9EC' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#64748B', marginBottom: '0.25rem' }}>Komponen tagihan yang akan dibuat</div>
                      <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>Isi nama &amp; tipe pembayaran untuk melihat tampilan</div>
                    </div>
                  ) : (
                    <div style={{ border: '2px solid #BABFC7', borderRadius: 12, padding: '1rem 1.25rem', background: '#E7E9EC', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.18)' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 10, background: viewFormWarna, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.02em' }}>{viewFormInisial}</span>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>{viewFormNama}</span>
                          {viewFormTipe && (
                            <span style={{ background: TIPE_WARNA[viewFormTipe] ?? viewFormWarna, color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, flexShrink: 0 }}>
                              {TIPE_OPTIONS.find(t => t.value === viewFormTipe)?.label}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {viewFormKeterangan.trim() || <span style={{ color: '#8a8e94' }}>Belum ada keterangan</span>}
                        </div>
                      </div>
                      <div style={{ width: 1.5, height: 40, background: '#CBD5E1', flexShrink: 0, marginLeft: '1%' }} />
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Nominal default</div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>
                          {viewFormNominal ? `Rp ${viewFormNominal}` : <span style={{ color: '#878c92' }}>—</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button onClick={startCloseViewForm}
                    style={{ background: '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.6rem 1.1rem', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)' }}>
                    Batalkan Pembuatan <Image src="/icons/IconsXCircle.png" width={16} height={16} alt="Batal" />
                  </button>
                  <button onClick={handleSimpanViewForm} disabled={viewFormSaving}
                    style={{ background: viewFormSaving ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.7rem 1.5rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: viewFormSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.15s', boxShadow: viewFormSaving ? 'none' : '0 5px 2px rgba(18, 47, 102, 0.31)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {viewFormSaving ? 'Menyimpan...' : 'Simpan & Lanjutkan'}{!viewFormSaving && <Image src="/icons/IconArrowKanan.png" width={12} height={12} alt="Simpan" />}
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Card ── */}
      <div style={{ background: '#fff', borderLeft: '25px solid #1A2C4E', borderRadius: 16, overflow: 'hidden', boxShadow: '0 0 20px rgba(26, 44, 78, 0.77)' }}>

        {/* Card header */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem'}}>
          <div style={{ width: 70, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Image src="/icons/IconWaktu.png" width={26} height={26} alt="Komponen" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1.2 }}>
                {tahunAjaran.replace('/', ' / ')}
              </div>
              <span style={{ background: '#69C183', border: '2.5px solid #C1E6CC', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, padding: '1px 14px', borderRadius: 20 }}>
                Aktif
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>
              {taMulai && taSelesai
                ? `${new Date(taMulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(taSelesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : `Semester ${autoSemester}`}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ padding: '0 1.5rem 1.25rem', display: 'flex', gap: '0.875rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
          <div style={sStatCard}>
            <div>
              <div style={sStatLabel}>Total komponen</div>
              <div style={sStatValue}>{allKomponen.length}</div>
            </div>
            <LayoutGrid size={22} color="#1A2C4E" />
          </div>
          <div style={sStatCard}>
            <div>
              <div style={sStatLabel}>Rutin bulanan</div>
              <div style={sStatValue}>{countRutin}</div>
            </div>
            <RefreshCw size={22} color="#1A2C4E" />
          </div>
          <div style={sStatCard}>
            <div>
              <div style={sStatLabel}>Sekali bayar</div>
              <div style={sStatValue}>{countSekali}</div>
            </div>
            <Banknote size={22} color="#1A2C4E" />
          </div>
          <div style={sStatCard}>
            <div>
              <div style={sStatLabel}>Per semester</div>
              <div style={sStatValue}>{countSemester}</div>
            </div>
            <CalendarDays size={22} color="#1A2C4E" />
          </div>
        </div>

        {/* Short separator */}
        <div style={{ padding: '0 1.5rem' }}>
          <div style={{ height: 1, background: '#C1C6CF', width: '100%', marginBottom: '2rem' }} />
        </div>

        {/* Tabs + Search */}
        <div style={{ padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.6rem' }}>
          <div style={{ display: 'flex', marginLeft: '-0.75rem' }}>
            {TABS.map(tab => (
              <button key={tab.value} onClick={() => setFilterTipe(tab.value)}
                style={{ background: 'none', borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', fontWeight: filterTipe === tab.value ? 700 : 500, color: '#1A2C4E', padding: '0.3rem 0.75rem', transition: 'all 0.15s' }}>
                <span style={{ display: 'inline-block', borderBottom: filterTipe === tab.value ? '4px solid #1A2C4E' : '3px solid transparent', paddingBottom: '0.25rem', transition: 'border-color 0.15s' }}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input placeholder="Cari nama komponen" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ ...sInput, padding: '0.3rem 0.85rem 0.3rem 2.25rem', width: 400, border: '3px solid #C1C6CF', boxShadow: 'none', fontSize: '0.875rem' }} />
          </div>
        </div>

        {/* Scrollable list */}
        <div style={{ maxHeight: '480px', overflowY: 'auto', marginRight: '1.5rem' }}>
          {filteredKomponen.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {allKomponen.length === 0 ? 'Belum ada komponen tagihan.' : 'Tidak ada komponen yang sesuai filter.'}
            </div>
          ) : (
            filteredKomponen.map((k, i) => (
              <div key={k.id} style={{ paddingLeft: '1.5rem', paddingRight: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 0' }}>
                {/* Avatar */}
                <div style={{ width: 48, height: 48, borderRadius: 10, background: k.warna, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.02em' }}>
                    {k.nama.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}
                  </span>
                </div>
                {/* Nama + badge / keterangan */}
                <div style={{ width: 240, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'nowrap', overflow: 'hidden' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{k.nama}</span>
                    <span style={{ background: TIPE_WARNA[k.jenis] ?? k.warna, color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, flexShrink: 0 }}>
                      {TIPE_OPTIONS.find(t => t.value === k.jenis)?.label ?? k.jenis}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {k.keterangan.trim() || <span style={{ color: '#8a8e94' }}>Belum ada keterangan</span>}
                  </div>
                </div>
                {/* Separator tegak */}
                <div style={{ width: 1.5, height: 40, background: '#CBD5E1', flexShrink: 0, marginLeft: '1%' }} />
                {/* Nominal default */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Nominal default</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>
                    {k.nominal_default != null ? `Rp ${k.nominal_default.toLocaleString('id-ID')}` : <span style={{ color: '#878c92' }}>—</span>}
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                {/* Eye / Edit / Delete */}
                <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0, position:'relative', right: 20 }}>
                  <button onClick={() => openDetail(k)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.45rem', display: 'flex', alignItems: 'center' }}>
                    <Eye size={18} />
                  </button>
                  <button onClick={() => openEdit(k)}
                    style={{ background: 'transparent', borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.45rem', display: 'flex', alignItems: 'center' }}>
                    <Image src="/icons/IconEdit2.png" width={16} height={16} alt="Edit" />
                  </button>
                  <button onClick={() => setDeleteTarget(k)}
                    style={{ background: '#DA8181', borderRadius: '4px', cursor: 'pointer', color: '#ffffff', padding: '0.45rem', display: 'flex', alignItems: 'center', boxShadow: '2px 4px 4px #a8a8a88c' }}>
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
              {i < filteredKomponen.length - 1 && (
                <div style={{ height: 1, background: '#C1C6CF' }} />
              )}
              </div>
            ))
          )}
        </div>

      </div>

      {/* ── Edit Modal ── */}
      {editTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.2s ease' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, padding: '1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 1.25rem' }}>Edit Komponen</h3>

            {editError && <div className="login-error" style={{ marginBottom: '1rem' }}>{editError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={sLabel}>Nama komponen</label>
                <input value={editNama} onChange={e => setEditNama(e.target.value)} style={sInput} />
              </div>
              <div>
                <label style={sLabel}>Tipe pembayaran</label>
                <div style={{ position: 'relative' }}>
                  <select value={editTipe} onChange={e => setEditTipe(e.target.value)} style={{ ...sInput, appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}>
                    <option value="" disabled hidden>Pilih tipe</option>
                    {TIPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <ChevronDown size={15} color="#6F788A" style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={sLabel}>Nominal default <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span></label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>Rp</span>
                  <input type="text" inputMode="numeric" placeholder="0"
                    value={editNominal}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      const num = parseInt(raw, 10)
                      setEditNominal(raw ? num.toLocaleString('id-ID') : '')
                    }}
                    style={{ ...sInput, padding: '0.65rem 0.85rem 0.65rem 2.5rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={sLabel}>Keterangan <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span></label>
                <input value={editKeterangan} onChange={e => setEditKeterangan(e.target.value)} style={sInput} />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ ...sLabel, marginBottom: 8 }}>Warna komponen</label>
              <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', background: '#fff', border: '2.5px solid #BABFC7', borderRadius: 13, padding: '0.5rem 0.75rem' }}>
                {FORM_WARNA_EDIT.map(w => (
                  <button key={w} onClick={() => setEditWarna(w)} style={{ width: 28, height: 28, borderRadius: 8, background: w, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: editWarna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none', transition: 'all 0.15s' }} />
                ))}
                <label style={{ position: 'relative', width: 30, height: 30, cursor: 'pointer', flexShrink: 0 }}>
                  <input type="color" value={editWarna} onChange={e => setEditWarna(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }} />
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: isCustomWarnaEdit ? editWarna : 'transparent', boxShadow: isCustomWarnaEdit ? `0 0 0 2px #fff, 0 0 0 4px ${editWarna}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                    {!isCustomWarnaEdit && <Image src="/icons/IconPipet.png" width={16} height={16} alt="Pipet" />}
                  </div>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditTarget(null)} style={sBtnSecondary}>Batal</button>
              <button onClick={handleEdit} disabled={editSaving} style={{ ...sBtnPrimary, background: editSaving ? '#D1D5DB' : '#1A2C4E' }}>
                {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.2s ease' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: '1.75rem', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Trash2 size={26} color="#EF4444" />
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
              Anda yakin ingin menghapus <strong>{deleteTarget.nama}</strong>?
            </p>
            <p style={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 600, margin: '0 0 0.75rem' }}>
              Komponen ini akan dikeluarkan dari semua paket kelas, komponen individu siswa,
              dan kaitan beasiswa.
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.55 }}>
              Tagihan yang sudah terbit tetap utuh — rincian dan nominalnya disimpan sebagai
              riwayat. Tagihan bulan berjalan akan dihitung ulang tanpa komponen ini.
            </p>

            {deleteError && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.78rem', fontWeight: 600, marginBottom: '1rem', textAlign: 'left' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => { setDeleteTarget(null); setDeleteError('') }} style={{ ...sBtnSecondary, flex: 1 }}>Batal</button>
              <button onClick={handleDelete} disabled={deleteLoading}
                style={{ flex: 1, background: deleteLoading ? '#D1D5DB' : '#EF4444', color: '#fff', border: 'none', padding: '0.65rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: deleteLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

      {/* ── Detail Slide Panel ── */}
      {detailTarget && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeDetail}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9998,
              animation: detailClosing ? 'panelFadeOut 0.35s ease forwards' : 'panelFadeIn 0.25s ease',
            }}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 380,
            background: '#fff', zIndex: 9999,
            boxShadow: '-8px 0 32px rgba(26,44,78,0.22)',
            display: 'flex', flexDirection: 'column',
            animation: detailClosing ? 'panelSlideOut 0.35s cubic-bezier(0.4,0,0.2,1) forwards' : 'panelSlideIn 0.35s cubic-bezier(0.22,1,0.36,1)',
          }}>
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1.5px solid #E2E8F0' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--navy-dark)' }}>Detail Komponen</span>
              <button onClick={closeDetail} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6F788A', display: 'flex', alignItems: 'center', padding: '0.25rem' }}>
                <X size={20} />
              </button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 1.5rem' }}>

              {/* Avatar + badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
                <div style={{ width: 60, height: 60, borderRadius: 14, background: detailTarget.warna, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '0.02em' }}>
                    {detailTarget.nama.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}
                  </span>
                </div>
                <div>
                  <span style={{ background: TIPE_WARNA[detailTarget.jenis] ?? detailTarget.warna, color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '3px 12px', borderRadius: 20 }}>
                    {TIPE_OPTIONS.find(t => t.value === detailTarget.jenis)?.label ?? detailTarget.jenis}
                  </span>
                </div>
              </div>

              {/* Nama lengkap */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Nama Komponen</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                  {detailTarget.nama}
                </div>
              </div>

              <div style={{ height: 1, background: '#E2E8F0', marginBottom: '1.5rem' }} />

              {/* Keterangan lengkap */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Keterangan</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: detailTarget.keterangan.trim() ? 'var(--navy-dark)' : '#94A3B8', lineHeight: 1.65, wordBreak: 'break-word' }}>
                  {detailTarget.keterangan.trim() || 'Belum ada keterangan'}
                </div>
              </div>

              <div style={{ height: 1, background: '#E2E8F0', marginBottom: '1.5rem' }} />

              {/* Nominal default */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Nominal Default</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                  {detailTarget.nominal_default != null
                    ? `Rp ${detailTarget.nominal_default.toLocaleString('id-ID')}`
                    : <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: '0.95rem' }}>Tidak ada nominal default</span>}
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ── Import Modal ── */}
      {showImportModal && (
        <>
        <style>{`@keyframes ic-in { from{opacity:0;transform:scale(0.94) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)} }`}</style>
        <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => { setShowImportModal(false); setPendingImportFile(null) }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'ic-in 0.22s cubic-bezier(0.34,1.56,0.64,1)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Upload size={18} color="#64748B" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1A2C4E' }}>Import Excel</div>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Import data komponen tagihan dari file Excel</div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>

              {/* Info card */}
              <div style={{ border: '1.5px solid #DBEAFE', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1rem', background: '#F8FAFF' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 52, height: 52, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Download size={22} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A2C4E' }}>Import via Excel</div>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 2 }}>Harus download template *</div>
                    </div>
                  </div>
                  <button onClick={downloadKomponenTemplate}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FBCECE', color: '#C0392B', border: 'none', borderRadius: 20, padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    <Download size={13} /> Download Template
                  </button>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setModalDragging(true) }}
                  onDragLeave={() => setModalDragging(false)}
                  onDrop={e => { e.preventDefault(); setModalDragging(false); const f = e.dataTransfer.files[0]; if (f) setPendingImportFile(f) }}
                  onClick={() => importFileRef.current?.click()}
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
                <button onClick={() => { setShowImportModal(false); setPendingImportFile(null) }} style={{ ...sBtnSecondary, padding: '0.6rem 1.5rem' }}>Batal</button>
                <button
                  onClick={() => { if (pendingImportFile) { parseKomponenFile(pendingImportFile); setShowImportModal(false); setPendingImportFile(null) } }}
                  disabled={!pendingImportFile}
                  style={{ ...sBtnPrimary, padding: '0.6rem 1.5rem', background: '#1A2C4E', opacity: pendingImportFile ? 1 : 0.45, cursor: pendingImportFile ? 'pointer' : 'not-allowed' }}>
                  Preview Data
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      <input ref={importFileRef} type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) setPendingImportFile(f); e.target.value = '' }} style={{ display: 'none' }} />

    </>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sLabel:        React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--text-mid)', marginBottom: 4 }
const sInput:        React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2.5px solid #BABFC7', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.19)',borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const sCard:         React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sBtnPrimary:   React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.3rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sStatCard:     React.CSSProperties = { background: '#ffffff', borderRadius: 16, padding: '0.875rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', boxShadow: '0 0 20px rgba(31, 85, 167, 0.52)', flex: 1, minWidth: 0 }
const sStatLabel:    React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 18 }
const sStatValue:    React.CSSProperties = { fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1 }
