'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, Receipt, X, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STEP_ORDER      = ['profil_sekolah', 'tahun_ajaran', 'komponen_tagihan', 'buat_kelas', 'import_siswa']
const THIS_STEP_INDEX = 2

const WARNA_OPTIONS = [
  '#1A3557', '#1D4ED8', '#0891B2', '#059669',
  '#D97706', '#DC2626', '#7C3AED', '#BE185D',
]

// ── Types ─────────────────────────────────────────────────────────────────────

type JenisTagihan = 'wajib' | 'ekskul' | 'aktivitas'

interface KomponenItem {
  id:    string
  jenis: JenisTagihan
  nama:  string
  warna: string
}

interface SimpleModal {
  open:     boolean
  mode:     'add' | 'edit'
  editId?:  string
  jenis:    JenisTagihan
  nama:     string
  warna:    string
}

// ── Tagihan DB types ──────────────────────────────────────────────────────────

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
  // fallback: bulan 7–12 = Ganjil, 1–6 = Genap
  return today.getMonth() + 1 >= 7 ? 'Ganjil' : 'Genap'
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KomponenTagihanPage() {
  const router = useRouter()

  // Setup mode state
  const [setupDone,      setSetupDone]      = useState(false)
  const [dataLoading,    setDataLoading]    = useState(true)
  const [tahunAjaran,    setTahunAjaran]    = useState('')
  const [autoSemester,   setAutoSemester]   = useState('')
  const [cardsWajib,     setCardsWajib]     = useState<KomponenItem[]>([])
  const [cardsEkskul,    setCardsEkskul]    = useState<KomponenItem[]>([])
  const [cardsAktivitas, setCardsAktivitas] = useState<KomponenItem[]>([])
  const [activeTab,      setActiveTab]      = useState<JenisTagihan>('wajib')
  const [modal,          setModal]          = useState<SimpleModal>({
    open: false, mode: 'add', jenis: 'wajib', nama: '', warna: WARNA_OPTIONS[0],
  })
  const [setupSteps,     setSetupSteps]     = useState<Record<string, boolean>>({})
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')

  const [komponenTab, setKomponenTab] = useState<JenisTagihan>('wajib')

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

      // Guard: redirect jika tahun_ajaran belum selesai
      if (!peng?.setup_steps?.['tahun_ajaran']) {
        router.replace('/tagihan/tahun-ajaran')
        return
      }

      // Tahun ajaran & semester dari tabel tahun_ajaran
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
          id: r.id, jenis: r.jenis as JenisTagihan,
          nama: r.nama ?? '', warna: r.kelas_warna ?? WARNA_OPTIONS[0],
        })

        setCardsWajib(rows.filter(r => r.jenis === 'wajib').map(toItem))
        setCardsEkskul(rows.filter(r => r.jenis === 'ekskul').map(toItem))
        setCardsAktivitas(rows.filter(r => r.jenis === 'aktivitas').map(toItem))

      }

      setDataLoading(false)
    })()
  }, [router])

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const allCards = [...cardsWajib, ...cardsEkskul, ...cardsAktivitas]

  const openAdd = (jenis: JenisTagihan) =>
    setModal({ open: true, mode: 'add', jenis, nama: '', warna: WARNA_OPTIONS[0] })

  const openEdit = (card: KomponenItem) =>
    setModal({ open: true, mode: 'edit', editId: card.id, jenis: card.jenis, nama: card.nama, warna: card.warna })

  const closeModal = () =>
    setModal(m => ({ ...m, open: false, nama: '', warna: WARNA_OPTIONS[0] }))

  const deleteCard = (jenis: JenisTagihan, id: string) => {
    const setFn = jenis === 'wajib' ? setCardsWajib : jenis === 'ekskul' ? setCardsEkskul : setCardsAktivitas
    setFn(prev => prev.filter((c: KomponenItem) => c.id !== id))
  }

  const handleSubmitModal = () => {
    if (!modal.nama.trim()) return
    const item: KomponenItem = {
      id: modal.editId ?? Date.now().toString(),
      jenis: modal.jenis, nama: modal.nama.trim(), warna: modal.warna,
    }
    const setFn = modal.jenis === 'wajib' ? setCardsWajib : modal.jenis === 'ekskul' ? setCardsEkskul : setCardsAktivitas
    if (modal.mode === 'add') setFn(prev => [...prev, item])
    else setFn(prev => prev.map((c: KomponenItem) => c.id === modal.editId ? item : c))
    closeModal()
  }

  const handleSimpan = async () => {
    setError('')
    if (allCards.length === 0) { setError('Tambahkan minimal 1 komponen tagihan.'); return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/setup-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        step: 'komponen_tagihan',
        data: {
          tahun_ajaran: tahunAjaran,
          semester:     autoSemester,
          komponen: allCards.map(c => ({
            id:          c.id,
            jenis:       c.jenis,
            nama:        c.nama,
            kelasWarna:  c.warna,
            items:       [],
          })),
        },
      }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setError(json.error ?? 'Gagal menyimpan.'); setSaving(false); return }
    setSaving(false)
    setSetupDone(true)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const completedBefore = STEP_ORDER.slice(0, THIS_STEP_INDEX).filter(k => setupSteps[k]).length
  const greenCount      = completedBefore + 1

  if (dataLoading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  // ── SETUP MODE ────────────────────────────────────────────────────────────
  if (!setupDone) {
    const TABS: { key: JenisTagihan; label: string; color: string; addLabel: string; emptyMsg: string }[] = [
      { key: 'wajib',     label: 'Tagihan Wajib',  color: 'var(--navy)', addLabel: 'Tambah Tagihan Wajib', emptyMsg: 'Belum ada tagihan wajib.'   },
      { key: 'ekskul',    label: 'Ekskul',          color: '#047857',     addLabel: 'Tambah Ekskul',         emptyMsg: 'Belum ada ekstrakurikuler.' },
      { key: 'aktivitas', label: 'Aktivitas Lain',  color: '#7C3AED',     addLabel: 'Tambah Aktivitas',      emptyMsg: 'Belum ada aktivitas lain.'  },
    ]
    const getCards  = (k: JenisTagihan) => k === 'wajib' ? cardsWajib : k === 'ekskul' ? cardsEkskul : cardsAktivitas
    const activeCards  = getCards(activeTab)
    const activeTabCfg = TABS.find(t => t.key === activeTab)!

    return (
      <div className="dashboard-content">

        {/* Header */}
        <style>{`
          @keyframes dot-blink {
            0%, 100% { background-color: #69C183; }
            50%       { background-color: #CBD5E1; }
          }
          .dot-active { animation: dot-blink 1.8s ease-in-out infinite; }
        `}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 60, height: 60, background: '#1A2C4E', borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)',
            }}>
              <Receipt size={30} color="#fff" />
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

        {/* Periode Aktif — view only */}
        <div style={sCard}>
          <div style={sCardTitle}>Periode Aktif</div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={sViewItem}>
              <span style={sViewLabel}>Tahun Ajaran</span>
              <span style={sViewValue}>{tahunAjaran || '—'}</span>
            </div>
            <div style={sViewItem}>
              <span style={sViewLabel}>Semester</span>
              <span style={{ ...sViewValue, color: autoSemester === 'Ganjil' ? '#1D4ED8' : '#059669' }}>
                {autoSemester || '—'}
              </span>
            </div>
          </div>
        </div>

        {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Daftar Komponen */}
        <div style={sCard}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '1.25rem', marginTop: '-0.25rem' }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: '0.5rem 0.25rem', background: 'none', border: 'none',
                  borderBottom: activeTab === tab.key ? `2.5px solid ${tab.color}` : '2.5px solid transparent',
                  marginBottom: -2, fontWeight: activeTab === tab.key ? 700 : 400,
                  fontSize: '0.78rem', color: activeTab === tab.key ? tab.color : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span style={{ marginLeft: 4, fontSize: '0.7rem', opacity: 0.8 }}>({activeCards.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Add button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button
              onClick={() => openAdd(activeTab)}
              style={{ ...sBtnPrimary, padding: '0.45rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Plus size={14} /> {activeTabCfg.addLabel}
            </button>
          </div>

          {/* Cards */}
          {activeCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {activeTabCfg.emptyMsg}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {activeCards.map(card => (
                <KomponenCard key={card.id} card={card} onEdit={openEdit} onDelete={deleteCard} />
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => router.push('/tagihan/komponen')} style={sBtnSecondary}>← Kembali</button>
          <button onClick={handleSimpan} disabled={saving}
            style={{ ...sBtnPrimary, flex: 1, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Menyimpan...' : 'Simpan & Lanjutkan →'}
          </button>
        </div>

        {/* Modal tambah/edit */}
        {modal.open && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            onClick={closeModal}
          >
            <div
              style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontFamily: 'var(--font-serif,Georgia,serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '1.25rem' }}>
                {modal.mode === 'add'
                  ? TABS.find(t => t.key === modal.jenis)?.addLabel
                  : 'Edit Komponen'}
              </h3>

              {/* Nama Komponen */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={sLabel}>Nama Komponen</label>
                <input
                  type="text"
                  placeholder={
                    modal.jenis === 'wajib'     ? 'cth: SPP Bulanan, Uang Gedung'

                    : modal.jenis === 'ekskul'    ? 'cth: Pramuka, Karate, Paduan Suara'
                    : 'cth: Perpisahan Kelas, Study Tour'
                  }
                  value={modal.nama}
                  onChange={e => setModal(m => ({ ...m, nama: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSubmitModal()}
                  style={sInput}
                  autoFocus
                />
              </div>

              {/* Warna */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={sLabel}>Warna</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
                  {WARNA_OPTIONS.map(w => (
                    <button key={w} onClick={() => setModal(m => ({ ...m, warna: w }))}
                      style={{
                        width: 32, height: 32, borderRadius: 8, background: w,
                        border: 'none', cursor: 'pointer', flexShrink: 0,
                        transform: modal.warna === w ? 'scale(1.18)' : 'scale(1)',
                        boxShadow: modal.warna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none',
                        transition: 'all 0.15s',
                      }}
                    />
                  ))}

                  {/* Divider */}
                  <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0, margin: '0 0.1rem' }} />

                  {/* Custom color picker */}
                  <label title="Pilih warna kustom" style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, cursor: 'pointer' }}>
                    <input
                      type="color"
                      value={modal.warna}
                      onChange={e => setModal(m => ({ ...m, warna: e.target.value }))}
                      style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }}
                    />
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: !WARNA_OPTIONS.includes(modal.warna)
                        ? modal.warna
                        : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                      border: !WARNA_OPTIONS.includes(modal.warna) ? 'none' : '1.5px solid #e2e8f0',
                      transform: !WARNA_OPTIONS.includes(modal.warna) ? 'scale(1.18)' : 'scale(1)',
                      boxShadow: !WARNA_OPTIONS.includes(modal.warna) ? `0 0 0 2px #fff, 0 0 0 4px ${modal.warna}` : 'none',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.72rem', overflow: 'hidden', userSelect: 'none',
                    }}>
                      {WARNA_OPTIONS.includes(modal.warna) && '✦'}
                    </div>
                  </label>
                </div>
                {/* Preview card */}
                <div style={{
                  position: 'relative', overflow: 'hidden',
                  padding: '0.5rem 0.875rem',
                  background: modal.warna,
                  borderRadius: 8,
                  boxShadow: `0 2px 8px ${modal.warna}40`,
                }}>
                  <div style={{ position: 'absolute', bottom: -14, right: -14, width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: -4, right: 14, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.18)', position: 'relative', zIndex: 1 }}>
                    {modal.nama.trim() || 'Nama komponen'}
                  </span>
                </div>
              </div>

              {/* Tombol aksi */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={closeModal} style={{ ...sBtnSecondary, flex: 1 }}>Batal</button>
                <button onClick={handleSubmitModal} disabled={!modal.nama.trim()}
                  style={{ ...sBtnPrimary, flex: 2, opacity: modal.nama.trim() ? 1 : 0.5 }}>
                  {modal.mode === 'add' ? 'Tambah Komponen' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── KOMPONEN VIEW MODE ────────────────────────────────────────────────────
  if (setupDone) {
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
                  <KomponenCard key={card.id} card={card} readonly />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

}

// ── Komponen Card ─────────────────────────────────────────────────────────────

function KomponenCard({
  card, readonly = false, onEdit, onDelete,
}: {
  card:      KomponenItem
  readonly?: boolean
  onEdit?:   (card: KomponenItem) => void
  onDelete?: (jenis: JenisTagihan, id: string) => void
}) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: card.warna,
      borderRadius: 10, padding: '0.875rem 1rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
      boxShadow: `0 2px 8px ${card.warna}40`,
    }}>
      {/* Gradient blob pojok kanan bawah */}
      <div style={{
        position: 'absolute', bottom: -18, right: -18,
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(255,255,255,0.18)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -8, right: 18,
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(255,255,255,0.10)',
        pointerEvents: 'none',
      }} />

      <span style={{
        fontWeight: 700, color: '#fff', fontSize: '0.875rem',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        zIndex: 1, textShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }}>
        {card.nama}
      </span>

      {!readonly && (
        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0, zIndex: 1 }}>
          <button onClick={() => onEdit?.(card)}
            style={{ background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', padding: 0 }}>
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete?.(card.jenis, card.id)}
            style={{ background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', padding: 0 }}>
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sLabel:       React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 4 }
const sInput:       React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', outline: 'none', background: '#fff' }
const sCard:        React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sCardTitle:   React.CSSProperties = { fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.9rem', marginBottom: '1rem' }
const sViewItem:    React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.875rem' }
const sViewLabel:   React.CSSProperties = { fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const sViewValue:   React.CSSProperties = { fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-dark)' }
const sBtnPrimary:  React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary:React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
