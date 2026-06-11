'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PaketItem {
  id:       string
  nama:     string
  kelas:    string
  total:    number
  komponen: number
}

export default function PaketPerKelasPage() {
  const router = useRouter()

  const [loading,   setLoading]   = useState(true)
  const [paketList, setPaketList] = useState<PaketItem[]>([])

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

      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Paket per Kelas</h1>
          <p className="dashboard-subtitle">Atur bundel komponen tagihan berdasarkan kelas</p>
        </div>
        <button
          style={{
            background: 'var(--navy)', color: '#fff', border: 'none',
            padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 700,
            fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={15} /> Tambah Paket
        </button>
      </div>

      {paketList.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
          padding: '4rem 2rem', textAlign: 'center',
        }}>
          <Package size={48} strokeWidth={1.2} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
            Belum ada paket tagihan
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Buat paket tagihan yang berisi kumpulan komponen untuk tiap kelas.
          </div>
          <button
            style={{
              background: 'var(--navy)', color: '#fff', border: 'none',
              padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 700,
              fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={14} /> Buat Paket Pertama
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>NAMA PAKET</th>
                <th>KELAS</th>
                <th>JUMLAH KOMPONEN</th>
                <th>TOTAL TAGIHAN</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {paketList.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{p.nama}</td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{p.kelas}</td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{p.komponen} komponen</td>
                  <td style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{formatRp(p.total)}</td>
                  <td>
                    <button
                      onClick={() => setPaketList(prev => prev.filter(x => x.id !== p.id))}
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
