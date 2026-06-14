'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Pencil, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
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

// ── Types ─────────────────────────────────────────────────────────────────────

type JenisTagihan = 'wajib' | 'ekskul' | 'aktivitas'

interface KomponenItem {
  id:    string
  jenis: string
  nama:  string
  warna: string
}

function darkenHex(hex: string, amount = 60): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - amount)
  const g = Math.max(0, ((n >> 8) & 0xff) - amount)
  const b = Math.max(0, (n & 0xff) - amount)
  return `rgb(${r},${g},${b})`
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

  // View mode state
  const [cardsWajib,     setCardsWajib]     = useState<KomponenItem[]>([])
  const [cardsEkskul,    setCardsEkskul]    = useState<KomponenItem[]>([])
  const [cardsAktivitas, setCardsAktivitas] = useState<KomponenItem[]>([])
  const [komponenTab,    setKomponenTab]    = useState<JenisTagihan>('wajib')

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
          .select('nama, semester_ganjil_mulai, semester_ganjil_selesai, semester_genap_mulai, semester_genap_selesai')
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
        semester_ganjil_mulai:  string; semester_ganjil_selesai:  string
        semester_genap_mulai:   string; semester_genap_selesai:   string
      }
      const ta = taData as TaRow | null
      if (ta?.nama) setTahunAjaran(ta.nama)
      setAutoSemester(detectSemester(
        ta?.semester_ganjil_mulai, ta?.semester_ganjil_selesai,
        ta?.semester_genap_mulai,  ta?.semester_genap_selesai,
      ))

      if (peng?.setup_steps?.['komponen_tagihan'] === true) {
        setSetupDone(true)
        const { data: kRows } = await supabase
          .from('komponen_tagihan')
          .select('id, jenis, nama, kelas_warna')
          .order('created_at')
          .limit(100)

        type KRow = { id: string; jenis: string; nama: string | null; kelas_warna: string | null }
        const rows = (kRows ?? []) as KRow[]
        const toItem = (r: KRow): KomponenItem => ({
          id: r.id, jenis: r.jenis,
          nama: r.nama ?? '', warna: r.kelas_warna ?? WARNA_OPTIONS[0],
        })

        setCardsWajib(rows.filter(r => r.jenis === 'wajib').map(toItem))
        setCardsEkskul(rows.filter(r => r.jenis === 'ekskul').map(toItem))
        setCardsAktivitas(rows.filter(r => r.jenis === 'aktivitas').map(toItem))
      }

      setDataLoading(false)
    })()
  }, [router])

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
            id:         Date.now().toString(),
            jenis:      formTipe,
            nama:       formNama.trim(),
            kelasWarna: formWarna,
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
                    style={{ ...sInput, paddingLeft: '2.5rem' }}
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

  const KOMPONEN_TABS: { key: JenisTagihan; label: string; color: string; cards: KomponenItem[] }[] = [
    { key: 'wajib',     label: 'Tagihan Wajib',  color: 'var(--navy)', cards: cardsWajib     },
    { key: 'ekskul',    label: 'Ekstrakurikuler', color: '#047857',     cards: cardsEkskul    },
    { key: 'aktivitas', label: 'Aktivitas Lain',  color: '#7C3AED',     cards: cardsAktivitas },
  ]
  const activeKomponenCards = KOMPONEN_TABS.find(t => t.key === komponenTab)?.cards ?? []

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <h1 className="dashboard-title">Komponen Tagihan</h1>
            <p className="dashboard-subtitle">{tahunAjaran} · Semester {autoSemester}</p>
          </div>
        </div>
        <button onClick={() => router.push('/tagihan/komponen/edit')}
          style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
          <Pencil size={13} /> Edit Komponen
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)' }}>
          {KOMPONEN_TABS.map(tab => (
            <button key={tab.key} onClick={() => setKomponenTab(tab.key)}
              style={{
                flex: 1, padding: '0.75rem 0.5rem', background: 'none', border: 'none',
                borderBottom: komponenTab === tab.key ? `3px solid ${tab.color}` : '3px solid transparent',
                marginBottom: -2, fontWeight: komponenTab === tab.key ? 700 : 400,
                fontSize: '0.82rem', color: komponenTab === tab.key ? tab.color : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {tab.label}
              <span style={{
                background: komponenTab === tab.key ? tab.color : 'var(--border)',
                color: komponenTab === tab.key ? '#fff' : 'var(--text-muted)',
                fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 20,
              }}>
                {tab.cards.length}
              </span>
            </button>
          ))}
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          {activeKomponenCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Belum ada komponen {KOMPONEN_TABS.find(t => t.key === komponenTab)?.label.toLowerCase()}.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem' }}>
              {activeKomponenCards.map(card => (
                <KomponenCard key={card.id} card={card} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Komponen Card ─────────────────────────────────────────────────────────────

function KomponenCard({ card }: { card: KomponenItem }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: card.warna,
      borderRadius: 10, padding: '0.65rem 1rem',
      boxShadow: `0 2px 12px ${card.warna}55`,
    }}>
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 130, height: 130, background: `linear-gradient(to right, transparent 30%, ${darkenHex(card.warna)} 100%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.875rem', display: 'block', marginBottom: '0.15rem' }}>
          {card.nama}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
          {card.jenis === 'rutin_bulanan' ? 'Rutin Bulanan' : card.jenis === 'sekali_bayar' ? 'Sekali Bayar' : card.jenis === 'per_semester' ? 'Per Semester' : card.jenis}
        </span>
      </div>
    </div>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sLabel:        React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--text-mid)', marginBottom: 4 }
const sInput:        React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2.5px solid #BABFC7', boxShadow: '6px 6px 8px rgba(18, 47, 102, 0.19)',borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const sCard:         React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sBtnPrimary:   React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
