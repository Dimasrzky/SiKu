'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const WARNA_OPTIONS = [
  '#1E3A8A', '#1D4ED8', '#0891B2', '#059669',
  '#7C3AED', '#BE185D', '#DC2626', '#D97706',
  '#92400E', '#374151',
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface KelasDetail {
  id:           string
  nama:         string
  jenjang:      string
  warna:        string
  wali_kelas:   string | null
  tahun_ajaran: string
  semester:     string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditKelasPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id as string

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [nama,        setNama]        = useState('')
  const [warna,       setWarna]       = useState('#1D4ED8')
  const [waliKelas,   setWaliKelas]   = useState('')
  const [tahunAjaran, setTahunAjaran] = useState('')
  const [semester,    setSemester]    = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('kelas')
        .select('id, nama, jenjang, warna, wali_kelas, tahun_ajaran, semester')
        .eq('id', id)
        .maybeSingle()

      if (data) {
        const row = data as KelasDetail
        setNama(row.nama)
        setWarna(row.warna ?? '#1D4ED8')
        setWaliKelas(row.wali_kelas ?? '')
        setTahunAjaran(row.tahun_ajaran)
        setSemester(row.semester)
      }

      setLoading(false)
    })()
  }, [id])

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSimpan = async () => {
    setError('')
    setSaving(true)

    const { error: updateError } = await supabase
      .from('kelas')
      .update({
        warna,
        wali_kelas: waliKelas.trim() || null,
      })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message ?? 'Gagal menyimpan.')
      setSaving(false)
      return
    }

    router.push(`/siswa/manajemen-kelas/${id}`)
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => router.push(`/siswa/manajemen-kelas/${id}`)}
            style={{ background: 'none', border: '1.5px solid #1A2C4E', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--navy)', flexShrink: 0, padding: 0 }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="dashboard-title">Edit Kelas</h1>
            <p className="dashboard-subtitle">{nama} · {tahunAjaran} · Sem. {semester}</p>
          </div>
        </div>
        <button onClick={handleSimpan} disabled={saving}
          style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1.25rem', opacity: saving ? 0.6 : 1 }}>
          <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#DC2626' }}>
          {error}
        </div>
      )}

      {/* Form Card */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem 1.75rem' }}>

        {/* Periode — text only */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Periode</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={sViewItem}>
              <span style={sViewLabel}>Tahun Ajaran</span>
              <span style={sViewValue}>{tahunAjaran || '—'}</span>
            </div>
            <div style={sViewItem}>
              <span style={sViewLabel}>Semester</span>
              <span style={sViewValue}>Semester {semester || '—'}</span>
            </div>
          </div>
        </div>

        {/* Warna kelas */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={sLabel}>Warna Kelas</label>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {WARNA_OPTIONS.map(w => (
              <button key={w} onClick={() => setWarna(w)}
                style={{
                  width: 30, height: 30, borderRadius: 8, background: w, cursor: 'pointer',
                  border: warna === w ? '3px solid #1E3A8A' : '2px solid transparent',
                  outline: warna === w ? '2px solid #fff' : 'none', outlineOffset: -4,
                  boxShadow: `0 2px 6px ${w}55`,
                  transform: warna === w ? 'scale(1.18)' : 'scale(1)', transition: 'transform 0.12s',
                }}
              />
            ))}

            {/* Rainbow custom picker */}
            <label title="Pilih warna kustom" style={{ position: 'relative', width: 30, height: 30, cursor: 'pointer' }}>
              <input type="color" value={warna} onChange={e => setWarna(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%' }} />
              <div style={{
                width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: !WARNA_OPTIONS.includes(warna)
                  ? warna
                  : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                transform: !WARNA_OPTIONS.includes(warna) ? 'scale(1.18)' : 'scale(1)',
                boxShadow: !WARNA_OPTIONS.includes(warna) ? `0 0 0 2px #fff, 0 0 0 4px ${warna}` : 'none',
                transition: 'transform 0.12s',
              }}>
                {WARNA_OPTIONS.includes(warna) && (
                  <span style={{ fontSize: '0.65rem', color: '#fff', lineHeight: 1 }}>✦</span>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Wali kelas */}
        <div>
          <label style={sLabel}>Wali Kelas</label>
          <input
            type="text"
            style={sInput}
            placeholder="Nama guru wali kelas..."
            value={waliKelas}
            onChange={e => setWaliKelas(e.target.value)}
          />
        </div>

      </div>
    </div>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sLabel:     React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 6 }
const sInput:     React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2px solid #68748A', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', outline: 'none', background: '#fff', boxShadow: '0 0 12px rgba(31, 86, 167, 0.437)' }
const sBtnPrimary: React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sViewItem:  React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.875rem' }
const sViewLabel: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const sViewValue: React.CSSProperties = { fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-dark)' }
