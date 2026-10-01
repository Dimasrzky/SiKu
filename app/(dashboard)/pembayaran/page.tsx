'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Search, Banknote, ChevronDown, CreditCard, X,
  CheckCircle2, Wallet, Building2, QrCode, TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TA_PERIODE_SELECT, type PeriodeTahunAjaran } from '@/lib/komponenTagihan'
import { muatRingkasanPeriode, RINGKASAN_PERIODE_KOSONG, type RingkasanPeriode } from '@/lib/ringkasanPeriode'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BULAN_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

const formatRpShort = (n: number) => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000)         return `Rp ${(n / 1_000).toFixed(0)}rb`
  return formatRp(n)
}

const rpInput = (v: string) =>
  v.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function getInitials(nama: string): string {
  const parts = nama.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return nama.slice(0, 2).toUpperCase()
}


// ── Types ─────────────────────────────────────────────────────────────────────

interface TagihanRow {
  id:            string
  total_nominal: number
  status:        'lunas' | 'belum_bayar' | 'cicilan'
  bulan:         number
  tahun:         number
  siswa: {
    id:    string
    nama:  string
    nis:   string | null
    no_wa: string | null
    kelas: { id: string; nama: string; warna: string; jenjang: string } | null
  } | null
}

interface PembayaranRecord {
  id:           string
  tagihan_id:   string
  jumlah:       number
  metode:       string
  tanggal_bayar: string
  catatan:      string | null
}

interface VerifikasiMenungguRow {
  id:               string
  tagihan_id:       string
  nominal_diajukan: number
  created_at:       string
  siswa: {
    id:    string
    nama:  string
    nis:   string | null
    kelas: { id: string; nama: string; warna: string; jenjang: string } | null
  } | null
  tagihan: { bulan: number; tahun: number } | null
}

type EffectiveStatus = 'lunas' | 'cicilan' | 'belum_bayar' | 'menunggak' | 'menunggu_verifikasi'

interface DisplayRow {
  key:             string
  tagihan_id:      string
  siswa_id:        string
  siswa_nama:      string
  siswa_nis:       string | null
  kelas_id:        string
  kelas_nama:      string
  kelas_warna:     string
  nominal:         number
  tagihan_total:   number
  paid_total:      number
  payment_count:   number
  metode:          string | null
  ke:              number | null
  effectiveStatus: EffectiveStatus
  tanggal:         string | null
  tagihan_status:  TagihanRow['status']
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<EffectiveStatus, { label: string; bg: string; color: string }> = {
  lunas:               { label: 'Lunas',               bg: '#D1FAE5', color: '#065F46' },
  cicilan:             { label: 'Cicilan',              bg: '#1A2C4E', color: '#FFFFFF' },
  belum_bayar:         { label: 'Belum Bayar',          bg: '#DBEAFE', color: '#1D4ED8' },
  menunggak:           { label: 'Menunggak',            bg: '#FEE2E2', color: '#DC2626' },
  menunggu_verifikasi: { label: 'Menunggu Verifikasi',  bg: '#FEF3C7', color: '#D97706' },
}

const METODE_OPTIONS = [
  { value: 'tunai',    label: 'Tunai',           icon: Wallet   },
  { value: 'transfer', label: 'Transfer',         icon: Building2 },
  { value: 'qris',    label: 'QRIS',             icon: QrCode   },
  { value: 'va',      label: 'Virtual Account',  icon: CreditCard },
]

const METODE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  tunai:    { label: 'Tunai',    bg: '#DCFCE7', color: '#16A34A' },
  transfer: { label: 'Transfer', bg: '#DBEAFE', color: '#1D4ED8' },
  qris:     { label: 'QRIS',    bg: '#F3E8FF', color: '#7C3AED' },
  va:       { label: 'VA',      bg: '#FEF3C7', color: '#D97706' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SelectArrow() {
  return (
    <ChevronDown size={14} style={{
      position: 'absolute', right: 10, top: '50%',
      transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748B',
    }} />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PembayaranPage() {
  const now = new Date()

  const [sekolahId,      setSekolahId]      = useState('')
  const [bulan,          ]          = useState(now.getMonth() + 1)
  const [tahun,          ]          = useState(now.getFullYear())
  const [tagihan,        setTagihan]        = useState<TagihanRow[]>([])
  const [pembayaran,     setPembayaran]     = useState<PembayaranRecord[]>([])
  const [verifMenunggu,  setVerifMenunggu]  = useState<VerifikasiMenungguRow[]>([])
  const [lastMonthTotal, setLastMonthTotal] = useState(0)
  // Seluruh periode (tunggakan sebelumnya + bulan ini) — dasar kartu Tingkat Pelunasan
  const [ringkasanPeriode, setRingkasanPeriode] = useState<RingkasanPeriode>(RINGKASAN_PERIODE_KOSONG)
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [filterKelas,    setFilterKelas]    = useState('semua')
  const [filterMetode,   setFilterMetode]   = useState('semua')
  const [currentPage,    setCurrentPage]    = useState(1)
  const PAGE_SIZE = 10

  // Modal state
  const [modal,        setModal]        = useState<DisplayRow | null>(null)
  const [jumlahBayar,  setJumlahBayar]  = useState('')
  const [metodeBayar,  setMetodeBayar]  = useState('tunai')
  // Tanggal lokal, bukan UTC — toISOString() memberi tanggal kemarin sebelum pukul 07.00 WIB
  const [tanggalBayar, setTanggalBayar] = useState(now.toLocaleDateString('en-CA'))
  const [keterangan,   setKeterangan]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState('')
  const [savedOk,      setSavedOk]     = useState(false)

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

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sekolahId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)

      // Ringkasan periode berjalan bersamaan dengan pemuatan data bulan ini
      const ringkasanPromise = (async () => {
        const { data: ta } = await supabase
          .from('tahun_ajaran').select(TA_PERIODE_SELECT).eq('sekolah_id', sekolahId).eq('is_aktif', true).maybeSingle()
        return muatRingkasanPeriode(sekolahId, (ta ?? null) as PeriodeTahunAjaran | null, bulan, tahun)
      })()

      const { data: tagihanData } = await supabase
        .from('tagihan')
        .select('id, total_nominal, status, bulan, tahun, siswa:siswa_id(id, nama, nis, no_wa, kelas:kelas_id(id, nama, warna, jenjang))')
        .eq('sekolah_id', sekolahId)
        .eq('bulan', bulan)
        .eq('tahun', tahun)
        .limit(500)

      if (cancelled) return
      const tagihanList = (tagihanData ?? []) as unknown as TagihanRow[]

      const { data: verifData } = await supabase
        .from('verifikasi_pembayaran')
        .select('id, tagihan_id, nominal_diajukan, created_at, siswa:siswa_id(id, nama, nis, kelas:kelas_id(id, nama, warna, jenjang)), tagihan:tagihan_id(bulan, tahun)')
        .eq('sekolah_id', sekolahId)
        .eq('status', 'menunggu')
        .limit(200)

      if (cancelled) return
      const verifList = ((verifData ?? []) as unknown as VerifikasiMenungguRow[])
        .filter(v => v.tagihan?.bulan === bulan && v.tagihan?.tahun === tahun)

      const tagihanIds = tagihanList.map(t => t.id)
      let pembayaranList: PembayaranRecord[] = []
      if (tagihanIds.length > 0) {
        const { data: pembData } = await supabase
          .from('pembayaran')
          .select('id, tagihan_id, jumlah, metode, tanggal_bayar, catatan')
          .in('tagihan_id', tagihanIds)
          .order('tanggal_bayar', { ascending: true })
          .limit(2000)
        pembayaranList = (pembData ?? []) as PembayaranRecord[]
      }

      // Last month total for trend
      const lastBulan = bulan === 1 ? 12 : bulan - 1
      const lastTahun = bulan === 1 ? tahun - 1 : tahun
      const { data: lastTagihanData } = await supabase
        .from('tagihan')
        .select('id')
        .eq('sekolah_id', sekolahId)
        .eq('bulan', lastBulan)
        .eq('tahun', lastTahun)
        .limit(500)

      let prevTotal = 0
      const lastIds = ((lastTagihanData ?? []) as { id: string }[]).map(t => t.id)
      if (lastIds.length > 0) {
        const { data: lastPemb } = await supabase
          .from('pembayaran')
          .select('jumlah')
          .in('tagihan_id', lastIds)
          .limit(2000)
        prevTotal = ((lastPemb ?? []) as { jumlah: number }[]).reduce((s, p) => s + p.jumlah, 0)
      }

      const ringkasan = await ringkasanPromise

      if (cancelled) return
      setTagihan(tagihanList)
      setPembayaran(pembayaranList)
      setVerifMenunggu(verifList)
      setLastMonthTotal(prevTotal)
      setRingkasanPeriode(ringkasan)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [sekolahId, bulan, tahun])

  // ── Build display rows ────────────────────────────────────────────────────

  const { displayRows, kelasList } = useMemo(() => {
    const pembByTagihan = new Map<string, PembayaranRecord[]>()
    for (const p of pembayaran) {
      const list = pembByTagihan.get(p.tagihan_id) ?? []
      list.push(p)
      pembByTagihan.set(p.tagihan_id, list)
    }

    const rows: DisplayRow[] = []

    // Baris menunggu verifikasi (bukti transfer dari orang tua, belum diproses admin) — tampil paling atas
    for (const v of verifMenunggu) {
      const kelas = v.siswa?.kelas
      rows.push({
        key:             `verif_${v.id}`,
        tagihan_id:      v.tagihan_id,
        siswa_id:        v.siswa?.id ?? '',
        siswa_nama:      v.siswa?.nama ?? '-',
        siswa_nis:       v.siswa?.nis ?? null,
        kelas_id:        kelas?.id ?? '',
        kelas_nama:      kelas?.nama ?? '-',
        kelas_warna:     kelas?.warna ?? '#94A3B8',
        nominal:         v.nominal_diajukan,
        tagihan_total:   v.nominal_diajukan,
        paid_total:      0,
        payment_count:   0,
        metode:          'transfer',
        ke:              null,
        effectiveStatus: 'menunggu_verifikasi',
        tanggal:         v.created_at,
        tagihan_status:  'belum_bayar',
      })
    }

    for (const t of tagihan) {
      const pembs = pembByTagihan.get(t.id) ?? []
      if (pembs.length === 0) continue  // tidak ada transaksi = jangan tampilkan

      const kelas        = t.siswa?.kelas
      const paidTotal    = pembs.reduce((s, p) => s + p.jumlah, 0)
      const paymentCount = pembs.length

      const common = {
        tagihan_id:     t.id,
        siswa_id:       t.siswa?.id ?? '',
        siswa_nama:     t.siswa?.nama ?? '-',
        siswa_nis:      t.siswa?.nis ?? null,
        kelas_id:       kelas?.id ?? '',
        kelas_nama:     kelas?.nama ?? '-',
        kelas_warna:    kelas?.warna ?? '#94A3B8',
        tagihan_total:  t.total_nominal,
        paid_total:     paidTotal,
        payment_count:  paymentCount,
        tagihan_status: t.status,
      }

      // Satu baris per transaksi pembayaran
      pembs.forEach((p, idx) => {
        const isLast: boolean         = idx === pembs.length - 1
        const effectiveStatus: EffectiveStatus = (isLast && t.status === 'lunas') ? 'lunas' : 'cicilan'
        rows.push({
          key: `${t.id}_${p.id}`,
          ...common,
          effectiveStatus,
          nominal: p.jumlah,
          metode:  p.metode,
          ke:      idx + 1,
          tanggal: p.tanggal_bayar,
        })
      })
    }

    const kelasList = Array.from(
      new Map(
        tagihan.map(t => t.siswa?.kelas).filter(Boolean).map(k => [k!.id, k!])
      ).values()
    ).sort((a, b) =>
      a.jenjang.localeCompare(b.jenjang, 'id', { numeric: true }) ||
      a.nama.localeCompare(b.nama, 'id', { numeric: true })
    )

    return { displayRows: rows, kelasList }
  }, [tagihan, pembayaran, verifMenunggu])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    // Tingkat pelunasan dan sisanya memakai seluruh periode — tunggakan bulan-bulan
    // sebelumnya digabung dengan tagihan bulan ini — hitungan yang sama dengan card
    // "Total tagihan periode ini" di Tagihan Aktif. Persen = uang masuk ÷ nilai tagihan.
    const pctLunas      = ringkasanPeriode.total > 0 ? Math.round(ringkasanPeriode.masuk / ringkasanPeriode.total * 100) : 0
    const sisBelumMasuk = Math.max(0, ringkasanPeriode.total - ringkasanPeriode.masuk)
    const gatewayTotal  = pembayaran.filter(p => ['qris','va','transfer'].includes(p.metode)).reduce((s,p) => s + p.jumlah, 0)
    const manualTotal   = pembayaran.filter(p => p.metode === 'tunai').reduce((s,p) => s + p.jumlah, 0)
    const totalPemasukan = gatewayTotal + manualTotal
    const trendPct = lastMonthTotal > 0
      ? Math.round(((totalPemasukan - lastMonthTotal) / lastMonthTotal) * 100)
      : totalPemasukan > 0 ? 100 : 0
    const trendUp = trendPct >= 0
    const lastBulan = bulan === 1 ? 12 : bulan - 1
    const lastTahun = bulan === 1 ? tahun - 1 : tahun
    return { pctLunas, gatewayTotal, manualTotal, totalPemasukan, sisBelumMasuk, trendPct, trendUp, lastBulan, lastTahun }
  }, [pembayaran, lastMonthTotal, ringkasanPeriode, bulan, tahun])

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return displayRows.filter(row => {
      if (filterKelas !== 'semua' && row.kelas_id !== filterKelas) return false
      if (filterMetode !== 'semua' && row.metode !== filterMetode) return false
      if (search) {
        const q = search.toLowerCase()
        if (!row.siswa_nama.toLowerCase().includes(q) && !(row.siswa_nis ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [displayRows, filterKelas, filterMetode, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(currentPage, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const goToPage   = (p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages)))

  // ── Modal ─────────────────────────────────────────────────────────────────

  const closeModal = () => { setModal(null); setSavedOk(false); setSaveError('') }

  const handleSimpan = async () => {
    if (!modal) return
    const jumlah    = parseInt(jumlahBayar.replace(/\D/g, ''), 10)
    const remaining = modal.tagihan_total - modal.paid_total
    if (!jumlah || jumlah <= 0) { setSaveError('Masukkan jumlah pembayaran yang valid.'); return }
    if (jumlah > remaining)     { setSaveError(`Jumlah melebihi sisa tagihan (${formatRp(remaining)}).`); return }

    setSaving(true); setSaveError('')

    const { error: e1 } = await supabase.from('pembayaran').insert({
      tagihan_id:   modal.tagihan_id,
      siswa_id:     modal.siswa_id,
      sekolah_id:   sekolahId,
      jumlah,
      metode:       metodeBayar,
      tanggal_bayar: new Date(tanggalBayar).toISOString(),
      catatan:      keterangan.trim() || null,
      status:       'terkonfirmasi',
    })

    if (e1) { setSaveError(e1.message); setSaving(false); return }

    const newPaidTotal = modal.paid_total + jumlah
    const newStatus: TagihanRow['status'] = newPaidTotal >= modal.tagihan_total ? 'lunas' : 'cicilan'
    await supabase.from('tagihan').update({ status: newStatus }).eq('id', modal.tagihan_id)

    const { data: refreshed } = await supabase
      .from('pembayaran')
      .select('id, tagihan_id, jumlah, metode, tanggal_bayar, catatan')
      .eq('tagihan_id', modal.tagihan_id)
      .order('tanggal_bayar', { ascending: true })

    setPembayaran(prev => [
      ...prev.filter(p => p.tagihan_id !== modal.tagihan_id),
      ...((refreshed ?? []) as PembayaranRecord[]),
    ])
    setTagihan(prev => prev.map(t => t.id === modal.tagihan_id ? { ...t, status: newStatus } : t))
    // Pembayaran ini untuk tagihan bulan berjalan dan tidak melebihi sisanya, jadi
    // uang masuk periode cukup ditambah tanpa memuat ulang
    setRingkasanPeriode(prev => ({ ...prev, masuk: prev.masuk + jumlah }))

    setSaving(false)
    setSavedOk(true)
    setTimeout(closeModal, 1200)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hasData = tagihan.length > 0

  return (
    <div className="dashboard-content">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            <div style={{ width:60, height:60, background:'#1A2C4E', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'2px 3px 10px rgba(18, 47, 102, 0.54)' }}>
              <Banknote size={30} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize:'1.8rem', fontWeight:700, color:'var(--navy-dark)', fontFamily:'var(--font-dm-sans), sans-serif', margin:0, lineHeight:1.2 }}>
                Pembayaran
              </h1>
              <p style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-muted)', margin:'0.2rem 0 0' }}>
                Rekam jejak seluruh transaksi pembayaran siswa
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ background:'#fff', borderRadius:14, borderLeft:'28px solid #E2E8F0', border:'1.5px solid #E2E8F0', padding:'4rem 2rem', display:'flex', alignItems:'center', justifyContent:'center', color:'#94A3B8', fontSize:'0.875rem', minHeight:220 }}>
          Memuat data...
        </div>
      ) : !hasData ? (

        /* ── Empty state ───────────────────────────────────────────────────── */
        <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #E2E8F0', borderLeft:'28px solid #1A2C4E', padding:'4rem 2rem', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.875rem', minHeight:260, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'#F1F5F9', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Banknote size={30} color="#94A3B8" />
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:700, fontSize:'1.05rem', color:'#0F172A', marginBottom:4 }}>
              Belum ada ringkasan periode ini
            </div>
            <div style={{ fontSize:'0.875rem', color:'#94A3B8', fontWeight:500 }}>
              Rekap nominal dan kondisi pembayaran {BULAN_NAMES[bulan]} {tahun}
            </div>
          </div>
        </div>

      ) : (
        <>
          {/* ── Stat wrapper card ────────────────────────────────────────────── */}
          <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #E2E8F0', borderLeft:'28px solid #1A2C4E', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', padding:'1.25rem 1.5rem', marginBottom:'1.25rem' }}>

            {/* Header ringkasan */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.875rem', marginBottom:'1.25rem' }}>
              <div style={{ width:48, height:48, background:'#1A2C4E', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Banknote size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontWeight:800, fontSize:'1rem', color:'#0F172A', lineHeight:1.2 }}>Ringkasan periode ini</div>
                <div style={{ fontSize:'0.8rem', color:'#94A3B8', fontWeight:500, marginTop:2 }}>Rekap nominal dan kondisi pembayaran bulan ini</div>
              </div>
            </div>

            {/* Stat row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'0.875rem' }}>

            {/* Total Pemasukan */}
            <div style={{ background:'#fff', borderRadius:12, padding:'1.25rem', border:'1px solid #F1F5F9', boxShadow:'0 2px 10px #3244736e' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                <span style={{ fontSize:'1rem', fontWeight:600, color:'#94A3B8' }}>Total pemasukan</span>
                <TrendingUp size={22} color="#1A2C4E" />
              </div>
              <div style={{ fontSize:'1.65rem', fontWeight:800, color:'#0F172A', lineHeight:1.1, marginBottom:'0.75rem' }}>
                {formatRp(stats.totalPemasukan)}
              </div>
              <div style={{ height:1, background:'#E2E8F0', marginBottom:'0.875rem' }} />
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <div style={{ flex:1, background:'#1A2C4E', borderRadius:10, padding:'0.6rem 0.75rem' }}>
                  <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#fff', marginBottom:'0.2rem' }}>● Gateway</div>
                  <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.6)', fontWeight:600 }}>{formatRp(stats.gatewayTotal)}</div>
                </div>
                <div style={{ flex:1, background:'#1A2C4E', borderRadius:10, padding:'0.6rem 0.75rem' }}>
                  <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#fff', marginBottom:'0.2rem' }}>● Manual</div>
                  <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.6)', fontWeight:600 }}>{formatRp(stats.manualTotal)}</div>
                </div>
              </div>
            </div>

            {/* Tingkat Pelunasan */}
            <div style={{ background:'#ffffff', borderRadius:12, padding:'1.1rem', boxShadow:'0 2px 10px #3244736e' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.75rem' }}>
                <span style={{ fontSize:'1rem', fontWeight:600, color:'#94A3B8' }}>Tingkat Pelunasan</span>
              </div>
              <div style={{ fontSize:'2rem', fontWeight:800, color:'#0F172A', lineHeight:1, marginBottom:'0.5rem' }}>
                {stats.pctLunas}%
              </div>
              <div style={{ height:15, background:'#F1F5F9', borderRadius:99, overflow:'hidden', marginBottom:'0.5rem' }}>
                <div style={{ height:'100%', width:`${stats.pctLunas}%`, background:'linear-gradient(90deg,#10B981,#059669)', borderRadius:99, transition:'width 0.5s' }} />
              </div>
              <div style={{ fontSize:'0.9rem', color:'#64748B', fontWeight:600 }}>
                Sisa belum masuk: {formatRp(stats.sisBelumMasuk)}
              </div>
            </div>

            {/* Tren Bulanan */}
            <div style={{ background:'#fff', borderRadius:12, padding:'1.25rem', border:'1px solid #F1F5F9', boxShadow:'0 2px 10px #3244736e' }}>
              <div style={{ marginBottom:'0.5rem' }}>
                <span style={{ fontSize:'1rem', fontWeight:600, color:'#94A3B8' }}>Tren bulanan</span>
              </div>
              <div style={{ fontSize:'1.85rem', fontWeight:800, color: stats.trendUp ? '#16A34A' : '#DC2626', lineHeight:1, marginBottom:'0.25rem' }}>
                {stats.trendUp ? '↗' : '↘'} {Math.abs(stats.trendPct)}%
              </div>
              <div style={{ fontSize:'0.78rem', color:'#64748B', fontWeight:500, marginBottom:'0.875rem' }}>
                Lebih {stats.trendUp ? 'tinggi' : 'rendah'} dari bulan lalu
              </div>
              <div style={{ background:'#1A2C4E', borderRadius:10, overflow:'hidden' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.6rem 0.875rem' }}>
                  <span style={{ fontSize:'0.8rem', fontWeight:700, color:'#fff' }}>Bulan ini ({BULAN_NAMES[bulan]})</span>
                  <span style={{ fontSize:'0.8rem', fontWeight:700, color:'#fff' }}>{formatRpShort(stats.totalPemasukan)}</span>
                </div>
                <div style={{ height:1, background:'rgba(255,255,255,0.12)', margin:'0 0.875rem' }} />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.6rem 0.875rem' }}>
                  <span style={{ fontSize:'0.78rem', fontWeight:500, color:'rgba(255,255,255,0.55)' }}>Bulan lalu ({BULAN_NAMES[stats.lastBulan]})</span>
                  <span style={{ fontSize:'0.78rem', fontWeight:600, color:'rgba(255,255,255,0.55)' }}>{formatRpShort(lastMonthTotal)}</span>
                </div>
              </div>
            </div>
            </div>{/* end stat grid */}
          </div>{/* end wrapper card */}

          {/* ── Table card ───────────────────────────────────────────────────── */}
          <div style={{ background:'#fff', borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', border:'1px solid #F1F5F9', overflow:'hidden' }}>

            {/* Filter row */}
            <div style={{ display:'flex', gap:'0.6rem', padding:'0.875rem 1rem', borderBottom:'1px solid #F1F5F9', flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ position:'relative' }}>
                <select value={filterKelas} onChange={e => { setFilterKelas(e.target.value); setCurrentPage(1) }}
                  style={{ appearance:'none', background:'#F8FAFC', border:'1.5px solid #E2E8F0', borderRadius:8, padding:'0.45rem 2rem 0.45rem 0.75rem', fontSize:'0.82rem', fontWeight:600, color:'#0F172A', cursor:'pointer', minWidth:130 }}>
                  <option value="semua">Semua kelas</option>
                  {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
                <SelectArrow />
              </div>

              <div style={{ position:'relative' }}>
                <select value={filterMetode} onChange={e => { setFilterMetode(e.target.value); setCurrentPage(1) }}
                  style={{ appearance:'none', background:'#F8FAFC', border:'1.5px solid #E2E8F0', borderRadius:8, padding:'0.45rem 2rem 0.45rem 0.75rem', fontSize:'0.82rem', fontWeight:600, color:'#0F172A', cursor:'pointer', minWidth:140 }}>
                  <option value="semua">Semua metode</option>
                  {METODE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <SelectArrow />
              </div>

              <div style={{ position:'relative', flex:'1 1 200px', minWidth:0, marginLeft:'auto' }}>
                <Search size={15} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94A3B8' }} />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                  placeholder="Cari nama siswa..."
                  style={{ width:'100%', paddingLeft:32, paddingRight:10, paddingTop:'0.45rem', paddingBottom:'0.45rem', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:'0.85rem', outline:'none', boxSizing:'border-box', background:'#F8FAFC' }}
                />
              </div>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
              <div style={{ padding:'3rem', textAlign:'center', color:'#94A3B8', fontSize:'0.875rem' }}>
                Tidak ada data yang sesuai filter.
              </div>
            ) : (
              <div style={{ overflowX:'auto', padding:'0 1rem' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:720 }}>
                  <thead>
                    <tr style={{ background:'#1A2C4E' }}>
                      {(['Tanggal', 'Nama', 'Kelas', 'Nominal', 'Metode', 'Ke-', 'Status'] as const).map((h, i, arr) => (
                        <th key={h} style={{ padding:'0.5rem 1rem', textAlign:'left', fontSize:'0.75rem', fontWeight:700, color:'#fff', whiteSpace:'nowrap', borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : undefined }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(row => {
                      const cfg       = STATUS_CFG[row.effectiveStatus]
                      const metodeCfg = row.metode ? (METODE_BADGE[row.metode] ?? { label: row.metode, bg:'#F1F5F9', color:'#64748B' }) : null
                      const initials  = getInitials(row.siswa_nama)

                      return (
                        <tr key={row.key}
                          style={{ borderBottom:'1px solid #F8FAFC', transition:'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FAFBFF'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                        >
                          <td style={{ padding:'0.7rem 0.875rem', fontSize:'0.8rem', color:'#64748B', fontWeight:600, whiteSpace:'nowrap' }}>
                            {row.tanggal
                              ? new Date(row.tanggal).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'2-digit' })
                              : <span style={{ color:'#CBD5E1' }}>—</span>}
                          </td>

                          <td style={{ padding:'0.7rem 0.875rem' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                              <div style={{ width:30, height:30, borderRadius:'50%', background: row.kelas_warna, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'0.62rem', fontWeight:800, color:'#fff' }}>
                                {initials}
                              </div>
                              <span style={{ fontWeight:700, fontSize:'0.85rem', color:'#0F172A' }}>{row.siswa_nama}</span>
                            </div>
                          </td>

                          <td style={{ padding:'0.7rem 0.875rem' }}>
                            <span style={{ background: row.kelas_warna + '22', color: row.kelas_warna, borderRadius:6, padding:'0.2rem 0.55rem', fontSize:'0.73rem', fontWeight:700, whiteSpace:'nowrap' }}>
                              {row.kelas_nama}
                            </span>
                          </td>

                          <td style={{ padding:'0.7rem 0.875rem', fontSize:'0.85rem', fontWeight:700, color:'#0F172A', whiteSpace:'nowrap' }}>
                            {formatRp(row.nominal)}
                          </td>

                          <td style={{ padding:'0.7rem 0.875rem' }}>
                            {metodeCfg
                              ? <span style={{ background: metodeCfg.bg, color: metodeCfg.color, borderRadius:20, padding:'0.2rem 0.6rem', fontSize:'0.72rem', fontWeight:700 }}>{metodeCfg.label}</span>
                              : <span style={{ color:'#CBD5E1' }}>—</span>}
                          </td>

                          <td style={{ padding:'0.7rem 0.875rem', fontSize:'0.8rem', color:'#475569', fontWeight:600, whiteSpace:'nowrap' }}>
                            {row.ke != null
                              ? `Pembayaran ke-${row.ke}`
                              : <span style={{ color:'#CBD5E1' }}>—</span>}
                          </td>

                          <td style={{ padding:'0.7rem 0.875rem' }}>
                            <span style={{ background: cfg.bg, color: cfg.color, borderRadius:20, padding:'0.25rem 0.65rem', fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' }}>
                              {cfg.label}
                            </span>
                          </td>

                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.875rem 1rem', borderTop:'1px solid #F1F5F9', flexWrap:'wrap', gap:'0.5rem' }}>
                <span style={{ fontSize:'0.78rem', color:'#64748B', fontWeight:600 }}>
                  {(safePage-1)*PAGE_SIZE+1}–{Math.min(safePage*PAGE_SIZE, filtered.length)} dari {filtered.length} transaksi
                </span>
                <div style={{ display:'flex', gap:'0.35rem', alignItems:'center' }}>
                  <button onClick={() => goToPage(safePage-1)} disabled={safePage===1}
                    style={{ padding:'0.4rem 0.75rem', borderRadius:7, border:'1.5px solid #E2E8F0', background:'#fff', fontSize:'0.8rem', fontWeight:700, color:safePage===1?'#CBD5E1':'#1A2C4E', cursor:safePage===1?'default':'pointer' }}>
                    ‹ Prev
                  </button>
                  {Array.from({length:totalPages},(_,i)=>i+1)
                    .filter(p => p===1 || p===totalPages || Math.abs(p-safePage)<=1)
                    .reduce<(number|'...')[]>((acc,p,i,arr) => {
                      if (i>0 && (p as number)-(arr[i-1] as number)>1) acc.push('...')
                      acc.push(p); return acc
                    }, [])
                    .map((p, idx) => p==='...'
                      ? <span key={`e${idx}`} style={{padding:'0.4rem 0.3rem',fontSize:'0.8rem',color:'#94A3B8'}}>…</span>
                      : <button key={p} onClick={() => goToPage(p as number)}
                          style={{padding:'0.4rem 0.65rem',borderRadius:7,border:'1.5px solid',borderColor:p===safePage?'#1A2C4E':'#E2E8F0',background:p===safePage?'#1A2C4E':'#fff',color:p===safePage?'#fff':'#475569',fontSize:'0.8rem',fontWeight:700,cursor:'pointer',minWidth:34}}>
                          {p}
                        </button>
                    )}
                  <button onClick={() => goToPage(safePage+1)} disabled={safePage===totalPages}
                    style={{padding:'0.4rem 0.75rem',borderRadius:7,border:'1.5px solid #E2E8F0',background:'#fff',fontSize:'0.8rem',fontWeight:700,color:safePage===totalPages?'#CBD5E1':'#1A2C4E',cursor:safePage===totalPages?'default':'pointer'}}>
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal Catat Pembayaran ─────────────────────────────────────────── */}
      {modal && (
        <div
          style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(15,23,42,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
          onClick={closeModal}
        >
          <div
            style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:460, boxShadow:'0 24px 60px rgba(0,0,0,0.22)', overflow:'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background:'#1A2C4E', padding:'1.1rem 1.4rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ color:'#fff', fontWeight:800, fontSize:'1rem' }}>Catat Pembayaran</div>
                <div style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.78rem', marginTop:1 }}>{BULAN_NAMES[bulan]} {tahun}</div>
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
                  <div style={{ background:'#F8FAFC', borderRadius:10, padding:'0.75rem 1rem', marginBottom:'1rem', border:'1px solid #F1F5F9' }}>
                    <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#0F172A' }}>{modal.siswa_nama}</div>
                    <div style={{ display:'flex', gap:'0.75rem', marginTop:3, flexWrap:'wrap' }}>
                      <span style={{ fontSize:'0.73rem', color:'#64748B', fontWeight:600 }}>Kelas: {modal.kelas_nama}</span>
                      {modal.siswa_nis && <span style={{ fontSize:'0.73rem', color:'#64748B', fontWeight:600 }}>NIS: {modal.siswa_nis}</span>}
                    </div>
                    <div style={{ display:'flex', gap:'1rem', marginTop:6, flexWrap:'wrap' }}>
                      <div style={{ fontSize:'0.78rem', color:'#475569', fontWeight:600 }}>
                        Total tagihan: <span style={{ color:'#1A2C4E', fontWeight:800 }}>{formatRp(modal.tagihan_total)}</span>
                      </div>
                      {modal.payment_count > 0 && (
                        <div style={{ fontSize:'0.78rem', color:'#475569', fontWeight:600 }}>
                          Sudah dibayar: <span style={{ color:'#16A34A', fontWeight:800 }}>{formatRp(modal.paid_total)}</span>
                        </div>
                      )}
                    </div>
                    {modal.payment_count > 0 && (
                      <div style={{ marginTop:4, fontSize:'0.75rem', color:'#D97706', fontWeight:700 }}>
                        Ini akan menjadi Pembayaran ke-{modal.payment_count + 1}
                      </div>
                    )}
                  </div>

                  <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem' }}>
                    <button
                      onClick={() => setJumlahBayar(String(modal.tagihan_total - modal.paid_total))}
                      style={{ flex:1, padding:'0.5rem', borderRadius:8, border:`1.5px solid ${jumlahBayar===String(modal.tagihan_total-modal.paid_total)?'#1A2C4E':'#E2E8F0'}`, background:jumlahBayar===String(modal.tagihan_total-modal.paid_total)?'#EFF6FF':'#fff', color:jumlahBayar===String(modal.tagihan_total-modal.paid_total)?'#1A2C4E':'#64748B', fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}>
                      Lunas Sekarang
                    </button>
                    <button
                      onClick={() => setJumlahBayar('')}
                      style={{ flex:1, padding:'0.5rem', borderRadius:8, border:'1.5px solid #E2E8F0', background:'#fff', color:'#64748B', fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}>
                      Bayar Sebagian
                    </button>
                  </div>

                  <div style={{ marginBottom:'0.875rem' }}>
                    <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Jumlah Bayar</label>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:'0.85rem', color:'#64748B', fontWeight:700 }}>Rp</span>
                      <input type="text" value={rpInput(jumlahBayar)} onChange={e => setJumlahBayar(e.target.value.replace(/\D/g,''))}
                        placeholder="0"
                        style={{ width:'100%', paddingLeft:36, paddingRight:10, paddingTop:'0.6rem', paddingBottom:'0.6rem', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:'0.9rem', fontWeight:700, boxSizing:'border-box', outline:'none', background:'#F8FAFC' }} />
                    </div>
                  </div>

                  <div style={{ marginBottom:'0.875rem' }}>
                    <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Tanggal Pembayaran</label>
                    <input type="date" value={tanggalBayar} onChange={e => setTanggalBayar(e.target.value)}
                      style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:'0.85rem', boxSizing:'border-box', outline:'none', background:'#F8FAFC' }} />
                  </div>

                  <div style={{ marginBottom:'0.875rem' }}>
                    <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Metode Pembayaran</label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.4rem' }}>
                      {METODE_OPTIONS.map(m => {
                        const Icon = m.icon; const active = metodeBayar === m.value
                        return (
                          <button key={m.value} onClick={() => setMetodeBayar(m.value)}
                            style={{ padding:'0.5rem 0.3rem', borderRadius:8, border:`1.5px solid ${active?'#1A2C4E':'#E2E8F0'}`, background:active?'#EFF6FF':'#fff', color:active?'#1A2C4E':'#64748B', fontWeight:700, fontSize:'0.67rem', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                            <Icon size={14} />
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ marginBottom:'1rem' }}>
                    <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>
                      Keterangan <span style={{ color:'#94A3B8', fontWeight:500 }}>(opsional)</span>
                    </label>
                    <textarea value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="Catatan tambahan..." rows={2}
                      style={{ width:'100%', padding:'0.6rem 0.75rem', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:'0.85rem', resize:'vertical', boxSizing:'border-box', outline:'none', fontFamily:'inherit', background:'#F8FAFC' }} />
                  </div>

                  {saveError && (
                    <div style={{ background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'0.6rem 0.8rem', fontSize:'0.8rem', fontWeight:600, marginBottom:'0.875rem' }}>
                      {saveError}
                    </div>
                  )}

                  <button onClick={handleSimpan} disabled={saving}
                    style={{ width:'100%', background:saving?'#94A3B8':'linear-gradient(135deg,#1A2C4E,#243D6A)', color:'#fff', border:'none', borderRadius:10, padding:'0.8rem', fontSize:'0.9rem', fontWeight:800, cursor:saving?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    {saving ? 'Menyimpan...' : <><CreditCard size={16} /> Simpan Pembayaran</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
