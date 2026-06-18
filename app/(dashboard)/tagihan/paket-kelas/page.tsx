'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Trash2, ChevronDown, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const WARNA_OPTIONS = [
  '#944949', '#2F1F1F', '#2B7B2B', '#5E3333',
  '#401568', '#704E4E', '#AF9191'
]

interface PaketItem {
  id:        string
  nama:      string
  kelas_id:  string | null
  kelas_nama: string
  warna:     string
  keterangan: string
}

interface KelasOption {
  id:   string
  nama: string
}

export default function PaketPerKelasPage() {
  const router = useRouter()

  const [loading,    setLoading]    = useState(true)
  const [paketList,  setPaketList]  = useState<PaketItem[]>([])
  const [kelasList,  setKelasList]  = useState<KelasOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Inline add form
  const [showForm,       setShowForm]       = useState(false)
  const [formClosing,    setFormClosing]    = useState(false)
  const [formNama,       setFormNama]       = useState('')
  const [formKelasId,    setFormKelasId]    = useState('')
  const [formWarna,      setFormWarna]      = useState(WARNA_OPTIONS[0])
  const [formKeterangan, setFormKeterangan] = useState('')
  const [formSaving,     setFormSaving]     = useState(false)
  const [formError,      setFormError]      = useState('')

  // Delete modal
  const [deleteTarget,  setDeleteTarget]  = useState<PaketItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: pData } = await supabase
        .from('pengaturan')
        .select('setup_steps')
        .maybeSingle()

      const steps = (pData as { setup_steps?: Record<string, boolean> } | null)?.setup_steps ?? {}
      if (!steps['buat_kelas']) {
        router.replace('/siswa/manajemen-kelas')
        return
      }

      const { data: kData } = await supabase
        .from('kelas')
        .select('id, nama')
        .order('nama')

      setKelasList((kData ?? []) as KelasOption[])
      setLoading(false)
    })()
  }, [router])

  const isCustomWarna = !WARNA_OPTIONS.includes(formWarna)

  const openForm = () => {
    setFormNama('')
    setFormKelasId('')
    setFormWarna(WARNA_OPTIONS[0])
    setFormKeterangan('')
    setFormError('')
    setFormClosing(false)
    setShowForm(true)
  }

  const closeForm = () => {
    setFormClosing(true)
    setTimeout(() => { setShowForm(false); setFormClosing(false) }, 400)
  }

  const handleSimpan = async () => {
    setFormError('')
    if (!formNama.trim()) { setFormError('Nama paket harus diisi.'); return }
    setFormSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setFormError('Sesi tidak ditemukan.'); setFormSaving(false); return }

    const { data: profile } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).single()
    if (!profile?.sekolah_id) { setFormError('Data sekolah tidak ditemukan.'); setFormSaving(false); return }

    const kelasNama = kelasList.find(k => k.id === formKelasId)?.nama ?? ''
    const { data: inserted, error: insertError } = await supabase
      .from('paket_tagihan')
      .insert({
        sekolah_id:  profile.sekolah_id,
        nama:        formNama.trim(),
        kelas_id:    formKelasId || null,
        warna:       formWarna,
        keterangan:  formKeterangan.trim() || null,
      })
      .select('id, nama, kelas_id, warna, keterangan')
      .single()

    if (insertError) { setFormError(insertError.message); setFormSaving(false); return }
    if (inserted) {
      setPaketList(prev => [...prev, { ...(inserted as PaketItem), kelas_nama: kelasNama }])
    }
    setFormSaving(false)
    closeForm()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const { error } = await supabase.from('paket_tagihan').delete().eq('id', deleteTarget.id)
    if (error) { setDeleteLoading(false); return }
    setPaketList(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleteLoading(false)
  }

  const inisial = formNama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')

  const filtered = paketList.filter(p =>
    !searchQuery || p.nama.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-content">
      <style>{`
        @keyframes modalBackdrop { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalCard { from { opacity: 0; transform: scale(0.88) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes formSlideDown { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes formSlideUp   { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18,47,102,0.31)' }}>
          <Image src="/icons/IconBox.png" width={32} height={32} alt="Paket" style={{ display: 'block' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>
            Paket per kelas
          </h1>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
            Kelola paket tagihan per jenjang kelas
          </p>
        </div>
      </div>

      {/* Inline add form */}
      <div style={{ display: 'grid', gridTemplateRows: showForm && !formClosing ? '1fr' : '0fr', transition: 'grid-template-rows 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ overflow: 'hidden', paddingBottom: showForm && !formClosing ? '1.5rem' : 0, transition: 'padding-bottom 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
          {showForm && (
            <div style={{ animation: formClosing ? 'formSlideUp 0.26s cubic-bezier(0.22,1,0.36,1) forwards' : 'formSlideDown 0.3s cubic-bezier(0.22,1,0.36,1)' }}>
              <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18,47,102,0.18)', marginBottom: 0 }}>

                {formError && <div className="login-error" style={{ marginBottom: '1rem' }}>{formError}</div>}

                {/* Baris 1: Nama paket + Pilih kelas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={sLabel}>Nama paket</label>
                    <input
                      type="text" placeholder="Contoh: Paket Kelas 10"
                      value={formNama} onChange={e => setFormNama(e.target.value)}
                      style={sInput} autoFocus
                    />
                  </div>
                  <div>
                    <label style={sLabel}>Pilih kelas <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span></label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={formKelasId} onChange={e => setFormKelasId(e.target.value)}
                        style={{ ...sInput, appearance: 'none', WebkitAppearance: 'none', padding: '0.65rem 2.5rem 0.65rem 0.85rem' }}
                      >
                        <option value="">Semua kelas</option>
                        {kelasList.map(k => (
                          <option key={k.id} value={k.id}>{k.nama.replace('-', ' ')}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} color="#6F788A" style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                  </div>
                </div>

                {/* Baris 2: Keterangan */}
                <div style={{ marginBottom: '0.4rem' }}>
                  <label style={sLabel}>Keterangan <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span></label>
                  <input
                    type="text" placeholder="Contoh: Paket tagihan semester ganjil"
                    value={formKeterangan} onChange={e => setFormKeterangan(e.target.value)}
                    style={sInput}
                  />
                </div>

                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F788A', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span>ⓘ</span> Komponen tagihan dapat di-assign setelah paket dibuat
                </p>

                <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                {/* Pilih warna */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Pilih warna paket</div>
                  <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                    Membedakan paket secara visual di grafik &amp; laporan dashboard
                  </div>
                  <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', background: '#fff', border: '3px solid #BABFC7', borderRadius: 13, padding: '0.5rem 0.75rem', boxShadow: '6px 6px 8px rgba(18,47,102,0.18)' }}>
                    {WARNA_OPTIONS.map(w => (
                      <button key={w} onClick={() => setFormWarna(w)} style={{ width: 30, height: 30, borderRadius: 8, background: w, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: formWarna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none', transition: 'all 0.15s' }} />
                    ))}
                    <label style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, cursor: 'pointer' }}>
                      <input type="color" value={formWarna} onChange={e => setFormWarna(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }} />
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: isCustomWarna ? formWarna : 'transparent', boxShadow: isCustomWarna ? `0 0 0 2px #fff, 0 0 0 4px ${formWarna}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        {!isCustomWarna && <Image src="/icons/IconPipet.png" width={18} height={18} alt="Pipet" />}
                      </div>
                    </label>
                  </div>
                </div>

                <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                {/* Review tampilan */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Review tampilan</div>
                  <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                    Tampilan paket di daftar
                  </div>
                  {!formNama.trim() ? (
                    <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1.1rem 1.4rem', background: '#F8FAFC' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#64748B', marginBottom: '0.25rem' }}>Paket yang akan dibuat</div>
                      <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>Isi nama paket untuk melihat tampilan</div>
                    </div>
                  ) : (
                    <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.25rem', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 10, background: formWarna, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>{inisial}</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>{formNama}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {formKelasId
                            ? `Kelas ${kelasList.find(k => k.id === formKelasId)?.nama.replace('-', ' ') ?? ''}`
                            : <span style={{ color: '#CBD5E1' }}>Semua kelas</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button onClick={closeForm} style={sBtn}>Batalkan</button>
                  <button onClick={handleSimpan} disabled={formSaving}
                    style={{ background: formSaving ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.7rem 1.5rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: formSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: formSaving ? 'none' : '0 5px 2px rgba(18,47,102,0.31)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {formSaving ? 'Menyimpan...' : 'Simpan Paket'}
                    {!formSaving && <Image src="/icons/IconArrowKanan.png" width={12} height={12} alt="Simpan" />}
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main card */}
      <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '0 0 0 1px rgba(26,44,78,0.08), 6px 6px 24px rgba(26,44,78,0.14)' }}>

        {/* Card top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: paketList.length > 0 ? '1.25rem' : 0 }}>
          {paketList.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                placeholder="Cari paket"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ ...sInput, padding: '0.3rem 0.85rem 0.3rem 2.25rem', width: 280, border: '3px solid #C1C6CF', boxShadow: 'none', fontSize: '0.875rem' }}
              />
            </div>
          )}
          {!showForm && (
            <button onClick={openForm}
              style={{ marginLeft: 'auto', background: '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.6rem 1.1rem', borderRadius: 10, fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 5px 2px rgba(18,47,102,0.31)' }}>
              Buat Paket Baru <Image src="/icons/IconEdit2.png" width={18} height={18} alt="Tambah" style={{ display: 'block' }} />
            </button>
          )}
        </div>

        {/* Empty state */}
        {paketList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '7rem 0' }}>
            <Image src="/icons/IconNotBox.png" width={80} height={80} alt="Belum ada paket" style={{ margin: '0 auto 0.875rem', display: 'block' }} />
            <p style={{ fontWeight: 700, fontSize: '1.2rem', color: '#6F788A', margin: '0 0 0.35rem' }}>Belum ada paket komponen per kelas</p>
            <p style={{ fontSize: '1rem', color: '#6F788A', margin: 0 }}>Buat paket untuk menggabungkan komponen tagihan &amp; men-assign ke tiap tingkat kelas</p>
          </div>
        ) : (
          /* Paket list */
          <div style={{ maxHeight: '480px', overflowY: 'auto', marginRight: '1.5rem' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Tidak ada paket yang sesuai pencarian.
              </div>
            ) : (
              filtered.map((p, i) => {
                const init = p.nama.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
                return (
                  <div key={p.id} style={{ paddingLeft: '1.5rem', paddingRight: '2.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 0' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 10, background: p.warna, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>{init}</span>
                      </div>
                      <div style={{ width: 260, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.2rem' }}>{p.nama}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.kelas_nama ? `Kelas ${p.kelas_nama.replace('-', ' ')}` : 'Semua kelas'}
                        </div>
                      </div>
                      <div style={{ width: 1.5, height: 40, background: '#CBD5E1', flexShrink: 0 }} />
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Keterangan</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--navy-dark)' }}>
                          {p.keterangan || <span style={{ color: '#CBD5E1' }}>—</span>}
                        </div>
                      </div>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0, position: 'relative', right: 20 }}>
                        <button onClick={() => setDeleteTarget(p)}
                          style={{ background: '#DA8181', borderRadius: '4px', border: 'none', cursor: 'pointer', color: '#fff', padding: '0.45rem', display: 'flex', alignItems: 'center', boxShadow: '2px 4px 4px #a8a8a88c' }}>
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    {i < filtered.length - 1 && (
                      <div style={{ height: 1, background: '#C1C6CF' }} />
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.18s ease' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, padding: '2rem 1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <Trash2 size={24} color="#DC2626" />
            </div>
            <h3 style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.5rem' }}>Hapus Paket?</h3>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              Paket <strong>{deleteTarget.nama}</strong> akan dihapus permanen.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
                style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: 'var(--navy-dark)' }}>
                Batal
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: deleteLoading ? 'not-allowed' : 'pointer' }}>
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const sLabel: React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--text-mid)', marginBottom: 4 }
const sInput: React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2.5px solid #BABFC7', boxShadow: '6px 6px 8px rgba(18,47,102,0.19)', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const sCard:  React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sBtn:   React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
