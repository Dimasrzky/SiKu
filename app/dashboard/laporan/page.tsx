'use client'

import { FileText, CheckCircle, AlertTriangle, Percent } from 'lucide-react'
import { MOCK_SISWA, MOCK_PEMBAYARAN, LAPORAN_BULANAN, MOCK_USER, TAHUN_AKTIF } from '@/lib/mockData'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:140 }}>
              <div style={{ width:18, height:`${pctTarget}%`, background:'#E2E8F0', borderRadius:'4px 4px 0 0', position:'relative' }} title={`Target: ${formatRp(d.target)}`} />
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
  const siswaKelas  = MOCK_SISWA.filter(s => s.kelas.startsWith(prefix + '-'))
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

// ─── PDF Export ────────────────────────────────────────────────────────────────

// Abbreviate large rupiah numbers for chart axis labels
function rpShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}jt`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

function exportPDF(data: {
  totalSiswa: number
  totalLunas: number
  totalTertagih: number
  totalMasuk: number
  totalTunggakan: number
  distribusiMetode: { label: string; count: number }[]
  totalTrx: number
}) {
  const { totalSiswa, totalLunas, totalTertagih, totalMasuk, totalTunggakan, distribusiMetode, totalTrx } = data
  const realisasi = Math.round((totalMasuk / totalTertagih) * 100)
  const now = new Date()
  const tglCetak = now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })

  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  const W = doc.internal.pageSize.getWidth()
  let y = 14

  // ── Header bar ────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(MOCK_USER.sekolah, 14, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('Sistem Keuangan Sekolah — SiKu', 14, 17)
  doc.text(`Dicetak: ${tglCetak}`, 14, 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('LAPORAN KEUANGAN', W - 14, 12, { align:'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`${TAHUN_AKTIF}`, W - 14, 18, { align:'right' })

  y = 36

  // ── Section title helper ──────────────────────────────────────────
  const sectionTitle = (title: string) => {
    doc.setFillColor(30, 58, 138)
    doc.roundedRect(14, y, W - 28, 7, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(title, 18, y + 4.8)
    y += 10
  }

  // ── 1. Ringkasan Keuangan ─────────────────────────────────────────
  sectionTitle('RINGKASAN KEUANGAN')

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Keterangan', 'Nilai']],
    body: [
      ['Total Siswa Aktif',    `${totalSiswa} siswa`],
      ['Siswa Lunas',          `${totalLunas} siswa (${Math.round((totalLunas/totalSiswa)*100)}%)`],
      ['Siswa Belum Bayar',    `${totalSiswa - totalLunas} siswa`],
      ['Target Pemasukan',     formatRp(totalTertagih)],
      ['Total Terkumpul',      formatRp(totalMasuk)],
      ['Sisa Tunggakan',       formatRp(totalTunggakan)],
      ['Realisasi Keseluruhan', `${realisasi}%`],
    ],
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, fontStyle:'bold' },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle:'bold', cellWidth: 60 }, 1: { cellWidth: 'auto' } },
    theme: 'grid',
  })

  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 7

  // ── 2. Tren Pemasukan Bulanan (bar chart) ─────────────────────────
  sectionTitle('TREN PEMASUKAN BULANAN')

  // Chart dimensions
  const cX   = 28          // left edge of plot area (leaves room for Y-axis labels)
  const cW   = W - cX - 14 // plot width
  const cH   = 52           // plot height
  const cY   = y
  const baseY = cY + cH - 8 // baseline (above x-axis labels)
  const plotH = cH - 14     // drawable bar height (above baseline, below top)

  const maxVal = Math.max(...LAPORAN_BULANAN.map(d => d.target)) * 1.08

  // Chart background
  doc.setFillColor(248, 250, 252)
  doc.rect(14, cY, W - 28, cH, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.15)
  doc.rect(14, cY, W - 28, cH, 'S')

  // Horizontal grid lines + Y-axis labels (4 lines)
  const gridSteps = 4
  for (let g = 0; g <= gridSteps; g++) {
    const lineY = baseY - (plotH * g / gridSteps)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.15)
    doc.line(cX, lineY, cX + cW, lineY)
    const val = maxVal * (g / gridSteps)
    doc.setFontSize(5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(rpShort(val), cX - 1, lineY + 1.5, { align:'right' })
  }

  // Legend (top-right inside chart)
  const legX = cX + cW - 52
  const legY = cY + 3
  doc.setFillColor(203, 213, 225)
  doc.rect(legX, legY + 0.5, 5, 3, 'F')
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Target', legX + 6, legY + 3)
  doc.setFillColor(5, 150, 105)
  doc.rect(legX + 22, legY + 0.5, 5, 3, 'F')
  doc.text('Terkumpul', legX + 28, legY + 3)

  // Draw bars for each month
  const groupW  = cW / LAPORAN_BULANAN.length
  const pairW   = groupW * 0.48
  const singleW = (pairW - 1) / 2

  LAPORAN_BULANAN.forEach((d, i) => {
    const gX      = cX + i * groupW + (groupW - pairW) / 2
    const selesai = d.terkumpul >= d.target
    const tH      = Math.max((d.target     / maxVal) * plotH, 1)
    const kH      = Math.max((d.terkumpul  / maxVal) * plotH, 1)
    const pct     = Math.round((d.terkumpul / d.target) * 100)

    // Target bar (gray)
    doc.setFillColor(203, 213, 225)
    doc.rect(gX, baseY - tH, singleW, tH, 'F')

    // Terkumpul bar (green or amber)
    if (selesai) { doc.setFillColor(5, 150, 105) } else { doc.setFillColor(217, 119, 6) }
    doc.rect(gX + singleW + 0.8, baseY - kH, singleW, kH, 'F')

    // Percentage label above terkumpul bar
    doc.setFontSize(5.5)
    doc.setFont('helvetica', 'bold')
    if (selesai) { doc.setTextColor(5, 150, 105) } else { doc.setTextColor(217, 119, 6) }
    doc.text(`${pct}%`, gX + singleW + 0.8 + singleW / 2, baseY - kH - 1.5, { align:'center' })

    // Month label below bars
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(d.bulan.substring(0, 3), gX + pairW / 2, baseY + 5, { align:'center' })
  })

  y = cY + cH + 5

  // Small summary row below chart
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  const colW = (W - 28) / LAPORAN_BULANAN.length
  LAPORAN_BULANAN.forEach((d, i) => {
    const cx = 14 + i * colW + colW / 2
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(d.bulan.substring(0, 3), cx, y, { align:'center' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(rpShort(d.terkumpul), cx, y + 4, { align:'center' })
    doc.text(`/ ${rpShort(d.target)}`, cx, y + 8, { align:'center' })
  })

  y += 13

  // ── 3. Rekapitulasi per Kelas (progress bars) ─────────────────────
  sectionTitle('REKAPITULASI PER KELAS')

  const kelasRows = ['VII','VIII','IX'].map(prefix => {
    const siswaKelas = MOCK_SISWA.filter(s => s.kelas.startsWith(prefix + '-'))
    const lunas      = siswaKelas.filter(s => s.status === 'lunas').length
    const total      = siswaKelas.length
    const terkumpul  = siswaKelas.filter(s => s.status === 'lunas').reduce((s, x) => s + x.nominal, 0)
    const pct        = total > 0 ? Math.round((lunas / total) * 100) : 0
    return { prefix, lunas, total, terkumpul, pct }
  })

  const barTrackX = 14 + 30  // after "Kelas VIII " label
  const barTrackW = W - 28 - 30 - 22  // leave 22mm for right-side values
  const barH = 5

  kelasRows.forEach((row, i) => {
    const rowY = y + i * 13
    const selesai = row.pct === 100

    // Label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(15, 23, 42)
    doc.text(`Kelas ${row.prefix}`, 14, rowY + 4)

    // Sub-label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(148, 163, 184)
    doc.text(`${row.lunas}/${row.total} siswa lunas`, 14, rowY + 8.5)

    // Track
    doc.setFillColor(241, 245, 249)
    doc.rect(barTrackX, rowY, barTrackW, barH, 'F')

    // Fill
    if (selesai) { doc.setFillColor(5, 150, 105) } else { doc.setFillColor(217, 119, 6) }
    doc.rect(barTrackX, rowY, barTrackW * (row.pct / 100), barH, 'F')

    // Percentage + amount
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    if (selesai) { doc.setTextColor(5, 150, 105) } else { doc.setTextColor(217, 119, 6) }
    doc.text(`${row.pct}%`, W - 14, rowY + 4, { align:'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(148, 163, 184)
    doc.text(rpShort(row.terkumpul), W - 14, rowY + 8.5, { align:'right' })
  })

  y += kelasRows.length * 13 + 5

  // ── 4. Distribusi Metode Pembayaran (horizontal bars) ─────────────
  sectionTitle('DISTRIBUSI METODE PEMBAYARAN')

  const methColors: [number,number,number][] = [
    [59, 130, 246],   // blue  — Transfer
    [124, 58, 237],   // purple — QRIS
    [5, 150, 105],    // green  — Tunai
  ]
  const methLabelW = 36
  const methBarW   = W - 28 - methLabelW - 20
  const methBarH   = 5

  distribusiMetode.forEach((d, i) => {
    const pct   = Math.round((d.count / totalTrx) * 100)
    const rowY  = y + i * 11
    const color = methColors[i]

    // Label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(30, 30, 30)
    doc.text(d.label, 14, rowY + 4)

    // Track
    const bX = 14 + methLabelW
    doc.setFillColor(241, 245, 249)
    doc.rect(bX, rowY, methBarW, methBarH, 'F')

    // Fill
    doc.setFillColor(...color)
    doc.rect(bX, rowY, methBarW * (pct / 100), methBarH, 'F')

    // Percentage
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...color)
    doc.text(`${pct}%  ·  ${d.count} trx`, W - 14, rowY + 4, { align:'right' })
  })

  y += distribusiMetode.length * 11 + 10

  // ── Footer ────────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(14, y, W - 14, y)
  y += 5

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text(
    'Dokumen ini digenerate otomatis oleh SiKu. Harap verifikasi dengan data asli sebelum digunakan secara resmi.',
    14, y
  )
  doc.text(`SiKu — Sistem Keuangan Sekolah  |  Hal. 1 dari 1`, W - 14, y, { align:'right' })

  doc.save(`Laporan Keuangan ${MOCK_USER.sekolah} (${TAHUN_AKTIF}).pdf`)
}

// ──────────────────────────────────────────────────────────────────────────────

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

  const handleExportPDF = () => {
    exportPDF({ totalSiswa, totalLunas, totalTertagih, totalMasuk, totalTunggakan, distribusiMetode, totalTrx })
  }

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Laporan Keuangan</h1>
          <p className="dashboard-subtitle">Ringkasan kondisi keuangan sekolah</p>
        </div>
        <button className="btn-export btn-export--danger" onClick={handleExportPDF}>
          ↓ Export Laporan PDF
        </button>
      </div>

      {/* Stats utama */}
      <div className="stats-grid" style={{ marginBottom:'1.25rem' }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Tertagih (Apr)</div>
          <div className="stat-card-value" style={{ fontSize:'1.1rem' }}>{formatRp(totalTertagih)}</div>
          <div className="stat-card-sub">{totalSiswa} siswa × rata-rata SPP</div>
          <FileText className="stat-card-bg-icon" />
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-card-label">Total Terkumpul</div>
          <div className="stat-card-value" style={{ fontSize:'1.1rem' }}>{formatRp(totalMasuk)}</div>
          <div className="stat-card-sub">{totalLunas} siswa sudah lunas</div>
          <CheckCircle className="stat-card-bg-icon" />
        </div>
        <div className="stat-card stat-card-warning">
          <div className="stat-card-label">Sisa Tunggakan</div>
          <div className="stat-card-value" style={{ fontSize:'1.1rem' }}>{formatRp(totalTunggakan)}</div>
          <div className="stat-card-sub">{totalSiswa - totalLunas} siswa belum bayar</div>
          <AlertTriangle className="stat-card-bg-icon" />
        </div>
        <div className="stat-card stat-card-info">
          <div className="stat-card-label">Realisasi</div>
          <div className="stat-card-value">{Math.round((totalMasuk / totalTertagih) * 100)}%</div>
          <div className="stat-card-sub">Dari target bulan ini</div>
          <Percent className="stat-card-bg-icon" />
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
            <strong>Transfer Bank</strong> masih menjadi metode paling banyak digunakan orang tua.
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
        <div style={{ fontWeight:700, color:'var(--emerald)', marginBottom:6 }}>Ringkasan Laporan</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem 2rem' }}>
          <div>• Total siswa aktif: <strong>{totalSiswa} siswa</strong></div>
          <div>• Target pemasukan: <strong>{formatRp(totalTertagih)}</strong></div>
          <div>• Siswa lunas: <strong>{totalLunas} siswa ({Math.round((totalLunas/totalSiswa)*100)}%)</strong></div>
          <div>• Dana terkumpul: <strong>{formatRp(totalMasuk)}</strong></div>
          <div>• Siswa belum bayar: <strong>{totalSiswa - totalLunas} siswa</strong></div>
          <div>• Sisa tunggakan: <strong>{formatRp(totalTunggakan)}</strong></div>
        </div>
        <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid rgba(5,150,105,0.15)', fontSize:'0.78rem', color:'var(--text-muted)' }}>
          💡 Klik tombol <strong>Export Laporan PDF</strong> di atas untuk mengunduh laporan dalam format PDF.
        </div>
      </div>
    </div>
  )
}