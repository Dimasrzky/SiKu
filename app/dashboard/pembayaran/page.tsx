'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, CreditCard, Receipt, Search, Landmark, Plus, X, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { MOCK_PEMBAYARAN, MOCK_USER, type Pembayaran } from '@/lib/mockData'

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n)

const METODE_CFG: Record<string, { bg:string; color:string }> = {
  Transfer: { bg:'#EFF6FF', color:'#1D4ED8' },
  Tunai:    { bg:'#F0FDF4', color:'#166534' },
}

interface Rekening {
  id: string; bank: string; noRek: string; atasNama: string
  jenis: 'Transfer' | 'Tunai'; aktif: boolean
}

const BANK_COLOR: Record<string, { bg: string; color: string }> = {
  Transfer: { bg: '#EFF6FF', color: '#1D4ED8' },
  Tunai:    { bg: '#F0FDF4', color: '#166534' },
}

const INIT_REKENING: Rekening[] = [
  { id:'1', bank:'Bank BCA',    noRek:'1234567890', atasNama:'SDIT Al-Hikmah Yogyakarta', jenis:'Transfer', aktif:true  },
  { id:'2', bank:'Bank Mandiri',noRek:'9876543210', atasNama:'SDIT Al-Hikmah Yogyakarta', jenis:'Transfer', aktif:true  },
]

export default function PembayaranPage() {
  const [filterBulan,  setFilterBulan]  = useState('Semua')
  const [filterMetode, setFilterMetode] = useState('Semua')
  const [search,       setSearch]       = useState('')
  const [list]                          = useState<Pembayaran[]>(MOCK_PEMBAYARAN)
  const [rekeningList, setRekeningList] = useState<Rekening[]>(INIT_REKENING)
  const [showRekening, setShowRekening] = useState(false)
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [formRek, setFormRek] = useState({ bank:'', noRek:'', atasNama:'', jenis:'Transfer' as Rekening['jenis'] })

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
  const jmlTunai      = filtered.filter(p => p.metode === 'Tunai').length

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const now = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })

    // Header
    doc.setFillColor(15, 30, 68)
    doc.rect(0, 0, W, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Riwayat Pembayaran', 14, 10)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(MOCK_USER.sekolah, 14, 16)
    doc.setFontSize(7.5)
    doc.text(`Dicetak: ${now}`, W - 14, 10, { align: 'right' })
    if (filterBulan !== 'Semua') doc.text(`Periode: ${filterBulan}`, W - 14, 16, { align: 'right' })

    // Stats row — background
    doc.setFillColor(239, 246, 255)
    doc.rect(0, 22, W, 18, 'F')

    // Total Masuk highlight block (kolom pertama)
    const stats = [
      { label: 'Total Masuk', value: formatRp(totalMasuk) },
      { label: 'Transfer', value: `${jmlTransfer} transaksi` },
      { label: 'Tunai', value: `${jmlTunai} transaksi` },
      { label: 'Total Transaksi', value: `${filtered.length}` },
    ]
    const colW = W / stats.length
    doc.setFillColor(22, 101, 52)
    doc.rect(0, 22, colW, 18, 'F')

    stats.forEach((s, i) => {
      const x = i * colW + colW / 2
      const isHighlight = i === 0
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(isHighlight ? 187 : 71, isHighlight ? 247 : 85, isHighlight ? 208 : 105)
      doc.text(s.label, x, 28, { align: 'center' })
      doc.setFontSize(isHighlight ? 10 : 9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(isHighlight ? 255 : 15, isHighlight ? 255 : 30, isHighlight ? 255 : 68)
      doc.text(s.value, x, 35, { align: 'center' })
    })

    // Table
    autoTable(doc, {
      startY: 44,
      head: [['No', 'No. Resi', 'Nama Siswa', 'Kelas', 'Periode', 'Nominal', 'Metode', 'Tanggal', 'Status']],
      body: filtered.map((p, i) => [
        i + 1,
        p.noResi,
        p.namaSiswa,
        p.kelas,
        p.bulan,
        formatRp(p.nominal),
        p.metode,
        p.tanggal,
        p.status === 'terkonfirmasi' ? 'Terkonfirmasi' : 'Menunggu',
      ]),
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], halign: 'center' },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 32, font: 'courier' },
        3: { cellWidth: 14 },
        5: { cellWidth: 30 },
        6: { cellWidth: 18 },
        7: { cellWidth: 22 },
        8: { cellWidth: 26 },
      },
      didParseCell: (data) => {
        if (data.column.index === 8 && data.section === 'body') {
          const val = data.cell.raw as string
          if (val === 'Terkonfirmasi') {
            data.cell.styles.textColor = [22, 101, 52]
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = [146, 64, 14]
            data.cell.styles.fontStyle = 'bold'
          }
        }
        if (data.column.index === 6 && data.section === 'body') {
          const val = data.cell.raw as string
          if (val === 'Transfer') data.cell.styles.textColor = [29, 78, 216]
          else data.cell.styles.textColor = [22, 101, 52]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: 14, right: 14 },
    })

    // Footer
    const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      const y = doc.internal.pageSize.getHeight() - 6
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(148, 163, 184)
      doc.text(`${MOCK_USER.sekolah} — Dokumen ini dicetak otomatis oleh sistem SiKu`, 14, y)
      doc.text(`Hal ${i} / ${pageCount}`, W - 14, y, { align: 'right' })
    }

    const period = filterBulan !== 'Semua' ? ` - ${filterBulan}` : ''
    doc.save(`Riwayat Pembayaran${period} - ${MOCK_USER.sekolah}.pdf`)
  }

  const addRekening = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRek.bank || !formRek.atasNama) return
    setRekeningList(prev => [...prev, { ...formRek, id: Date.now().toString(), aktif: true }])
    setFormRek({ bank: '', noRek: '', atasNama: '', jenis: 'Transfer' })
    setShowAddForm(false)
  }

  const toggleAktif = (id: string) =>
    setRekeningList(prev => prev.map(r => r.id === id ? { ...r, aktif: !r.aktif } : r))

  const deleteRekening = (id: string) =>
    setRekeningList(prev => prev.filter(r => r.id !== id))

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Riwayat Pembayaran</h1>
          <p className="dashboard-subtitle">{list.length} transaksi tercatat</p>
        </div>
        <button className="btn-export btn-export--danger" onClick={exportPDF}>
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
          <div className="stat-card-value" style={{ fontSize:'1.1rem' }}>{jmlTransfer}T · {jmlTunai}C</div>
          <div className="stat-card-sub">Transfer · Tunai</div>
          <CreditCard className="stat-card-bg-icon" />
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Transaksi</div>
          <div className="stat-card-value">{filtered.length}</div>
          <div className="stat-card-sub">Dari semua filter aktif</div>
          <Receipt className="stat-card-bg-icon" />
        </div>
        <div
          className="stat-card"
          onClick={() => setShowRekening(true)}
          style={{ cursor:'pointer', borderColor:'var(--navy)', outline:'none' }}
          title="Lihat detail rekening"
        >
          <div className="stat-card-label">Kartu Rekening</div>
          <div className="stat-card-value">{rekeningList.length}</div>
          <div className="stat-card-sub">{rekeningList.filter(r=>r.aktif).length} aktif · klik untuk detail</div>
          <Landmark className="stat-card-bg-icon" />
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
          {['Semua','Transfer','Tunai'].map(m => <option key={m}>{m}</option>)}
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

      {/* Modal Kartu Rekening */}
      {showRekening && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
          onClick={() => { setShowRekening(false); setShowAddForm(false) }}
        >
          <div
            style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:'1px solid #E2E8F0' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Landmark size={20} color="var(--navy)" />
                <span style={{ fontWeight:700, fontSize:'1rem', color:'var(--navy)' }}>Kartu Rekening</span>
              </div>
              <button
                onClick={() => { setShowRekening(false); setShowAddForm(false) }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}
              ><X size={20} /></button>
            </div>

            {/* Rekening list */}
            <div style={{ padding:'1rem 1.5rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {rekeningList.map(r => {
                const cfg = BANK_COLOR[r.jenis]
                return (
                  <div key={r.id} style={{ border:'1.5px solid #E2E8F0', borderRadius:12, padding:'0.875rem 1rem', display:'flex', alignItems:'center', gap:'0.875rem', opacity: r.aktif ? 1 : 0.5 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:cfg.bg, color:cfg.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Landmark size={18} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--navy)' }}>{r.bank}</div>
                      <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:1 }}>{r.atasNama}</div>
                      {r.noRek !== '-' && <div style={{ fontFamily:'monospace', fontSize:'0.78rem', color:'var(--text-secondary)', marginTop:2 }}>{r.noRek}</div>}
                    </div>
                    <span style={{ background:cfg.bg, color:cfg.color, fontSize:'0.68rem', fontWeight:700, padding:'2px 9px', borderRadius:20, flexShrink:0 }}>{r.jenis}</span>
                    <button onClick={() => toggleAktif(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color: r.aktif ? '#16A34A' : '#94A3B8', display:'flex', flexShrink:0 }} title={r.aktif ? 'Nonaktifkan' : 'Aktifkan'}>
                      {r.aktif ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <button onClick={() => deleteRekening(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#F87171', display:'flex', flexShrink:0 }} title="Hapus">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })}
              {rekeningList.length === 0 && (
                <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'1.5rem 0', fontSize:'0.875rem' }}>Belum ada rekening terdaftar</div>
              )}
            </div>

            {/* Add form */}
            {showAddForm ? (
              <form onSubmit={addRekening} style={{ padding:'0 1.5rem 1.5rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                <div style={{ height:1, background:'#E2E8F0', marginBottom:'0.25rem' }} />
                <div style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--navy)' }}>Tambah Sumber Dana</div>
                {/* Nama Bank — dropdown */}
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <label style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-secondary)' }}>Nama Bank / Dompet</label>
                  <select
                    required
                    value={formRek.bank}
                    onChange={e => setFormRek(f => ({ ...f, bank: e.target.value }))}
                    style={{ border:'1.5px solid #E2E8F0', borderRadius:8, padding:'0.5rem 0.75rem', fontSize:'0.85rem', outline:'none', background:'#fff' }}
                  >
                    <option value="">-- Pilih Bank / Dompet --</option>
                    <optgroup label="Bank Umum">
                      {['Bank BCA','Bank Mandiri','Bank BNI','Bank BRI','Bank BTN','Bank BPD/DIY','Bank CIMB Niaga','Bank Danamon','Bank Permata','Bank Syariah Indonesia (BSI)','Bank Mega','Bank Maybank','Bank OCBC NISP'].map(b => <option key={b}>{b}</option>)}
                    </optgroup>
                    <optgroup label="QRIS / Dompet Digital">
                      {['QRIS Sekolah','GoPay','OVO','Dana','ShopeePay','LinkAja'].map(b => <option key={b}>{b}</option>)}
                    </optgroup>
                  </select>
                </div>

                {/* Atas Nama */}
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <label style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-secondary)' }}>Atas Nama</label>
                  <input
                    required
                    placeholder="cth: Yayasan Al-Hikmah"
                    value={formRek.atasNama}
                    onChange={e => setFormRek(f => ({ ...f, atasNama: e.target.value }))}
                    style={{ border:'1.5px solid #E2E8F0', borderRadius:8, padding:'0.5rem 0.75rem', fontSize:'0.85rem', outline:'none' }}
                  />
                </div>

                {/* No. Rekening */}
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <label style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-secondary)' }}>No. Rekening <span style={{ fontWeight:400, color:'#94A3B8' }}>(opsional)</span></label>
                  <input
                    placeholder="cth: 0123456789"
                    value={formRek.noRek}
                    onChange={e => setFormRek(f => ({ ...f, noRek: e.target.value }))}
                    style={{ border:'1.5px solid #E2E8F0', borderRadius:8, padding:'0.5rem 0.75rem', fontSize:'0.85rem', outline:'none' }}
                  />
                </div>
                <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.25rem' }}>
                  <button type="submit" style={{ flex:1, background:'var(--navy)', color:'#fff', border:'none', borderRadius:8, padding:'0.6rem', fontWeight:600, fontSize:'0.85rem', cursor:'pointer' }}>Simpan</button>
                  <button type="button" onClick={() => setShowAddForm(false)} style={{ flex:1, background:'#F1F5F9', color:'var(--text-secondary)', border:'none', borderRadius:8, padding:'0.6rem', fontWeight:600, fontSize:'0.85rem', cursor:'pointer' }}>Batal</button>
                </div>
              </form>
            ) : (
              <div style={{ padding:'0 1.5rem 1.5rem' }}>
                <button
                  onClick={() => setShowAddForm(true)}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#F8FAFC', border:'1.5px dashed #CBD5E1', borderRadius:10, padding:'0.7rem', fontWeight:600, fontSize:'0.85rem', color:'var(--navy)', cursor:'pointer' }}
                >
                  <Plus size={16} /> Tambah Sumber Dana
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}