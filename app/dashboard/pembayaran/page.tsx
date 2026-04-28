'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, CreditCard, Clock, Receipt, Search } from 'lucide-react'
import { MOCK_PEMBAYARAN, type Pembayaran } from '@/lib/mockData'

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n)

const METODE_CFG: Record<string, { bg:string; color:string }> = {
  Transfer: { bg:'#EFF6FF', color:'#1D4ED8' },
  QRIS:     { bg:'#F5F3FF', color:'#6D28D9' },
  Tunai:    { bg:'#F0FDF4', color:'#166534' },
}

export default function PembayaranPage() {
  const [filterBulan,  setFilterBulan]  = useState('Semua')
  const [filterMetode, setFilterMetode] = useState('Semua')
  const [search,       setSearch]       = useState('')
  const [list]                 = useState<Pembayaran[]>(MOCK_PEMBAYARAN)

  const bulanOptions = ['Semua', ...Array.from(new Set(list.map(p => p.bulan)))]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return list.filter(p =>
      (filterBulan  === 'Semua' || p.bulan   === filterBulan) &&
      (filterMetode === 'Semua' || p.metode  === filterMetode) &&
      (p.namaSiswa.toLowerCase().includes(q) || p.noResi.toLowerCase().includes(q))
    )
  }, [list, filterBulan, filterMetode, search])

  const totalMasuk    = filtered.filter(p => p.status === 'terkonfirmasi').reduce((s, p) => s + p.nominal, 0)
  const jmlTransfer   = filtered.filter(p => p.metode === 'Transfer').length
  const jmlQRIS       = filtered.filter(p => p.metode === 'QRIS').length
  const jmlTunai      = filtered.filter(p => p.metode === 'Tunai').length
  const jmlMenunggu   = filtered.filter(p => p.status === 'menunggu').length

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Riwayat Pembayaran</h1>
          <p className="dashboard-subtitle">{list.length} transaksi tercatat</p>
        </div>
        <button className="btn-export" onClick={() => alert('Export akan hadir segera!')}>
          ↓ Export PDF
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom:'1.25rem' }}>
        <div className="stat-card stat-card-success">
          <div className="stat-card-label">Total Masuk</div>
          <div className="stat-card-value" style={{ fontSize:'1.2rem' }}>{formatRp(totalMasuk)}</div>
          <div className="stat-card-sub">Transaksi terkonfirmasi</div>
          <TrendingUp className="stat-card-bg-icon" />
        </div>
        <div className="stat-card stat-card-info">
          <div className="stat-card-label">Metode Pembayaran</div>
          <div className="stat-card-value" style={{ fontSize:'1.1rem' }}>{jmlTransfer}T · {jmlQRIS}Q · {jmlTunai}C</div>
          <div className="stat-card-sub">Transfer · QRIS · Tunai</div>
          <CreditCard className="stat-card-bg-icon" />
        </div>
        <div className={`stat-card ${jmlMenunggu > 0 ? 'stat-card-warning' : ''}`}>
          <div className="stat-card-label">Menunggu Konfirmasi</div>
          <div className="stat-card-value">{jmlMenunggu}</div>
          <div className="stat-card-sub">{jmlMenunggu > 0 ? 'Perlu dikonfirmasi' : 'Semua terkonfirmasi ✓'}</div>
          <Clock className="stat-card-bg-icon" />
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Transaksi</div>
          <div className="stat-card-value">{filtered.length}</div>
          <div className="stat-card-sub">Dari semua filter aktif</div>
          <Receipt className="stat-card-bg-icon" />
        </div>
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <div className="filter-search-wrap">
          <span className="filter-search-icon"><Search size={15} /></span>
          <input className="filter-search" placeholder="Cari nama siswa atau no. resi..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
          {bulanOptions.map(b => <option key={b}>{b}</option>)}
        </select>
        <select className="filter-select" value={filterMetode} onChange={e => setFilterMetode(e.target.value)}>
          {['Semua','Transfer','QRIS','Tunai'].map(m => <option key={m}>{m}</option>)}
        </select>
        <div className="filter-count">{filtered.length} transaksi</div>
      </div>

      {/* Tabel */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th><th>No. Resi</th><th>Nama Siswa</th><th>Kelas</th>
              <th>Periode</th><th>Nominal</th><th>Metode</th>
              <th>Tanggal</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="table-empty">Tidak ada transaksi yang sesuai</td></tr>
            ) : filtered.map((p, i) => {
              const mc = METODE_CFG[p.metode]
              return (
                <tr key={p.id}>
                  <td className="td-no">{i+1}</td>
                  <td style={{ fontFamily:'monospace', fontSize:'0.72rem', color:'var(--text-muted)' }}>{p.noResi}</td>
                  <td className="td-nama">{p.namaSiswa}</td>
                  <td><span className="kelas-pill">{p.kelas}</span></td>
                  <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{p.bulan}</td>
                  <td className="td-nominal">{formatRp(p.nominal)}</td>
                  <td>
                    <span style={{ background:mc.bg, color:mc.color, fontSize:'0.7rem', fontWeight:700, padding:'3px 10px', borderRadius:20 }}>
                      {p.metode}
                    </span>
                  </td>
                  <td className="td-tanggal">{p.tanggal}</td>
                  <td>
                    {p.status === 'terkonfirmasi'
                      ? <span className="badge-lunas">Terkonfirmasi</span>
                      : <span className="badge-terlambat">Menunggu</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}