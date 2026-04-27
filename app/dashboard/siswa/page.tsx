'use client'

import { useState, useMemo } from 'react'
import { MOCK_SISWA, type Siswa } from '@/lib/mockData'

const KELAS_OPTIONS = ['Semua Kelas','VII-A','VII-B','VII-C','VIII-A','VIII-B','VIII-C','IX-A','IX-B','IX-C']

// Modal Tambah Siswa
function TambahSiswaModal({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState(false)

  if (saved) return (
    <div style={overlay}>
      <div style={modalBox}>
        <div style={{ textAlign:'center', padding:'1rem' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
          <div style={{ fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.2rem', fontWeight:700, color:'var(--navy-dark)', marginBottom:'0.5rem' }}>
            Siswa Berhasil Ditambahkan!
          </div>
          <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1.5rem' }}>
            Data siswa tersimpan ke sistem (demo). Pada versi produksi, data akan tersinkron ke database.
          </p>
          <button onClick={onClose} style={btnPrimary}>Tutup</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalBox}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <h2 style={{ fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.2rem', fontWeight:700, color:'var(--navy-dark)' }}>
            Tambah Siswa Baru
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
          {[
            { label:'Nama Lengkap', placeholder:'cth: Ahmad Fauzi', required:true },
            { label:'NIS', placeholder:'cth: 2401021', required:true },
            { label:'Nama Wali Murid', placeholder:'cth: Bapak Fauzi', required:true },
            { label:'No. WhatsApp Wali', placeholder:'cth: 08123456789', required:true },
          ].map((f) => (
            <div key={f.label}>
              <label style={labelStyle}>{f.label} {f.required && <span style={{ color:'#EF4444' }}>*</span>}</label>
              <input type="text" placeholder={f.placeholder} style={inputStyle} />
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'1rem' }}>
          <div>
            <label style={labelStyle}>Kelas <span style={{ color:'#EF4444' }}>*</span></label>
            <select style={inputStyle}>
              <option value="">-- Pilih Kelas --</option>
              {['VII-A','VII-B','VII-C','VIII-A','VIII-B','VIII-C','IX-A','IX-B','IX-C'].map(k=>(
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Nominal SPP</label>
            <select style={inputStyle}>
              <option>Rp 450.000 (Kelas VII)</option>
              <option>Rp 475.000 (Kelas VIII)</option>
              <option>Rp 500.000 (Kelas IX)</option>
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:'0.75rem', marginTop:'1.5rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Batal</button>
          <button onClick={() => setSaved(true)} style={btnPrimary}>Simpan Siswa</button>
        </div>
      </div>
    </div>
  )
}

export default function SiswaPage() {
  const [search, setSearch]       = useState('')
  const [kelas, setKelas]         = useState('Semua Kelas')
  const [showModal, setShowModal] = useState(false)
  const [siswaList] = useState<Siswa[]>(MOCK_SISWA)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return siswaList.filter(s =>
      (s.nama.toLowerCase().includes(q) || s.nis.includes(search)) &&
      (kelas === 'Semua Kelas' || s.kelas === kelas)
    )
  }, [search, kelas, siswaList])

  const sendWA = (nama: string, noWa: string) => {
    const msg = encodeURIComponent(`Halo Wali Murid ${nama}, kami dari SDIT Al-Hikmah menghubungi Anda terkait data siswa. Terima kasih.`)
    window.open(`https://wa.me/${noWa}?text=${msg}`, '_blank')
  }

  return (
    <div className="dashboard-content">
      {showModal && <TambahSiswaModal onClose={() => setShowModal(false)} />}

      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Data Siswa</h1>
          <p className="dashboard-subtitle">Total {siswaList.length} siswa terdaftar aktif</p>
        </div>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button className="btn-export" onClick={() => alert('Import Excel akan hadir segera!')}>
            ↑ Import Excel
          </button>
          <button
            className="btn-export"
            style={{ background:'var(--navy)', color:'#fff', borderColor:'var(--navy)' }}
            onClick={() => setShowModal(true)}
          >
            + Tambah Siswa
          </button>
        </div>
      </div>

      {/* Stats ringkas */}
      <div className="stats-grid" style={{ marginBottom:'1.25rem' }}>
        {[
          { label:'Total Siswa', value: siswaList.length, sub:'Aktif semua jenjang', cls:'' },
          { label:'Kelas VII',   value: siswaList.filter(s=>s.kelas.startsWith('VII')).length,  sub:'3 kelas', cls:'stat-card-info' },
          { label:'Kelas VIII',  value: siswaList.filter(s=>s.kelas.startsWith('VIII')).length, sub:'3 kelas', cls:'stat-card-success' },
          { label:'Kelas IX',    value: siswaList.filter(s=>s.kelas.startsWith('IX')).length,   sub:'3 kelas', cls:'stat-card-warning' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-card-label">{s.label}</div>
            <div className="stat-card-value">{s.value}</div>
            <div className="stat-card-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <input className="filter-search" placeholder="🔍  Cari nama siswa atau NIS..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="filter-select" value={kelas} onChange={e=>setKelas(e.target.value)}>
          {KELAS_OPTIONS.map(k=><option key={k}>{k}</option>)}
        </select>
        <div className="filter-count">{filtered.length} siswa</div>
      </div>

      {/* Tabel */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th><th>NIS</th><th>Nama Siswa</th><th>Nama Wali</th>
              <th>Kelas</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id}>
                <td className="td-no">{i+1}</td>
                <td className="td-nis">{s.nis}</td>
                <td className="td-nama">{s.nama}</td>
                <td style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{s.namaWali}</td>
                <td><span className="kelas-pill">{s.kelas}</span></td>
                <td>
                  <button className="btn-wa" onClick={() => sendWA(s.nama, s.noWa)}>
                    💬 WA
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
  display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'1rem',
}
const modalBox: React.CSSProperties = {
  background:'#fff', borderRadius:16, padding:'2rem', width:'100%',
  maxWidth:560, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto',
}
const labelStyle: React.CSSProperties = {
  display:'block', fontSize:'0.8rem', fontWeight:600,
  color:'var(--text-mid)', marginBottom:4,
}
const inputStyle: React.CSSProperties = {
  width:'100%', padding:'0.65rem 0.85rem', border:'1.5px solid var(--border)',
  borderRadius:8, fontFamily:'inherit', fontSize:'0.875rem',
  color:'var(--text-dark)', outline:'none', background:'#fff', appearance:'auto',
}
const btnPrimary: React.CSSProperties = {
  background:'var(--navy)', color:'#fff', border:'none',
  padding:'0.65rem 1.5rem', borderRadius:8, fontWeight:700,
  fontSize:'0.875rem', cursor:'pointer', fontFamily:'inherit',
}
const btnSecondary: React.CSSProperties = {
  background:'transparent', color:'var(--navy)',
  border:'1.5px solid var(--navy)', padding:'0.65rem 1.25rem',
  borderRadius:8, fontWeight:600, fontSize:'0.875rem',
  cursor:'pointer', fontFamily:'inherit',
}