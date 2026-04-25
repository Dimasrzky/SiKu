'use client'

import { useState } from 'react'
import { MOCK_SISWA, BULAN_AKTIF, type Siswa, type StatusBayar } from '@/lib/mockData'

// ─── Opsi filter ──────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'semua',     label: 'Semua Status'  },
  { value: 'lunas',     label: 'Lunas'         },
  { value: 'belum',     label: 'Belum Bayar'   },
  { value: 'terlambat', label: 'Terlambat'     },
]

const KELAS_OPTIONS = [
  'Semua Kelas',
  'VII-A', 'VII-B', 'VII-C',
  'VIII-A', 'VIII-B', 'VIII-C',
  'IX-A', 'IX-B', 'IX-C',
]

// ─── Helper: format Rupiah ────────────────────────────────────────────
const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n)

// ─── Helper: badge status ─────────────────────────────────────────────
const STATUS_MAP: Record<StatusBayar, { cls: string; label: string }> = {
  lunas:     { cls: 'badge-lunas',     label: 'Lunas'      },
  belum:     { cls: 'badge-belum',     label: 'Belum Bayar' },
  terlambat: { cls: 'badge-terlambat', label: 'Terlambat'  },
}

// ─── Komponen utama ───────────────────────────────────────────────────
export default function DashboardPage() {
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')
  const [kelasFilter,  setKelasFilter]  = useState('Semua Kelas')

  // Kalkulasi stats dari mock data
  const totalSiswa      = MOCK_SISWA.length
  const jumlahLunas     = MOCK_SISWA.filter((s) => s.status === 'lunas').length
  const jumlahBelum     = MOCK_SISWA.filter((s) => s.status === 'belum').length
  const jumlahTerlambat = MOCK_SISWA.filter((s) => s.status === 'terlambat').length
  const totalPemasukan  = MOCK_SISWA
    .filter((s) => s.status === 'lunas')
    .reduce((sum, s) => sum + s.nominal, 0)

  // Filter data berdasarkan search + status + kelas
  const q = search.toLowerCase()
  const filtered = MOCK_SISWA.filter((s) => {
    const matchSearch =
      s.nama.toLowerCase().includes(q) || s.nis.includes(search)
    const matchStatus =
      statusFilter === 'semua' || s.status === statusFilter
    const matchKelas =
      kelasFilter === 'Semua Kelas' || s.kelas === kelasFilter
    return matchSearch && matchStatus && matchKelas
  })

  // Buka WA dengan pesan reminder otomatis
  const sendWAReminder = (nama: string, noWa: string, nominal: number) => {
    const pesan = encodeURIComponent(
      `Yth. Wali murid ${nama},\n\n` +
      `Kami mengingatkan bahwa tagihan SPP bulan *${BULAN_AKTIF}* ` +
      `sebesar *${formatRp(nominal)}* belum kami terima.\n\n` +
      `Mohon segera melakukan pembayaran. Terima kasih atas kerjasamanya.\n\n` +
      `_Bendahara SDIT Al-Hikmah Yogyakarta_`
    )
    window.open(`https://wa.me/${noWa}?text=${pesan}`, '_blank')
  }

  const persenLunas = Math.round((jumlahLunas / totalSiswa) * 100)

  return (
    <div className="dashboard-content">

      {/* ─── HEADER ─────────────────────────────────── */}
      <div className="dashboard-header">
        <div>
          <div className="dashboard-greeting">Selamat datang kembali 👋</div>
          <h1 className="dashboard-title">Rekap SPP Bulanan</h1>
          <p className="dashboard-subtitle">Periode: {BULAN_AKTIF}</p>
        </div>
        <button
          className="btn-export"
          onClick={() => alert('Fitur export Excel akan hadir segera!')}
        >
          ↓ Export Excel
        </button>
      </div>

      {/* ─── STATS CARDS ────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Siswa</div>
          <div className="stat-card-value">{totalSiswa}</div>
          <div className="stat-card-sub">Terdaftar aktif</div>
        </div>

        <div className="stat-card stat-card-success">
          <div className="stat-card-label">Sudah Lunas</div>
          <div className="stat-card-value">{jumlahLunas}</div>
          <div className="stat-card-sub">{persenLunas}% dari total siswa</div>
        </div>

        <div className="stat-card stat-card-warning">
          <div className="stat-card-label">Belum Bayar</div>
          <div className="stat-card-value">{jumlahBelum + jumlahTerlambat}</div>
          <div className="stat-card-sub">
            {jumlahBelum} menunggu · {jumlahTerlambat} terlambat
          </div>
        </div>

        <div className="stat-card stat-card-info">
          <div className="stat-card-label">Total Pemasukan</div>
          <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>
            {formatRp(totalPemasukan)}
          </div>
          <div className="stat-card-sub">Bulan {BULAN_AKTIF}</div>
        </div>
      </div>

      {/* ─── PROGRESS BAR ───────────────────────────── */}
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Progress pelunasan
        </span>
        <div
          style={{
            flex: 1,
            height: 8,
            background: '#F1F5F9',
            borderRadius: 100,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${persenLunas}%`,
              height: '100%',
              background: 'var(--emerald)',
              borderRadius: 100,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: 'var(--emerald)',
            whiteSpace: 'nowrap',
          }}
        >
          {persenLunas}%
        </span>
      </div>

      {/* ─── FILTER BAR ─────────────────────────────── */}
      <div className="filter-bar">
        <input
          type="text"
          className="filter-search"
          placeholder="🔍  Cari nama siswa atau NIS..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={kelasFilter}
          onChange={(e) => setKelasFilter(e.target.value)}
        >
          {KELAS_OPTIONS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <div className="filter-count">
          {filtered.length} siswa ditemukan
        </div>
      </div>

      {/* ─── DATA TABLE ─────────────────────────────── */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>NIS</th>
              <th>Nama Siswa</th>
              <th>Kelas</th>
              <th>Nominal SPP</th>
              <th>Status</th>
              <th>Tgl Bayar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  Tidak ada siswa yang sesuai dengan filter
                </td>
              </tr>
            ) : (
              filtered.map((siswa: Siswa, idx: number) => {
                const badge = STATUS_MAP[siswa.status]
                return (
                  <tr key={siswa.id}>
                    <td className="td-no">{idx + 1}</td>
                    <td className="td-nis">{siswa.nis}</td>
                    <td className="td-nama">{siswa.nama}</td>
                    <td>
                      <span className="kelas-pill">{siswa.kelas}</span>
                    </td>
                    <td className="td-nominal">{formatRp(siswa.nominal)}</td>
                    <td>
                      <span className={badge.cls}>{badge.label}</span>
                    </td>
                    <td className="td-tanggal">
                      {siswa.tanggalBayar ?? '—'}
                    </td>
                    <td>
                      {siswa.status !== 'lunas' ? (
                        <button
                          className="btn-wa"
                          onClick={() =>
                            sendWAReminder(
                              siswa.nama,
                              siswa.noWa,
                              siswa.nominal
                            )
                          }
                        >
                          💬 WA Reminder
                        </button>
                      ) : (
                        <span className="td-done">✓ Lunas</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div
        style={{
          marginTop: '1rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          gap: '1.5rem',
        }}
      >
        <span>📌 Data ini adalah data demo (mockup)</span>
        <span>🔔 Tombol WA Reminder membuka WhatsApp dengan pesan otomatis</span>
      </div>

    </div>
  )
}