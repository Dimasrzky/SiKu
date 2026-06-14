'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  Users, Calendar, Download,
  Clock, AlertTriangle, CheckCircle2, ChevronRight,
  Banknote, Gift, BookOpen, TrendingUp, TrendingDown,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SetupChecklist } from '@/components/SetupChecklist'
import { StatCard } from '@/components/StatCard'
import { FinanceCard } from '@/components/FinanceCard'
import { ChartCard } from '@/components/ChartCard'

// ── Constants ─────────────────────────────────────────────────────────────────

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const BULAN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const KOMPOSISI_COLORS = ['#1A2C4E', '#3B82F6', '#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6']

// ── Helpers ───────────────────────────────────────────────────────────────────

function rpCompact(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(2).replace('.', ',')} jt`
  if (n >= 1_000)         return `Rp ${Math.round(n / 1_000)}.000`
  return `Rp ${n}`
}

function rpFull(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function getLast6Months(): Array<{ bulan: string; tahun: number; short: string }> {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { bulan: BULAN_NAMES[d.getMonth()], tahun: d.getFullYear(), short: BULAN_SHORT[d.getMonth()] }
  })
}

function daysLeftInMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthUser { nama: string; jabatan: string; sekolah: string }

interface TagihanRow {
  id:            string
  jenis:         string
  bulan:         string
  tahun:         number
  nominal:       number
  kelas_jenjang: string | null
  nama:          string | null
  status:        'draft' | 'aktif' | 'selesai'
  total_siswa:   number
  sudah_bayar:   number
}

interface BeasiswaRow {
  jenis:       'beasiswa' | 'override'
  nominal:     number | null
  persen:      number | null
  jumlah_siswa: number
}

interface TrenItem    { short: string; terkumpul: number; tunggakan: number }
interface KomposisiItem { nama: string; nominal: number; persen: number }
interface KelasItem   { nama: string; lunas: number; total: number }

interface Insight {
  id:           string
  level:        'merah' | 'amber' | 'hijau'
  judul:        string
  desc:         string
  sub?:         string
  actionLabel?: string
  actionHref?:  string
}

interface DashData {
  totalSiswaAktif:   number
  totalKelas:        number
  tahunAjaranNama:   string
  totalTunggakan:    number
  siswaBelumBayar:   number
  totalSiswaRef:     number
  lunasRef:          number
  siswaTunggakanLama: number
  terkumpulIni:      number
  terkumpulLalu:     number
  targetIni:         number
  belumBayarNominal: number
  belumBayarLalu:    number
  totalBeasiswaNom:  number
  penerimaBeasiswa:  number
  totalTagihanNom:   number
  trenData:          TrenItem[]
  komposisi:         KomposisiItem[]
  perKelas:          KelasItem[]
  insights:          Insight[]
}

// ── SVG: Bar Chart ─────────────────────────────────────────────────────────────

function BarChart({ data }: { data: TrenItem[] }) {
  if (!data.length) return null
  const max  = Math.max(...data.map(d => Math.max(d.terkumpul, d.tunggakan)), 1)
  const bW   = 16
  const bGap = 4
  const gGap = 18
  const gW   = bW * 2 + bGap
  const cH   = 140

  return (
    <svg viewBox={`0 0 280 160`} style={{ width: '100%', maxHeight: 160, marginBottom: 16 }}>
      <g transform="translate(-20 0)">
        {data.map((d, i) => {
          const x  = 2 + i * (gW + gGap)
          const h1 = (d.terkumpul / max) * cH
          const h2 = (d.tunggakan / max) * cH
          return (
            <g key={d.short}>
              <rect x={x}              y={cH - h1} width={bW} height={Math.max(h1, 2)} rx={4} fill="#10B981" opacity={0.85} />
              <rect x={x + bW + bGap}  y={cH - h2} width={bW} height={Math.max(h2, 2)} rx={4} fill="#EF4444" opacity={0.75} />
              <text x={x + bW}         y={155}      textAnchor="middle" fontSize={10} fill="#9CA3AF">{d.short}</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// ── SVG: Donut Chart ──────────────────────────────────────────────────────────

function DonutChart({ items, total }: { items: KomposisiItem[]; total: number }) {
  const R  = 42
  const CX = 58
  const CY = 58
  const C  = 2 * Math.PI * R

  const totalLabel =
    total >= 1_000_000 ? (total / 1_000_000).toFixed(2).replace('.', ',') : total.toLocaleString('id-ID')

  type Seg = { i: number; dash: number; offset: number }

  // Immutable reduce — React Compiler forbids let-mutation inside render functions
  const segments: Seg[] = items.reduce<{ list: Seg[]; cum: number }>(
    ({ list, cum }, item, i) => {
      const dash   = (item.persen / 100) * C
      const offset = C * 0.25 - cum
      return { list: [...list, { i, dash, offset }], cum: cum + dash }
    },
    { list: [], cum: 0 },
  ).list

  return (
    <svg viewBox="0 0 116 116" style={{ width: 116, height: 116, flexShrink: 0 }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth={17} />
      {segments.map(({ i, dash, offset }) => (
        <circle
          key={i}
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={KOMPOSISI_COLORS[i % KOMPOSISI_COLORS.length]}
          strokeWidth={17}
          strokeDasharray={`${dash} ${C - dash}`}
          strokeDashoffset={offset}
        />
      ))}
      <text x={CX} y={CY - 3} textAnchor="middle" fontSize={11} fontWeight="800" fill="#0F172A">
        {totalLabel}
      </text>
      <text x={CX} y={CY + 11} textAnchor="middle" fontSize={8} fill="#6B7280">juta</text>
    </svg>
  )
}

// ── Data Loader ───────────────────────────────────────────────────────────────

async function loadDashData(siswaTotal: number): Promise<DashData> {
  const now       = new Date()
  const bulanIni  = BULAN_NAMES[now.getMonth()]
  const tahunIni  = now.getFullYear()
  const prevDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const bulanLalu = BULAN_NAMES[prevDate.getMonth()]
  const tahunLalu = prevDate.getFullYear()
  const last6     = getLast6Months()

  const [
    { count: kelasCount },
    { data: taRows },
    { data: bsRows },
    { data: taData },
  ] = await Promise.all([
    supabase.from('kelas').select('id', { count: 'exact', head: true }),
    supabase
      .from('tagihan')
      .select('id, jenis, bulan, tahun, nominal, kelas_jenjang, nama, status, total_siswa, sudah_bayar')
      .neq('status', 'draft')
      .order('tahun', { ascending: false })
      .order('bulan')
      .limit(500),
    supabase
      .from('beasiswa')
      .select('jenis, nominal, persen, jumlah_siswa')
      .limit(100),
    supabase
      .from('tahun_ajaran')
      .select('nama')
      .eq('is_aktif', true)
      .maybeSingle(),
  ])

  const rows   = (taRows  ?? []) as TagihanRow[]
  const bsList = (bsRows  ?? []) as BeasiswaRow[]

  const currentRows = rows.filter(t => t.bulan === bulanIni && t.tahun === tahunIni)
  const lastRows    = rows.filter(t => t.bulan === bulanLalu && t.tahun === tahunLalu)

  // ── Tunggakan card ──────────────────────────────────────────────────────────

  const totalTunggakan = rows.reduce(
    (s, t) => s + (t.total_siswa - t.sudah_bayar) * t.nominal, 0
  )

  const repRow       = [...currentRows].sort((a, b) => b.total_siswa - a.total_siswa)[0]
  const totalSiswaRef = repRow?.total_siswa  ?? siswaTotal
  const lunasRef      = repRow?.sudah_bayar   ?? 0
  const siswaBelumBayar = totalSiswaRef - lunasRef

  // Students with debt from previous months
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const oldUnpaid = rows.filter(t => {
    const idx = BULAN_NAMES.indexOf(t.bulan)
    if (idx < 0) return false
    return new Date(t.tahun, idx, 1) < thisMonthStart && t.sudah_bayar < t.total_siswa
  })
  const siswaTunggakanLama = oldUnpaid.length > 0
    ? Math.max(...oldUnpaid.map(t => t.total_siswa - t.sudah_bayar))
    : 0

  // ── Financial ───────────────────────────────────────────────────────────────

  const terkumpulIni   = currentRows.reduce((s, t) => s + t.sudah_bayar * t.nominal, 0)
  const terkumpulLalu  = lastRows.reduce((s, t) => s + t.sudah_bayar * t.nominal, 0)
  const targetIni      = currentRows.reduce((s, t) => s + t.total_siswa * t.nominal, 0)
  const belumBayarNominal = currentRows.reduce((s, t) => s + (t.total_siswa - t.sudah_bayar) * t.nominal, 0)
  const belumBayarLalu    = lastRows.reduce((s, t) => s + (t.total_siswa - t.sudah_bayar) * t.nominal, 0)

  // ── Beasiswa ────────────────────────────────────────────────────────────────

  const beasiswaOnly   = bsList.filter(b => b.jenis === 'beasiswa')
  const totalBeasiswaNom = beasiswaOnly.reduce((s, b) => s + (b.nominal ?? 0), 0)
  const penerimaBeasiswa = beasiswaOnly.reduce((s, b) => s + b.jumlah_siswa, 0)

  // ── Tren 6 bulan ────────────────────────────────────────────────────────────

  const trenData: TrenItem[] = last6.map(({ bulan, tahun, short }) => {
    const mRows = rows.filter(t => t.bulan === bulan && t.tahun === tahun)
    return {
      short,
      terkumpul: mRows.reduce((s, t) => s + t.sudah_bayar * t.nominal, 0),
      tunggakan: mRows.reduce((s, t) => s + (t.total_siswa - t.sudah_bayar) * t.nominal, 0),
    }
  })

  // ── Komposisi per komponen ──────────────────────────────────────────────────

  const komMap = new Map<string, number>()
  currentRows.forEach(t => {
    const key = t.nama || t.jenis || 'Lainnya'
    komMap.set(key, (komMap.get(key) ?? 0) + t.sudah_bayar * t.nominal)
  })
  const totalKom = Math.max(Array.from(komMap.values()).reduce((s, v) => s + v, 0), 1)
  const komposisi: KomposisiItem[] = Array.from(komMap.entries())
    .map(([nama, nominal]) => ({ nama, nominal, persen: Math.round((nominal / totalKom) * 100) }))
    .sort((a, b) => b.persen - a.persen)
    .slice(0, 6)

  // ── Per kelas ───────────────────────────────────────────────────────────────

  const kelasMap = new Map<string, { lunas: number; total: number }>()
  currentRows.filter(t => t.kelas_jenjang).forEach(t => {
    const key = t.kelas_jenjang!
    const e = kelasMap.get(key) ?? { lunas: 0, total: 0 }
    e.lunas += t.sudah_bayar
    e.total += t.total_siswa
    kelasMap.set(key, e)
  })
  const perKelas: KelasItem[] = Array.from(kelasMap.entries())
    .map(([nama, { lunas, total }]) => ({ nama, lunas, total }))
    .sort((a, b) => b.lunas / b.total - a.lunas / a.total)
    .slice(0, 5)

  // ── Insights ────────────────────────────────────────────────────────────────

  const insights: Insight[] = []
  const pctIni = totalSiswaRef > 0 ? (lunasRef / totalSiswaRef) * 100 : 0

  // Merah: kelas rendah (< 50%)
  const kelasRendah = perKelas.filter(k => k.total > 0 && k.lunas / k.total < 0.5)
  if (kelasRendah.length > 0) {
    insights.push({
      id: 'kelas-rendah',
      level: 'merah',
      judul: 'Kelas bayar rendah',
      desc: `${kelasRendah.length} kelas memiliki tingkat pembayaran di bawah 50%.`,
      sub: kelasRendah.map(k => k.nama).join(' • '),
      actionLabel: 'Kirim Pengingat',
      actionHref: '/tagihan/aktif',
    })
  }

  // Merah: akhir bulan & pct rendah
  const sisa = daysLeftInMonth()
  if (sisa <= 5 && pctIni < 80) {
    insights.push({
      id: 'akhir-bulan',
      level: 'merah',
      judul: 'Akhir bulan kritis',
      desc: `Sisa ${sisa} hari, tingkat pembayaran baru ${Math.round(pctIni)}%.`,
      sub: 'Kirim pengingat massal ke siswa yang belum membayar.',
      actionLabel: 'Kirim Pengingat',
    })
  }

  // Merah: tunggakan lama
  if (siswaTunggakanLama > 0) {
    insights.push({
      id: 'tunggakan-lama',
      level: 'merah',
      judul: 'Tunggakan kritis',
      desc: `${oldUnpaid.length} tagihan bulan sebelumnya belum lunas.`,
      sub: `Sekitar ${siswaTunggakanLama} siswa memiliki tunggakan lebih dari 1 bulan.`,
      actionLabel: 'Kirim Pengingat',
    })
  }

  // Amber: override aktif
  const overrideCount = bsList.filter(b => b.jenis === 'override').length
  if (overrideCount > 0) {
    insights.push({
      id: 'override-aktif',
      level: 'amber',
      judul: 'Override tagihan aktif',
      desc: `Ada ${overrideCount} override tarif aktif untuk beberapa siswa.`,
      sub: 'Periksa jika ada override yang perlu diperpanjang atau dikembalikan.',
      actionLabel: 'Lihat Detail',
      actionHref: '/tagihan/beasiswa',
    })
  }

  // Amber: beasiswa berjalan
  if (penerimaBeasiswa > 0) {
    insights.push({
      id: 'beasiswa-aktif',
      level: 'amber',
      judul: 'Beasiswa sedang berjalan',
      desc: `${penerimaBeasiswa} siswa sedang menerima program beasiswa.`,
      sub: 'Pastikan data penerima beasiswa sudah sesuai dan terkini.',
      actionLabel: 'Lihat Detail',
      actionHref: '/tagihan/beasiswa',
    })
  }

  // Hijau: pemasukan naik
  if (terkumpulLalu > 0 && terkumpulIni > terkumpulLalu * 1.05) {
    const pct = Math.round(((terkumpulIni - terkumpulLalu) / terkumpulLalu) * 100)
    insights.push({
      id: 'pemasukan-naik',
      level: 'hijau',
      judul: 'Pemasukan naik',
      desc: `Pemasukan bulan ini sudah ${pct}% lebih tinggi dari bulan lalu.`,
      sub: `Dibandingkan periode yang sama bulan ${bulanLalu}.`,
      actionLabel: 'Lihat Detail',
      actionHref: '/laporan',
    })
  }

  // Hijau: kelas 100%
  const kelas100 = perKelas.filter(k => k.total > 0 && k.lunas >= k.total)
  if (kelas100.length > 0) {
    insights.push({
      id: 'kelas-100',
      level: 'hijau',
      judul: `Kelas 100% Lunas`,
      desc: `${kelas100.length} kelas sudah mencapai 100% pembayaran bulan ${bulanIni}.`,
      sub: kelas100.map(k => k.nama).join(' • '),
      actionLabel: 'Lihat Detail',
      actionHref: '/tagihan/aktif',
    })
  }

  // Fallback: jika tidak ada insight lain, tampilkan ringkasan status bulan ini
  if (insights.length === 0) {
    if (currentRows.length === 0) {
      insights.push({
        id: 'belum-tagihan',
        level: 'amber',
        judul: 'Belum ada tagihan bulan ini',
        desc: `Tidak ada tagihan aktif untuk ${bulanIni} ${tahunIni}.`,
        sub: 'Buat tagihan baru untuk memulai monitoring pembayaran bulan ini.',
        actionLabel: 'Buat Tagihan',
        actionHref: '/tagihan/aktif',
      })
    } else if (pctIni >= 80) {
      insights.push({
        id: 'semua-baik',
        level: 'hijau',
        judul: 'Pembayaran berjalan baik',
        desc: `${Math.round(pctIni)}% siswa sudah membayar tagihan bulan ${bulanIni}.`,
        sub: `${lunasRef} dari ${totalSiswaRef} siswa lunas — tidak ada kondisi yang perlu perhatian.`,
        actionLabel: 'Lihat Detail',
        actionHref: '/tagihan/aktif',
      })
    } else {
      insights.push({
        id: 'pembayaran-berjalan',
        level: 'amber',
        judul: 'Pembayaran sedang berlangsung',
        desc: `${Math.round(pctIni)}% siswa sudah membayar tagihan bulan ${bulanIni}.`,
        sub: `${totalSiswaRef - lunasRef} siswa belum membayar — pantau terus hingga akhir bulan.`,
        actionLabel: 'Lihat Detail',
        actionHref: '/tagihan/aktif',
      })
    }
  }

  return {
    totalSiswaAktif: siswaTotal,
    totalKelas: kelasCount ?? 0,
    tahunAjaranNama: (taData as { nama: string } | null)?.nama ?? '-',
    totalTunggakan,
    siswaBelumBayar,
    totalSiswaRef,
    lunasRef,
    siswaTunggakanLama,
    terkumpulIni,
    terkumpulLalu,
    targetIni,
    belumBayarNominal,
    belumBayarLalu,
    totalBeasiswaNom,
    penerimaBeasiswa,
    totalTagihanNom: targetIni,
    trenData,
    komposisi,
    perKelas,
    insights,
  }
}

// ── Insight Card ──────────────────────────────────────────────────────────────

const INSIGHT_STYLE: Record<string, { border: string; bg: string; iconColor: string; badgeBg: string; badgeColor: string; label: string }> = {
  merah: { border: '#FCA5A5', bg: '#FFF5F5', iconColor: '#DC2626', badgeBg: '#FEE2E2', badgeColor: '#DC2626', label: 'Perlu Diperhatian' },
  amber: { border: '#FCD34D', bg: '#FFFBEB', iconColor: '#D97706', badgeBg: '#FEF3C7', badgeColor: '#D97706', label: 'Pengingat' },
  hijau: { border: '#6EE7B7', bg: '#F0FDF4', iconColor: '#059669', badgeBg: '#D1FAE5', badgeColor: '#059669', label: 'Kabar Baik' },
}

function InsightCard({ insight }: { insight: Insight }) {
  const st = INSIGHT_STYLE[insight.level]
  const Icon = insight.level === 'merah' ? AlertTriangle : insight.level === 'amber' ? Clock : CheckCircle2
  return (
    <div style={{
      background: st.bg,
      border: `1px solid ${st.border}`,
      borderRadius: 12,
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: st.badgeBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} color={st.iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: st.iconColor, marginBottom: 2 }}>{insight.judul}</div>
        <div style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.4 }}>{insight.desc}</div>
        {insight.sub && (
          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: 2 }}>{insight.sub}</div>
        )}
      </div>
      {insight.actionLabel && (
        insight.actionHref ? (
          <Link href={insight.actionHref} style={{
            background: st.iconColor, color: '#fff',
            border: 'none', borderRadius: 8, padding: '0.45rem 1rem',
            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            {insight.actionLabel} <ChevronRight size={13} />
          </Link>
        ) : (
          <button style={{
            background: st.iconColor, color: '#fff',
            border: 'none', borderRadius: 8, padding: '0.45rem 1rem',
            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {insight.actionLabel} <ChevronRight size={13} />
          </button>
        )
      )}
    </div>
  )
}

// ── Auth helpers (same pattern as layout.tsx) ────────────────────────────────

function getAuthRaw()       { return localStorage.getItem('siku_auth') }
function getAuthRawServer() { return null }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [hasSiswa,          setHasSiswa]          = useState<boolean | null>(null)
  const [data,              setData]              = useState<DashData | null>(null)
  const [now,               setNow]               = useState(new Date())
  const [lastUpd,           setLastUpd]           = useState<Date | null>(null)
  const [showSetupBerhasil, setShowSetupBerhasil] = useState(false)

  const raw  = useSyncExternalStore(
    (cb) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb) },
    getAuthRaw,
    getAuthRawServer,
  )
  const user: AuthUser | null = raw ? (JSON.parse(raw) as AuthUser) : null

  useEffect(() => {
    try {
      if (localStorage.getItem('siku_setup_berhasil') === '1') {
        localStorage.removeItem('siku_setup_berhasil')
        setTimeout(() => setShowSetupBerhasil(true), 0)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    supabase
      .from('siswa')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'aktif')
      .then(({ count }: { count: number | null }) => {
        const total = count ?? 0
        setHasSiswa(total > 0)
        if (total > 0) {
          loadDashData(total)
            .then(d => { setData(d); setLastUpd(new Date()) })
            .catch(() => setData({
              totalSiswaAktif: total, totalKelas: 0, tahunAjaranNama: '-',
              totalTunggakan: 0, siswaBelumBayar: 0, totalSiswaRef: total,
              lunasRef: 0, siswaTunggakanLama: 0, terkumpulIni: 0,
              terkumpulLalu: 0, targetIni: 0, belumBayarNominal: 0,
              belumBayarLalu: 0, totalBeasiswaNom: 0, penerimaBeasiswa: 0,
              totalTagihanNom: 0, trenData: [], komposisi: [], perKelas: [],
              insights: [{
                id: 'load-error', level: 'amber',
                judul: 'Gagal memuat data', desc: 'Terjadi kesalahan saat mengambil data dashboard.',
                sub: 'Coba refresh halaman atau periksa koneksi internet.',
              }],
            }))
        }
      })
  }, [])

  if (hasSiswa === null) {
    return (
      <div className="dashboard-content">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Memuat data...</span>
        </div>
      </div>
    )
  }

  if (!hasSiswa) {
    return (
      <div className="dashboard-content">
        <SetupChecklist />
      </div>
    )
  }

  // ── Computed values ─────────────────────────────────────────────────────────

  const dd       = String(now.getDate()).padStart(2, '0')
  const mName    = BULAN_NAMES[now.getMonth()]
  const yyyy     = now.getFullYear()
  const dateStr  = `${dd} ${mName} ${yyyy}`

  const d         = data
  const pctLunas  = d && d.totalSiswaRef > 0 ? Math.round((d.lunasRef / d.totalSiswaRef) * 100) : 0
  const pctTarget = d && d.targetIni > 0      ? Math.round((d.terkumpulIni / d.targetIni) * 100) : 0

  const diffTerkumpul  = d ? d.terkumpulIni - d.terkumpulLalu : 0
  const diffBelumBayar = d ? d.belumBayarNominal - d.belumBayarLalu : 0

  const merahInsights  = d?.insights.filter(i => i.level === 'merah') ?? []
  const amberInsights  = d?.insights.filter(i => i.level === 'amber') ?? []
  const hijauInsights  = d?.insights.filter(i => i.level === 'hijau') ?? []

  const loading = !d

  // ── Skeleton value helper ───────────────────────────────────────────────────
  const sk = (val: string) => loading ? '—' : val

  return (
    <>
    <div className="dashboard-content">

      {/* ── 1. Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: '#1A2C4E',
        borderRadius: '0 0 16px 16px',
        padding: '1.25rem 1.75rem',
        margin: '-1.5rem 0 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        boxShadow: '0 2px 8px rgba(26, 44, 78, 0.7)',
      }}>
        {/* Left */}
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
            Selamat Datang, {user?.nama ?? '—'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', flexShrink: 0, boxShadow: '0 0 6px #22C55E' }} />
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>
              {user?.jabatan ?? ''}{user?.jabatan && user?.sekolah ? ' – ' : ''}{user?.sekolah ?? ''}
            </span>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#A3CDFE', border: '1px solid #A3CDFE',
            color: '#1A2C4E', borderRadius: 10, padding: '0.45rem 0.85rem',
            fontSize: '0.8rem', fontWeight: 600,
          }}>
            <Calendar size={13} />
            {dateStr}
          </div>

          <button className="btn-export btn-export--disabled" style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', borderRadius:10 }}>
            <Download size={13} />
            Export Laporan
          </button>

          <button style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#22C55E', color: '#fff',
            border: 'none', borderRadius: 10, padding: '0.45rem 0.85rem',
            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            <Image src="/icons/IconWA.png" width={25} height={25} alt="WhatsApp" />
            Ingatkan
          </button>
        </div>
      </div>

      {/* ── 2. Card Total Tunggakan ─────────────────────────────────────────── */}
      <div style={{
        marginTop: '2rem',
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: '1rem',
        boxShadow: '2px 2px 8px 8px rgba(45, 91, 145, 0.74)',
      }}>
        {/* Body */}
        <div style={{ display: 'flex', padding: '1.5rem', gap: '1.25rem', position: 'relative' }}>
          {/* Watermark */}
          <AlertTriangle
            size={130}
            style={{ position: 'absolute', right: 400, top: '50%', transform: 'translateY(-50%)', color: '#FEE2E2', pointerEvents: 'none' }}
          />

          {/* Left */}
          <div style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              background: '#1A2C4E', color: '#ffffff',
              padding: '6px 12px', borderRadius: 20,
              fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.03em',
              marginBottom: '0.65rem',
              boxShadow: '0 6px 10px rgba(92, 135, 184, 0.67)',
            }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#D35E5E', animation: 'dot-pulse 1.6s ease-in-out infinite' }} />
              Total Tunggakan Aktif
            </div>

            <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1.5, marginBottom: '0.6rem', letterSpacing: '-0.02em', borderBottom: '5px solid #1A2C4E', paddingBottom: '0.25rem', display: 'inline-block' }}>
              {sk(rpFull(d?.totalTunggakan ?? 0))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', position: 'relative', top: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '1rem', fontWeight: 500, color: '#1A2C4E' }}>
                <Users size={16} />
                {sk(`${d?.siswaBelumBayar ?? 0} Siswa belum bayar`)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '1rem', fontWeight: 500, color: '#1A2C4E' }}>
                <Clock size={16} />
                {lastUpd ? (() => {
                  const menit = Math.floor((now.getTime() - lastUpd.getTime()) / 60_000)
                  if (menit < 1)  return 'Baru saja diperbarui'
                  if (menit <= 60) return `${menit} menit yang lalu`
                  return `Diperbarui ${lastUpd.getHours()}:${String(lastUpd.getMinutes()).padStart(2, '0')}`
                })() : 'Memuat...'}
              </span>
            </div>
          </div>

          {/* Right: % badge */}
          <div style={{
            background: '#1A2C4E',
            borderRadius: 12,
            minWidth: 138,
            textAlign: 'center',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            boxShadow: '0 6px 10px rgba(92, 135, 184, 0.67)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '12px',
              background: '#F7DD7D',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 4, fontSize: '0.9rem', position: 'relative', bottom: 13,
              marginLeft: '7rem',
            }}>
              <Image src="/icons/IconDollar.png" alt="Lunas" width={20} height={20} />
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#fff', marginTop: '-1.7rem', marginLeft: '-3.8rem' }}>
              {sk(`${pctLunas}%`)}
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F788A' }}>Siswa sudah lunas</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F788A', marginLeft: '-2rem' }}>
              {sk(`${d?.lunasRef ?? 0} dari ${d?.totalSiswaRef ?? 0} siswa`)}
            </div>
          </div>
        </div>

        {/* Bottom alert strip */}
        <div style={{
          background: '#DE6666',
          padding: '0.6rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#fff', fontSize: '1rem', fontWeight: 600 }}>
            <AlertTriangle size={16} />
            {d?.siswaTunggakanLama ? `${d.siswaTunggakanLama} Siswa memiliki tunggakan lebih dari 1 bulan` : 'Periksa status tunggakan siswa'}
          </div>
          <Link href="/tagihan/aktif" style={{
            color: '#fff', fontSize: '1rem', fontWeight: 700,
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
            opacity: 0.9, whiteSpace: 'nowrap',
          }}>
            Ingatkan sekarang <ChevronRight size={20} />
          </Link>
        </div>
      </div>

      {/* ── 3. Row 1: Stats cards ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 230px) 1fr', gap: '1.2rem', marginBottom: '1.3rem', marginTop: '2rem' }}>

        <StatCard title="Total siswa aktif" value={sk(String(d?.totalSiswaAktif ?? 0))} icon={Users} />
        <StatCard title="Kelas aktif" value={sk(String(d?.totalKelas ?? 0))} icon={BookOpen} />
        <StatCard title="Tahun ajaran aktif" value={sk((d?.tahunAjaranNama ?? '-').replace(/(\d{4})\/(\d{4})/, (_, y1, y2: string) => `${y1}/${y2.slice(2)}`))} icon={Calendar} valueStyle={{ marginLeft: '-1.8rem', marginTop: '0.2rem', fontSize: '2.2rem' }} />

        {/* Target Pembayaran */}
        <div style={{ background: '#fff', borderRadius: 13, padding: '0.6rem 1.25rem', boxShadow: '0 6px 10px rgba(92, 135, 184, 0.67)',}}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1A2C4E', letterSpacing: '0.05em', display: 'flex', alignItems: 'center' }}>
              <Image src="/icons/IconTarget.png" alt="Target" width={30} height={16} style={{ marginRight: 8 }} />
              Target Pembayaran – {mName} {yyyy}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          </div>
          <div style={{ background: '#E5E7EB', borderRadius: 6, height: 20, overflow: 'hidden', marginBottom: 5, position: 'relative' }}>
            <div style={{ background: 'linear-gradient(90deg,#6366F1,#818CF8)', height: '100%', width: `${pctTarget}%`, borderRadius: 6, transition: 'width 0.6s ease', position: 'absolute', left: 0, top: 0 }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, fontSize: '0.8rem', fontWeight: 600, color: '#1A2C4E', zIndex: 1 }}>
              {pctTarget}%
            </div>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{sk(`${d?.lunasRef ?? 0} siswa sudah lunas`)}</span>
            <span>{sk(`Tersisa ${(d?.totalSiswaRef ?? 0) - (d?.lunasRef ?? 0)}`)}</span>
          </div>
        </div>
      </div>

      {/* ── 4. Row 2: Financial cards ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>

        <FinanceCard
          title="Terkumpul bulan ini"
          value={sk(rpCompact(d?.terkumpulIni ?? 0))}
          valueColor="#69C183"
          info={
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, color: diffTerkumpul >= 0 ? '#69C183' : '#DE6666' }}>
              {diffTerkumpul >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {d && d.terkumpulLalu > 0 ? `${Math.abs(Math.round((diffTerkumpul / d.terkumpulLalu) * 100))}% siswa sudah lunas` : '—'}
            </div>
          }
          progress={pctTarget}
          progressColor="#69C183"
          progressLabel={`${pctTarget}%`}
        />

        <FinanceCard
          title="Belum dibayar"
          value={sk(rpCompact(d?.belumBayarNominal ?? 0))}
          valueColor="#DE6666"
          info={
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, color: diffBelumBayar > 0 ? '#DE6666' : '#69C183' }}>
              {diffBelumBayar > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {d && d.belumBayarLalu > 0 ? `${diffBelumBayar > 0 ? 'Naik' : 'Turun'} ${rpCompact(Math.abs(diffBelumBayar))} dari bulan lalu` : '—'}
            </div>
          }
          progress={100 - pctTarget}
          progressColor="#DE6666"
          progressLabel={`${100 - pctTarget}%`}
        />

        <FinanceCard
          title="Total beasiswa"
          value={sk(rpCompact(d?.totalBeasiswaNom ?? 0))}
          valueColor="#BB8848"
          info={d && d.penerimaBeasiswa > 0
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 700, color: '#BB8848' }}>
                <Gift size={11} />
                {d.penerimaBeasiswa} penerima aktif
              </div>
            : undefined
          }
          progress={d && d.totalTagihanNom > 0 ? Math.min(Math.round((d.totalBeasiswaNom / d.totalTagihanNom) * 100), 100) : 0}
          progressColor="#BB8848"
          progressLabel={d && d.totalTagihanNom > 0 ? `${Math.round((d.totalBeasiswaNom / d.totalTagihanNom) * 100)}%` : '—'}
          progressSub="dari total tagihan"
        />
      </div>

      {/* ── 5. Row 3: Chart cards ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <Link href="/laporan" style={{
            position: 'absolute', top: '0.6rem', right: '1rem', zIndex: 1,
            fontSize: '0.8rem', fontWeight: 600, color: '#1A2C4E',
            textDecoration: 'none', opacity: 0.65,
          }}>
            Laporan →
          </Link>
          <ChartCard title="Tren Pemasukan Bulanan" subtitle="6 bulan terakhir" style={{ flex: 1 }}>
            <div style={{ marginTop: 'auto' }}>
              {d?.trenData.length ? <BarChart data={d.trenData} /> : (
                <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '1rem' }}>Belum ada data</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10B981', flexShrink: 0 }} /> Terkumpul
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#EF4444', flexShrink: 0 }} /> Tunggakan
              </div>
            </div>
          </ChartCard>
        </div>

        <ChartCard
          title="Komposisi Pemasukan"
          subtitle={`Per komponen tagihan · ${mName}`}
        >
          {d?.komposisi.length ? (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <DonutChart items={d.komposisi} total={d.terkumpulIni} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {d.komposisi.map((item, i) => (
                  <div key={item.nama} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: KOMPOSISI_COLORS[i % KOMPOSISI_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nama}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--navy-dark)', flexShrink: 0 }}>{item.persen}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>Belum ada data</div>
          )}
        </ChartCard>

        <ChartCard
          title="Pembayaran per Kelas"
          subtitle="% siswa lunas bulan ini"
          style={{ minHeight: 320 }}
        >
          {d?.perKelas.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {d.perKelas.map((kelas, i) => {
                const pct = kelas.total > 0 ? Math.round((kelas.lunas / kelas.total) * 100) : 0
                const colors = ['#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444']
                return (
                  <div key={kelas.nama}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                        {kelas.nama.startsWith('Kelas') ? kelas.nama : `Kelas ${kelas.nama}`}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{kelas.total} siswa</span>
                    </div>
                    <div style={{ background: '#E5E7EB', borderRadius: 4, height: 7, overflow: 'hidden' }}>
                      <div style={{ background: colors[i % colors.length], height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{pct}%</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>Belum ada data kelas</div>
          )}
        </ChartCard>
      </div>

      {/* ── 6. Insights ─────────────────────────────────────────────────────── */}
      {(merahInsights.length > 0 || amberInsights.length > 0 || hijauInsights.length > 0) && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          {/* Watermark */}
          <TrendingUp size={120} style={{ position: 'absolute', right: -16, bottom: -16, color: '#F8FAFC', pointerEvents: 'none' }} />

          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Banknote size={15} color="var(--navy)" />
            Insight &amp; Notifikasi
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {merahInsights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            {amberInsights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            {hijauInsights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
          </div>
        </div>
      )}

    </div>

    {showSetupBerhasil && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '2rem 1.75rem', width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <CheckCircle2 size={38} color="#059669" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy-dark)', margin: '0 0 0.5rem', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            Setup Berhasil! 🎉
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 0.35rem', lineHeight: 1.6 }}>
            SiKu sudah siap digunakan. Semua langkah setup telah selesai.
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.75rem', lineHeight: 1.5 }}>
            Kamu bisa mulai membuat tagihan, mengelola siswa, dan memantau pembayaran dari dashboard ini.
          </p>
          <button
            onClick={() => setShowSetupBerhasil(false)}
            style={{ background: '#1A2C4E', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
          >
            Mulai Gunakan SiKu →
          </button>
        </div>
      </div>
    )}
    </>
  )
}
