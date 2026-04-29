'use client'

import { useState } from 'react'
import { Users, CheckCircle, Clock, TrendingUp, ClipboardCheck, Search,AlertCircle } from 'lucide-react'
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
          <div className="dashboard-greeting">Selamat datang kembali</div>
          <h1 className="dashboard-title">Rekap Bulanan</h1>
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
          <Users className="stat-card-bg-icon" />
        </div>

        <div className="stat-card stat-card-success">
          <div className="stat-card-label">Sudah Lunas</div>
          <div className="stat-card-value">{jumlahLunas}</div>
          <div className="stat-card-sub">{persenLunas}% dari total siswa</div>
          <CheckCircle className="stat-card-bg-icon" />
        </div>

        <div className="stat-card stat-card-warning">
          <div className="stat-card-label">Belum Bayar</div>
          <div className="stat-card-value">{jumlahBelum + jumlahTerlambat}</div>
          <div className="stat-card-sub">
            {jumlahBelum} menunggu · {jumlahTerlambat} terlambat
          </div>
          <Clock className="stat-card-bg-icon" />
        </div>

        <div className="stat-card stat-card-info">
          <div className="stat-card-label">Total Pemasukan</div>
          <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>
            {formatRp(totalPemasukan)}
          </div>
          <div className="stat-card-sub">Bulan {BULAN_AKTIF}</div>
          <TrendingUp className="stat-card-bg-icon" />
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
        <div className="filter-search-wrap">
          <span className="filter-search-icon"><Search size={15} /></span>
          <input
            type="text"
            className="filter-search"
            placeholder="Cari nama siswa atau NIS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
              <th>Nominal</th>
              <th>Status</th>
              <th>Tanggal Bayar</th>
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
                      {siswa.status !== 'lunas' && siswa.status !== 'terlambat' ? (
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
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink:0 }}>
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Reminder
                        </button>
                      ) : (
                        <span className="td-done"><ClipboardCheck size={15} /></span>
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
          fontSize: '1rem',
          color: 'var(--text-muted)',
          display: 'flex',
          gap: '1.5rem',
        }}
      >
        <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><AlertCircle size={15} color='var(--text-muted)' /> Data ini adalah data demo</span>
      </div>

    </div>
  )
}