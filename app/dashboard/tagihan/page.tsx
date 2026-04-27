'use client'

import { useState, useMemo } from 'react'
import { MOCK_TAGIHAN, type Tagihan } from '@/lib/mockData'

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n)

const STATUS_CFG = {
  aktif:   { cls:'badge-belum',    label:'Aktif'   },
  selesai: { cls:'badge-lunas',    label:'Selesai' },
  draft:   { cls:'badge-terlambat', label:'Draft'  },
}

function DetailModal({ tagihan, onClose }: { tagihan: Tagihan; onClose: () => void }) {
  const belum = tagihan.totalSiswa - tagihan.sudahBayar
  const persen = Math.round((tagihan.sudahBayar / tagihan.totalSiswa) * 100)

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalBox}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <h2 style={{ fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.15rem', fontWeight:700, color:'var(--navy-dark)' }}>
            Detail Tagihan
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'1.25rem' }}>
          {[
            ['ID Tagihan', tagihan.id],
            ['Jenis',      tagihan.jenis],
            ['Bulan',      `${tagihan.bulan} ${tagihan.tahun}`],
            ['Kelas',      `Kelas ${tagihan.kelas}`],
            ['Nominal',    formatRp(tagihan.nominal)],
            ['Jatuh Tempo',tagihan.tanggalJatuhTempo],
          ].map(([k,v]) => (
            <div key={k} style={{ background:'#F8FAFC', borderRadius:8, padding:'0.75rem' }}>
              <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:600, marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:'0.9rem', fontWeight:600, color:'var(--navy-dark)' }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:'1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', marginBottom:6 }}>
            <span style={{ color:'var(--text-muted)' }}>Progress Pembayaran</span>
            <span style={{ fontWeight:700, color:'var(--emerald)' }}>{persen}%</span>
          </div>
          <div style={{ height:10, background:'#F1F5F9', borderRadius:100, overflow:'hidden' }}>
            <div style={{ width:`${persen}%`, height:'100%', background:'var(--emerald)', borderRadius:100 }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:'0.78rem', color:'var(--text-muted)' }}>
            <span>✅ {tagihan.sudahBayar} siswa lunas</span>
            <span>⏳ {belum} siswa belum</span>
          </div>
        </div>

        <div style={{ background:'#FFFBEB', border:'1px solid rgba(217,119,6,0.25)', borderRadius:8, padding:'0.75rem', fontSize:'0.82rem', color:'var(--text-mid)', marginBottom:'1.25rem' }}>
          💡 Pada versi produksi: klik Kirim Reminder WA Massal untuk mengirim notifikasi ke semua orang tua yang belum membayar secara serentak.
        </div>

        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Tutup</button>
          <button style={btnPrimary} onClick={() => alert('Fitur reminder massal akan hadir segera!')}>
            💬 Kirim Reminder WA Massal ({belum} orang)
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TagihanPage() {
  const [filterBulan, setFilterBulan]     = useState('Semua')
  const [filterStatus, setFilterStatus]   = useState('Semua')
  const [selected, setSelected]           = useState<Tagihan | null>(null)
  const [tagihanList]                     = useState<Tagihan[]>(MOCK_TAGIHAN)

  const bulanOptions = ['Semua', ...Array.from(new Set(tagihanList.map(t => t.bulan)))]

  const filtered = useMemo(() => tagihanList.filter(t =>
    (filterBulan  === 'Semua' || t.bulan === filterBulan) &&
    (filterStatus === 'Semua' || t.status === filterStatus)
  ), [filterBulan, filterStatus, tagihanList])

  const totalTagihan    = filtered.reduce((s, t) => s + t.nominal * t.totalSiswa, 0)
  const totalTerkumpul  = filtered.reduce((s, t) => s + t.nominal * t.sudahBayar, 0)
  const totalSiswa      = filtered.reduce((s, t) => s + t.totalSiswa, 0)
  const totalLunas      = filtered.reduce((s, t) => s + t.sudahBayar, 0)

  return (
    <div className="dashboard-content">
      {selected && <DetailModal tagihan={selected} onClose={() => setSelected(null)} />}

      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Tagihan SPP</h1>
          <p className="dashboard-subtitle">Kelola tagihan SPP per kelas per bulan</p>
        </div>
        <button
          className="btn-export"
          style={{ background:'var(--navy)', color:'#fff', borderColor:'var(--navy)' }}
          onClick={() => alert('Generate tagihan baru akan hadir segera!')}
        >
          + Generate Tagihan Baru
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom:'1.25rem' }}>
        {[
          { label:'Total Target',    value: formatRp(totalTagihan),   sub:`${filtered.length} tagihan aktif`,       cls:'' },
          { label:'Terkumpul',       value: formatRp(totalTerkumpul), sub:'Sudah masuk ke kas sekolah',             cls:'stat-card-success' },
          { label:'Siswa Lunas',     value: `${totalLunas}/${totalSiswa}`, sub:'Dari semua tagihan terpilih',       cls:'stat-card-info' },
          { label:'Sisa Tagihan',    value: formatRp(totalTagihan - totalTerkumpul), sub:'Belum terkumpul',         cls:'stat-card-warning' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-card-label">{s.label}</div>
            <div className="stat-card-value" style={{ fontSize:'1.15rem' }}>{s.value}</div>
            <div className="stat-card-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <select className="filter-select" value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
          {bulanOptions.map(b => <option key={b}>{b}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {['Semua','aktif','selesai','draft'].map(s => (
            <option key={s} value={s}>{s === 'Semua' ? 'Semua Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <div className="filter-count">{filtered.length} tagihan</div>
      </div>

      {/* Tabel */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th><th>Periode</th><th>Jenis</th><th>Kelas</th>
              <th>Nominal/Siswa</th><th>Progress</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const pct = Math.round((t.sudahBayar / t.totalSiswa) * 100)
              const cfg = STATUS_CFG[t.status]
              return (
                <tr key={t.id}>
                  <td className="td-nis">{t.id}</td>
                  <td style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--navy-dark)' }}>{t.bulan} {t.tahun}</td>
                  <td style={{ fontSize:'0.83rem' }}>{t.jenis}</td>
                  <td><span className="kelas-pill">Kelas {t.kelas}</span></td>
                  <td className="td-nominal">{formatRp(t.nominal)}</td>
                  <td style={{ minWidth:130 }}>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:3 }}>
                      {t.sudahBayar}/{t.totalSiswa} siswa ({pct}%)
                    </div>
                    <div style={{ height:6, background:'#F1F5F9', borderRadius:100, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:'var(--emerald)', borderRadius:100 }} />
                    </div>
                  </td>
                  <td className="td-tanggal">{t.tanggalJatuhTempo}</td>
                  <td><span className={cfg.cls}>{cfg.label}</span></td>
                  <td>
                    <button className="btn-wa" onClick={() => setSelected(t)} style={{ background:'#EEF2FF', color:'#4338CA' }}>
                      Detail
                    </button>
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

const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'1rem' }
const modalBox: React.CSSProperties = { background:'#fff', borderRadius:16, padding:'2rem', width:'100%', maxWidth:540, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }
const btnPrimary: React.CSSProperties = { background:'var(--navy)', color:'#fff', border:'none', padding:'0.65rem 1.25rem', borderRadius:8, fontWeight:700, fontSize:'0.85rem', cursor:'pointer', fontFamily:'inherit' }
const btnSecondary: React.CSSProperties = { background:'transparent', color:'var(--navy)', border:'1.5px solid var(--navy)', padding:'0.65rem 1rem', borderRadius:8, fontWeight:600, fontSize:'0.85rem', cursor:'pointer', fontFamily:'inherit' }