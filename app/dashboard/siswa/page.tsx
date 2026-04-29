'use client'

'use client'

import { useState, useMemo } from 'react'
import { Pencil, Trash2, Users, BookOpen, GraduationCap, Award, Search } from 'lucide-react'
import { MOCK_SISWA, MOCK_USER, type Siswa } from '@/lib/mockData'
import * as XLSX from 'xlsx-js-style'

const KELAS_OPTIONS = ['Semua Kelas','VII-A','VII-B','VII-C','VIII-A','VIII-B','VIII-C','IX-A','IX-B','IX-C']

// Modal Edit Siswa
function EditSiswaModal({ siswa, onClose }: { siswa: Siswa; onClose: () => void }) {
  const [saved, setSaved] = useState(false)

  if (saved) return (
    <div style={overlay}>
      <div style={modalBox}>
        <div style={{ textAlign:'center', padding:'1rem' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
          <div style={{ fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.2rem', fontWeight:700, color:'var(--navy-dark)', marginBottom:'0.5rem' }}>
            Data Berhasil Diperbarui!
          </div>
          <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1.5rem' }}>
            Perubahan data siswa tersimpan (demo).
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
            Edit Data Siswa
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
          {[
            { label:'Nama Lengkap', placeholder:'cth: Ahmad Fauzi', defaultValue: siswa.nama, required:true },
            { label:'NIS', placeholder:'cth: 2401021', defaultValue: siswa.nis, required:true },
            { label:'Nama Wali Murid', placeholder:'cth: Bapak Fauzi', defaultValue: siswa.namaWali, required:true },
            { label:'No. WhatsApp Wali', placeholder:'cth: 08123456789', defaultValue: siswa.noWa, required:true },
          ].map((f) => (
            <div key={f.label}>
              <label style={labelStyle}>{f.label} {f.required && <span style={{ color:'#EF4444' }}>*</span>}</label>
              <input type="text" placeholder={f.placeholder} defaultValue={f.defaultValue} style={inputStyle} />
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'1rem' }}>
          <div>
            <label style={labelStyle}>Kelas <span style={{ color:'#EF4444' }}>*</span></label>
            <select style={inputStyle} defaultValue={siswa.kelas}>
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
          <button onClick={() => setSaved(true)} style={btnPrimary}>Simpan Perubahan</button>
        </div>
      </div>
    </div>
  )
}

// Modal Konfirmasi Hapus
function HapusSiswaModal({ siswa, onClose, onConfirm }: { siswa: Siswa; onClose: () => void; onConfirm: () => void }) {
  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, maxWidth:420 }}>
        <div style={{ textAlign:'center', padding:'0.5rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🗑️</div>
          <h2 style={{ fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.1rem', fontWeight:700, color:'var(--navy-dark)', marginBottom:'0.5rem' }}>
            Hapus Data Siswa?
          </h2>
          <p style={{ fontSize:'0.875rem', color:'var(--text-muted)', marginBottom:'1.5rem', lineHeight:1.6 }}>
            Anda akan menghapus data <strong>{siswa.nama}</strong> ({siswa.nis}).
            Tindakan ini tidak dapat dibatalkan.
          </p>
          <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center' }}>
            <button onClick={onClose} style={btnSecondary}>Batal</button>
            <button onClick={onConfirm} style={{ ...btnPrimary, background:'#DC2626', borderColor:'#DC2626' }}>
              Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const [search, setSearch]           = useState('')
  const [kelas, setKelas]             = useState('Semua Kelas')
  const [showModal, setShowModal]     = useState(false)
  const [editSiswa, setEditSiswa]     = useState<Siswa | null>(null)
  const [deleteSiswa, setDeleteSiswa] = useState<Siswa | null>(null)
  const [siswaList, setSiswaList]     = useState<Siswa[]>(MOCK_SISWA)

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

  const handleDelete = (siswa: Siswa) => {
    setSiswaList((prev) => prev.filter((s) => s.id !== siswa.id))
    setDeleteSiswa(null)
  }

  const exportExcel = () => {
    const headers = ['No', 'NIS', 'Nama Siswa', 'Kelas', 'Nama Wali', 'No. WA']
    const rows = filtered.map((s, i) => [
      i + 1, s.nis, s.nama, s.kelas, s.namaWali, s.noWa,
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

    // Column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 26 }, { wch: 8 },
      { wch: 22 }, { wch: 17 },
    ]

    // Style header row (A1:F1)
    const headerStyle = {
      fill:      { fgColor: { rgb: 'BFDBFE' } },          // blue-200
      font:      { bold: true, color: { rgb: '1E3A8A' } }, // blue-900 text
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        bottom: { style: 'medium', color: { rgb: '93C5FD' } },
      },
    }

    headers.forEach((_, ci) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: ci })
      if (!ws[addr]) ws[addr] = {}
      ws[addr].s = headerStyle
    })

    // Data rows: center alignment + zebra fill for even rows
    const center = { horizontal: 'center', vertical: 'center' }
    rows.forEach((_, ri) => {
      const isEven = (ri + 1) % 2 === 0
      headers.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
        if (!ws[addr]) ws[addr] = {}
        ws[addr].s = {
          alignment: center,
          ...(isEven ? { fill: { fgColor: { rgb: 'EFF6FF' } } } : {}),
        }
      })
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa')
    XLSX.writeFile(wb, `Rekap Siswa ${MOCK_USER.sekolah}.xlsx`)
  }

  return (
    <div className="dashboard-content">
      {showModal    && <TambahSiswaModal onClose={() => setShowModal(false)} />}
      {editSiswa    && <EditSiswaModal   siswa={editSiswa}   onClose={() => setEditSiswa(null)} />}
      {deleteSiswa  && <HapusSiswaModal  siswa={deleteSiswa} onClose={() => setDeleteSiswa(null)} onConfirm={() => handleDelete(deleteSiswa)} />}

      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Data Siswa</h1>
          <p className="dashboard-subtitle">Total {siswaList.length} siswa terdaftar aktif</p>
        </div>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button className="btn-export btn-export--disabled" tabIndex={-1}>
            ↑ Import Excel
          </button>
          <button className="btn-export btn-export--success" onClick={exportExcel}>
            ↓ Export Excel
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
          { label:'Total Siswa', value: siswaList.length, sub:'Aktif semua jenjang', cls:'',                icon: Users         },
          { label:'Kelas VII',   value: siswaList.filter(s=>s.kelas.startsWith('VII-')).length,  sub:'3 kelas', cls:'stat-card-info',    icon: BookOpen      },
          { label:'Kelas VIII',  value: siswaList.filter(s=>s.kelas.startsWith('VIII-')).length, sub:'3 kelas', cls:'stat-card-success', icon: GraduationCap },
          { label:'Kelas IX',    value: siswaList.filter(s=>s.kelas.startsWith('IX-')).length,   sub:'3 kelas', cls:'stat-card-warning', icon: Award         },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-card-label">{s.label}</div>
            <div className="stat-card-value">{s.value}</div>
            <div className="stat-card-sub">{s.sub}</div>
            <s.icon className="stat-card-bg-icon" />
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <div className="filter-search-wrap">
          <span className="filter-search-icon"><Search size={15} /></span>
          <input className="filter-search" placeholder="Cari nama siswa atau NIS..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
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
              <th>Kelas</th><th className="th-aksi">Aksi</th>
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
                <td className="td-aksi">
                  <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                    <button className="btn-wa" onClick={() => sendWA(s.nama, s.noWa)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WA
                    </button>
                    <button className="btn-edit" onClick={() => setEditSiswa(s)}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn-hapus" onClick={() => setDeleteSiswa(s)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
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