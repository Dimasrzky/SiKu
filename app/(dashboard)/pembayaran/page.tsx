'use client'

import { useState, useEffect } from 'react'
import { Search, Banknote, CheckCircle2, Clock, AlertCircle, ChevronDown, X, CreditCard, Wallet, Building2, QrCode } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BULAN_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

const rpInput = (v: string) =>
  v.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// ── Types ─────────────────────────────────────────────────────────────────────

interface TagihanRow {
  id:            string
  total_nominal: number
  status:        'lunas' | 'belum_bayar' | 'cicilan'
  bulan:         number
  tahun:         number
  siswa: {
    id:       string
    nama:     string
    nis:      string | null
    no_wa:    string | null
    kelas: { id: string; nama: string; warna: string; jenjang: string } | null
  } | null
}

interface PembayaranRow {
  id:         string
  jumlah:     number
  metode:     string
  keterangan: string | null
  created_at: string
}

// ── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  lunas:      { label: 'Lunas',       bg: '#DCFCE7', color: '#16A34A' },
  cicilan:    { label: 'Cicilan',     bg: '#FEF3C7', color: '#D97706' },
  belum_bayar:{ label: 'Belum Bayar', bg: '#FEE2E2', color: '#DC2626' },
} as const

const METODE_OPTIONS = [
  { value: 'tunai',    label: 'Tunai',         icon: Wallet },
  { value: 'transfer', label: 'Transfer Bank',  icon: Building2 },
  { value: 'qris',     label: 'QRIS',          icon: QrCode },
]

// ── Sub-components (harus di luar render) ────────────────────────────────────

function SelectArrow() {
  return (
    <ChevronDown size={14} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#64748B' }} />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PembayaranPage() {
  const now = new Date()

  const [sekolahId,    setSekolahId]    = useState('')
  const [bulan,        setBulan]        = useState(now.getMonth() + 1)
  const [tahun,        setTahun]        = useState(now.getFullYear())
  const [tagihan,      setTagihan]      = useState<TagihanRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [filterKelas,  setFilterKelas]  = useState('semua')
  const [currentPage,  setCurrentPage]  = useState(1)
  const PAGE_SIZE = 10

  // Modal state
  const [modal,         setModal]         = useState<TagihanRow | null>(null)
  const [jumlahBayar,   setJumlahBayar]   = useState('')
  const [metodeBayar,   setMetodeBayar]   = useState('tunai')
  const [keterangan,    setKeterangan]    = useState('')
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState('')
  const [savedOk,       setSavedOk]       = useState(false)

  // Riwayat panel
  const [riwayatTarget,  setRiwayatTarget]  = useState<TagihanRow | null>(null)
  const [riwayatList,    setRiwayatList]    = useState<PembayaranRow[]>([])
  const [riwayatLoading, setRiwayatLoading] = useState(false)

  // ── Load profile ──────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase
        .from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
      if (p?.sekolah_id) setSekolahId(p.sekolah_id as string)
    }
    init()
  }, [])

  // ── Load tagihan ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sekolahId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('tagihan')
        .select('id, total_nominal, status, bulan, tahun, siswa:siswa_id(id, nama, nis, no_wa, kelas:kelas_id(id, nama, warna, jenjang))')
        .eq('sekolah_id', sekolahId)
        .eq('bulan', bulan)
        .eq('tahun', tahun)
        .limit(500)
      if (cancelled) return
      setTagihan((data ?? []) as unknown as TagihanRow[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [sekolahId, bulan, tahun])

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalSiswa   = tagihan.length
  const jumlahLunas  = tagihan.filter(t => t.status === 'lunas').length
  const jumlahCicil  = tagihan.filter(t => t.status === 'cicilan').length
  const jumlahBelum  = tagihan.filter(t => t.status === 'belum_bayar').length
  const terkumpul    = tagihan.filter(t => t.status === 'lunas').reduce((s, t) => s + t.total_nominal, 0)
  const targetTotal  = tagihan.reduce((s, t) => s + t.total_nominal, 0)
  const pctLunas     = totalSiswa > 0 ? Math.round((jumlahLunas / totalSiswa) * 100) : 0

  // ── Kelas list for filter ─────────────────────────────────────────────────

  const kelasList = Array.from(
    new Map(tagihan.map(t => t.siswa?.kelas).filter(Boolean).map(k => [k!.id, k!])).values()
  ).sort((a, b) =>
    a.jenjang.localeCompare(b.jenjang, 'id', { numeric: true }) ||
    a.nama.localeCompare(b.nama, 'id', { numeric: true })
  )

  // ── Filtered table ────────────────────────────────────────────────────────

  const filtered = tagihan.filter(t => {
    if (filterStatus !== 'semua' && t.status !== filterStatus) return false
    if (filterKelas  !== 'semua' && t.siswa?.kelas?.id !== filterKelas) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.siswa?.nama.toLowerCase().includes(q) && !(t.siswa?.nis ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a, b) => (a.siswa?.nama ?? '').localeCompare(b.siswa?.nama ?? '', 'id'))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(currentPage, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const goToPage   = (p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages)))


  // ── Open bayar modal ──────────────────────────────────────────────────────

  const openModal = (row: TagihanRow) => {
    setModal(row)
    setJumlahBayar(row.total_nominal.toString())
    setMetodeBayar('tunai')
    setKeterangan('')
    setSaveError('')
    setSavedOk(false)
  }

  const closeModal = () => {
    setModal(null)
    setSavedOk(false)
    setSaveError('')
  }

  // ── Save payment ──────────────────────────────────────────────────────────

  const handleSimpan = async () => {
    if (!modal) return
    const jumlah = parseInt(jumlahBayar.replace(/\D/g, ''), 10)
    if (!jumlah || jumlah <= 0) { setSaveError('Masukkan jumlah pembayaran yang valid.'); return }
    if (jumlah > modal.total_nominal) { setSaveError(`Jumlah melebihi total tagihan (${formatRp(modal.total_nominal)}).`); return }

    setSaving(true); setSaveError('')

    const { error: e1 } = await supabase.from('pembayaran').insert({
      tagihan_id:  modal.id,
      siswa_id:    modal.siswa?.id,
      sekolah_id:  sekolahId,
      jumlah,
      metode:      metodeBayar,
      keterangan:  keterangan.trim() || null,
    })

    if (e1) { setSaveError(e1.message); setSaving(false); return }

    const newStatus: TagihanRow['status'] = jumlah >= modal.total_nominal ? 'lunas' : 'cicilan'
    await supabase.from('tagihan').update({ status: newStatus }).eq('id', modal.id)

    setTagihan(prev => prev.map(t => t.id === modal.id ? { ...t, status: newStatus } : t))
    setSaving(false)
    setSavedOk(true)
    setTimeout(closeModal, 1200)
  }

  // ── Load riwayat ──────────────────────────────────────────────────────────

  const openRiwayat = async (row: TagihanRow) => {
    setRiwayatTarget(row)
    setRiwayatLoading(true)
    const { data } = await supabase
      .from('pembayaran')
      .select('id, jumlah, metode, keterangan, created_at')
      .eq('tagihan_id', row.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setRiwayatList((data ?? []) as PembayaranRow[])
    setRiwayatLoading(false)
  }

  const closeRiwayat = () => { setRiwayatTarget(null); setRiwayatList([]) }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-content">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            <div style={{
              width:60, height:60, background:'#1A2C4E', borderRadius:14,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              boxShadow:'10px 16px 14px rgba(18,47,102,0.31)',
            }}>
              <Banknote size={30} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize:'1.8rem', fontWeight:700, color:'var(--navy-dark)', fontFamily:'var(--font-dm-sans), sans-serif', margin:0, lineHeight:1.2 }}>
                Pembayaran
              </h1>
              <p style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-muted)', margin:'0.2rem 0 0' }}>
                Catat dan pantau pembayaran tagihan siswa
              </p>
            </div>
          </div>

          {/* Bulan selector */}
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <select
                value={bulan}
                onChange={e => setBulan(Number(e.target.value))}
                style={{ appearance:'none', background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:8, padding:'0.5rem 2rem 0.5rem 0.75rem', fontSize:'0.85rem', fontWeight:600, color:'#0F172A', cursor:'pointer' }}
              >
                {BULAN_NAMES.slice(1).map((n, i) => (
                  <option key={i + 1} value={i + 1}>{n}</option>
                ))}
              </select>
              <SelectArrow />
            </div>
            <div style={{ position:'relative' }}>
              <select
                value={tahun}
                onChange={e => setTahun(Number(e.target.value))}
                style={{ appearance:'none', background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:8, padding:'0.5rem 2rem 0.5rem 0.75rem', fontSize:'0.85rem', fontWeight:600, color:'#0F172A', cursor:'pointer' }}
              >
                {[tahun - 1, tahun, tahun + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <SelectArrow />
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'0.875rem', marginBottom:'1.25rem' }}>
        {[
          { label:'Total Tagihan',  value:totalSiswa,  sub: formatRp(targetTotal),  color:'#1A2C4E', bg:'#EFF6FF', icon:<Banknote size={18} /> },
          { label:'Sudah Lunas',    value:jumlahLunas, sub:`${pctLunas}% dari total`, color:'#16A34A', bg:'#DCFCE7', icon:<CheckCircle2 size={18} /> },
          { label:'Cicilan',        value:jumlahCicil, sub:'Belum lunas semua',       color:'#D97706', bg:'#FEF3C7', icon:<Clock size={18} /> },
          { label:'Belum Bayar',    value:jumlahBelum, sub:formatRp(tagihan.filter(t=>t.status==='belum_bayar').reduce((s,t)=>s+t.total_nominal,0)), color:'#DC2626', bg:'#FEE2E2', icon:<AlertCircle size={18} /> },
        ].map(c => (
          <div key={c.label} style={{ background:'#fff', borderRadius:12, padding:'1rem 1.15rem', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', border:'1px solid #F1F5F9', display:'flex', alignItems:'center', gap:'0.875rem' }}>
            <div style={{ width:40, height:40, borderRadius:10, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', color:c.color, flexShrink:0 }}>
              {c.icon}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:'1.5rem', fontWeight:800, color:'#0F172A', lineHeight:1.1 }}>{c.value}</div>
              <div style={{ fontSize:'0.73rem', color:'#64748B', fontWeight:600, marginTop:2 }}>{c.label}</div>
              <div style={{ fontSize:'0.72rem', color:c.color, fontWeight:600, marginTop:1 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      {totalSiswa > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:'0.875rem 1.15rem', marginBottom:'1.25rem', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', border:'1px solid #F1F5F9' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.5rem' }}>
            <span style={{ fontSize:'0.8rem', fontWeight:700, color:'#0F172A' }}>
              Terkumpul: {formatRp(terkumpul)}
            </span>
            <span style={{ fontSize:'0.8rem', color:'#64748B', fontWeight:600 }}>
              Target: {formatRp(targetTotal)}
            </span>
          </div>
          <div style={{ height:10, background:'#F1F5F9', borderRadius:99, overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:99,
              width:`${Math.min(100, targetTotal > 0 ? (terkumpul / targetTotal) * 100 : 0)}%`,
              background:'linear-gradient(90deg, #10B981, #059669)',
              transition:'width 0.5s ease',
            }} />
          </div>
          <div style={{ display:'flex', gap:'1.25rem', marginTop:'0.5rem' }}>
            {[
              { dot:'#10B981', label:`Lunas (${jumlahLunas})` },
              { dot:'#F59E0B', label:`Cicilan (${jumlahCicil})` },
              { dot:'#EF4444', label:`Belum bayar (${jumlahBelum})` },
            ].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.72rem', color:'#64748B', fontWeight:600 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:l.dot, flexShrink:0 }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      <div style={{ background:'#fff', borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', border:'1px solid #F1F5F9', overflow:'hidden' }}>

        {/* Filter row */}
        <div style={{ display:'flex', gap:'0.75rem', padding:'1rem 1.15rem', borderBottom:'1px solid #F1F5F9', flexWrap:'wrap', alignItems:'center' }}>
          {/* Search */}
          <div style={{ position:'relative', flex:'1 1 220px', minWidth:0 }}>
            <Search size={15} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94A3B8' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              placeholder="Cari nama atau NIS..."
              style={{ width:'100%', paddingLeft:32, paddingRight:10, paddingTop:'0.5rem', paddingBottom:'0.5rem', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:'0.85rem', outline:'none', boxSizing:'border-box', background:'#F8FAFC' }}
            />
          </div>
          {/* Kelas filter */}
          <div style={{ position:'relative' }}>
            <select
              value={filterKelas}
              onChange={e => { setFilterKelas(e.target.value); setCurrentPage(1) }}
              style={{ appearance:'none', background:'#F8FAFC', border:'1.5px solid #E2E8F0', borderRadius:8, padding:'0.5rem 2rem 0.5rem 0.75rem', fontSize:'0.82rem', fontWeight:600, color:'#0F172A', cursor:'pointer', minWidth:120 }}
            >
              <option value="semua">Semua Kelas</option>
              {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            <SelectArrow />
          </div>
          {/* Status filter */}
          <div style={{ position:'relative' }}>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1) }}
              style={{ appearance:'none', background:'#F8FAFC', border:'1.5px solid #E2E8F0', borderRadius:8, padding:'0.5rem 2rem 0.5rem 0.75rem', fontSize:'0.82rem', fontWeight:600, color:'#0F172A', cursor:'pointer', minWidth:140 }}
            >
              <option value="semua">Semua Status</option>
              <option value="belum_bayar">Belum Bayar</option>
              <option value="cicilan">Cicilan</option>
              <option value="lunas">Lunas</option>
            </select>
            <SelectArrow />
          </div>
          <span style={{ fontSize:'0.78rem', color:'#94A3B8', fontWeight:600, marginLeft:'auto', whiteSpace:'nowrap' }}>
            {filtered.length} siswa
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#94A3B8', fontSize:'0.875rem' }}>Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#94A3B8', fontSize:'0.875rem' }}>
            {tagihan.length === 0
              ? `Tidak ada tagihan untuk ${BULAN_NAMES[bulan]} ${tahun}.`
              : 'Tidak ada data yang sesuai filter.'}
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:640 }}>
              <thead>
                <tr style={{ background:'#F8FAFC' }}>
                  {['No', 'Siswa', 'Kelas', 'Total Tagihan', 'Status', 'Aksi'].map(h => (
                    <th key={h} style={{ padding:'0.7rem 1rem', textAlign:'left', fontSize:'0.75rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap', borderBottom:'1px solid #F1F5F9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((row, i) => {
                  const cfg = STATUS_CFG[row.status] ?? STATUS_CFG.belum_bayar
                  const kelas = row.siswa?.kelas
                  return (
                    <tr key={row.id} style={{ borderBottom:'1px solid #F8FAFC', transition:'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FAFBFF'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                    >
                      <td style={{ padding:'0.75rem 1rem', fontSize:'0.8rem', color:'#94A3B8', fontWeight:600 }}>{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                      <td style={{ padding:'0.75rem 1rem' }}>
                        <div style={{ fontWeight:700, fontSize:'0.88rem', color:'#0F172A' }}>{row.siswa?.nama ?? '-'}</div>
                        <div style={{ fontSize:'0.73rem', color:'#94A3B8', fontWeight:600 }}>{row.siswa?.nis ?? '-'}</div>
                      </td>
                      <td style={{ padding:'0.75rem 1rem' }}>
                        {kelas ? (
                          <span style={{ background: kelas.warna + '22', color: kelas.warna, borderRadius:6, padding:'0.2rem 0.6rem', fontSize:'0.75rem', fontWeight:700, whiteSpace:'nowrap' }}>
                            {kelas.nama}
                          </span>
                        ) : <span style={{ color:'#94A3B8' }}>-</span>}
                      </td>
                      <td style={{ padding:'0.75rem 1rem', fontSize:'0.875rem', fontWeight:700, color:'#0F172A' }}>
                        {formatRp(row.total_nominal)}
                      </td>
                      <td style={{ padding:'0.75rem 1rem' }}>
                        <span style={{ background:cfg.bg, color:cfg.color, borderRadius:20, padding:'0.25rem 0.7rem', fontSize:'0.75rem', fontWeight:700, whiteSpace:'nowrap' }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding:'0.75rem 1rem' }}>
                        <div style={{ display:'flex', gap:'0.4rem' }}>
                          {row.status !== 'lunas' && (
                            <button
                              onClick={() => openModal(row)}
                              style={{ background:'#1A2C4E', color:'#fff', border:'none', borderRadius:7, padding:'0.38rem 0.85rem', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}
                              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#243D6A'}
                              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#1A2C4E'}
                            >
                              <CreditCard size={13} /> Catat Bayar
                            </button>
                          )}
                          <button
                            onClick={() => openRiwayat(row)}
                            style={{ background:'#F1F5F9', color:'#475569', border:'none', borderRadius:7, padding:'0.38rem 0.7rem', fontSize:'0.78rem', fontWeight:700, cursor:'pointer' }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#E2E8F0'}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#F1F5F9'}
                          >
                            Riwayat
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.875rem 1.15rem', borderTop:'1px solid #F1F5F9', flexWrap:'wrap', gap:'0.5rem' }}>
            <span style={{ fontSize:'0.78rem', color:'#64748B', fontWeight:600 }}>
              Menampilkan {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} dari {filtered.length} siswa
            </span>
            <div style={{ display:'flex', gap:'0.35rem', alignItems:'center' }}>
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
                style={{ padding:'0.4rem 0.75rem', borderRadius:7, border:'1.5px solid #E2E8F0', background:'#fff', fontSize:'0.8rem', fontWeight:700, color: safePage === 1 ? '#CBD5E1' : '#1A2C4E', cursor: safePage === 1 ? 'default' : 'pointer' }}
              >
                ‹ Prev
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} style={{ padding:'0.4rem 0.3rem', fontSize:'0.8rem', color:'#94A3B8' }}>…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      style={{ padding:'0.4rem 0.65rem', borderRadius:7, border:'1.5px solid', borderColor: p === safePage ? '#1A2C4E' : '#E2E8F0', background: p === safePage ? '#1A2C4E' : '#fff', color: p === safePage ? '#fff' : '#475569', fontSize:'0.8rem', fontWeight:700, cursor:'pointer', minWidth:34 }}
                    >
                      {p}
                    </button>
                  )
                )}

              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
                style={{ padding:'0.4rem 0.75rem', borderRadius:7, border:'1.5px solid #E2E8F0', background:'#fff', fontSize:'0.8rem', fontWeight:700, color: safePage === totalPages ? '#CBD5E1' : '#1A2C4E', cursor: safePage === totalPages ? 'default' : 'pointer' }}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Catat Pembayaran ─────────────────────────────────────────── */}
      {modal && (
        <div
          style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(15,23,42,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
          onClick={closeModal}
        >
          <div
            style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:440, boxShadow:'0 24px 60px rgba(0,0,0,0.22)', overflow:'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ background:'#1A2C4E', padding:'1.1rem 1.4rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ color:'#fff', fontWeight:800, fontSize:'1rem' }}>Catat Pembayaran</div>
                <div style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.78rem', fontWeight:500, marginTop:1 }}>
                  {BULAN_NAMES[bulan]} {tahun}
                </div>
              </div>
              <button onClick={closeModal} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding:'1.4rem' }}>
              {savedOk ? (
                <div style={{ textAlign:'center', padding:'1.5rem 0' }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:'#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 0.875rem' }}>
                    <CheckCircle2 size={28} color="#16A34A" />
                  </div>
                  <div style={{ fontWeight:800, fontSize:'1rem', color:'#0F172A' }}>Pembayaran Tercatat!</div>
                  <div style={{ color:'#64748B', fontSize:'0.83rem', marginTop:4 }}>Data tagihan telah diperbarui.</div>
                </div>
              ) : (
                <>
                  {/* Siswa info */}
                  <div style={{ background:'#F8FAFC', borderRadius:10, padding:'0.75rem 1rem', marginBottom:'1.1rem', border:'1px solid #F1F5F9' }}>
                    <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#0F172A' }}>{modal.siswa?.nama}</div>
                    <div style={{ display:'flex', gap:'0.75rem', marginTop:3 }}>
                      <span style={{ fontSize:'0.73rem', color:'#64748B', fontWeight:600 }}>NIS: {modal.siswa?.nis ?? '-'}</span>
                      {modal.siswa?.kelas && (
                        <span style={{ fontSize:'0.73rem', color:'#64748B', fontWeight:600 }}>
                          {modal.siswa.kelas.nama}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop:6, fontSize:'0.78rem', color:'#0F172A', fontWeight:700 }}>
                      Total tagihan: <span style={{ color:'#1A2C4E' }}>{formatRp(modal.total_nominal)}</span>
                    </div>
                  </div>

                  {/* Bayar penuh / sebagian toggle */}
                  <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem' }}>
                    <button
                      onClick={() => setJumlahBayar(modal.total_nominal.toString())}
                      style={{ flex:1, padding:'0.5rem', borderRadius:8, border:`1.5px solid ${jumlahBayar === modal.total_nominal.toString() ? '#1A2C4E' : '#E2E8F0'}`, background: jumlahBayar === modal.total_nominal.toString() ? '#EFF6FF' : '#fff', color: jumlahBayar === modal.total_nominal.toString() ? '#1A2C4E' : '#64748B', fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}
                    >
                      Bayar Penuh
                    </button>
                    <button
                      onClick={() => setJumlahBayar('')}
                      style={{ flex:1, padding:'0.5rem', borderRadius:8, border:`1.5px solid ${jumlahBayar !== modal.total_nominal.toString() && jumlahBayar !== '' ? '#F59E0B' : '#E2E8F0'}`, background: jumlahBayar !== modal.total_nominal.toString() && jumlahBayar !== '' ? '#FFFBEB' : '#fff', color: jumlahBayar !== modal.total_nominal.toString() && jumlahBayar !== '' ? '#D97706' : '#64748B', fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}
                    >
                      Bayar Sebagian
                    </button>
                  </div>

                  {/* Jumlah bayar */}
                  <div style={{ marginBottom:'0.875rem' }}>
                    <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Jumlah Bayar</label>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:'0.85rem', color:'#64748B', fontWeight:700 }}>Rp</span>
                      <input
                        type="text"
                        value={rpInput(jumlahBayar)}
                        onChange={e => setJumlahBayar(e.target.value.replace(/\D/g, ''))}
                        placeholder="0"
                        style={{ width:'100%', paddingLeft:36, paddingRight:10, paddingTop:'0.6rem', paddingBottom:'0.6rem', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:'0.9rem', fontWeight:700, boxSizing:'border-box', outline:'none', background:'#F8FAFC' }}
                      />
                    </div>
                  </div>

                  {/* Metode */}
                  <div style={{ marginBottom:'0.875rem' }}>
                    <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Metode Pembayaran</label>
                    <div style={{ display:'flex', gap:'0.4rem' }}>
                      {METODE_OPTIONS.map(m => {
                        const Icon = m.icon
                        const active = metodeBayar === m.value
                        return (
                          <button
                            key={m.value}
                            onClick={() => setMetodeBayar(m.value)}
                            style={{ flex:1, padding:'0.5rem 0.4rem', borderRadius:8, border:`1.5px solid ${active ? '#1A2C4E' : '#E2E8F0'}`, background: active ? '#EFF6FF' : '#fff', color: active ? '#1A2C4E' : '#64748B', fontWeight:700, fontSize:'0.72rem', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}
                          >
                            <Icon size={15} />
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Keterangan */}
                  <div style={{ marginBottom:'1rem' }}>
                    <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Keterangan <span style={{ color:'#94A3B8', fontWeight:500 }}>(opsional)</span></label>
                    <textarea
                      value={keterangan}
                      onChange={e => setKeterangan(e.target.value)}
                      placeholder="Catatan tambahan..."
                      rows={2}
                      style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:'0.85rem', resize:'vertical', boxSizing:'border-box', outline:'none', fontFamily:'inherit', background:'#F8FAFC' }}
                    />
                  </div>

                  {saveError && (
                    <div style={{ background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'0.6rem 0.8rem', fontSize:'0.8rem', fontWeight:600, marginBottom:'0.875rem' }}>
                      {saveError}
                    </div>
                  )}

                  <button
                    onClick={handleSimpan}
                    disabled={saving}
                    style={{ width:'100%', background: saving ? '#94A3B8' : 'linear-gradient(135deg,#1A2C4E,#243D6A)', color:'#fff', border:'none', borderRadius:10, padding:'0.8rem', fontSize:'0.9rem', fontWeight:800, cursor: saving ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                  >
                    {saving ? 'Menyimpan...' : <><CreditCard size={16} /> Simpan Pembayaran</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Riwayat Pembayaran ───────────────────────────────────────── */}
      {riwayatTarget && (
        <div
          style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(15,23,42,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
          onClick={closeRiwayat}
        >
          <div
            style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:440, boxShadow:'0 24px 60px rgba(0,0,0,0.22)', overflow:'hidden', maxHeight:'80vh', display:'flex', flexDirection:'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background:'#1A2C4E', padding:'1.1rem 1.4rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <div style={{ color:'#fff', fontWeight:800, fontSize:'1rem' }}>Riwayat Pembayaran</div>
                <div style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.78rem', marginTop:1 }}>
                  {riwayatTarget.siswa?.nama} · {BULAN_NAMES[bulan]} {tahun}
                </div>
              </div>
              <button onClick={closeRiwayat} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ overflowY:'auto', padding:'1.1rem 1.4rem', flex:1 }}>
              {riwayatLoading ? (
                <p style={{ textAlign:'center', color:'#94A3B8', fontSize:'0.85rem' }}>Memuat...</p>
              ) : riwayatList.length === 0 ? (
                <p style={{ textAlign:'center', color:'#94A3B8', fontSize:'0.85rem' }}>Belum ada riwayat pembayaran.</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                  {riwayatList.map((r) => (
                    <div key={r.id} style={{ background:'#F8FAFC', borderRadius:10, padding:'0.75rem 1rem', border:'1px solid #F1F5F9' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontWeight:800, fontSize:'0.92rem', color:'#0F172A' }}>{formatRp(r.jumlah)}</span>
                        <span style={{ fontSize:'0.72rem', color:'#94A3B8', fontWeight:600 }}>
                          {new Date(r.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                        </span>
                      </div>
                      <div style={{ display:'flex', gap:'0.5rem', marginTop:4 }}>
                        <span style={{ fontSize:'0.72rem', background:'#EFF6FF', color:'#3B82F6', borderRadius:5, padding:'0.15rem 0.5rem', fontWeight:700, textTransform:'capitalize' }}>
                          {r.metode}
                        </span>
                        {r.keterangan && (
                          <span style={{ fontSize:'0.72rem', color:'#64748B' }}>{r.keterangan}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
