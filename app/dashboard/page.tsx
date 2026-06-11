'use client'

import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Wrench, BarChart2, CreditCard, Bell, TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SetupChecklist } from '@/components/SetupChecklist'

const FITUR = [
  { icon: TrendingUp,      label: 'Rekap tagihan bulanan'              },
  { icon: CreditCard,      label: 'Monitor pembayaran real-time'       },
  { icon: Bell,            label: 'Notifikasi WhatsApp otomatis'       },
  { icon: BarChart2,       label: 'Laporan & grafik keuangan'          },
]

export default function DashboardPage() {
  const [hasSiswa, setHasSiswa] = useState<boolean | null>(null)

  useEffect(() => {
    supabase
      .from('siswa')
      .select('id', { count: 'exact', head: true })
      .then(({ count }: { count: number | null }) => setHasSiswa((count ?? 0) > 0))
  }, [])

  if (hasSiswa === null) {
    return (
      <div className="dashboard-content">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Memuat data...</span>
        </div>
      </div>
    )
  }

  if (!hasSiswa) {
    return (
      <div className="dashboard-content">
        <SetupChecklist />
      </div>
    )
  }

  return (
    <div className="dashboard-content">

      <SetupChecklist />

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
            background: 'linear-gradient(135deg, #EFF6FF 0%, #E0E7FF 100%)',
            border: '1.5px solid #C7D2FE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.75rem',
            boxShadow: '0 4px 20px rgba(99,102,241,0.12)',
          }}>
            <LayoutDashboard size={44} color="#4F46E5" strokeWidth={1.5} />
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
            Dashboard Utama
          </h2>

          <p style={{
            fontSize: '0.88rem',
            color: 'var(--text-muted)',
            lineHeight: 1.75,
            maxWidth: 400,
            margin: '0 auto 2rem',
          }}>
            Halaman ini sedang dalam pengembangan. Ringkasan keuangan,
            statistik real-time, dan notifikasi akan segera tersedia.
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
                <Icon size={15} color="#4F46E5" strokeWidth={2} style={{ flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
