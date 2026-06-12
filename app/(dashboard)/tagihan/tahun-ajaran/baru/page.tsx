'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SemesterState {
  ganjil: { mulai: string; selesai: string }
  genap:  { mulai: string; selesai: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextTahunAjaran(current: string): string {
  // current: "2025/2026" → "2026/2027"
  const parts = current.split('/')
  if (parts.length === 2) {
    const y2 = parseInt(parts[1], 10)
    if (!isNaN(y2)) return `${y2}/${y2 + 1}`
  }
  const year = new Date().getFullYear()
  return `${year}/${year + 1}`
}

function buildOptions(current: string): string[] {
  const next = nextTahunAjaran(current)
  const parts = next.split('/')
  const base  = parseInt(parts[0], 10)
  if (isNaN(base)) return [next]
  return Array.from({ length: 3 }, (_, i) => `${base + i}/${base + i + 1}`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TambahTahunAjaranPage() {
  const router = useRouter()

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [nama,     setNama]     = useState('')
  const [mulai,    setMulai]    = useState('')
  const [selesai,  setSelesai]  = useState('')
  const [semester, setSemester] = useState<SemesterState>({
    ganjil: { mulai: '', selesai: '' },
    genap:  { mulai: '', selesai: '' },
  })
  const [options, setOptions] = useState<string[]>([])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('tahun_ajaran')
        .select('nama')
        .eq('is_aktif', true)
        .maybeSingle()

      const currentNama = (data as { nama?: string } | null)?.nama ?? ''
      const opts = buildOptions(currentNama)
      setOptions(opts)
      setNama(opts[0] ?? '')
      setLoading(false)
    })()
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function calcSemester(tMulai: string, tSelesai: string): SemesterState | null {
    const d1 = new Date(tMulai).getTime()
    const d2 = new Date(tSelesai).getTime()
    if (!tMulai || !tSelesai || d2 <= d1) return null
    const mid     = new Date(Math.floor((d1 + d2) / 2))
    const midNext = new Date(mid.getTime() + 86400000)
    return {
      ganjil: { mulai: tMulai,                              selesai: mid.toISOString().split('T')[0] },
      genap:  { mulai: midNext.toISOString().split('T')[0], selesai: tSelesai },
    }
  }

  const handleSimpan = async () => {
    setError('')
    if (!nama.trim())         { setError('Nama tahun ajaran wajib diisi.'); return }
    if (!mulai)               { setError('Tanggal mulai wajib diisi.'); return }
    if (!selesai)             { setError('Tanggal selesai wajib diisi.'); return }
    if (new Date(selesai) <= new Date(mulai)) { setError('Tanggal selesai harus setelah tanggal mulai.'); return }
    if (!semester.ganjil.mulai || !semester.ganjil.selesai ||
        !semester.genap.mulai  || !semester.genap.selesai) {
      setError('Pembagian semester belum lengkap.'); return
    }

    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/tahun-ajaran', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        nama:                    nama.trim(),
        tanggal_mulai:           mulai,
        tanggal_selesai:         selesai,
        semester_ganjil_mulai:   semester.ganjil.mulai,
        semester_ganjil_selesai: semester.ganjil.selesai,
        semester_genap_mulai:    semester.genap.mulai,
        semester_genap_selesai:  semester.genap.selesai,
      }),
    })

    const json = await res.json() as { error?: string }
    if (!res.ok) { setError(json.error ?? 'Gagal menyimpan.'); setSaving(false); return }
    router.push('/tagihan/tahun-ajaran')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hasDates = !!mulai && !!selesai && new Date(selesai) > new Date(mulai)

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
          <button onClick={() => router.push('/tagihan/tahun-ajaran')}
            style={{ background: 'none', border: '1.5px solid #1A2C4E', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--navy)', flexShrink: 0, padding: 0 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="dashboard-title">Tambah Tahun Ajaran Baru</h1>
            <p className="dashboard-subtitle">{nama || '—'}</p>
          </div>
        </div>
        <button onClick={handleSimpan} disabled={saving}
          style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1.25rem', opacity: saving ? 0.6 : 1 }}>
          <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Ajaran Baru'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#DC2626' }}>
          {error}
        </div>
      )}

      {/* Form Card */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem 1.75rem' }}>

        {/* Baris atas */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={sLabel}>Nama tahun ajaran</label>
            <select value={nama} onChange={e => setNama(e.target.value)} style={{ ...sInput, appearance: 'auto', cursor: 'pointer' }}>
              {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label style={sLabel}>Tanggal mulai</label>
            <input type="date" value={mulai}
              onChange={e => { setMulai(e.target.value); const c = calcSemester(e.target.value, selesai); if (c) setSemester(c) }}
              style={sInput} />
          </div>
          <div>
            <label style={sLabel}>Tanggal selesai</label>
            <input type="date" value={selesai}
              onChange={e => { setSelesai(e.target.value); const c = calcSemester(mulai, e.target.value); if (c) setSemester(c) }}
              style={sInput} />
          </div>
        </div>

        {/* Pembagian semester */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ ...sLabel, marginBottom: 0 }}>Pembagian semester</label>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Otomatis dan dapat diedit</span>
          </div>

          {!hasDates ? (
            <div style={{ border: '2px solid #68748A', borderRadius: 10, padding: '2rem', textAlign: 'center', color: '#6F788A', display: 'flex', flexDirection: 'column', fontWeight: 600, fontSize: '0.9rem', alignItems: 'center', gap: '1.6rem', boxShadow: '0 0 12px rgba(31, 85, 167, 0.58)' }}>
              <Image src="/icons/IconNotDate.png" width={65} height={65} alt="Belum ada tanggal" />
              <span style={{ fontSize: '0.875rem' }}>Isi tanggal mulai &amp; selesai untuk melihat pembagian semester</span>
            </div>
          ) : (
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Semester Ganjil */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy-dark)' }}>Semester Ganjil</span>
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3 }}>Mulai</label>
                  <input type="date" value={semester.ganjil.mulai}
                    onChange={e => setSemester(s => ({ ...s, ganjil: { ...s.ganjil, mulai: e.target.value } }))}
                    style={{ ...sInput, fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3 }}>Selesai</label>
                  <input type="date" value={semester.ganjil.selesai}
                    onChange={e => setSemester(s => ({ ...s, ganjil: { ...s.ganjil, selesai: e.target.value } }))}
                    style={{ ...sInput, fontSize: '0.82rem' }} />
                </div>
              </div>
              {/* Semester Genap */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem 1.25rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy-dark)' }}>Semester Genap</span>
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3 }}>Mulai</label>
                  <input type="date" value={semester.genap.mulai}
                    onChange={e => setSemester(s => ({ ...s, genap: { ...s.genap, mulai: e.target.value } }))}
                    style={{ ...sInput, fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3 }}>Selesai</label>
                  <input type="date" value={semester.genap.selesai}
                    onChange={e => setSemester(s => ({ ...s, genap: { ...s.genap, selesai: e.target.value } }))}
                    style={{ ...sInput, fontSize: '0.82rem' }} />
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sLabel:      React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--text-mid)', marginBottom: 6 }
const sInput:      React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2px solid #68748A', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', outline: 'none', background: '#fff', boxShadow: '0 0 12px rgba(31, 86, 167, 0.437)' }
const sBtnPrimary: React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
