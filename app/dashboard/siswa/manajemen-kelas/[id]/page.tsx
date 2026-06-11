'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, MessageCircle, Users, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface KelasDetail {
  id:          string
  nama:        string
  jenjang:     string
  warna:       string
  wali_kelas:  string | null
  tahun_ajaran: string
  semester:    string
}

interface SiswaRow {
  id:         string
  nama:       string
  nis:        string
  no_wa:      string | null
  nama_wali:  string | null
  status:     string
}

export default function KelasDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [kelas,   setKelas]   = useState<KelasDetail | null>(null)
  const [siswas,  setSiswas]  = useState<SiswaRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [{ data: kelasData }, { data: siswaData }] = await Promise.all([
        supabase
          .from('kelas')
          .select('id, nama, jenjang, warna, wali_kelas, tahun_ajaran, semester')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('siswa')
          .select('id, nama, nis, no_wa, nama_wali, status')
          .eq('kelas_id', id)
          .order('nama')
          .limit(200),
      ])
      setKelas(kelasData as KelasDetail | null)
      setSiswas((siswaData ?? []) as SiswaRow[])
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  if (!kelas) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Kelas tidak ditemukan.
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-content">

      {/* Header */}
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => router.push('/dashboard/siswa/manajemen-kelas')}
            style={{
              background: 'none', border: '1.5px solid #1A2C4E', borderRadius: 8,
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--navy)', flexShrink: 0, padding: 0,
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="dashboard-title">Kelas {kelas.nama}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
              <span style={{ ...sBadge, background: kelas.warna + '18', color: kelas.warna, border: `1px solid ${kelas.warna}40` }}>
                {kelas.tahun_ajaran} · Sem. {kelas.semester}
              </span>
              <span style={{ ...sBadge }}>
                <Users size={11} style={{ display: 'inline', marginRight: 4 }} />
                {siswas.length} siswa
              </span>
            </div>
          </div>
        </div>

        {/* Tombol Edit */}
        <button
          onClick={() => router.push(`/dashboard/siswa/manajemen-kelas/${id}/edit`)}
          style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}
        >
          <Pencil size={13} /> Edit Kelas
        </button>

        {/* Wali kelas */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
            Wali Kelas
          </div>
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.95rem' }}>
            {kelas.wali_kelas ?? <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontStyle: 'italic' }}>Belum ditentukan</span>}
          </div>
        </div>
      </div>

      {/* Tabel siswa */}
      {siswas.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👤</div>
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.35rem' }}>Belum ada siswa</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Siswa di kelas ini belum diimport ke sistem.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>NO</th>
                <th>NAMA SISWA</th>
                <th>NIS</th>
                <th>NAMA WALI</th>
                <th>NO WA WALI</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {siswas.map((s, idx) => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', width: 40 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{s.nama}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-mid)' }}>{s.nis ?? '—'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-mid)' }}>{s.nama_wali ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-mid)' }}>
                    {s.no_wa ?? '—'}
                  </td>
                  <td>
                    {s.no_wa ? (
                      <a
                        href={`https://wa.me/${s.no_wa.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: '#DCFCE7', color: '#15803D',
                          borderRadius: 6, padding: '0.3rem 0.75rem',
                          fontSize: '0.78rem', fontWeight: 600,
                          textDecoration: 'none', whiteSpace: 'nowrap',
                        }}
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                    )}
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

const sBtnSecondary: React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }

const sBadge: React.CSSProperties = {
  background: '#F1F5F9', color: 'var(--navy-dark)',
  fontSize: '0.75rem', fontWeight: 600,
  padding: '0.25rem 0.75rem', borderRadius: 20,
  border: '1px solid var(--border)',
  display: 'inline-flex', alignItems: 'center',
}
