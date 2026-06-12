'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AlumniRow {
  id:           string
  nama:         string
  nisn:         string | null
  kelas:        string | null
  tahun_lulus:  string | null
  status:       string
}

export default function AlumniPage() {
  const router = useRouter()

  const [loading,     setLoading]     = useState(true)
  const [alumniList,  setAlumniList]  = useState<AlumniRow[]>([])
  const [search,      setSearch]      = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: pData } = await supabase
        .from('pengaturan')
        .select('setup_steps')
        .maybeSingle()

      const steps = (pData as { setup_steps?: Record<string, boolean> } | null)?.setup_steps ?? {}
      if (!steps['komponen_tagihan']) {
        router.replace('/tagihan/komponen')
        return
      }

      const { data } = await supabase
        .from('siswa')
        .select('id, nama, nisn, kelas, tahun_lulus, status')
        .eq('status', 'alumni')
        .order('nama')
        .limit(200)

      setAlumniList((data ?? []) as AlumniRow[])
      setLoading(false)
    })()
  }, [router])

  const filtered = alumniList.filter(s =>
    s.nama.toLowerCase().includes(search.toLowerCase()) ||
    (s.nisn ?? '').includes(search) ||
    (s.kelas ?? '').toLowerCase().includes(search.toLowerCase())
  )

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
          <h1 className="dashboard-title">Alumni</h1>
          <p className="dashboard-subtitle">Daftar siswa yang telah lulus</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: '1.25rem' }}>
        <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Cari nama, NISN, atau kelas..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '0.6rem 0.85rem 0.6rem 2.25rem',
            border: '1.5px solid var(--border)', borderRadius: 8,
            fontFamily: 'inherit', fontSize: '0.875rem',
            color: 'var(--text-dark)', outline: 'none', background: '#fff',
          }}
        />
      </div>

      {/* Tabel */}
      {alumniList.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
          padding: '4rem 2rem', textAlign: 'center',
        }}>
          <GraduationCap size={48} strokeWidth={1.2} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
            Belum ada data alumni
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Alumni akan muncul di sini setelah siswa ditandai sebagai lulusan.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>NAMA</th>
                <th>NISN</th>
                <th>KELAS TERAKHIR</th>
                <th>TAHUN LULUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="table-empty">Tidak ada alumni sesuai pencarian</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{s.nama}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {s.nisn ?? '—'}
                  </td>
                  <td>
                    {s.kelas
                      ? <span style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                          {s.kelas}
                        </span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-mid)' }}>
                    {s.tahun_lulus ?? '—'}
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
