'use client'

import { BarChart2, Wrench, TrendingUp, PieChart, Download, Filter } from 'lucide-react'

const FITUR = [
  { icon: TrendingUp, label: 'Grafik tren pemasukan bulanan'    },
  { icon: PieChart,   label: 'Distribusi metode & kelas'        },
  { icon: Download,   label: 'Export laporan PDF & Excel'       },
  { icon: Filter,     label: 'Filter periode & tahun ajaran'    },
]

export default function LaporanPage() {
  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Laporan</h1>
          <p className="dashboard-subtitle">Laporan keuangan sekolah</p>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 500 }}>

          {/* Ikon utama */}
          <div style={{
            width: 92,
            height: 92,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
            border: '1.5px solid #BBF7D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.75rem',
            boxShadow: '0 4px 20px rgba(5,150,105,0.12)',
          }}>
            <BarChart2 size={44} color="#059669" strokeWidth={1.5} />
          </div>

          {/* Badge status */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#FEF9C3',
            color: '#854D0E',
            padding: '0.3rem 1rem',
            borderRadius: 20,
            fontSize: '0.75rem',
            fontWeight: 700,
            marginBottom: '1.25rem',
            border: '1px solid #FDE68A',
            letterSpacing: '0.04em',
          }}>
            <Wrench size={12} strokeWidth={2.5} />
            SEDANG DALAM PENGEMBANGAN
          </div>

          <h2 style={{
            fontSize: '1.45rem',
            fontWeight: 700,
            color: 'var(--navy-dark)',
            marginBottom: '0.75rem',
            lineHeight: 1.3,
          }}>
            Modul Laporan
          </h2>

          <p style={{
            fontSize: '0.88rem',
            color: 'var(--text-muted)',
            lineHeight: 1.75,
            marginBottom: '2rem',
            maxWidth: 400,
            margin: '0 auto 2rem',
          }}>
            Halaman ini sedang dalam pengembangan. Laporan keuangan lengkap,
            grafik tren, dan fitur ekspor akan segera tersedia.
          </p>

          {/* Daftar fitur yang akan datang */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.65rem',
            textAlign: 'left',
            maxWidth: 440,
            margin: '0 auto',
          }}>
            {FITUR.map(({ icon: Icon, label }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#F8FAFC',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.7rem 0.9rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <Icon size={15} color="#059669" strokeWidth={2} style={{ flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
