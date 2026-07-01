'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { BarChart2, Database, TrendingUp, PieChart, AlertTriangle, ChevronDown, Download, Receipt, Users, GraduationCap, FileSpreadsheet, FileText } from 'lucide-react'

// ── Mock Data ─────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { label: 'Bulan ini',    sublabel: 'Jun 2026',  value: 'bulan-ini'  },
  { label: 'Bulan lalu',   sublabel: 'Mei 2026',  value: 'bulan-lalu' },
  { label: 'Semester 1',   sublabel: '2025/2026', value: 'sem1-2526'  },
  { label: 'Semester 2',   sublabel: '2025/2026', value: 'sem2-2526'  },
  { label: 'Tahun ajaran', sublabel: '2025/2026', value: 'ta-2526'    },
  { label: 'Tahun ajaran', sublabel: '2024/2025', value: 'ta-2425'    },
]

const MONTHLY_DATA = [
  { bulan: 'Jan', nominal: 97_000_000  },
  { bulan: 'Feb', nominal: 120_000_000 },
  { bulan: 'Mar', nominal: 450_000_000 },
  { bulan: 'Apr', nominal: 50_000_000  },
  { bulan: 'Mei', nominal: 50_000_000  },
  { bulan: 'Jun', nominal: 50_000_000  },
]

const STATUS_DATA = [
  { label: 'Lunas',       value: 310, color: '#22C55E' },
  { label: 'Cicilan',     value: 50,  color: '#3B82F6' },
  { label: 'Belum bayar', value: 20,  color: '#F59E0B' },
  { label: 'Menunggak',   value: 20,  color: '#EF4444' },
]

const TOTAL_SISWA = 455

const JENJANG_DATA = [
  { jenjang: 'Jenjang 7', pct: 96 },
  { jenjang: 'Jenjang 8', pct: 87 },
  { jenjang: 'Jenjang 9', pct: 43 },
]

const KOMPONEN_DATA = [
  { kode: 'UG',  nama: 'Uang Gedung', jumlah: 68, total: 36_400_000 },
  { kode: 'SPP', nama: 'SPP',         jumlah: 46, total: 36_400_000 },
  { kode: 'SR',  nama: 'Seragam',     jumlah: 23, total: 36_400_000 },
  { kode: 'CT',  nama: 'Catering',    jumlah: 18, total: 36_400_000 },
  { kode: 'EK',  nama: 'Ekstrakurikuler', jumlah: 12, total: 18_000_000 },
  { kode: 'BP',  nama: 'Buku Paket',  jumlah: 9,  total: 13_500_000 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({ data }: { data: typeof MONTHLY_DATA }) {
  const max    = Math.max(...data.map(d => d.nominal))
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
          <g key={d.bulan}>
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

function DonutChart({ data, totalSiswa }: { data: typeof STATUS_DATA; totalSiswa: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
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
        <text x={C} y={C - 4}  textAnchor="middle" fontSize={20} fontWeight={800} fill="#0F172A">{totalSiswa}</text>
        <text x={C} y={C + 10} textAnchor="middle" fontSize={8.5} fill="#94A3B8">Siswa</text>
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
  const hasData = true // mock: ubah ke false untuk lihat empty state
  const [selectedFilter, setSelectedFilter] = useState(FILTER_OPTIONS[0])
  const [showDropdown,   setShowDropdown]   = useState(false)
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

        {hasData && (
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
                  {FILTER_OPTIONS.map(opt => {
                    const isActive = selectedFilter.value === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { setSelectedFilter(opt); setShowDropdown(false) }}
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
            <button style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              <Download size={20} /> Generate Laporan Utama
            </button>
          </div>
        )}
      </div>

      {/* ── Empty State ── */}
      {!hasData && (
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
      {hasData && (
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
                  Rp 120.000.000
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6F788A' }}>Dari 87 transaksi</div>
              </div>

              {/* Tingkat Pelunasan */}
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#6F788A' }}>Tingkat pelunasan</span>
                  <div style={{ width: 32, height: 32, background: '#EFF6FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PieChart size={16} color="#3B82F6" />
                  </div>
                </div>
                <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: '0.75rem' }}>78%</div>
                <div style={{ height: 18, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden', marginBottom: '0.5rem' }}>
                  <div style={{ height: '100%', width: '78%', background: '#69C183', borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: '0.76rem', color: '#6F788A' }}>Rp 124,5jt dari 159,5jt</div>
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
                  Rp 35.000.000
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Belum jatuh tempo</span>
                    </div>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0F172A' }}>Rp 23jt</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Menunggak</span>
                    </div>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#EF4444' }}>Rp 12jt</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Donut + Bar chart */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '0.9rem' }}>
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#6F788A', marginBottom: 4 }}>Komposisi status pembayaran</div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '1.25rem' }}>Distribusi per status tagihan siswa</div>
                <DonutChart data={STATUS_DATA} totalSiswa={TOTAL_SISWA} />
              </div>
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#6F788A', marginBottom: 4 }}>Tren pemasukan per bulan</div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '1rem' }}>6 bulan terakhir</div>
                <BarChart data={MONTHLY_DATA} />
              </div>
            </div>

            {/* Row 3: Pelunasan per jenjang + Komponen belum dibayar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#6F788A', marginBottom: 4 }}>Pelunasan per jenjang</div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '1.25rem' }}>Persentase tagihan lunas per tingkat kelas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  {JENJANG_DATA.map(j => {
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
              </div>
              <div style={{ background: '#ffffff', borderRadius: 12, padding: '1.1rem', boxShadow: '0 0 18px #5a88b8cf' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#6F788A', marginBottom: 4 }}>Komponen paling banyak belum dibayar</div>
                <div style={{ fontSize: '0.75rem', color: '#6F788A', marginBottom: '1rem' }}>Berdasarkan jumlah siswa yang belum membayar</div>
                <div>
                  {[...KOMPONEN_DATA].sort((a, b) => b.jumlah - a.jumlah).slice(0, 4).map((k, i) => {
                    const amountColor = i === 0 ? '#EF4444' : i === 1 ? '#D97706' : '#94A3B8'
                    const badgeBg     = i === 0 ? '#FEF2F2' : i === 1 ? '#FFFBEB' : '#F1F5F9'
                    const badgeColor  = i === 0 ? '#EF4444' : i === 1 ? '#D97706' : '#64748B'
                    return (
                      <div key={k.kode} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 0', borderBottom: i < 3 ? '1px solid #E2E8F0' : 'none' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: badgeColor, letterSpacing: '-0.3px' }}>{k.kode}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{k.nama}</div>
                          <div style={{ fontSize: '0.73rem', color: '#6F788A' }}>{k.jumlah} siswa belum bayar</div>
                        </div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: amountColor, flexShrink: 0 }}>
                          {fmt(k.total)}
                        </span>
                      </div>
                    )
                  })}
                </div>
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
                  <button style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: '#F5C518', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#1A1A1A', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <FileSpreadsheet size={13} color="#1A1A1A" /> Excel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  )
}
