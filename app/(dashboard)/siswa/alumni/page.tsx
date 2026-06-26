'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, Search, Users, CheckCircle2, X,
  AlertTriangle, Plus, Eye, ChevronDown, ChevronRight, CreditCard,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AlumniRow {
  id:            string
  nama:          string
  nis:           string | null
  nisn:          string | null
  kelas:         string | null
  tahun_lulus:   string | null
  jenis_alumni:  string | null   // 'lulus' | 'pindah' | 'keluar'
  nama_wali:     string | null
  no_wa:         string | null
  tanggal_lulus: string | null   // DATE "YYYY-MM-DD"
}

interface TagihanDetailItem {
  id:            string
  bulan:         number
  tahun:         number
  status:        string
  nominal:       number
  hasPembayaran: boolean
}

interface TagihanGroupItem {
  tahun_ajaran_id:   string
  tahun_ajaran_nama: string
  kelas_nama:        string | null
  tagihan:           TagihanDetailItem[]
  totalNominal:      number
}

type TagihanRaw = {
  id: string; total_nominal: number; status: string; bulan: number; tahun: number
  tahun_ajaran_id: string | null
  tahun_ajaran: { nama: string } | null
  kelas: { nama: string } | null
}
type PembTagihanRaw = { id: string; tagihan_id: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const formatRp   = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const formatDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#059669', '#DC2626', '#D97706', '#0891B2', '#1A2C4E']

function getInitials(nama: string): string {
  return nama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function avatarColor(nama: string): string {
  let h = 0
  for (const c of nama) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ jenis }: { jenis: string | null }) {
  const j = jenis ?? 'lulus'
  if (j === 'pindah') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF3C7', color: '#92400E', borderRadius: 20, padding: '0.22rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
      <Plus size={10} /> Pindah
    </span>
  )
  if (j === 'keluar') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEE2E2', color: '#DC2626', borderRadius: 20, padding: '0.22rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
      <X size={10} /> Keluar
    </span>
  )
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EDE9FE', color: '#5B21B6', borderRadius: 20, padding: '0.22rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
      <CheckCircle2 size={10} /> Lulus
    </span>
  )
}

// ── Donut chart constants ─────────────────────────────────────────────────────

const R    = 38
const CIRC = 2 * Math.PI * R

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AlumniPage() {
  const router        = useRouter()
  const angkatanRef   = useRef<HTMLDivElement>(null)
  const statusRef     = useRef<HTMLDivElement>(null)

  const [loading,          setLoading]          = useState(true)
  const [alumniList,       setAlumniList]       = useState<AlumniRow[]>([])
  const [menunggakIds,     setMenunggakIds]     = useState<Set<string>>(new Set())
  const [search,           setSearch]           = useState('')
  const [filterAngkatan,   setFilterAngkatan]   = useState('semua')
  const [filterStatus,     setFilterStatus]     = useState('semua')
  const [showAngkatanDrop, setShowAngkatanDrop] = useState(false)
  const [showStatusDrop,   setShowStatusDrop]   = useState(false)
  const [viewAlumni,       setViewAlumni]       = useState<AlumniRow | null>(null)
  const [viewLoading,      setViewLoading]      = useState(false)
  const [tagihanGroups,    setTagihanGroups]    = useState<TagihanGroupItem[]>([])
  const [expandedGroups,   setExpandedGroups]   = useState<Set<string>>(new Set())
  const [totalTagihan,     setTotalTagihan]     = useState(0)

  // Click outside untuk tutup dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (angkatanRef.current && !angkatanRef.current.contains(e.target as Node)) setShowAngkatanDrop(false)
      if (statusRef.current   && !statusRef.current.contains(e.target as Node))   setShowStatusDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Load data ───────────────────────────────────────────────────────────────

  useEffect(() => {
    ;(async () => {
      const { data: pData } = await supabase.from('pengaturan').select('setup_steps').maybeSingle()
      const steps = (pData as { setup_steps?: Record<string, boolean> } | null)?.setup_steps ?? {}
      if (!steps['komponen_tagihan']) { router.replace('/tagihan/komponen'); return }

      // Query dengan jenis_alumni + no_wa + tanggal_lulus (fallback jika kolom belum ada)
      let result = await supabase
        .from('siswa')
        .select('id, nama, nis, nisn, kelas, tahun_lulus, jenis_alumni, nama_wali, no_wa, tanggal_lulus, status')
        .eq('status', 'alumni')
        .order('tahun_lulus', { ascending: false })
        .order('nama')
        .limit(1000)

      if (result.error) {
        result = await supabase
          .from('siswa')
          .select('id, nama, nis, nisn, kelas, tahun_lulus, nama_wali, no_wa, status')
          .eq('status', 'alumni')
          .order('tahun_lulus', { ascending: false })
          .order('nama')
          .limit(1000)
      }

      const alumni = (result.data ?? []) as AlumniRow[]
      setAlumniList(alumni)

      // Cek tunggakan tagihan
      if (alumni.length > 0) {
        const ids = alumni.map(a => a.id)
        const { data: tunggakan } = await supabase
          .from('tagihan')
          .select('siswa_id')
          .eq('status', 'belum_bayar')
          .in('siswa_id', ids)
          .limit(2000)
        setMenunggakIds(new Set(((tunggakan ?? []) as { siswa_id: string }[]).map(t => t.siswa_id)))
      }
      setLoading(false)
    })()
  }, [router])

  // ── Open detail popup ────────────────────────────────────────────────────────

  const openView = async (alumni: AlumniRow) => {
    setViewAlumni(alumni)
    setViewLoading(true)
    setTagihanGroups([])
    setExpandedGroups(new Set())
    setTotalTagihan(0)

    const { data: tagihanRaw } = await supabase
      .from('tagihan')
      .select('id, total_nominal, status, bulan, tahun, tahun_ajaran_id, tahun_ajaran:tahun_ajaran_id(nama), kelas:kelas_id(nama)')
      .eq('siswa_id', alumni.id)
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: true })
      .limit(200)

    const tagihan = (tagihanRaw ?? []) as TagihanRaw[]
    const tagihanIds = tagihan.map(t => t.id)

    const pembByTag = new Map<string, number>()
    if (tagihanIds.length > 0) {
      const { data: pembRaw } = await supabase
        .from('pembayaran')
        .select('id, tagihan_id')
        .in('tagihan_id', tagihanIds)
        .limit(1000)
      for (const p of (pembRaw ?? []) as PembTagihanRaw[]) {
        pembByTag.set(p.tagihan_id, (pembByTag.get(p.tagihan_id) ?? 0) + 1)
      }
    }

    const groupMap = new Map<string, TagihanGroupItem>()
    for (const t of tagihan) {
      const key = t.tahun_ajaran_id ?? `year-${t.tahun}`
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          tahun_ajaran_id:   key,
          tahun_ajaran_nama: t.tahun_ajaran?.nama ?? String(t.tahun),
          kelas_nama:        t.kelas?.nama ?? null,
          tagihan:           [],
          totalNominal:      0,
        })
      }
      const grp = groupMap.get(key)!
      grp.tagihan.push({
        id: t.id, bulan: t.bulan, tahun: t.tahun,
        status: t.status, nominal: t.total_nominal,
        hasPembayaran: (pembByTag.get(t.id) ?? 0) > 0,
      })
      grp.totalNominal += t.total_nominal
    }

    const groups = [...groupMap.values()]
      .sort((a, b) => b.tahun_ajaran_nama.localeCompare(a.tahun_ajaran_nama))

    setTagihanGroups(groups)
    setTotalTagihan(groups.reduce((s, g) => s + g.totalNominal, 0))
    if (groups.length > 0) setExpandedGroups(new Set([groups[0].tahun_ajaran_id]))
    setViewLoading(false)
  }

  // ── Derived stats ───────────────────────────────────────────────────────────

  const totalAlumni = alumniList.length

  const statusCounts = useMemo(() => ({
    lulus:  alumniList.filter(a => (a.jenis_alumni ?? 'lulus') === 'lulus').length,
    pindah: alumniList.filter(a => a.jenis_alumni === 'pindah').length,
    keluar: alumniList.filter(a => a.jenis_alumni === 'keluar').length,
  }), [alumniList])

  const angkatanGroups = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of alumniList) {
      const y = a.tahun_lulus ?? 'Tidak diketahui'
      map.set(y, (map.get(y) ?? 0) + 1)
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'Tidak diketahui') return 1
      if (b === 'Tidak diketahui') return -1
      return Number(b) - Number(a)
    })
  }, [alumniList])

  const latestAngkatan = angkatanGroups[0]

  // ── Donut ───────────────────────────────────────────────────────────────────

  const donutRaw = [
    { label: 'Lulus',  value: statusCounts.lulus,  color: '#7C3AED' },
    { label: 'Pindah', value: statusCounts.pindah, color: '#F59E0B' },
    { label: 'Keluar', value: statusCounts.keluar, color: '#EF4444' },
  ]
  const donutBase  = donutRaw.reduce((s, d) => s + d.value, 0) || 1
  const donutSlices = donutRaw.filter(d => d.value > 0).reduce<{
    label: string; value: number; color: string; dash: number; gap: number; offset: number
  }[]>((acc, d) => {
    const dash   = (d.value / donutBase) * CIRC
    const gap    = CIRC - dash
    const offset = CIRC / 4 - acc.reduce((s, a) => s + a.dash, 0)
    return [...acc, { ...d, dash, gap, offset }]
  }, [])

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return alumniList.filter(a => {
      const matchSearch   = a.nama.toLowerCase().includes(q) || (a.nis ?? '').includes(search) || (a.nisn ?? '').includes(search)
      const matchAngkatan = filterAngkatan === 'semua' || (a.tahun_lulus ?? 'Tidak diketahui') === filterAngkatan
      const matchStatus   = filterStatus   === 'semua' || (a.jenis_alumni ?? 'lulus') === filterStatus
      return matchSearch && matchAngkatan && matchStatus
    })
  }, [alumniList, search, filterAngkatan, filterStatus])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="dashboard-content">
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Memuat data...</div>
    </div>
  )

  return (
    <div className="dashboard-content">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18,47,102,0.31)' }}>
          <GraduationCap size={30} color="#ffffff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>Alumni</h1>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>Data siswa yang telah lulus, pindah, atau keluar dari sekolah</p>
        </div>
      </div>

      {/* ── Ringkasan card ─────────────────────────────────────────────────── */}
      <div style={{ background: '#ffffff', borderRadius: 16, padding: '1.25rem', marginBottom: '1.5rem', borderLeft:'28px solid #1A2C4E', }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ width: 36, height: 36, background: '#1A2C4E', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <GraduationCap size={17} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1A2C4E' }}>Ringkasan alumni</div>
            <div style={{ fontSize: '0.9rem', color: 'rgb(117, 117, 117)', marginTop: 1 }}>Sebaran status dan angkatan alumni seluruh periode</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>

          {/* Total alumni + donut */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '1rem 1.1rem', boxShadow:'0 2px 10px #b5b5b5' }}>
            <div style={{ fontSize: '1rem', fontWeight: 500, color: '#64748B', marginBottom: '0.75rem' }}>Total alumni</div>
            {totalAlumni === 0 ? (
              <div style={{ padding: '1.5rem 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem' }}>Belum ada alumni</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
                <svg viewBox="0 0 110 110" style={{ width: 110, height: 110, flexShrink: 0 }}>
                  {donutSlices.length === 0 ? (
                    <circle cx={55} cy={55} r={R} fill="none" stroke="#E2E8F0" strokeWidth={18} />
                  ) : donutSlices.map(s => (
                    <circle key={s.label} cx={55} cy={55} r={R} fill="none"
                      stroke={s.color} strokeWidth={18}
                      strokeDasharray={`${s.dash} ${s.gap}`}
                      strokeDashoffset={s.offset} />
                  ))}
                  <text x="55" y="52" textAnchor="middle" style={{ fontSize: '15px', fontWeight: 800, fill: '#1A2C4E' }}>{totalAlumni}</text>
                  <text x="55" y="63" textAnchor="middle" style={{ fontSize: '7px', fill: '#94A3B8', fontWeight: 600 }}>Alumni</text>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
                  {donutRaw.map(d => (
                    <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, flex: 1 }}>{d.label}</span>
                      <span style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800 }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Angkatan terbaru */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '1rem 1.1rem', boxShadow:'0 2px 10px #b5b5b5' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#64748B' }}>Angkatan terbaru</div>
              <Users size={15} color="#94A3B8" />
            </div>
            {latestAngkatan ? (
              <>
                <div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#1A2C4E', lineHeight: 1 }}>{latestAngkatan[1]}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500, marginTop: 3 }}>Siswa angkatan {latestAngkatan[0]}</div>
                </div>
                <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                  {angkatanGroups.slice(0, 3).map(([year, count]) => (
                    <div key={year} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>Angkatan {year}</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>{count} Siswa</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: '1.5rem 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem' }}>Belum ada data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>

        {/* Filter row */}
        <div style={{ padding: '0.875rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.625rem', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>

          {/* Angkatan dropdown */}
          <div ref={angkatanRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowAngkatanDrop(v => !v); setShowStatusDrop(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 0.875rem', borderRadius: 8, border: '1.5px solid #E2E8F0', background: filterAngkatan !== 'semua' ? '#EFF6FF' : '#fff', fontSize: '0.82rem', fontWeight: 600, color: filterAngkatan !== 'semua' ? '#1D4ED8' : '#0F172A', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {filterAngkatan === 'semua' ? 'Semua angkatan' : `Angkatan ${filterAngkatan}`}
              <ChevronDown size={13} />
            </button>
            {showAngkatanDrop && (
              <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 190, zIndex: 50, overflow: 'hidden' }}>
                {[['semua', 'Semua angkatan'] as [string, string], ...angkatanGroups.map(([y]): [string, string] => [y, `Angkatan ${y}`])].map(([val, label]) => (
                  <button key={val} onClick={() => { setFilterAngkatan(val); setShowAngkatanDrop(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.875rem', background: filterAngkatan === val ? '#EFF6FF' : 'transparent', border: 'none', fontSize: '0.82rem', fontWeight: filterAngkatan === val ? 700 : 500, color: filterAngkatan === val ? '#1D4ED8' : '#0F172A', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status dropdown */}
          <div ref={statusRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowStatusDrop(v => !v); setShowAngkatanDrop(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 0.875rem', borderRadius: 8, border: '1.5px solid #E2E8F0', background: filterStatus !== 'semua' ? '#EFF6FF' : '#fff', fontSize: '0.82rem', fontWeight: 600, color: filterStatus !== 'semua' ? '#1D4ED8' : '#0F172A', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {filterStatus === 'semua' ? 'Semua status' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
              <ChevronDown size={13} />
            </button>
            {showStatusDrop && (
              <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, zIndex: 50, overflow: 'hidden' }}>
                {([['semua', 'Semua status'], ['lulus', 'Lulus'], ['pindah', 'Pindah'], ['keluar', 'Keluar']] as [string, string][]).map(([val, label]) => (
                  <button key={val} onClick={() => { setFilterStatus(val); setShowStatusDrop(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.875rem', background: filterStatus === val ? '#EFF6FF' : 'transparent', border: 'none', fontSize: '0.82rem', fontWeight: filterStatus === val ? 700 : 500, color: filterStatus === val ? '#1D4ED8' : '#0F172A', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Cari nama siswa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '0.45rem 0.75rem 0.45rem 2rem', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: '0.82rem', color: '#0F172A', outline: 'none', fontFamily: 'inherit', width: 210, background: '#FAFBFF' }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', padding: '0 1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#1A2C4E' }}>
                {(['Nama', 'NIS', 'Angkatan', 'Status', 'Orang Tua', 'Pelunasan', ''] as const).map((h, i, arr) => (
                  <th key={i} style={{ padding: '0.45rem 1rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '4rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 56, height: 56, background: '#F1F5F9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GraduationCap size={26} color="#94A3B8" strokeWidth={1.4} />
                      </div>
                      <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.875rem' }}>
                        {totalAlumni === 0 ? 'Belum ada data alumni' : 'Tidak ada alumni sesuai filter'}
                      </div>
                      {totalAlumni === 0 && (
                        <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Alumni akan muncul setelah proses kenaikan kelas dijalankan</div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : filtered.map((a, idx) => (
                <tr key={a.id}
                  style={{ borderBottom: '1px solid #F8FAFC', background: idx % 2 === 0 ? '#fff' : '#FAFBFF' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#F0F7FF'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? '#fff' : '#FAFBFF'}
                >
                  {/* Nama */}
                  <td style={{ padding: '0.7rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(a.nama), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                        {getInitials(a.nama)}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>{a.nama}</span>
                    </div>
                  </td>
                  {/* NIS */}
                  <td style={{ padding: '0.7rem 1rem', fontSize: '0.8rem', color: '#64748B', fontFamily: 'monospace', fontWeight: 500 }}>{a.nis ?? a.nisn ?? '—'}</td>
                  {/* Angkatan */}
                  <td style={{ padding: '0.7rem 1rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.22rem 0.625rem', borderRadius: 20 }}>
                      {a.tahun_lulus ?? '—'}
                    </span>
                  </td>
                  {/* Status */}
                  <td style={{ padding: '0.7rem 1rem' }}>
                    <StatusBadge jenis={a.jenis_alumni} />
                  </td>
                  {/* Orang Tua */}
                  <td style={{ padding: '0.7rem 1rem', fontSize: '0.82rem', color: '#475569', fontWeight: 500 }}>{a.nama_wali ?? '—'}</td>
                  {/* Pelunasan */}
                  <td style={{ padding: '0.7rem 1rem' }}>
                    {menunggakIds.has(a.id) ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF3C7', color: '#92400E', borderRadius: 20, padding: '0.22rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
                        <AlertTriangle size={10} /> Menunggak
                      </span>
                    ) : (
                      <span style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 20, padding: '0.22rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>Lunas</span>
                    )}
                  </td>
                  {/* Action */}
                  <td style={{ padding: '0.7rem 0.875rem' }}>
                    <button
                      onClick={() => openView(a)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6 }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#1A2C4E'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1'}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid #F1F5F9', fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>
            Menampilkan {filtered.length} dari {totalAlumni} alumni
          </div>
        )}
      </div>

      {/* ── View detail popup ───────────────────────────────────────────────── */}
      {viewAlumni && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setViewAlumni(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '90vh', boxShadow: '0 24px 60px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header: avatar + nama + badges ── */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1.5px solid #F1F5F9', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: avatarColor(viewAlumni.nama), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {getInitials(viewAlumni.nama)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{viewAlumni.nama}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
                    {/* Lulus/Pindah/Keluar + tahun */}
                    {(() => {
                      const j = viewAlumni.jenis_alumni ?? 'lulus'
                      const yr = viewAlumni.tahun_lulus ? ` ${viewAlumni.tahun_lulus}` : ''
                      if (j === 'pindah') return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF3C7', color: '#92400E', borderRadius: 20, padding: '0.22rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
                          <Plus size={10} /> Pindah{yr}
                        </span>
                      )
                      if (j === 'keluar') return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEE2E2', color: '#DC2626', borderRadius: 20, padding: '0.22rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
                          <X size={10} /> Keluar{yr}
                        </span>
                      )
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EDE9FE', color: '#5B21B6', borderRadius: 20, padding: '0.22rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
                          <CheckCircle2 size={10} /> Lulus{yr}
                        </span>
                      )
                    })()}
                    {/* Pelunasan badge */}
                    {menunggakIds.has(viewAlumni.id) ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF3C7', color: '#92400E', borderRadius: 20, padding: '0.22rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
                        <AlertTriangle size={10} /> Menunggak
                      </span>
                    ) : (
                      <span style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 20, padding: '0.22rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>Lunas</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setViewAlumni(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, flexShrink: 0 }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ overflowY: 'auto', flex: 1 }}>

              {/* Info rows */}
              <div style={{ padding: '0 1.5rem' }}>
                {[
                  { label: 'NIS',            value: viewAlumni.nis ?? viewAlumni.nisn ?? '—' },
                  { label: 'Angkatan',       value: viewAlumni.tahun_lulus ?? '—' },
                  { label: 'Kelas terakhir', value: viewAlumni.kelas ?? '—' },
                  { label: 'Orang tua',      value: viewAlumni.nama_wali ?? '—' },
                  { label: 'Nomor WhatsApp', value: viewAlumni.no_wa ?? '—' },
                  { label: 'Tanggal lulus',  value: viewAlumni.tanggal_lulus ? formatDate(viewAlumni.tanggal_lulus) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid #F8FAFC', fontSize: '0.82rem' }}>
                    <span style={{ color: '#64748B', fontWeight: 500 }}>{label}</span>
                    <span style={{ color: '#0F172A', fontWeight: 700, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Riwayat pembayaran */}
              <div style={{ padding: '1rem 1.5rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>Riwayat pembayaran</span>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1A2C4E' }}>Total: {formatRp(totalTagihan)}</span>
                </div>

                {viewLoading ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem' }}>Memuat riwayat...</div>
                ) : tagihanGroups.length === 0 ? (
                  <div style={{ padding: '1.25rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem', background: '#F8FAFC', borderRadius: 10, border: '1px solid #F1F5F9' }}>Belum ada riwayat pembayaran</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {tagihanGroups.map(grp => {
                      const isExpanded = expandedGroups.has(grp.tahun_ajaran_id)
                      return (
                        <div key={grp.tahun_ajaran_id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                          {/* Group header - toggle */}
                          <button
                            onClick={() => setExpandedGroups(prev => {
                              const next = new Set(prev)
                              if (isExpanded) next.delete(grp.tahun_ajaran_id)
                              else next.add(grp.tahun_ajaran_id)
                              return next
                            })}
                            style={{ width: '100%', background: '#F8FAFC', border: 'none', padding: '0.65rem 0.875rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {isExpanded
                                  ? <ChevronDown size={14} color="#64748B" />
                                  : <ChevronRight size={14} color="#64748B" />
                                }
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>{grp.tahun_ajaran_nama}</div>
                                  {grp.kelas_nama && (
                                    <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 500, marginTop: 1 }}>Kelas {grp.kelas_nama}</div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <CreditCard size={13} color="#94A3B8" />
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A2C4E' }}>{formatRp(grp.totalNominal)}</span>
                              </div>
                            </div>
                          </button>

                          {/* Expanded rows */}
                          {isExpanded && (
                            <div>
                              {grp.tagihan.map((t, idx) => (
                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0.875rem 0.5rem 2.25rem', borderTop: '1px solid #F1F5F9', background: idx % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                                  <span style={{ flex: 1, fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>
                                    {BULAN_NAMES[t.bulan - 1]} {t.tahun}
                                  </span>
                                  <span style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 600, marginRight: '0.75rem' }}>
                                    {formatRp(t.nominal)}
                                  </span>
                                  {t.status === 'lunas' ? (
                                    <span style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 20, padding: '0.15rem 0.55rem', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Lunas</span>
                                  ) : t.hasPembayaran ? (
                                    <span style={{ background: '#1A2C4E', color: '#fff', borderRadius: 20, padding: '0.15rem 0.55rem', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Cicilan</span>
                                  ) : (
                                    <span style={{ background: '#F1F5F9', color: '#94A3B8', borderRadius: 20, padding: '0.15rem 0.55rem', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Belum</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ padding: '0.875rem 1.5rem', borderTop: '1.5px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button
                onClick={() => setViewAlumni(null)}
                style={{ padding: '0.55rem 1.5rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#fff'}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
