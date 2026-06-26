'use client'

import { useState, useMemo } from 'react'
import {
  TrendingUp, Banknote, Users, AlertCircle,
  CheckCircle2, Clock, Download, ChevronDown, FileText, BookOpen,
} from 'lucide-react'

// ── Mock Data ─────────────────────────────────────────────────────────────────

const BULAN_OPTS = ['Januari 2026', 'Februari 2026', 'Maret 2026', 'April 2026', 'Mei 2026', 'Juni 2026']
const TA_OPTS    = ['2025/2026', '2024/2025', '2023/2024']

const MONTHLY_DATA = [
  { bulan: 'Jan', nominal: 52_000_000, txCount: 127 },
  { bulan: 'Feb', nominal: 48_500_000, txCount: 118 },
  { bulan: 'Mar', nominal: 61_200_000, txCount: 149 },
  { bulan: 'Apr', nominal: 55_800_000, txCount: 135 },
  { bulan: 'Mei', nominal: 49_000_000, txCount: 120 },
  { bulan: 'Jun', nominal: 48_500_000, txCount: 115 },
]

const STATUS_DATA = [
  { label: 'Lunas',    value: 72, color: '#22C55E' },
  { label: 'Sebagian', value: 18, color: '#F59E0B' },
  { label: 'Belum',    value: 10, color: '#EF4444' },
]

const RECENT_PAYMENTS = [
  { id: '1', nama: 'Aisyah Putri Rahmawati',  kelas: '10-A', nominal: 1_500_000, tanggal: '25 Jun 2026', metode: 'Transfer', status: 'lunas'   },
  { id: '2', nama: 'Budi Santoso',             kelas: '11-B', nominal:   750_000, tanggal: '25 Jun 2026', metode: 'Cash',     status: 'lunas'   },
  { id: '3', nama: 'Citra Dewi Lestari',       kelas: '12-C', nominal:   500_000, tanggal: '24 Jun 2026', metode: 'Transfer', status: 'cicilan' },
  { id: '4', nama: 'Dimas Rizky Pratama',      kelas: '10-B', nominal: 2_000_000, tanggal: '24 Jun 2026', metode: 'QRIS',     status: 'lunas'   },
  { id: '5', nama: 'Ervina Maharani',          kelas: '11-A', nominal: 1_250_000, tanggal: '23 Jun 2026', metode: 'Transfer', status: 'lunas'   },
  { id: '6', nama: 'Fajar Nugroho Wibowo',     kelas: '12-A', nominal:   300_000, tanggal: '23 Jun 2026', metode: 'Cash',     status: 'cicilan' },
  { id: '7', nama: 'Gita Permatasari',         kelas: '10-C', nominal: 1_750_000, tanggal: '22 Jun 2026', metode: 'Transfer', status: 'lunas'   },
]

const KELAS_TUNGGAKAN = [
  { kelas: '10-A', jumlahSiswa: 32, menunggak: 3,  totalTunggakan: 4_500_000 },
  { kelas: '11-B', jumlahSiswa: 30, menunggak: 5,  totalTunggakan: 7_250_000 },
  { kelas: '12-C', jumlahSiswa: 28, menunggak: 8,  totalTunggakan: 9_600_000 },
  { kelas: '10-B', jumlahSiswa: 31, menunggak: 2,  totalTunggakan: 3_000_000 },
  { kelas: '11-A', jumlahSiswa: 29, menunggak: 4,  totalTunggakan: 6_000_000 },
]

const TABS = [
  { id: 'keuangan', label: 'Keuangan',  icon: <Banknote  size={14} /> },
  { id: 'siswa',    label: 'Siswa',     icon: <Users     size={14} /> },
  { id: 'tagihan',  label: 'Tagihan',   icon: <FileText  size={14} /> },
  { id: 'kelas',    label: 'Per Kelas', icon: <BookOpen  size={14} /> },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────

function BarChart({ data }: { data: typeof MONTHLY_DATA }) {
  const max   = Math.max(...data.map(d => d.nominal))
  const W     = 560
  const H     = 180
  const PX    = 30
  const PY    = 16
  const BOT   = 28
  const barW  = (W - PX * 2) / data.length
  const innerH = H - PY - BOT

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = PY + innerH * (1 - t)
        return (
          <g key={t}>
            <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="#F1F5F9" strokeWidth={1} />
            <text x={PX - 5} y={y + 3.5} textAnchor="end" fontSize={8} fill="#94A3B8">
              {t === 0 ? '0' : `${Math.round((max * t) / 1_000_000)}jt`}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const pct    = d.nominal / max
        const barH   = innerH * pct
        const x      = PX + i * barW + barW * 0.18
        const bW     = barW * 0.64
        const y      = PY + innerH - barH
        const isLast = i === data.length - 1
        return (
          <g key={d.bulan}>
            <rect x={x} y={y} width={bW} height={barH} rx={5} fill={isLast ? '#1A2C4E' : '#93C5FD'} />
            <text x={x + bW / 2} y={y - 4} textAnchor="middle" fontSize={7.5} fill={isLast ? '#1A2C4E' : '#64748B'} fontWeight={isLast ? 700 : 500}>
              {Math.round(d.nominal / 1_000_000)}jt
            </text>
            <text x={x + bW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#64748B" fontWeight={isLast ? 700 : 400}>
              {d.bulan}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── SVG Donut Chart ───────────────────────────────────────────────────────────

function DonutChart({ data }: { data: typeof STATUS_DATA }) {
  const SIZE   = 160
  const R      = 60
  const STROKE = 28
  const C      = SIZE / 2
  const CIRC   = 2 * Math.PI * R

  const slices = data.reduce<{ label: string; value: number; color: string; dash: number; gap: number; offset: number }[]>((acc, d) => {
    const dash   = (d.value / 100) * CIRC
    const gap    = CIRC - dash
    const offset = acc.reduce((sum, s) => sum + s.dash, 0)
    return [...acc, { ...d, dash, gap, offset }]
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', justifyContent: 'center' }}>
      <svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
        {slices.map(s => (
          <circle
            key={s.label}
            cx={C} cy={C} r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={STROKE}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${C}px ${C}px` }}
          />
        ))}
        <text x={C} y={C - 6}  textAnchor="middle" fontSize={22} fontWeight={800} fill="#0F172A">72%</text>
        <text x={C} y={C + 10} textAnchor="middle" fontSize={9}  fill="#94A3B8">Lunas</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {data.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>{d.label}</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', marginLeft: 'auto' }}>{d.value}%</span>
          </div>
        ))}
        <div style={{ height: 1, background: '#F1F5F9', margin: '0.15rem 0' }} />
        <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>dari 450 tagihan</div>
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    lunas:   { bg: '#F0FDF4', color: '#15803D', label: 'Lunas'   },
    cicilan: { bg: '#FFFBEB', color: '#B45309', label: 'Cicilan' },
    belum:   { bg: '#FEF2F2', color: '#DC2626', label: 'Belum'   },
  }
  const s = map[status] ?? map['belum']
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: 20 }}>
      {s.label}
    </span>
  )
}

// ── Select ────────────────────────────────────────────────────────────────────

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ appearance: 'none', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '0.5rem 2rem 0.5rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, color: '#374151', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={13} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94A3B8' }} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LaporanPage() {
  const [activeTab,   setActiveTab]   = useState('keuangan')
  const [periode,     setPeriode]     = useState('Juni 2026')
  const [tahunAjaran, setTahunAjaran] = useState('2025/2026')

  const activeMonth = useMemo(
    () => MONTHLY_DATA.find(m => periode.startsWith(
      ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
        .indexOf(periode.split(' ')[0]) === MONTHLY_DATA.indexOf(MONTHLY_DATA.find(x => x.bulan === periode.slice(0, 3)) ?? MONTHLY_DATA[0])
        ? m.bulan : ''
    )) ?? MONTHLY_DATA[5],
    [periode]
  )

  return (
    <div className="dashboard-content">

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18,47,102,0.31)' }}>
              <TrendingUp size={30} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>
                Laporan
              </h1>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                Ringkasan data keuangan dan akademik sekolah
              </p>
            </div>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Download size={14} /> Ekspor Laporan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: '#F8FAFC', borderRadius: 10, padding: '0.3rem', marginBottom: '1.25rem', width: 'fit-content', border: '1.5px solid #F1F5F9' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.45rem 0.875rem', borderRadius: 8, border: 'none',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
              fontFamily: 'inherit', transition: 'all 0.15s',
              background:  activeTab === tab.id ? '#1A2C4E' : 'transparent',
              color:       activeTab === tab.id ? '#fff'    : '#64748B',
              boxShadow:   activeTab === tab.id ? '0 2px 8px rgba(26,44,78,0.3)' : 'none',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Select value={tahunAjaran} onChange={setTahunAjaran} options={TA_OPTS} />
        <Select value={periode}     onChange={setPeriode}     options={BULAN_OPTS} />
      </div>

      {/* ── Tab Keuangan ── */}
      {activeTab === 'keuangan' && (
        <>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem', marginBottom: '1.25rem' }}>
            {([
              {
                icon:  <Banknote      size={18} color="#2563EB" />, bg: '#EFF6FF',
                label: 'Pemasukan Bulan Ini',
                value: fmt(activeMonth.nominal),
                sub:   `${activeMonth.txCount} transaksi`, trend: '+8%', up: true,
              },
              {
                icon:  <CheckCircle2  size={18} color="#059669" />, bg: '#F0FDF4',
                label: 'Total Lunas',
                value: fmt(324_750_000),
                sub:   '324 dari 450 tagihan', trend: '+5%', up: true,
              },
              {
                icon:  <AlertCircle   size={18} color="#DC2626" />, bg: '#FEF2F2',
                label: 'Total Tunggakan',
                value: fmt(30_450_000),
                sub:   '45 siswa menunggak', trend: '-12%', up: false,
              },
              {
                icon:  <TrendingUp    size={18} color="#D97706" />, bg: '#FFFBEB',
                label: 'Realisasi Tagihan',
                value: '72%',
                sub:   'dari target Rp 424,5jt', trend: '+3%', up: true,
              },
            ] as const).map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #F1F5F9', padding: '1rem 1.1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                  <div style={{ width: 36, height: 36, background: s.bg, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.icon}
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: s.up ? '#059669' : '#DC2626', background: s.up ? '#F0FDF4' : '#FEF2F2', padding: '0.15rem 0.5rem', borderRadius: 20 }}>
                    {s.trend}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600, marginBottom: '0.2rem' }}>{s.label}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.2rem' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '0.875rem', marginBottom: '1.25rem', alignItems: 'start' }}>

            {/* Bar chart */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #F1F5F9', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>Pemasukan per Bulan</div>
                  <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: 2 }}>Tahun ajaran {tahunAjaran} — semester ganjil</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', fontSize: '0.72rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#93C5FD' }} /><span style={{ color: '#94A3B8' }}>Bulan lalu</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: '#1A2C4E' }} /><span style={{ color: '#94A3B8' }}>Bulan ini</span></div>
                </div>
              </div>
              <BarChart data={MONTHLY_DATA} />
            </div>

            {/* Donut chart */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #F1F5F9', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A', marginBottom: 4 }}>Status Tagihan</div>
              <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginBottom: '1.25rem' }}>Distribusi per status pembayaran</div>
              <DonutChart data={STATUS_DATA} />
              <div style={{ height: 1, background: '#F1F5F9', margin: '1.25rem 0' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { label: 'Total tagihan', value: '450' },
                  { label: 'Sudah lunas',   value: '324' },
                  { label: 'Cicilan',       value: '81'  },
                  { label: 'Belum bayar',   value: '45'  },
                ].map(s => (
                  <div key={s.label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '0.5rem 0.625rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginBottom: 1 }}>{s.label}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabel pembayaran terbaru */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #F1F5F9', padding: '1.25rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>Pembayaran Terbaru</div>
                <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: 2 }}>7 transaksi terakhir</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #F1F5F9' }}>
                    {['Siswa', 'Kelas', 'Nominal', 'Tanggal', 'Metode', 'Status'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#94A3B8', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECENT_PAYMENTS.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: i < RECENT_PAYMENTS.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                      <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: '#0F172A' }}>{p.nama}</td>
                      <td style={{ padding: '0.625rem 0.75rem' }}>
                        <span style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 20 }}>{p.kelas}</span>
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: '#059669' }}>{fmt(p.nominal)}</td>
                      <td style={{ padding: '0.625rem 0.75rem', color: '#64748B' }}>{p.tanggal}</td>
                      <td style={{ padding: '0.625rem 0.75rem', color: '#64748B' }}>{p.metode}</td>
                      <td style={{ padding: '0.625rem 0.75rem' }}><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tunggakan per kelas */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #F1F5F9', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A', marginBottom: 4 }}>Tunggakan per Kelas</div>
            <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginBottom: '1rem' }}>Kelas dengan jumlah tunggakan terbanyak</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[...KELAS_TUNGGAKAN].sort((a, b) => b.totalTunggakan - a.totalTunggakan).map((k, i) => {
                const pct = Math.round((k.menunggak / k.jumlahSiswa) * 100)
                return (
                  <div key={k.kelas} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.625rem 0', borderBottom: i < KELAS_TUNGGAKAN.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: i === 0 ? '#1A2C4E' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: i === 0 ? '#fff' : '#64748B' }}>{i + 1}</span>
                    </div>
                    <span style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: 20, flexShrink: 0 }}>{k.kelas}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{k.menunggak} dari {k.jumlahSiswa} siswa</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct > 20 ? '#EF4444' : '#F59E0B', borderRadius: 99 }} />
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0F172A', flexShrink: 0 }}>{fmt(k.totalTunggakan)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Tab lainnya: placeholder */}
      {activeTab !== 'keuangan' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #F1F5F9', padding: '4rem 2rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 56, height: 56, background: '#F8FAFC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Clock size={26} strokeWidth={1.3} color="#94A3B8" />
          </div>
          <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '0.4rem' }}>
            Laporan {TABS.find(t => t.id === activeTab)?.label} segera hadir
          </div>
          <div style={{ fontSize: '0.875rem', color: '#94A3B8' }}>Fitur ini sedang dalam pengembangan.</div>
        </div>
      )}

    </div>
  )
}
