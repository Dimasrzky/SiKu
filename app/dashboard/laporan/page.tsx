'use client'

import { MOCK_SISWA, MOCK_PEMBAYARAN, LAPORAN_BULANAN } from '@/lib/mockData'

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n)

// Bar chart murni CSS — tanpa library
function BarChart({ data }: { data: typeof LAPORAN_BULANAN }) {
  const maxVal = Math.max(...data.map(d => d.target))
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:'1.5rem', height:180, padding:'0 0.5rem' }}>
      {data.map(d => {
        const pctTarget    = (d.target     / maxVal) * 100
        const pctTerkumpul = (d.terkumpul  / maxVal) * 100
        const selesai      = d.terkumpul >= d.target
        return (
          <div key={d.bulan} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            <div style={{ fontSize:'0.68rem', fontWeight:700, color: selesai ? 'var(--emerald)' : 'var(--amber)' }}>
              {Math.round((d.terkumpul / d.target) * 100)}%
            </div>
            {/* Dua batang berdampingan */}
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:140 }}>
              {/* Target */}
              <div style={{ width:18, height:`${pctTarget}%`, background:'#E2E8F0', borderRadius:'4px 4px 0 0', position:'relative' }} title={`Target: ${formatRp(d.target)}`} />
              {/* Terkumpul */}
              <div
                style={{
                  width:18, height:`${pctTerkumpul}%`,
                  background: selesai ? 'var(--emerald)' : 'var(--amber)',
                  borderRadius:'4px 4px 0 0',
                }}
                title={`Terkumpul: ${formatRp(d.terkumpul)}`}
              />
            </div>
            <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', textAlign:'center', whiteSpace:'nowrap' }}>{d.bulan}</div>
          </div>
        )
      })}
    </div>
  )
}

// Breakdown per kelas
function KelasCard({ kelas, prefix }: { kelas: string; prefix: string }) {
  const siswaKelas  = MOCK_SISWA.filter(s => s.kelas.startsWith(prefix))
  const lunas       = siswaKelas.filter(s => s.status === 'lunas').length
  const total       = siswaKelas.length
  const terkumpul   = siswaKelas.filter(s => s.status === 'lunas').reduce((s, x) => s + x.nominal, 0)
  const pct         = total > 0 ? Math.round((lunas / total) * 100) : 0

  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:'0.95rem', color:'var(--navy-dark)' }}>Kelas {kelas}</div>
          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>{total} siswa terdaftar</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.1rem', fontWeight:700, color:'var(--emerald)' }}>{formatRp(terkumpul)}</div>
          <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>terkumpul</div>
        </div>
      </div>
      <div style={{ height:6, background:'#F1F5F9', borderRadius:100, overflow:'hidden', marginBottom:4 }}>
        <div style={{ width:`${pct}%`, height:'100%', background: pct === 100 ? 'var(--emerald)' : 'var(--amber)', borderRadius:100 }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--text-muted)' }}>
        <span>{lunas} lunas</span>
        <span style={{ fontWeight:700, color: pct === 100 ? 'var(--emerald)' : 'var(--amber)' }}>{pct}%</span>
      </div>
    </div>
  )
}

export default function LaporanPage() {
  const totalSiswa    = MOCK_SISWA.length
  const totalLunas    = MOCK_SISWA.filter(s => s.status === 'lunas').length
  const totalTertagih = MOCK_SISWA.reduce((s, x) => s + x.nominal, 0)
  const totalMasuk    = MOCK_SISWA.filter(s => s.status === 'lunas').reduce((s, x) => s + x.nominal, 0)
  const totalTunggakan = totalTertagih - totalMasuk

  const distribusiMetode = [
    { label:'Transfer Bank', count: MOCK_PEMBAYARAN.filter(p=>p.metode==='Transfer').length, color:'#3B82F6' },
    { label:'QRIS',          count: MOCK_PEMBAYARAN.filter(p=>p.metode==='QRIS').length,     color:'#7C3AED' },
    { label:'Tunai',         count: MOCK_PEMBAYARAN.filter(p=>p.metode==='Tunai').length,    color:'#059669' },
  ]
  const totalTrx = distribusiMetode.reduce((s,d) => s + d.count, 0)

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Laporan Keuangan</h1>
          <p className="dashboard-subtitle">Ringkasan kondisi keuangan sekolah</p>
        </div>
        <button className="btn-export" onClick={() => alert('Export PDF laporan akan hadir segera!')}>
          ↓ Export Laporan PDF
        </button>
      </div>

      {/* Stats utama */}
      <div className="stats-grid" style={{ marginBottom:'1.25rem' }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Tertagih (Apr)</div>
          <div className="stat-card-value" style={{ fontSize:'1.1rem' }}>{formatRp(totalTertagih)}</div>
          <div className="stat-card-sub">{totalSiswa} siswa × rata-rata SPP</div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-card-label">Total Terkumpul</div>
          <div className="stat-card-value" style={{ fontSize:'1.1rem' }}>{formatRp(totalMasuk)}</div>
          <div className="stat-card-sub">{totalLunas} siswa sudah lunas</div>
        </div>
        <div className="stat-card stat-card-warning">
          <div className="stat-card-label">Sisa Tunggakan</div>
          <div className="stat-card-value" style={{ fontSize:'1.1rem' }}>{formatRp(totalTunggakan)}</div>
          <div className="stat-card-sub">{totalSiswa - totalLunas} siswa belum bayar</div>
        </div>
        <div className="stat-card stat-card-info">
          <div className="stat-card-label">Realisasi</div>
          <div className="stat-card-value">{Math.round((totalMasuk / totalTertagih) * 100)}%</div>
          <div className="stat-card-sub">Dari target bulan ini</div>
        </div>
      </div>

      {/* Chart & Distribusi */}
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:'1rem', marginBottom:'1rem' }}>

        {/* Bar chart bulanan */}
        <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:'0.92rem', color:'var(--navy-dark)' }}>Tren Pemasukan Bulanan</div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>Januari — April 2025</div>
            </div>
            <div style={{ display:'flex', gap:'1rem', fontSize:'0.72rem' }}>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:10, height:10, background:'#E2E8F0', borderRadius:2, display:'inline-block' }} />Target
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:10, height:10, background:'var(--emerald)', borderRadius:2, display:'inline-block' }} />Terkumpul
              </span>
            </div>
          </div>
          <BarChart data={LAPORAN_BULANAN} />
          <div style={{ marginTop:'0.75rem', display:'flex', gap:'1rem', overflowX:'auto' }}>
            {LAPORAN_BULANAN.map(d => (
              <div key={d.bulan} style={{ flex:'0 0 auto', fontSize:'0.72rem', color:'var(--text-muted)', textAlign:'center' }}>
                <div style={{ fontWeight:600, color:'var(--navy-dark)' }}>{formatRp(d.terkumpul)}</div>
                <div>dari {formatRp(d.target)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribusi metode */}
        <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem' }}>
          <div style={{ fontWeight:700, fontSize:'0.92rem', color:'var(--navy-dark)', marginBottom:'0.25rem' }}>Metode Pembayaran</div>
          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:'1.25rem' }}>Bulan April 2025</div>
          {distribusiMetode.map(d => {
            const pct = Math.round((d.count / totalTrx) * 100)
            return (
              <div key={d.label} style={{ marginBottom:'1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', marginBottom:4 }}>
                  <span style={{ fontWeight:600, color:'var(--navy-dark)' }}>{d.label}</span>
                  <span style={{ color:'var(--text-muted)' }}>{d.count} trx ({pct}%)</span>
                </div>
                <div style={{ height:8, background:'#F1F5F9', borderRadius:100, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:d.color, borderRadius:100 }} />
                </div>
              </div>
            )
          })}
          <div style={{ marginTop:'1.25rem', padding:'0.75rem', background:'#F8FAFC', borderRadius:8, fontSize:'0.78rem', color:'var(--text-muted)' }}>
            💡 <strong>Transfer Bank</strong> masih menjadi metode paling banyak digunakan orang tua.
          </div>
        </div>
      </div>

      {/* Breakdown per kelas */}
      <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }}>
        <div style={{ fontWeight:700, fontSize:'0.92rem', color:'var(--navy-dark)', marginBottom:'0.25rem' }}>Rekapitulasi per Kelas</div>
        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:'1.25rem' }}>April 2025</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem' }}>
          <KelasCard kelas="VII"  prefix="VII" />
          <KelasCard kelas="VIII" prefix="VIII" />
          <KelasCard kelas="IX"   prefix="IX" />
        </div>
      </div>

      {/* Catatan bendahara */}
      <div style={{ background:'var(--emerald-bg)', border:'1px solid rgba(5,150,105,0.2)', borderRadius:12, padding:'1.25rem', fontSize:'0.85rem', color:'var(--text-mid)' }}>
        <div style={{ fontWeight:700, color:'var(--emerald)', marginBottom:6 }}>📋 Ringkasan untuk Laporan ke Yayasan</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem 2rem' }}>
          <div>• Total siswa aktif: <strong>{totalSiswa} siswa</strong></div>
          <div>• Target pemasukan: <strong>{formatRp(totalTertagih)}</strong></div>
          <div>• Siswa lunas: <strong>{totalLunas} siswa ({Math.round((totalLunas/totalSiswa)*100)}%)</strong></div>
          <div>• Dana terkumpul: <strong>{formatRp(totalMasuk)}</strong></div>
          <div>• Siswa belum bayar: <strong>{totalSiswa - totalLunas} siswa</strong></div>
          <div>• Sisa tunggakan: <strong>{formatRp(totalTunggakan)}</strong></div>
        </div>
        <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid rgba(5,150,105,0.15)', fontSize:'0.78rem', color:'var(--text-muted)' }}>
          💡 Pada versi produksi, laporan ini dapat diekspor ke PDF & Excel dan dikirim otomatis ke email ketua yayasan.
        </div>
      </div>
    </div>
  )
}