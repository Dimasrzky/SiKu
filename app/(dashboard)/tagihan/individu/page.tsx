'use client'

import { useState, useEffect, useCallback, useRef, CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutList, Puzzle, Pencil, Trash2, X, Plus, Search, Users, AlertTriangle, Eye } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KelasItem   { id: string; nama: string; jenjang: string }
interface SiswaResult { id: string; nama: string; kelas_id: string; kelas_nama: string; kelas_jenjang: string; kelas_warna: string | null }

interface KomponenItem {
  id: string; nama: string; warna: string; nominal_default: number | null
}

interface AssignRow {
  siswa_id: string; nama: string; kelas_nama: string; kelas_warna: string | null; nominal: string
}

interface KomponenGrouped {
  komponen_id: string; nama: string; warna: string; nominal_default: number | null
  inisial: string; siswa_count: number; kelas_list: string
}

interface SiswaAssignRow {
  id: string; komponen_id: string; siswa_id: string
  siswa_nama: string; inisial: string; kelas_nama: string; kelas_warna: string | null
  komponen_nama: string; nominal: number; nominal_default: number | null
  disesuaikan: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const getInisial = (nama: string) => {
  const p = nama.trim().split(' ').filter(Boolean)
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : nama.slice(0, 2).toUpperCase()
}

const fRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const highlightText = (text: string, query: string): ReactNode => {
  if (!query.trim()) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  const matchRe = new RegExp(`^${escaped}$`, 'i')
  return (
    <>{parts.map((part, i) =>
      matchRe.test(part)
        ? <span key={i} style={{ color: '#eb2c25', fontWeight: 700 }}>{part}</span>
        : <span key={i}>{part}</span>
    )}</>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IndividuPage() {
  const router      = useRouter()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [loading,      setLoading]      = useState(true)
  const [sekolahId,    setSekolahId]    = useState('')
  const [kelasList,    setKelasList]    = useState<KelasItem[]>([])
  const [komponenList, setKomponenList] = useState<KomponenItem[]>([])
  const [assignedList, setAssignedList] = useState<KomponenGrouped[]>([])
  const [statData,     setStatData]     = useState({ komponen_aktif: 0, siswa_terdampak: 0, komponen_belum_dipakai: 0 })
  const [siswaList,         setSiswaList]         = useState<SiswaAssignRow[]>([])
  const [tabelFilter,       setTabelFilter]       = useState('Semua')
  const [tabelKelasFilter,  setTabelKelasFilter]  = useState('Semua')
  const [tabelSearch,       setTabelSearch]       = useState('')

  // Form states
  const [showForm,    setShowForm]    = useState(false)
  const [formClosing, setFormClosing] = useState(false)
  const [formSaving,  setFormSaving]  = useState(false)
  const [fKomponen,   setFKomponen]   = useState<Set<string>>(new Set())
  const [fJenjang,    setFJenjang]    = useState('')
  const [fSearch,     setFSearch]     = useState('')
  const [fResults,    setFResults]    = useState<SiswaResult[]>([])
  const [fRows,       setFRows]       = useState<AssignRow[]>([])
  const [editingIdx,  setEditingIdx]  = useState<number | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (sid: string) => {
    // Get paket IDs for this sekolah → filter paket komponen
    const { data: pakets } = await supabase.from('paket').select('id').eq('sekolah_id', sid)
    const paketIds = (pakets ?? []).map((p: { id: string }) => p.id)

    let paketKompIds = new Set<string>()
    if (paketIds.length > 0) {
      const { data: pk } = await supabase.from('paket_komponen').select('komponen_id').in('paket_id', paketIds)
      paketKompIds = new Set((pk ?? []).map((r: { komponen_id: string }) => r.komponen_id))
    }

    // Non-paket komponen
    const { data: allKomps } = await supabase
      .from('komponen_tagihan')
      .select('id, nama, kelas_warna, nominal_default')
      .eq('sekolah_id', sid).order('nama').limit(100)

    type KompRaw = { id: string; nama: string; kelas_warna: string | null; nominal_default: number | null }
    const nonPaket: KomponenItem[] = ((allKomps ?? []) as KompRaw[])
      .filter(k => !paketKompIds.has(k.id))
      .map(k => ({ id: k.id, nama: k.nama, warna: k.kelas_warna ?? '#1A2C4E', nominal_default: k.nominal_default }))

    setKomponenList(nonPaket)

    // Load assignments (flat + grouped)
    const { data: assigns } = await supabase
      .from('siswa_komponen_individu')
      .select('id, komponen_id, siswa_id, nominal, siswa:siswa_id(nama, kelas:kelas_id(nama, warna)), komponen:komponen_id(nama, nominal_default)')
      .eq('sekolah_id', sid).limit(1000)

    type AssignRaw = {
      id: string; komponen_id: string; siswa_id: string; nominal: number
      siswa: { nama: string; kelas: { nama: string; warna: string | null } | null } | null
      komponen: { nama: string; nominal_default: number | null } | null
    }

    const kompMap = new Map(nonPaket.map(k => [k.id, k]))

    // Group by komponen for main card
    const groupMap = new Map<string, { siswa_ids: Set<string>; kelas_names: Set<string> }>()
    for (const a of (assigns ?? []) as AssignRaw[]) {
      if (!groupMap.has(a.komponen_id)) groupMap.set(a.komponen_id, { siswa_ids: new Set(), kelas_names: new Set() })
      const g = groupMap.get(a.komponen_id)!
      g.siswa_ids.add(a.siswa_id)
      if (a.siswa?.kelas?.nama) g.kelas_names.add(a.siswa.kelas.nama)
    }

    const grouped: KomponenGrouped[] = [...groupMap.entries()]
      .filter(([id]) => kompMap.has(id))
      .map(([id, g]) => {
        const k = kompMap.get(id)!
        return {
          komponen_id: id, nama: k.nama, warna: k.warna, nominal_default: k.nominal_default,
          inisial: getInisial(k.nama),
          siswa_count: g.siswa_ids.size,
          kelas_list: [...g.kelas_names].sort().join(', '),
        }
      })

    setAssignedList(grouped)

    // Flat per-siswa rows for tabel card
    const siswaRows: SiswaAssignRow[] = ((assigns ?? []) as AssignRaw[])
      .filter(a => a.siswa && a.komponen && kompMap.has(a.komponen_id))
      .map(a => ({
        id: a.id, komponen_id: a.komponen_id, siswa_id: a.siswa_id,
        siswa_nama: a.siswa!.nama, inisial: getInisial(a.siswa!.nama),
        kelas_nama: a.siswa!.kelas?.nama ?? '—', kelas_warna: a.siswa!.kelas?.warna ?? null,
        komponen_nama: a.komponen!.nama, nominal: a.nominal,
        nominal_default: a.komponen!.nominal_default,
        disesuaikan: a.komponen!.nominal_default !== null && a.nominal !== a.komponen!.nominal_default,
      }))

    setSiswaList(siswaRows)

    const allSiswaIds = new Set<string>()
    const assignedKompIds = new Set(grouped.map(g => g.komponen_id))
    for (const a of (assigns ?? []) as AssignRaw[]) allSiswaIds.add(a.siswa_id)

    setStatData({
      komponen_aktif:         grouped.length,
      siswa_terdampak:        allSiswaIds.size,
      komponen_belum_dipakai: nonPaket.filter(k => !assignedKompIds.has(k.id)).length,
    })
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

      const { data: kelas } = await supabase.from('kelas').select('id, nama, jenjang').eq('sekolah_id', sid).order('jenjang').limit(100)
      setKelasList((kelas ?? []) as KelasItem[])

      await loadData(sid)
      setLoading(false)
    })()
  }, [router, loadData])

  // ── Form handlers ─────────────────────────────────────────────────────────

  const uniqueJenjang = [...new Set(kelasList.map(k => k.jenjang).filter(Boolean))]

  const openForm = () => {
    setFormClosing(false); setShowForm(true)
    setFKomponen(new Set(komponenList.map(k => k.id)))
    setFJenjang(uniqueJenjang[0] ?? '')
    setFSearch(''); setFResults([]); setFRows([]); setEditingIdx(null)
  }

  const closeForm = () => {
    setFormClosing(true)
    setTimeout(() => {
      setShowForm(false); setFormClosing(false)
      setFKomponen(new Set()); setFJenjang(''); setFSearch(''); setFResults([]); setFRows([]); setEditingIdx(null)
    }, 320)
  }

  const handleSearch = (q: string) => {
    setFSearch(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      if (!q.trim()) { setFResults([]); return }
      const { data } = await supabase
        .from('siswa')
        .select('id, nama, kelas:kelas_id(id, nama, jenjang, warna)')
        .eq('sekolah_id', sekolahId).ilike('nama', `%${q}%`).limit(20)

      type RS = { id: string; nama: string; kelas: { id: string; nama: string; jenjang: string; warna: string | null } | null }
      setFResults(((data ?? []) as RS[])
        .filter(s => s.kelas && (!fJenjang || s.kelas.jenjang === fJenjang))
        .map(s => ({ id: s.id, nama: s.nama, kelas_id: s.kelas!.id, kelas_nama: s.kelas!.nama, kelas_jenjang: s.kelas!.jenjang, kelas_warna: s.kelas!.warna })))
    }, 280)
  }

  const addSiswa = (s: SiswaResult) => {
    if (fRows.find(r => r.siswa_id === s.id)) return
    const firstKomp = komponenList.find(k => fKomponen.has(k.id))
    setFRows(prev => [...prev, {
      siswa_id: s.id, nama: s.nama, kelas_nama: s.kelas_nama, kelas_warna: s.kelas_warna,
      nominal: String(firstKomp?.nominal_default ?? 0),
    }])
    setFSearch(''); setFResults([])
  }

  const saveForm = async () => {
    if (fRows.length === 0 || fKomponen.size === 0) return
    setFormSaving(true)
    try {
      const inserts: { sekolah_id: string; komponen_id: string; siswa_id: string; nominal: number }[] = []
      for (const kompId of fKomponen) {
        for (const row of fRows) {
          inserts.push({ sekolah_id: sekolahId, komponen_id: kompId, siswa_id: row.siswa_id, nominal: Number(row.nominal) || 0 })
        }
      }
      await supabase.from('siswa_komponen_individu').upsert(inserts, { onConflict: 'komponen_id,siswa_id' })
      await loadData(sekolahId)
      closeForm()
      triggerRecalculate()
    } finally { setFormSaving(false) }
  }

  const triggerRecalculate = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    fetch('/api/recalculate-tagihan', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
    }).catch(() => {})
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
          <LayoutList size={28} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>Komponen Individu</h1>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>Tambahkan komponen ke siswa tertentu tanpa mengubah paket kelas</p>
        </div>
      </div>

      {/* Form slide */}
      <div style={{ display: 'grid', gridTemplateRows: showForm && !formClosing ? '1fr' : '0fr', transition: 'grid-template-rows 0.32s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ overflow: 'hidden', paddingBottom: showForm && !formClosing ? '1.25rem' : 0, transition: 'padding-bottom 0.32s cubic-bezier(0.4,0,0.2,1)' }}>
          {showForm && (
            <div style={sCard}>

              {/* Pilih komponen */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2C4E' }}>Pilih komponen</div>
                    <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Hanya menampilkan komponen yang belum masuk paket manapun</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={() => setFKomponen(new Set(komponenList.map(k => k.id)))} style={sBtnOutline}>Pilih Semua</button>
                    <button onClick={() => setFKomponen(new Set())} style={{ ...sBtnOutline, background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5' }}>Hapus Semua</button>
                  </div>
                </div>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.75rem 1rem', minHeight: 52, maxHeight: 96, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignContent: 'flex-start' }}>
                  {komponenList.length === 0
                    ? <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Semua komponen sudah masuk paket</span>
                    : komponenList.map(k => {
                        const sel = fKomponen.has(k.id)
                        return (
                          <button key={k.id} onClick={() => {
                            const n = new Set(fKomponen); if (sel) n.delete(k.id); else n.add(k.id); setFKomponen(n)
                          }} style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: sel ? 'none' : '1.5px solid #CBD5E1', background: sel ? k.warna : '#fff', color: sel ? '#fff' : '#475569', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                            {k.nama}
                          </button>
                        )
                      })
                  }
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '0.4rem' }}>ⓘ {fKomponen.size} dari {komponenList.length} komponen terpilih</div>
              </div>
              <div style={sDivider} />

              {/* Filter jenjang + search */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2C4E', marginBottom: '0.2rem' }}>Filter jenjang</div>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '0.6rem' }}>Pilih jenjang dulu, bisa ganti untuk tambah siswa dari jenjang lain</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                  {uniqueJenjang.map(j => (
                    <button key={j} onClick={() => { setFJenjang(j); setFSearch(''); setFResults([]) }}
                      style={{ padding: '0.35rem 0.85rem', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit', background: fJenjang === j ? '#DBEAFE' : '#fff', color: fJenjang === j ? '#1E40AF' : '#475569', borderColor: fJenjang === j ? '#93C5FD' : '#CBD5E1', transition: 'all 0.15s' }}>
                      Kelas {j}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input value={fSearch} onChange={e => handleSearch(e.target.value)} placeholder="Cari nama siswa di jenjang ini..." style={{ ...sInp, paddingLeft: '2.2rem' }} />
                    {fResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 20, maxHeight: 190, overflowY: 'auto' }}>
                        {fResults.map(s => (
                          <div key={s.id} onClick={() => addSiswa(s)}
                            style={{ padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <span>{highlightText(s.nama, fSearch)}</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{s.kelas_nama}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { if (fResults.length > 0) addSiswa(fResults[0]) }}
                    style={{ background: '#fff', border: '1.5px solid #1A2C4E', color: '#1A2C4E', borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    + Tambah
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.3rem' }}>ⓘ Ketik minimal 1 huruf untuk melihat hasil pencarian</div>
              </div>

              {/* Tabel siswa + nominal */}
              {fRows.length > 0 && (
                <>
                  <div style={sDivider} />
                  <div style={{ marginBottom: '0.6rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2C4E' }}>Siswa &amp; nominal</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} /> {fRows.length} siswa dipilih
                    </div>
                  </div>
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#1A2C4E', color: '#fff' }}>
                          <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600 }}>Nama</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Kelas</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Nominal</th>
                          <th style={{ width: 40 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {fRows.map((r, i) => (
                          <tr key={r.siswa_id} style={{ borderTop: i > 0 ? '1px solid #F1F5F9' : undefined }}>
                            <td style={{ padding: '0.55rem 1rem', fontWeight: 500, color: '#1A2C4E' }}>{r.nama}</td>
                            <td style={{ padding: '0.55rem 0.75rem' }}>
                              <span style={{ background: r.kelas_warna ?? '#DBEAFE', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700 }}>{r.kelas_nama}</span>
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem' }}>
                              {editingIdx === i ? (
                                <input type="number" autoFocus value={r.nominal}
                                  onChange={e => setFRows(prev => prev.map((x, j) => j === i ? { ...x, nominal: e.target.value } : x))}
                                  onBlur={() => setEditingIdx(null)}
                                  onKeyDown={e => e.key === 'Enter' && setEditingIdx(null)}
                                  style={{ ...sInp, padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 140 }} />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{ fontWeight: 600, color: '#1A2C4E' }}>{fRp(Number(r.nominal) || 0)}</span>
                                  <button onClick={() => setEditingIdx(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: 2 }}>
                                    <Pencil size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.55rem 0.5rem' }}>
                              <button onClick={() => { setFRows(prev => prev.filter((_, j) => j !== i)); if (editingIdx === i) setEditingIdx(null) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>ⓘ Nominal default mengikuti komponen, tapi bisa diubah per siswa kapan saja</div>
                </>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button onClick={closeForm} style={sBtnYellow}>Batalkan Pembuatan <X size={15} /></button>
                <button onClick={saveForm} disabled={formSaving || fRows.length === 0 || fKomponen.size === 0}
                  style={{ ...sBtnYellow, opacity: (fRows.length === 0 || fKomponen.size === 0) ? 0.6 : 1 }}>
                  {formSaving ? 'Menyimpan...' : <>Simpan &amp; Lanjutkan →</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {assignedList.length === 0 && !showForm && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: '28px solid #1A2C4E', borderRadius: 16, boxShadow: '0 2px 16px rgba(26,44,78,0.08)', overflow: 'hidden', minHeight: 340, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1.5rem' }}>
            <button onClick={openForm} style={{ background: '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.55rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
              Assign Komponen <Image src="/icons/IconEdit2.png" width={18} height={18} alt="assign" />
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 2rem 4rem', textAlign: 'center' }}>
            <Puzzle size={68} strokeWidth={0.9} color="#CBD5E1" style={{ marginBottom: '1rem' }} />
            <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#6F788A', marginBottom: '0.35rem' }}>Belum ada komponen tambahan</div>
            <div style={{ fontSize: '1rem', color: '#94A3B8', maxWidth: 320, lineHeight: 1.6 }}>Assign komponen opsional seperti ekskul ke siswa tertentu</div>
          </div>
        </div>
      )}

      {/* Main card */}
      {assignedList.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: '28px solid #1A2C4E', borderRadius: 16, boxShadow: '0 2px 16px rgba(26,44,78,0.08)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1 }}>
              <div style={{ width: 46, height: 46, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A2C4E' }}>Aktivitas assign</div>
                <div style={{ fontSize: '0.83rem', color: '#64748B' }}>Assign komponen tambahan ke siswa lintas kelas dan jenjang</div>
              </div>
            </div>
            {!showForm && (
              <button onClick={openForm} style={{ background: '#1A2C4E', color: '#fff', border: 'none', padding: '0.55rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                <Plus size={14} /> Assign Siswa
              </button>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9' }}>
            {[
              { label: 'Komponen aktif',         val: statData.komponen_aktif,         icon: <Puzzle size={22} color="#3B82F6" /> },
              { label: 'Siswa terdampak',         val: statData.siswa_terdampak,         icon: <Users size={22} color="#8B5CF6" /> },
              { label: 'Komponen belum dipakai',  val: statData.komponen_belum_dipakai,  icon: <AlertTriangle size={22} color="#F59E0B" /> },
            ].map(s => (
              <div key={s.label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A2C4E' }}>{s.val}</div>
                </div>
                {s.icon}
              </div>
            ))}
          </div>

          {/* List komponen */}
          <div>
            <div style={{ padding: '1.25rem 1.5rem 0' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A2C4E', marginBottom: '0.2rem' }}>Komponen aktif</div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1rem' }}>Komponen tagihan yang di-assign langsung ke siswa</div>
            </div>
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {assignedList.map((k, i) => (
                <div key={k.komponen_id} style={{ paddingLeft: '1.5rem', paddingRight: '2.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 0' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: k.warna, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.02em' }}>{k.inisial}</span>
                    </div>
                    <div style={{ width: 240, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'nowrap', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{k.nama}</span>
                        <span style={{ background: k.warna, color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, flexShrink: 0 }}>{k.siswa_count} siswa</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Kelas: {k.kelas_list || <span style={{ color: '#8a8e94' }}>—</span>}
                      </div>
                    </div>
                    <div style={{ width: 1.5, height: 40, background: '#CBD5E1', flexShrink: 0, marginLeft: '1%' }} />
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Nominal default</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>
                        {k.nominal_default != null ? fRp(k.nominal_default) : <span style={{ color: '#878c92' }}>—</span>}
                      </div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0, position: 'relative', right: 20 }}>
                      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.45rem', display: 'flex', alignItems: 'center' }}>
                        <Eye size={18} />
                      </button>
                      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.45rem', display: 'flex', alignItems: 'center' }}>
                        <Pencil size={16} />
                      </button>
                      <button style={{ background: '#DA8181', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#fff', padding: '0.45rem', display: 'flex', alignItems: 'center', boxShadow: '2px 4px 4px #a8a8a88c' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  {i < assignedList.length - 1 && (
                    <div style={{ height: 1, background: '#C1C6CF' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabel per-siswa ── */}
      {siswaList.length > 0 && (() => {
        const uniqueKomps  = ['Semua', ...Array.from(new Set(siswaList.map(r => r.komponen_nama)))]
        const uniqueKelas  = ['Semua', ...Array.from(new Set(siswaList.map(r => r.kelas_nama).filter(k => k !== '—')))]
        const filtered = siswaList.filter(r => {
          const fK  = tabelFilter      === 'Semua' || r.komponen_nama === tabelFilter
          const fKl = tabelKelasFilter === 'Semua' || r.kelas_nama    === tabelKelasFilter
          const fS  = !tabelSearch || r.siswa_nama.toLowerCase().includes(tabelSearch.toLowerCase())
          return fK && fKl && fS
        })
        return (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 2px 16px rgba(26,44,78,0.08)', overflow: 'hidden', marginTop: '1.5rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
              <div style={{ width: 46, height: 46, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: '0.85rem' }}>
                <Users size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A2C4E' }}>Siswa per Komponen</div>
                <div style={{ fontSize: '0.83rem', color: '#64748B' }}>{siswaList.length} data tersimpan</div>
              </div>
            </div>

            {/* Filter toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.5rem', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
              <select value={tabelFilter} onChange={e => setTabelFilter(e.target.value)}
                style={{ border: '1.5px solid #CBD5E1', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: '#1A2C4E', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: '#fff' }}>
                {uniqueKomps.map(k => <option key={k} value={k}>{k === 'Semua' ? 'Semua komponen' : k}</option>)}
              </select>
              <select value={tabelKelasFilter} onChange={e => setTabelKelasFilter(e.target.value)}
                style={{ border: '1.5px solid #CBD5E1', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: '#1A2C4E', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: '#fff' }}>
                {uniqueKelas.map(k => <option key={k} value={k}>{k === 'Semua' ? 'Semua kelas' : k}</option>)}
              </select>
              <div style={{ flex: 1, minWidth: 200, position: 'relative', marginLeft: 'auto' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input value={tabelSearch} onChange={e => setTabelSearch(e.target.value)} placeholder="Cari nama siswa"
                  style={{ width: '100%', border: '1.5px solid #CBD5E1', borderRadius: 8, padding: '0.4rem 0.75rem 0.4rem 2.1rem', fontSize: '0.85rem', color: '#1A2C4E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Table */}
            <div style={{ padding: '0 1.5rem 1.5rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', borderRadius: 10, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#1A2C4E', color: '#fff' }}>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontWeight: 600 }}>Nama</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Nominal</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Kelas</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.875rem' }}>
                        Tidak ada data yang sesuai filter
                      </td>
                    </tr>
                  ) : filtered.map((r, i) => (
                    <tr key={r.id} style={{ borderTop: i > 0 ? '1px solid #F1F5F9' : undefined }}>
                      <td style={{ padding: '0.75rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: r.kelas_warna ?? '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', color: '#fff', flexShrink: 0 }}>
                            {r.inisial}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontWeight: 600, color: '#1A2C4E' }}>{r.siswa_nama}</span>
                              {r.disesuaikan && (
                                <span style={{ background: '#FEF3C7', color: '#D97706', fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 20, border: '1px solid #FDE68A' }}>Disesuaikan</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 1 }}>Komponen: {r.komponen_nama}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1A2C4E' }}>{fRp(r.nominal)}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ background: r.kelas_warna ?? '#E2E8F0', color: '#fff', fontSize: '0.78rem', fontWeight: 700, padding: '2px 10px', borderRadius: 6 }}>{r.kelas_nama}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.3rem', display: 'flex' }}><Eye size={17} /></button>
                          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1A2C4E', padding: '0.3rem', display: 'flex' }}><Pencil size={15} /></button>
                          <button style={{ background: '#DA8181', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#fff', padding: '0.3rem', display: 'flex', boxShadow: '2px 4px 4px #a8a8a88c' }}><Trash2 size={17} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const sCard:       CSSProperties = { background: '#fff', border: '1px solid #DBEAFE', borderLeft: '28px solid #1A2C4E', borderRadius: 12, position: 'relative', padding: '1.5rem' }
const sInp:        CSSProperties = { width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.55rem 0.85rem', fontSize: '0.875rem', color: '#1A2C4E', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const sDivider:    CSSProperties = { height: 1, background: '#F1F5F9', margin: '0 0 1.25rem' }
const sBtnOutline: CSSProperties = { background: '#fff', border: '1.5px solid #CBD5E1', color: '#475569', borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const sBtnYellow:  CSSProperties = { background: '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.55rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }
