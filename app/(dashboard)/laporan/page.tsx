'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Image from 'next/image'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BarChart2, Database, TrendingUp, PieChart, AlertTriangle, ChevronDown, Download, Receipt, Users, GraduationCap, FileSpreadsheet, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BULAN_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]
const BULAN_NAMES_FULL = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// Sama seperti naik-kelas & dashboard — dipakai untuk menurunkan angkatan dari posisi jenjang siswa.
const JENJANG_MAP: Record<string, string[]> = {
  'TK/PAUD': ['A', 'B', 'C'],
  'SD/MI':   ['1', '2', '3', '4', '5', '6'],
  'SMP/MTs': ['7', '8', '9'],
  'SMA/MA':  ['10', '11', '12'],
  'SMK':     ['10', '11', '12'],
}

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function monthsInRange(startIso: string, endIso: string): { bulan: number; tahun: number }[] {
  const start = new Date(startIso)
  const end   = new Date(endIso)
  const out: { bulan: number; tahun: number }[] = []
  let y = start.getFullYear()
  let m = start.getMonth() + 1
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth() + 1)) {
    out.push({ bulan: m, tahun: y })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

const periodKey = (bulan: number, tahun: number) => `${tahun}-${bulan}`

const isPastDue = (bulan: number, tahun: number, nowBulan: number, nowTahun: number) =>
  tahun < nowTahun || (tahun === nowTahun && bulan < nowBulan)

const METODE_LABELS: Record<string, string> = {
  tunai:    'Tunai',
  transfer: 'Transfer Manual',
  qris:     'QRIS',
  va:       'Virtual Account',
}
const metodeLabel = (m: string | null) => (m ? (METODE_LABELS[m] ?? m) : 'Transfer Manual')

function jenisPembayaranLabel(
  items: { nama_komponen: string; komponen: { jenis: string } | null }[],
  bulan: number,
  tahun: number,
): string {
  if (items.length === 0) return '-'
  return items
    .map(item => item.komponen?.jenis === 'rutin_bulanan'
      ? `${item.nama_komponen} ${BULAN_NAMES_FULL[bulan]} ${tahun}`
      : item.nama_komponen)
    .join(', ')
}

interface PaketKelasInfo { nama: string; komponenIds: Set<string> }

// Tagihan bulanan biasanya cuma berisi sebagian komponen paket (rutin_bulanan tiap bulan,
// sekali_bayar cuma bulan pertama, per_semester cuma bulan semester) — jadi dicek dengan subset,
// bukan exact match, terhadap komponen paket kelas siswa tsb. Kalau semua item tagihan berasal dari
// paket standar (tidak ada komponen individu/kustom di luar paket), tampilkan nama paketnya saja.
function resolveJenisLabel(
  items: { komponen_id: string | null; nama_komponen: string; komponen: { jenis: string } | null }[],
  bulan: number,
  tahun: number,
  kelasId: string | null,
  paketByKelas: Map<string, PaketKelasInfo>,
): string {
  if (items.length === 0) return '-'
  const paket = kelasId ? paketByKelas.get(kelasId) : undefined
  if (paket) {
    const isFromPaket = items.every(i => i.komponen_id && paket.komponenIds.has(i.komponen_id))
    if (isFromPaket) return paket.nama
  }
  return jenisPembayaranLabel(items, bulan, tahun)
}

async function buildPaketByKelasMap(sekolahId: string): Promise<Map<string, PaketKelasInfo>> {
  const { data, error } = await supabase
    .from('paket')
    .select('nama, paket_kelas(kelas_id), paket_komponen(komponen_id)')
    .eq('sekolah_id', sekolahId)
    .limit(200)
  if (error) console.error('[Laporan] gagal memuat paket kelas:', error)

  const map = new Map<string, PaketKelasInfo>()
  for (const p of ((data ?? []) as unknown as { nama: string; paket_kelas: { kelas_id: string }[]; paket_komponen: { komponen_id: string }[] }[])) {
    const komponenIds = new Set(p.paket_komponen.map(k => k.komponen_id))
    for (const pk of p.paket_kelas) map.set(pk.kelas_id, { nama: p.nama, komponenIds })
  }
  return map
}

function getFinalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20
}

// Data sekolah demo cuma isi NIS, belum isi NISN — fallback ke NIS supaya kolom tidak kosong.
function nisnOrNis(siswa: { nisn: string | null; nis: string | null } | null | undefined): string {
  return siswa?.nisn ?? siswa?.nis ?? '-'
}

function generateIdTransaksi(tanggalIso: string, seq: number): string {
  const d = new Date(tanggalIso)
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `TRX${yyyymmdd}${String(seq).padStart(3, '0')}`
}

function formatTanggalExcel(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Jatuh tempo = akhir bulan tagihan — konvensi yang sama dipakai di tagihan/aktif & dashboard.
function getJatuhTempoTanggal(bulan: number, tahun: number): string {
  return formatDateLocal(new Date(tahun, bulan, 0))
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TahunAjaranRow {
  id:                      string
  nama:                    string
  tanggal_mulai:           string
  tanggal_selesai:         string
  semester_ganjil_mulai:   string
  semester_ganjil_selesai: string
  semester_genap_mulai:    string
  semester_genap_selesai:  string
}

interface FilterOption {
  label:    string
  sublabel: string
  value:    string
  months:   { bulan: number; tahun: number }[]
}

interface TagihanItemRaw { nama_komponen: string; nominal: number }
interface TagihanRaw {
  id:            string
  total_nominal: number
  status:        'lunas' | 'belum_bayar' | 'cicilan'
  bulan:         number
  tahun:         number
  siswa:         { kelas: { jenjang: string } | null } | null
  tagihan_item:  TagihanItemRaw[]
}
interface PembayaranRaw { tagihan_id: string; jumlah: number }

interface ExportTagihanNested {
  id:           string
  bulan:        number
  tahun:        number
  siswa:        { nama: string; nis: string | null; nisn: string | null; kelas: { id: string; nama: string } | null } | null
  tagihan_item: { komponen_id: string | null; nama_komponen: string; komponen: { jenis: string } | null }[]
}
interface PembayaranExportRaw {
  id:             string
  jumlah:         number
  metode:         string
  tanggal_bayar:  string
  gateway_trx_id: string | null
  tagihan_id:     string
}
interface VerifikasiExportRaw {
  id:               string
  nominal_diajukan: number
  created_at:       string
  tagihan:          ExportTagihanNested | null
}
interface GatewayTrxRaw {
  ipaymu_trx_id:   string | null
  ipaymu_response: { fee?: string } | null
}
interface TunggakanTagihanRaw {
  id:            string
  bulan:         number
  tahun:         number
  status:        'lunas' | 'belum_bayar' | 'cicilan'
  total_nominal: number
  siswa:         { nama: string; nis: string | null; nisn: string | null; kelas: { id: string; nama: string } | null } | null
  tagihan_item:  { komponen_id: string | null; nama_komponen: string; komponen: { jenis: string } | null }[]
}
interface ExportRow {
  tanggal:         string
  nisn:            string
  nama:            string
  kelas:           string
  jenisPembayaran: string
  metode:          string
  nominal:         number
  biayaAdmin:      number
  status:          string
}
interface SiswaAktifRaw {
  nama:         string
  nis:          string | null
  nisn:         string | null
  no_wa:        string | null
  nama_wali:    string | null
  status:       'aktif' | 'alumni'
  jenis_alumni: string | null
  kelas:        string | null
  kelasRef:     { nama: string; jenjang: string } | null
}
interface AlumniRaw {
  id:          string
  nama:        string
  nis:         string | null
  nisn:        string | null
  tahun_lulus: string | null
}
interface TahunAjaranFullRaw {
  nama:            string
  tanggal_mulai:   string
  tanggal_selesai: string
  is_aktif:        boolean
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { bulan: string; nominal: number }[] }) {
  const max    = Math.max(1, ...data.map(d => d.nominal))
  const W      = 520; const H = 170; const PX = 30; const PY = 14; const BOT = 26
  const barW   = (W - PX * 2) / data.length
  const innerH = H - PY - BOT

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.5, 1].map(t => {
        const y = PY + innerH * (1 - t)
        return (
          <g key={t}>
            <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="#F1F5F9" strokeWidth={1} />
            <text x={PX - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="#94A3B8">
              {t === 0 ? '0' : `${Math.round((max * t) / 1_000_000)}jt`}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const pct    = d.nominal / max
        const barH   = innerH * pct
        const x      = PX + i * barW + barW * 0.2
        const bW     = barW * 0.6
        const y      = PY + innerH - barH
        const isLast = i === data.length - 1
        return (
          <g key={`${d.bulan}_${i}`}>
            <rect x={x} y={y} width={bW} height={barH} rx={4} fill={isLast ? '#1A2C4E' : '#93C5FD'} />
            <text x={x + bW / 2} y={y - 4} textAnchor="middle" fontSize={7.5}
              fill={isLast ? '#1A2C4E' : '#64748B'} fontWeight={isLast ? 700 : 400}>
              {Math.round(d.nominal / 1_000_000)}jt
            </text>
            <text x={x + bW / 2} y={H - 4} textAnchor="middle" fontSize={9}
              fill={isLast ? '#1A2C4E' : '#64748B'} fontWeight={isLast ? 700 : 400}>
              {d.bulan}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0))
  const SIZE  = 140; const R = 52; const STROKE = 24; const C = SIZE / 2
  const CIRC  = 2 * Math.PI * R

  const slices = data.reduce<(typeof data[0] & { dash: number; gap: number; offset: number })[]>((acc, d) => {
    const dash   = (d.value / total) * CIRC
    const gap    = CIRC - dash
    const offset = acc.reduce((s, x) => s + x.dash, 0)
    return [...acc, { ...d, dash, gap, offset }]
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      <svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
        {slices.map(s => (
          <circle key={s.label} cx={C} cy={C} r={R} fill="none" stroke={s.color}
            strokeWidth={STROKE} strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${C}px ${C}px` }} />
        ))}
        <text x={C} y={C - 4}  textAnchor="middle" fontSize={20} fontWeight={800} fill="#0F172A">{total}</text>
        <text x={C} y={C + 10} textAnchor="middle" fontSize={8.5} fill="#94A3B8">Tagihan</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {data.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #F8FAFC' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{d.label}</span>
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LaporanPage() {
  const [sekolahId,    setSekolahId]    = useState('')
  const [loading,      setLoading]      = useState(true)
  const [allTagihan,   setAllTagihan]   = useState<TagihanRaw[]>([])
  const [allPembayaran, setAllPembayaran] = useState<PembayaranRaw[]>([])
  const [activeTA,     setActiveTA]     = useState<TahunAjaranRow | null>(null)
  const [archivedTAs,  setArchivedTAs]  = useState<TahunAjaranRow[]>([])

  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedValue, setSelectedValue] = useState('bulan-ini')
  const [exportingTransaksi, setExportingTransaksi] = useState(false)
  const [exportingTunggakan, setExportingTunggakan] = useState(false)
  const [exportingSiswaAktif, setExportingSiswaAktif] = useState(false)
  const [exportingAlumni, setExportingAlumni] = useState(false)
  const [exportingKeuanganTahunan, setExportingKeuanganTahunan] = useState(false)
  const [exportNotice, setExportNotice] = useState('')
  const [generatingUtama, setGeneratingUtama] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  // ── Load profile ──────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
      if (p?.sekolah_id) setSekolahId(p.sekolah_id as string)
    }
    init()
  }, [])

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sekolahId) return
    let cancelled = false

    const TA_SELECT = 'id, nama, tanggal_mulai, tanggal_selesai, semester_ganjil_mulai, semester_ganjil_selesai, semester_genap_mulai, semester_genap_selesai'

    const load = async () => {
      setLoading(true)

      const [{ data: tagihanData }, { data: pembData }, { data: taAktif }, { data: taArsip }] = await Promise.all([
        supabase.from('tagihan')
          .select('id, total_nominal, status, bulan, tahun, siswa:siswa_id(kelas:kelas_id(jenjang)), tagihan_item(nama_komponen, nominal)')
          .eq('sekolah_id', sekolahId)
          .limit(5000),
        supabase.from('pembayaran')
          .select('tagihan_id, jumlah')
          .eq('sekolah_id', sekolahId)
          .limit(10000),
        supabase.from('tahun_ajaran').select(TA_SELECT).eq('sekolah_id', sekolahId).eq('is_aktif', true).maybeSingle(),
        supabase.from('tahun_ajaran').select(TA_SELECT).eq('sekolah_id', sekolahId).eq('is_aktif', false)
          .order('tanggal_mulai', { ascending: false }).limit(5),
      ])

      if (cancelled) return
      setAllTagihan((tagihanData ?? []) as unknown as TagihanRaw[])
      setAllPembayaran((pembData ?? []) as PembayaranRaw[])
      setActiveTA((taAktif ?? null) as TahunAjaranRow | null)
      setArchivedTAs((taArsip ?? []) as TahunAjaranRow[])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [sekolahId])

  // ── Filter periode options ────────────────────────────────────────────────

  const filterOptions = useMemo<FilterOption[]>(() => {
    const now       = new Date()
    const bulanIni  = now.getMonth() + 1
    const tahunIni  = now.getFullYear()
    const bulanLalu = bulanIni === 1 ? 12 : bulanIni - 1
    const tahunLalu = bulanIni === 1 ? tahunIni - 1 : tahunIni

    const opts: FilterOption[] = [
      { label: 'Bulan ini',  sublabel: `${BULAN_NAMES_FULL[bulanIni]} ${tahunIni}`,   value: 'bulan-ini',  months: [{ bulan: bulanIni, tahun: tahunIni }] },
      { label: 'Bulan lalu', sublabel: `${BULAN_NAMES_FULL[bulanLalu]} ${tahunLalu}`, value: 'bulan-lalu', months: [{ bulan: bulanLalu, tahun: tahunLalu }] },
    ]

    if (activeTA) {
      opts.push({ label: 'Semester Ganjil', sublabel: activeTA.nama, value: `sem-ganjil-${activeTA.id}`, months: monthsInRange(activeTA.semester_ganjil_mulai, activeTA.semester_ganjil_selesai) })
      opts.push({ label: 'Semester Genap',  sublabel: activeTA.nama, value: `sem-genap-${activeTA.id}`,  months: monthsInRange(activeTA.semester_genap_mulai, activeTA.semester_genap_selesai) })
      opts.push({ label: 'Tahun ajaran',    sublabel: activeTA.nama, value: `ta-${activeTA.id}`,          months: monthsInRange(activeTA.tanggal_mulai, activeTA.tanggal_selesai) })
    }
    for (const ta of archivedTAs) {
      opts.push({ label: 'Tahun ajaran', sublabel: ta.nama, value: `ta-${ta.id}`, months: monthsInRange(ta.tanggal_mulai, ta.tanggal_selesai) })
    }
    return opts
  }, [activeTA, archivedTAs])

  const selectedFilter = filterOptions.find(o => o.value === selectedValue) ?? filterOptions[0]

  // ── Data untuk periode terpilih ───────────────────────────────────────────

  const periodTagihan = useMemo(() => {
    if (!selectedFilter) return []
    const monthSet = new Set(selectedFilter.months.map(m => periodKey(m.bulan, m.tahun)))
    return allTagihan.filter(t => monthSet.has(periodKey(t.bulan, t.tahun)))
  }, [allTagihan, selectedFilter])

  const paidByTagihan = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of allPembayaran) {
      map.set(p.tagihan_id, (map.get(p.tagihan_id) ?? 0) + p.jumlah)
    }
    return map
  }, [allPembayaran])

  const now      = new Date()
  const nowBulan = now.getMonth() + 1
  const nowTahun = now.getFullYear()

  const stats = useMemo(() => {
    let totalPemasukan = 0
    let transaksiCount = 0
    let sudahMasuk     = 0
    let totalTagihanRp = 0
    let belumJatuhTempo = 0
    let menunggakRp     = 0

    for (const t of periodTagihan) {
      const paid = paidByTagihan.get(t.id) ?? 0
      totalPemasukan += paid
      totalTagihanRp += t.total_nominal
      if (t.status === 'lunas') sudahMasuk += t.total_nominal
      const sisa = t.total_nominal - paid
      if (t.status !== 'lunas' && sisa > 0) {
        if (isPastDue(t.bulan, t.tahun, nowBulan, nowTahun)) menunggakRp += sisa
        else belumJatuhTempo += sisa
      }
    }
    transaksiCount = periodTagihan.reduce((s, t) => s + (paidByTagihan.get(t.id) ? 1 : 0), 0)

    const tingkatPelunasan = totalTagihanRp > 0 ? Math.round((sudahMasuk / totalTagihanRp) * 100) : 0

    return { totalPemasukan, transaksiCount, sudahMasuk, totalTagihanRp, tingkatPelunasan, belumJatuhTempo, menunggakRp, totalTunggakan: belumJatuhTempo + menunggakRp }
  }, [periodTagihan, paidByTagihan, nowBulan, nowTahun])

  const donutData = useMemo(() => {
    let lunas = 0, cicilan = 0, belumBayar = 0, menunggak = 0
    for (const t of periodTagihan) {
      if (t.status === 'lunas') lunas += 1
      else if (t.status === 'cicilan') cicilan += 1
      else if (isPastDue(t.bulan, t.tahun, nowBulan, nowTahun)) menunggak += 1
      else belumBayar += 1
    }
    return [
      { label: 'Lunas',       value: lunas,      color: '#22C55E' },
      { label: 'Cicilan',     value: cicilan,    color: '#3B82F6' },
      { label: 'Belum bayar', value: belumBayar, color: '#F59E0B' },
      { label: 'Menunggak',   value: menunggak,  color: '#EF4444' },
    ]
  }, [periodTagihan, nowBulan, nowTahun])

  const jenjangData = useMemo(() => {
    const byJenjang = new Map<string, { total: number; lunas: number }>()
    for (const t of periodTagihan) {
      const jenjang = t.siswa?.kelas?.jenjang
      if (!jenjang) continue
      const cur = byJenjang.get(jenjang) ?? { total: 0, lunas: 0 }
      cur.total += 1
      if (t.status === 'lunas') cur.lunas += 1
      byJenjang.set(jenjang, cur)
    }
    return Array.from(byJenjang.entries())
      .map(([jenjang, v]) => ({ jenjang: `Jenjang ${jenjang}`, pct: v.total > 0 ? Math.round((v.lunas / v.total) * 100) : 0 }))
      .sort((a, b) => a.jenjang.localeCompare(b.jenjang, 'id', { numeric: true }))
  }, [periodTagihan])

  const komponenData = useMemo(() => {
    const byKomponen = new Map<string, { jumlah: number; total: number }>()
    for (const t of periodTagihan) {
      if (t.status === 'lunas') continue
      for (const item of t.tagihan_item) {
        const cur = byKomponen.get(item.nama_komponen) ?? { jumlah: 0, total: 0 }
        cur.jumlah += 1
        cur.total  += item.nominal
        byKomponen.set(item.nama_komponen, cur)
      }
    }
    return Array.from(byKomponen.entries())
      .map(([nama, v]) => ({ nama, jumlah: v.jumlah, total: v.total }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 4)
  }, [periodTagihan])

  // Tren 6 bulan terakhir — independen dari filter periode
  const monthlyTrend = useMemo(() => {
    const months: { bulan: number; tahun: number }[] = []
    let y = nowTahun, m = nowBulan
    for (let i = 0; i < 6; i++) {
      months.unshift({ bulan: m, tahun: y })
      m -= 1
      if (m < 1) { m = 12; y -= 1 }
    }
    return months.map(({ bulan, tahun }) => {
      const nominal = allTagihan
        .filter(t => t.bulan === bulan && t.tahun === tahun)
        .reduce((s, t) => s + (paidByTagihan.get(t.id) ?? 0), 0)
      return { bulan: BULAN_NAMES[bulan], nominal }
    })
  }, [allTagihan, paidByTagihan, nowBulan, nowTahun])

  const hasData = periodTagihan.length > 0

  // ── Export Laporan Transaksi (Excel) ─────────────────────────────────────

  const handleExportTransaksi = async () => {
    if (!selectedFilter || !sekolahId) return

    const sortedMonths = [...selectedFilter.months].sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan)
    const first = sortedMonths[0]
    const last  = sortedMonths[sortedMonths.length - 1]
    if (!first || !last) {
      setExportNotice('Tidak ada transaksi pada periode ini.')
      return
    }
    // Rentang berdasarkan tanggal transaksi aktual (tanggal_bayar / created_at), bukan bulan tagihan —
    // supaya pembayaran yang terjadi di periode ini tetap masuk walau melunasi tagihan bulan lain.
    const startIso = new Date(first.tahun, first.bulan - 1, 1).toISOString()
    const endIso   = new Date(last.tahun, last.bulan, 1).toISOString()

    setExportingTransaksi(true)
    try {
      const NESTED_SELECT = 'id, bulan, tahun, siswa:siswa_id(nama, nis, nisn, kelas:kelas_id(id, nama)), tagihan_item(komponen_id, nama_komponen, komponen:komponen_id(jenis))'

      // pembayaran.tagihan_id tidak terdaftar sebagai foreign key di PostgREST schema cache,
      // jadi tagihan tidak bisa di-embed langsung di sini — harus di-fetch terpisah lalu digabung manual
      // (pola yang sama dipakai di pembayaran/page.tsx).
      const [{ data: pembData, error: pembErr }, { data: verifData, error: verifErr }, paketByKelas] = await Promise.all([
        supabase
          .from('pembayaran')
          .select('id, jumlah, metode, tanggal_bayar, gateway_trx_id, tagihan_id')
          .eq('sekolah_id', sekolahId)
          .gte('tanggal_bayar', startIso)
          .lt('tanggal_bayar', endIso)
          .order('tanggal_bayar', { ascending: true })
          .limit(5000),
        supabase
          .from('verifikasi_pembayaran')
          .select(`id, nominal_diajukan, created_at, tagihan:tagihan_id(${NESTED_SELECT})`)
          .eq('sekolah_id', sekolahId)
          .eq('status', 'menunggu')
          .gte('created_at', startIso)
          .lt('created_at', endIso)
          .limit(2000),
        buildPaketByKelasMap(sekolahId),
      ])

      if (pembErr)  console.error('[Export Laporan Transaksi] gagal memuat pembayaran:', pembErr)
      if (verifErr) console.error('[Export Laporan Transaksi] gagal memuat verifikasi_pembayaran:', verifErr)

      const pembList  = (pembData ?? []) as unknown as PembayaranExportRaw[]
      const verifList = (verifData ?? []) as unknown as VerifikasiExportRaw[]

      const pembTagihanIds = Array.from(new Set(pembList.map(p => p.tagihan_id)))
      let tagihanMap = new Map<string, ExportTagihanNested>()
      if (pembTagihanIds.length > 0) {
        const { data: tagihanData, error: tagihanErr } = await supabase
          .from('tagihan')
          .select(NESTED_SELECT)
          .in('id', pembTagihanIds)
        if (tagihanErr) console.error('[Export Laporan Transaksi] gagal memuat tagihan:', tagihanErr)
        tagihanMap = new Map(((tagihanData ?? []) as unknown as ExportTagihanNested[]).map(t => [t.id, t]))
      }

      const gatewayTrxIds = Array.from(new Set(pembList.map(p => p.gateway_trx_id).filter((id): id is string => !!id)))
      let feeMap = new Map<string, number>()
      if (gatewayTrxIds.length > 0) {
        const { data: gwData } = await supabase
          .from('payment_gateway_trx')
          .select('ipaymu_trx_id, ipaymu_response')
          .in('ipaymu_trx_id', gatewayTrxIds)
          .limit(gatewayTrxIds.length)
        feeMap = new Map(
          ((gwData ?? []) as unknown as GatewayTrxRaw[])
            .filter(g => g.ipaymu_trx_id)
            .map(g => [g.ipaymu_trx_id as string, Number(g.ipaymu_response?.fee ?? 0) || 0])
        )
      }

      const rows: ExportRow[] = []

      for (const p of pembList) {
        const tagihan = tagihanMap.get(p.tagihan_id)
        if (!tagihan) continue
        rows.push({
          tanggal:         p.tanggal_bayar,
          nisn:            nisnOrNis(tagihan.siswa),
          nama:            tagihan.siswa?.nama ?? '-',
          kelas:           tagihan.siswa?.kelas?.nama ?? '-',
          jenisPembayaran: resolveJenisLabel(tagihan.tagihan_item, tagihan.bulan, tagihan.tahun, tagihan.siswa?.kelas?.id ?? null, paketByKelas),
          metode:          metodeLabel(p.metode),
          nominal:         p.jumlah,
          biayaAdmin:      p.gateway_trx_id ? (feeMap.get(p.gateway_trx_id) ?? 0) : 0,
          status:          'Berhasil',
        })
      }

      for (const v of verifList) {
        if (!v.tagihan) continue
        rows.push({
          tanggal:         v.created_at,
          nisn:            nisnOrNis(v.tagihan.siswa),
          nama:            v.tagihan.siswa?.nama ?? '-',
          kelas:           v.tagihan.siswa?.kelas?.nama ?? '-',
          jenisPembayaran: resolveJenisLabel(v.tagihan.tagihan_item, v.tagihan.bulan, v.tagihan.tahun, v.tagihan.siswa?.kelas?.id ?? null, paketByKelas),
          metode:          'Transfer Manual',
          nominal:         v.nominal_diajukan,
          biayaAdmin:      0,
          status:          'Menunggu Verifikasi',
        })
      }

      if (rows.length === 0) {
        setExportNotice('Tidak ada transaksi pada periode ini.')
        return
      }

      rows.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())

      const headers = ['No', 'Tanggal Transaksi', 'ID Transaksi', 'NISN', 'Nama Siswa', 'Kelas', 'Jenis Pembayaran', 'Metode', 'Nominal', 'Biaya Admin', 'Total Bayar', 'Status']
      const aoa: (string | number)[][] = [headers]
      rows.forEach((r, i) => {
        aoa.push([
          i + 1,
          formatTanggalExcel(r.tanggal),
          generateIdTransaksi(r.tanggal, i + 1),
          r.nisn,
          r.nama,
          r.kelas,
          r.jenisPembayaran,
          r.metode,
          r.nominal,
          r.biayaAdmin,
          r.nominal + r.biayaAdmin,
          r.status,
        ])
      })

      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = [
        { wch: 5 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 10 },
        { wch: 26 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Transaksi')

      const periodeLabel = `${selectedFilter.label}_${selectedFilter.sublabel}`.replace(/\s+/g, '_')
      XLSX.writeFile(wb, `Laporan_Transaksi_${periodeLabel}.xlsx`)
    } finally {
      setExportingTransaksi(false)
    }
  }

  // ── Export Laporan Tunggakan (Excel) ──────────────────────────────────────
  // Selalu semua tunggakan outstanding sampai hari ini — tidak terikat filter periode dropdown,
  // karena tunggakan bersifat akumulatif (piutang lintas bulan), bukan snapshot satu periode.

  const handleExportTunggakan = async () => {
    if (!sekolahId) return

    const tunggakanIds = allTagihan
      .filter(t => t.status !== 'lunas' && isPastDue(t.bulan, t.tahun, nowBulan, nowTahun))
      .map(t => t.id)

    if (tunggakanIds.length === 0) {
      setExportNotice('Tidak ada tunggakan saat ini.')
      return
    }

    setExportingTunggakan(true)
    try {
      const [{ data: tagihanData, error }, paketByKelas] = await Promise.all([
        supabase
          .from('tagihan')
          .select('id, bulan, tahun, status, total_nominal, siswa:siswa_id(nama, nis, nisn, kelas:kelas_id(id, nama)), tagihan_item(komponen_id, nama_komponen, komponen:komponen_id(jenis))')
          .in('id', tunggakanIds)
          .limit(5000),
        buildPaketByKelasMap(sekolahId),
      ])

      if (error) console.error('[Export Laporan Tunggakan] gagal memuat tagihan:', error)

      const detailList = (tagihanData ?? []) as unknown as TunggakanTagihanRaw[]

      const rows = detailList
        .map(t => ({
          nisn:       nisnOrNis(t.siswa),
          nama:       t.siswa?.nama ?? '-',
          kelas:      t.siswa?.kelas?.nama ?? '-',
          jenis:      resolveJenisLabel(t.tagihan_item, t.bulan, t.tahun, t.siswa?.kelas?.id ?? null, paketByKelas),
          periode:    `${BULAN_NAMES_FULL[t.bulan]} ${t.tahun}`,
          nominal:    t.total_nominal - (paidByTagihan.get(t.id) ?? 0),
          jatuhTempo: getJatuhTempoTanggal(t.bulan, t.tahun),
          status:     t.status === 'cicilan' ? 'Cicilan' : 'Belum Bayar',
          bulan:      t.bulan,
          tahun:      t.tahun,
        }))
        .sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan || a.nama.localeCompare(b.nama, 'id'))

      if (rows.length === 0) {
        setExportNotice('Tidak ada tunggakan saat ini.')
        return
      }

      const headers = ['No', 'NISN', 'Nama Siswa', 'Kelas', 'Jenis Tunggakan', 'Bulan/Periode', 'Nominal Tunggakan', 'Jatuh Tempo', 'Status']
      const aoa: (string | number)[][] = [headers]
      rows.forEach((r, i) => {
        aoa.push([i + 1, r.nisn, r.nama, r.kelas, r.jenis, r.periode, r.nominal, r.jatuhTempo, r.status])
      })

      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = [
        { wch: 5 }, { wch: 14 }, { wch: 24 }, { wch: 10 }, { wch: 32 },
        { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Tunggakan')

      XLSX.writeFile(wb, `Laporan_Tunggakan_${formatDateLocal(now)}.xlsx`)
    } finally {
      setExportingTunggakan(false)
    }
  }

  // ── Export Laporan Data Siswa Aktif (Excel) ───────────────────────────────
  // Angkatan tidak tersimpan untuk siswa aktif — diturunkan dari posisi jenjang siswa
  // dalam JENJANG_MAP dikurangkan dari tahun mulai tahun ajaran aktif (pola sama dgn naik-kelas).
  // Status "Nonaktif" mencakup alumni yang keluar/pindah sebelum lulus (jenis_alumni pindah/keluar).

  const handleExportSiswaAktif = async () => {
    if (!sekolahId) return

    setExportingSiswaAktif(true)
    try {
      const [{ data: pengData }, { data: siswaData, error }] = await Promise.all([
        supabase.from('pengaturan').select('jenjang_sekolah').eq('sekolah_id', sekolahId).maybeSingle(),
        supabase
          .from('siswa')
          .select('nama, nis, nisn, no_wa, nama_wali, status, jenis_alumni, kelas, kelasRef:kelas_id(nama, jenjang)')
          .eq('sekolah_id', sekolahId)
          .or('status.eq.aktif,and(status.eq.alumni,jenis_alumni.in.(pindah,keluar))')
          .limit(5000),
      ])

      if (error) console.error('[Export Laporan Siswa Aktif] gagal memuat siswa:', error)

      const jenjangSekolah = (pengData as { jenjang_sekolah?: string } | null)?.jenjang_sekolah ?? 'SMP/MTs'
      const jenjangLevels  = JENJANG_MAP[jenjangSekolah] ?? JENJANG_MAP['SMP/MTs']
      const taMulaiTahun   = activeTA ? new Date(activeTA.tanggal_mulai).getFullYear() : nowTahun

      const list = (siswaData ?? []) as unknown as SiswaAktifRaw[]

      const rows = list
        .map(s => {
          const isAktif   = s.status === 'aktif'
          const kelasNama = s.kelasRef?.nama ?? s.kelas ?? '-'
          const levelIdx  = isAktif && s.kelasRef?.jenjang ? jenjangLevels.indexOf(s.kelasRef.jenjang) : -1
          const angkatan  = levelIdx >= 0 ? String(taMulaiTahun - levelIdx) : '-'
          return {
            nisn:     nisnOrNis(s),
            nama:     s.nama,
            kelas:    kelasNama,
            angkatan,
            namaOrtu: s.nama_wali ?? '-',
            noWa:     s.no_wa ?? '-',
            status:   isAktif ? 'Aktif' : 'Nonaktif',
          }
        })
        .sort((a, b) =>
          (a.status === b.status ? 0 : a.status === 'Aktif' ? -1 : 1) ||
          a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) ||
          a.nama.localeCompare(b.nama, 'id')
        )

      if (rows.length === 0) {
        setExportNotice('Tidak ada data siswa aktif.')
        return
      }

      const headers = ['No', 'NISN', 'Nama Siswa', 'Kelas', 'Angkatan', 'Nama Orang Tua', 'No. WhatsApp', 'Status']
      const aoa: (string | number)[][] = [headers]
      rows.forEach((r, i) => {
        aoa.push([i + 1, r.nisn, r.nama, r.kelas, r.angkatan, r.namaOrtu, r.noWa, r.status])
      })

      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = [
        { wch: 5 }, { wch: 14 }, { wch: 24 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 12 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Siswa Aktif')

      XLSX.writeFile(wb, `Laporan_Siswa_Aktif_${formatDateLocal(now)}.xlsx`)
    } finally {
      setExportingSiswaAktif(false)
    }
  }

  // ── Export Laporan Alumni (Excel) ─────────────────────────────────────────
  // Total Tagihan/Terbayar dihitung dari SELURUH tagihan siswa sejak awal masuk hingga sebelum
  // jadi alumni (bukan cuma periode tertentu) — karena tagihan berhenti dibuat begitu siswa
  // jadi alumni (kelas_id dikosongkan), jumlah semua tagihan siswa itu = riwayat penuhnya.
  // Angkatan = tahun lulus dikurangi jumlah level jenjang (pola sama dgn Laporan Siswa Aktif,
  // dihitung dari sisi lulus, bukan sisi aktif).

  const handleExportAlumni = async () => {
    if (!sekolahId) return

    setExportingAlumni(true)
    try {
      const [{ data: pengData }, { data: alumniData, error: alumniErr }] = await Promise.all([
        supabase.from('pengaturan').select('jenjang_sekolah').eq('sekolah_id', sekolahId).maybeSingle(),
        supabase
          .from('siswa')
          .select('id, nama, nis, nisn, tahun_lulus')
          .eq('sekolah_id', sekolahId)
          .eq('status', 'alumni')
          .eq('jenis_alumni', 'lulus')
          .limit(5000),
      ])

      if (alumniErr) console.error('[Export Laporan Alumni] gagal memuat alumni:', alumniErr)

      const jenjangSekolah = (pengData as { jenjang_sekolah?: string } | null)?.jenjang_sekolah ?? 'SMP/MTs'
      const jenjangLevels  = JENJANG_MAP[jenjangSekolah] ?? JENJANG_MAP['SMP/MTs']

      const alumniList = (alumniData ?? []) as unknown as AlumniRaw[]
      const alumniIds  = alumniList.map(a => a.id)

      if (alumniIds.length === 0) {
        setExportNotice('Belum ada data alumni.')
        return
      }

      const [{ data: tagihanData, error: tagihanErr }, { data: pembData, error: pembErr }] = await Promise.all([
        supabase.from('tagihan').select('siswa_id, total_nominal').in('siswa_id', alumniIds).limit(20000),
        supabase.from('pembayaran').select('siswa_id, jumlah').in('siswa_id', alumniIds).limit(20000),
      ])
      if (tagihanErr) console.error('[Export Laporan Alumni] gagal memuat tagihan:', tagihanErr)
      if (pembErr)    console.error('[Export Laporan Alumni] gagal memuat pembayaran:', pembErr)

      const totalTagihanMap = new Map<string, number>()
      for (const t of ((tagihanData ?? []) as { siswa_id: string; total_nominal: number }[])) {
        totalTagihanMap.set(t.siswa_id, (totalTagihanMap.get(t.siswa_id) ?? 0) + t.total_nominal)
      }
      const totalBayarMap = new Map<string, number>()
      for (const p of ((pembData ?? []) as { siswa_id: string; jumlah: number }[])) {
        totalBayarMap.set(p.siswa_id, (totalBayarMap.get(p.siswa_id) ?? 0) + p.jumlah)
      }

      const rows = alumniList
        .map(a => {
          const totalTagihan  = totalTagihanMap.get(a.id) ?? 0
          const totalBayar    = totalBayarMap.get(a.id) ?? 0
          const sisa          = totalTagihan - totalBayar
          const tahunLulusNum = a.tahun_lulus ? parseInt(a.tahun_lulus, 10) : null
          const angkatan      = tahunLulusNum ? String(tahunLulusNum - jenjangLevels.length) : '-'
          return {
            nisn:       nisnOrNis(a),
            nama:       a.nama,
            angkatan,
            tahunLulus: a.tahun_lulus ?? '-',
            totalTagihan,
            totalBayar,
            sisa,
            status: sisa === 0 ? 'Lunas' : 'Belum Lunas',
          }
        })
        .sort((a, b) => a.tahunLulus.localeCompare(b.tahunLulus) || a.nama.localeCompare(b.nama, 'id'))

      const headers = ['No', 'NISN', 'Nama Siswa', 'Angkatan', 'Tahun Lulus', 'Total Tagihan', 'Total Terbayar', 'Sisa Tunggakan', 'Status Pelunasan']
      const aoa: (string | number)[][] = [headers]
      rows.forEach((r, i) => {
        aoa.push([i + 1, r.nisn, r.nama, r.angkatan, r.tahunLulus, r.totalTagihan, r.totalBayar, r.sisa, r.status])
      })

      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = [
        { wch: 5 }, { wch: 14 }, { wch: 24 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Alumni')

      XLSX.writeFile(wb, `Laporan_Alumni_${formatDateLocal(now)}.xlsx`)
    } finally {
      setExportingAlumni(false)
    }
  }

  // ── Export Laporan Keuangan Tahunan (Excel) ───────────────────────────────
  // Satu baris per tahun ajaran (fetch ulang semua tahun ajaran tanpa batas — bukan reuse
  // activeTA/archivedTAs yang di halaman ini sengaja dibatasi 5 utk dropdown). Target/Realisasi
  // dihitung dari tagihan yg bulan/tahunnya masuk rentang tahun ajaran tsb (pola monthsInRange
  // yang sama dipakai utk filter dropdown periode).

  const handleExportKeuanganTahunan = async () => {
    if (!sekolahId) return

    setExportingKeuanganTahunan(true)
    try {
      const [{ data: taData, error: taErr }, { data: tagihanData, error: tagihanErr }, { data: pembData, error: pembErr }] = await Promise.all([
        supabase
          .from('tahun_ajaran')
          .select('nama, tanggal_mulai, tanggal_selesai, is_aktif')
          .eq('sekolah_id', sekolahId)
          .order('tanggal_mulai', { ascending: true })
          .limit(200),
        supabase.from('tagihan').select('id, bulan, tahun, total_nominal').eq('sekolah_id', sekolahId).limit(10000),
        supabase.from('pembayaran').select('tagihan_id, jumlah').eq('sekolah_id', sekolahId).limit(20000),
      ])

      if (taErr)      console.error('[Export Laporan Keuangan Tahunan] gagal memuat tahun ajaran:', taErr)
      if (tagihanErr) console.error('[Export Laporan Keuangan Tahunan] gagal memuat tagihan:', tagihanErr)
      if (pembErr)    console.error('[Export Laporan Keuangan Tahunan] gagal memuat pembayaran:', pembErr)

      const taList      = (taData ?? []) as unknown as TahunAjaranFullRaw[]
      const tagihanList = (tagihanData ?? []) as { id: string; bulan: number; tahun: number; total_nominal: number }[]
      const pembList    = (pembData ?? []) as { tagihan_id: string; jumlah: number }[]

      if (taList.length === 0) {
        setExportNotice('Belum ada data tahun ajaran.')
        return
      }

      const paidMap = new Map<string, number>()
      for (const p of pembList) paidMap.set(p.tagihan_id, (paidMap.get(p.tagihan_id) ?? 0) + p.jumlah)

      const rows = taList.map(ta => {
        const monthSet = new Set(monthsInRange(ta.tanggal_mulai, ta.tanggal_selesai).map(m => periodKey(m.bulan, m.tahun)))
        const tagihanTA = tagihanList.filter(t => monthSet.has(periodKey(t.bulan, t.tahun)))
        const tagihanIds = new Set(tagihanTA.map(t => t.id))

        const totalTarget    = tagihanTA.reduce((s, t) => s + t.total_nominal, 0)
        const totalRealisasi = tagihanTA.reduce((s, t) => s + (paidMap.get(t.id) ?? 0), 0)
        const jumlahTransaksi = pembList.filter(p => tagihanIds.has(p.tagihan_id)).length

        return {
          tahunAjaran:    ta.nama,
          totalTarget,
          totalRealisasi,
          totalTunggakan: totalTarget - totalRealisasi,
          jumlahTransaksi,
          statusAudit:    ta.is_aktif ? 'Berjalan' : 'Terverifikasi',
        }
      })

      const headers = ['No', 'Tahun Ajaran', 'Total Target', 'Total Realisasi', 'Total Tunggakan', 'Jumlah Transaksi', 'Status Audit']
      const aoa: (string | number)[][] = [headers]
      rows.forEach((r, i) => {
        aoa.push([i + 1, r.tahunAjaran, r.totalTarget, r.totalRealisasi, r.totalTunggakan, r.jumlahTransaksi, r.statusAudit])
      })

      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = [
        { wch: 5 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Keuangan Tahunan')

      XLSX.writeFile(wb, `Laporan_Keuangan_Tahunan_${formatDateLocal(now)}.xlsx`)
    } finally {
      setExportingKeuanganTahunan(false)
    }
  }

  // ── Generate Laporan Utama (PDF) ───────────────────────────────────────────
  // Merangkum seluruh blok "Ringkasan periode ini" yang tampil di layar (stats, komposisi
  // status, tren 6 bulan, pelunasan per jenjang, komponen belum dibayar) jadi satu dokumen PDF
  // sesuai periode yang lagi dipilih di dropdown atas.

  const handleGenerateLaporanUtama = async () => {
    if (!selectedFilter || !sekolahId) return
    if (!hasData) {
      setExportNotice('Tidak ada data pada periode ini untuk digenerate.')
      return
    }

    setGeneratingUtama(true)
    try {
      const { data: sekolahData } = await supabase.from('sekolah').select('nama').eq('id', sekolahId).maybeSingle()
      const namaSekolah = (sekolahData as { nama?: string } | null)?.nama ?? 'Sekolah'

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const navy: [number, number, number] = [26, 44, 78]
      let y = 18

      doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
      doc.text(namaSekolah, pageWidth / 2, y, { align: 'center' })
      y += 7
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
      doc.text('Laporan Utama', pageWidth / 2, y, { align: 'center' })
      y += 6
      doc.setFontSize(9); doc.setTextColor(100)
      doc.text(`Periode: ${selectedFilter.label} - ${selectedFilter.sublabel}`, pageWidth / 2, y, { align: 'center' })
      y += 5
      doc.text(
        `Dibuat pada ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}, ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        pageWidth / 2, y, { align: 'center' }
      )
      doc.setTextColor(0)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [['Ringkasan', 'Nilai']],
        body: [
          ['Total Pemasukan', fmt(stats.totalPemasukan)],
          ['Dari Transaksi', `${stats.transaksiCount} transaksi`],
          ['Tingkat Pelunasan', `${stats.tingkatPelunasan}%`],
          ['Sudah Masuk', `${fmt(stats.sudahMasuk)} dari ${fmt(stats.totalTagihanRp)}`],
          ['Total Tunggakan', fmt(stats.totalTunggakan)],
          ['- Belum Jatuh Tempo', fmt(stats.belumJatuhTempo)],
          ['- Menunggak', fmt(stats.menunggakRp)],
        ],
        theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
      })
      y = getFinalY(doc) + 10

      doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
      doc.text('Komposisi Status Pembayaran', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        head: [['Status', 'Jumlah Tagihan']],
        body: donutData.map(d => [d.label, String(d.value)]),
        theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
      })
      y = getFinalY(doc) + 10

      if (y > 250) { doc.addPage(); y = 18 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
      doc.text('Tren Pemasukan (6 Bulan Terakhir)', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        head: [['Bulan', 'Nominal']],
        body: monthlyTrend.map(m => [m.bulan, fmt(m.nominal)]),
        theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
      })
      y = getFinalY(doc) + 10

      if (jenjangData.length > 0) {
        if (y > 250) { doc.addPage(); y = 18 }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
        doc.text('Pelunasan per Jenjang', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Jenjang', 'Persentase Lunas']],
          body: jenjangData.map(j => [j.jenjang, `${j.pct}%`]),
          theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
        })
        y = getFinalY(doc) + 10
      }

      if (komponenData.length > 0) {
        if (y > 250) { doc.addPage(); y = 18 }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
        doc.text('Komponen Paling Banyak Belum Dibayar', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Komponen', 'Jumlah Tagihan', 'Total Nominal']],
          body: komponenData.map(k => [k.nama, String(k.jumlah), fmt(k.total)]),
          theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
        })
      }

      const periodeLabel = `${selectedFilter.label}_${selectedFilter.sublabel}`.replace(/\s+/g, '_')
      doc.save(`Laporan_Utama_${periodeLabel}.pdf`)
    } finally {
      setGeneratingUtama(false)
    }
  }

  return (
    <div className="dashboard-content">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18,47,102,0.31)' }}>
            <BarChart2 size={30} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>
              Laporan
            </h1>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              Analisis keuangan dan unduhan laporan per periode
            </p>
          </div>
        </div>

        {!loading && selectedFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {/* Filter Periode */}
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(p => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '0.55rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                <span>{selectedFilter.label}</span>
                <span style={{ color: '#CBD5E1' }}>·</span>
                <span style={{ color: '#94A3B8' }}>{selectedFilter.sublabel}</span>
                <ChevronDown size={13} color="#94A3B8" style={{ marginLeft: 2, transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {showDropdown && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 220, zIndex: 100, overflow: 'hidden' }}>
                  {filterOptions.map(opt => {
                    const isActive = selectedValue === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { setSelectedValue(opt.value); setShowDropdown(false) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1rem', border: 'none', background: isActive ? '#F8FAFC' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <span style={{ fontSize: '0.82rem', fontWeight: isActive ? 700 : 600, color: isActive ? '#1A2C4E' : '#374151' }}>{opt.label}</span>
                        <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{opt.sublabel}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Generate Laporan */}
            <button
              onClick={handleGenerateLaporanUtama}
              disabled={generatingUtama}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: generatingUtama ? '#5B6B8C' : '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: generatingUtama ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              <Download size={20} /> {generatingUtama ? 'Memproses...' : 'Generate Laporan Utama'}
            </button>
          </div>
        )}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ background: '#fff', borderRadius: 14, borderLeft: '28px solid #E2E8F0', border: '1.5px solid #E2E8F0', padding: '4rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.875rem', minHeight: 220 }}>
          Memuat data...
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !hasData && (
        <div style={{
          background: '#fff',
          borderRadius: 14,
          borderTop: '1.5px solid #F1F5F9',
          borderRight: '1.5px solid #F1F5F9',
          borderBottom: '1.5px solid #F1F5F9',
          borderLeft: '28px solid #1A2C4E',
          boxShadow: '0 0 10px rgba(0,0,0,0.04)',
          minHeight: 360,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '5rem 2rem',
        }}>
          <Database size={56} strokeWidth={1.2} color="#CBD5E1" style={{ marginBottom: '1.25rem' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', marginBottom: '0.5rem' }}>
            Belum ada data untuk periode ini
          </div>
          <div style={{ fontSize: '0.875rem', color: '#94A3B8', textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
            Transaksi akan muncul di sini setelah ada pembayaran yang masuk di periode yang dipilih
          </div>
        </div>
      )}

      {/* ── Data State ── */}
      {!loading && hasData && (
        <>
          {/* Semua baris stat dalam satu wrapper card border-left */}
          <div style={{
            background: '#fff',
            borderRadius: 14,
            borderTop: '1.5px solid #F1F5F9',
            borderRight: '1.5px solid #F1F5F9',
            borderBottom: '1.5px solid #F1F5F9',
            borderLeft: '28px solid #1A2C4E',
            boxShadow: '0 0 18px rgba(39, 74, 156, 0.51)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
          }}>

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem' }}>
              <div style={{ width: 60, height: 50, background: '#1A2C4E', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Image src="/icons/Grafik.png" alt="Bar Chart" width={20} height={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#0F172A' }}>Ringkasan periode ini</div>
                <div style={{ fontSize: '1rem', color: '#747474' }}>Analisis status dan kondisi pembayaran berdasarkan periode yang dipilih</div>
              </div>
            </div>

            {/* Row 1: 3 stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '0.9rem' }}>

              {/* Total Pemasukan */}
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#6F788A' }}>Total pemasukan</span>
                  <div style={{ width: 32, height: 32, background: '#F0FDF4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUp size={16} color="#22C55E" />
                  </div>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: '0.35rem' }}>
                  {fmt(stats.totalPemasukan)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6F788A' }}>Dari {stats.transaksiCount} transaksi</div>
              </div>

              {/* Tingkat Pelunasan */}
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#6F788A' }}>Tingkat pelunasan</span>
                  <div style={{ width: 32, height: 32, background: '#EFF6FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PieChart size={16} color="#3B82F6" />
                  </div>
                </div>
                <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: '0.75rem' }}>{stats.tingkatPelunasan}%</div>
                <div style={{ height: 18, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden', marginBottom: '0.5rem' }}>
                  <div style={{ height: '100%', width: `${stats.tingkatPelunasan}%`, background: '#69C183', borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: '0.76rem', color: '#6F788A' }}>{fmt(stats.sudahMasuk)} dari {fmt(stats.totalTagihanRp)}</div>
              </div>

              {/* Total Tunggakan */}
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#6F788A' }}>Total tunggakan</span>
                  <div style={{ width: 32, height: 32, background: '#FEF2F2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={16} color="#EF4444" />
                  </div>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: '0.875rem' }}>
                  {fmt(stats.totalTunggakan)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Belum jatuh tempo</span>
                    </div>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0F172A' }}>{fmt(stats.belumJatuhTempo)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Menunggak</span>
                    </div>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#EF4444' }}>{fmt(stats.menunggakRp)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Donut + Bar chart */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '0.9rem' }}>
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#6F788A', marginBottom: 4 }}>Komposisi status pembayaran</div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '1.25rem' }}>Distribusi per status tagihan periode ini</div>
                <DonutChart data={donutData} />
              </div>
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#6F788A', marginBottom: 4 }}>Tren pemasukan per bulan</div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '1rem' }}>6 bulan terakhir</div>
                <BarChart data={monthlyTrend} />
              </div>
            </div>

            {/* Row 3: Pelunasan per jenjang + Komponen belum dibayar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#6F788A', marginBottom: 4 }}>Pelunasan per jenjang</div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '1.25rem' }}>Persentase tagihan lunas per tingkat kelas</div>
                {jenjangData.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center', padding: '1rem 0' }}>Belum ada data.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    {jenjangData.map(j => {
                      const color = j.pct >= 80 ? '#22C55E' : j.pct >= 60 ? '#3B82F6' : '#F59E0B'
                      return (
                        <div key={j.jenjang}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>{j.jenjang}</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#6F788A' }}>{j.pct}%</span>
                          </div>
                          <div style={{ height: 8, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${j.pct}%`, background: color, borderRadius: 99 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#6F788A', marginBottom: 4 }}>Komponen paling banyak belum dibayar</div>
                <div style={{ fontSize: '0.75rem', color: '#6F788A', marginBottom: '1rem' }}>Berdasarkan jumlah tagihan yang belum lunas</div>
                {komponenData.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center', padding: '1rem 0' }}>Tidak ada komponen menunggak.</div>
                ) : (
                  <div>
                    {komponenData.map((k, i) => {
                      const amountColor = i === 0 ? '#EF4444' : i === 1 ? '#D97706' : '#94A3B8'
                      const badgeBg     = i === 0 ? '#FEF2F2' : i === 1 ? '#FFFBEB' : '#F1F5F9'
                      const badgeColor  = i === 0 ? '#EF4444' : i === 1 ? '#D97706' : '#64748B'
                      const kode = k.nama.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
                      return (
                        <div key={k.nama} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 0', borderBottom: i < komponenData.length - 1 ? '1px solid #E2E8F0' : 'none' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: badgeColor, letterSpacing: '-0.3px' }}>{kode}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{k.nama}</div>
                            <div style={{ fontSize: '0.73rem', color: '#6F788A' }}>{k.jumlah} tagihan belum lunas</div>
                          </div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: amountColor, flexShrink: 0 }}>
                            {fmt(k.total)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── Daftar Laporan ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem', marginTop: '1.3rem' }}>
            {([
              {
                icon: <Receipt size={22} color="#fff" />,
                title: 'Laporan transaksi',
                subtitle: 'Rekap seluruh transaksi pembayaran periode ini',
              },
              {
                icon: <AlertTriangle size={22} color="#fff" />,
                title: 'Laporan tunggakan',
                subtitle: 'Daftar siswa yang masih memiliki tunggakan',
              },
              {
                icon: <Users size={22} color="#fff" />,
                title: 'Laporan data siswa aktif',
                subtitle: 'Data lengkap seluruh siswa yang aktif saat ini',
              },
              {
                icon: <GraduationCap size={22} color="#fff" />,
                title: 'Laporan alumni',
                subtitle: 'Data alumni per angkatan beserta status pelunasan',
              },
              {
                icon: <BarChart2 size={22} color="#fff" />,
                title: 'Laporan keuangan tahunan',
                subtitle: 'Rekap pemasukan keseluruhan per tahun ajaran, siap audit',
              },
            ] as const).map((item, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '1rem 1.25rem', boxShadow: '0 0 10px rgba(39, 74, 156, 0.51)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Icon */}
                <div style={{ width: 55, height: 55, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{item.subtitle}</div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <button style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: '#fff', border: '2px solid #1A2C4E', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <FileText size={13} color="#64748B" /> PDF
                  </button>
                  {i === 0 ? (
                    <button
                      onClick={handleExportTransaksi}
                      disabled={exportingTransaksi}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: exportingTransaksi ? '#FDE68A' : '#F5C518', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#1A1A1A', cursor: exportingTransaksi ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                      <FileSpreadsheet size={13} color="#1A1A1A" /> {exportingTransaksi ? 'Memproses...' : 'Excel'}
                    </button>
                  ) : i === 1 ? (
                    <button
                      onClick={handleExportTunggakan}
                      disabled={exportingTunggakan}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: exportingTunggakan ? '#FDE68A' : '#F5C518', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#1A1A1A', cursor: exportingTunggakan ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                      <FileSpreadsheet size={13} color="#1A1A1A" /> {exportingTunggakan ? 'Memproses...' : 'Excel'}
                    </button>
                  ) : i === 2 ? (
                    <button
                      onClick={handleExportSiswaAktif}
                      disabled={exportingSiswaAktif}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: exportingSiswaAktif ? '#FDE68A' : '#F5C518', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#1A1A1A', cursor: exportingSiswaAktif ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                      <FileSpreadsheet size={13} color="#1A1A1A" /> {exportingSiswaAktif ? 'Memproses...' : 'Excel'}
                    </button>
                  ) : i === 3 ? (
                    <button
                      onClick={handleExportAlumni}
                      disabled={exportingAlumni}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: exportingAlumni ? '#FDE68A' : '#F5C518', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#1A1A1A', cursor: exportingAlumni ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                      <FileSpreadsheet size={13} color="#1A1A1A" /> {exportingAlumni ? 'Memproses...' : 'Excel'}
                    </button>
                  ) : i === 4 ? (
                    <button
                      onClick={handleExportKeuanganTahunan}
                      disabled={exportingKeuanganTahunan}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: exportingKeuanganTahunan ? '#FDE68A' : '#F5C518', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#1A1A1A', cursor: exportingKeuanganTahunan ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                      <FileSpreadsheet size={13} color="#1A1A1A" /> {exportingKeuanganTahunan ? 'Memproses...' : 'Excel'}
                    </button>
                  ) : (
                    <button style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: '#F5C518', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#1A1A1A', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <FileSpreadsheet size={13} color="#1A1A1A" /> Excel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Notice Modal (pengganti alert() untuk hasil export) ── */}
      {exportNotice && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setExportNotice('')}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden', textAlign: 'center', padding: '2rem 1.75rem 1.5rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Database size={26} color="#94A3B8" />
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 6 }}>Tidak Ada Data</div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1.5rem' }}>{exportNotice}</div>
            <button
              onClick={() => setExportNotice('')}
              style={{ width: '100%', background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, padding: '0.7rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Tutup
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
