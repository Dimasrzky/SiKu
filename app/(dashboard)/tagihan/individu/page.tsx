'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface OverrideItem {
  id:          string
  nama:        string
  siswa_nama:  string
  kelas:       string | null
  nominal:     number
  keterangan:  string | null
}

export default function OverridePage() {
  const router = useRouter()

  const [loading,      setLoading]      = useState(true)
  const [overrideList, setOverrideList] = useState<OverrideItem[]>([])

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
          <h1 className="dashboard-title">TKomponen Individu</h1>
          <p className="dashboard-subtitle">Atur nominal tagihan khusus per siswa di luar paket standar</p>
        </div>
        <button
          style={{
            background: 'var(--navy)', color: '#fff', border: 'none',
            padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 700,
            fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={15} /> Tambah Override
        </button>
      </div>

      {/* Ringkasan */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Override Aktif', value: overrideList.length,                              color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Total Nominal Override', value: formatRp(overrideList.reduce((s, o) => s + o.nominal, 0)), color: '#0369A1', bg: '#E0F2FE' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', borderLeft: `4px solid ${card.color}` }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
              {card.label.toUpperCase()}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Konten */}
      {overrideList.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
          padding: '4rem 2rem', textAlign: 'center',
        }}>
          <SlidersHorizontal size={48} strokeWidth={1.2} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
            Belum ada override tagihan
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Override digunakan untuk mengatur nominal tagihan khusus bagi siswa tertentu di luar paket standar kelas.
          </div>
          <button
            style={{
              background: 'var(--navy)', color: '#fff', border: 'none',
              padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 700,
              fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Tambah Override Pertama
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SISWA</th>
                <th>KELAS</th>
                <th>NOMINAL OVERRIDE</th>
                <th>KETERANGAN</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {overrideList.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{o.siswa_nama}</td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{o.kelas ?? '—'}</td>
                  <td style={{ fontWeight: 700, color: '#7C3AED' }}>{formatRp(o.nominal)}</td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{o.keterangan ?? '—'}</td>
                  <td>
                    <button
                      onClick={() => setOverrideList(prev => prev.filter(x => x.id !== o.id))}
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
