'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface BeasiswaItem {
  id:           string
  nama:         string
  jenis:        'beasiswa' | 'override'
  kelas:        string | null
  persen:       number | null
  nominal:      number | null
  jumlah_siswa: number
}

export default function BeasiswaOverridePage() {
  const router = useRouter()

  const [loading,       setLoading]       = useState(true)
  const [beasiswaList,  setBeasiswaList]  = useState<BeasiswaItem[]>([])

  useEffect(() => {
    ;(async () => {
      const { data: pData } = await supabase
        .from('pengaturan')
        .select('setup_steps')
        .maybeSingle()

      const steps = (pData as { setup_steps?: Record<string, boolean> } | null)?.setup_steps ?? {}
      if (!steps['import_siswa']) {
        router.replace('/dashboard')
        return
      }

      setLoading(false)
    })()
  }, [router])

  const formatRp = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-content">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Beasiswa &amp; Override</h1>
          <p className="dashboard-subtitle">Kelola potongan beasiswa dan override tagihan per siswa</p>
        </div>
        <button
          style={{
            background: 'var(--navy)', color: '#fff', border: 'none',
            padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 700,
            fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={15} /> Tambah Beasiswa
        </button>
      </div>

      {/* Tab ringkasan */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Beasiswa Aktif', value: beasiswaList.filter(b => b.jenis === 'beasiswa').length, color: '#B45309', bg: '#FEF3C7' },
          { label: 'Total Override Aktif', value: beasiswaList.filter(b => b.jenis === 'override').length, color: '#7C3AED', bg: '#F5F3FF' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', borderLeft: `4px solid ${card.color}` }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
              {card.label.toUpperCase()}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {beasiswaList.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
          padding: '4rem 2rem', textAlign: 'center',
        }}>
          <Gift size={48} strokeWidth={1.2} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
            Belum ada beasiswa atau override
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Tambahkan program beasiswa atau override tagihan untuk siswa tertentu.
          </div>
          <button
            style={{
              background: 'var(--navy)', color: '#fff', border: 'none',
              padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 700,
              fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Tambah Beasiswa Pertama
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>NAMA PROGRAM</th>
                <th>JENIS</th>
                <th>KELAS</th>
                <th>NILAI POTONGAN</th>
                <th>PENERIMA</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {beasiswaList.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{b.nama}</td>
                  <td>
                    <span style={{
                      background: b.jenis === 'beasiswa' ? '#FEF3C7' : '#F5F3FF',
                      color:      b.jenis === 'beasiswa' ? '#B45309'  : '#7C3AED',
                      fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    }}>
                      {b.jenis === 'beasiswa' ? 'Beasiswa' : 'Override'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{b.kelas ?? 'Semua'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>
                    {b.persen != null ? `${b.persen}%` : b.nominal != null ? formatRp(b.nominal) : '—'}
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{b.jumlah_siswa} siswa</td>
                  <td>
                    <button
                      onClick={() => setBeasiswaList(prev => prev.filter(x => x.id !== b.id))}
                      style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 6, padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit' }}
                    >
                      <Trash2 size={13} /> Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
