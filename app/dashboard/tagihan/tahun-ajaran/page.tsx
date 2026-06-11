'use client'

import { useState, useEffect } from 'react'



import Image from 'next/image'
import { supabase } from '@/lib/supabase'

interface SemesterState {
  ganjil: { mulai: string; selesai: string }
  genap:  { mulai: string; selesai: string }
}

const STEP_ORDER = ['profil_sekolah', 'tahun_ajaran', 'komponen_tagihan', 'buat_kelas', 'import_siswa']
const THIS_STEP_INDEX = 1 // tahun_ajaran = langkah ke-2

const sLabel: React.CSSProperties = {
  display: 'block', fontSize: '1rem', fontWeight: 700,
  color: 'var(--text-mid)', marginBottom: 6,
}
const sInput: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.85rem',
  border: '2px solid #68748A', borderRadius: 8,
  fontFamily: 'inherit', fontSize: '0.875rem',
  color: 'var(--text-dark)', outline: 'none', background: '#fff',
  boxShadow: '0 0 12px rgba(31, 86, 167, 0.437)',
}

export default function TahunAjaranSetupPage() {
  const [pageLoading, setPageLoading] = useState(true)
  const [setupSteps,  setSetupSteps]  = useState<Record<string, boolean>>({})
  const [nama,        setNama]        = useState('')
  const [mulai,       setMulai]       = useState('')
  const [selesai,     setSelesai]     = useState('')
  const [semester,    setSemester]    = useState<SemesterState>({
    ganjil: { mulai: '', selesai: '' },
    genap:  { mulai: '', selesai: '' },
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('pengaturan').select('setup_steps').maybeSingle()
      if (data?.setup_steps) setSetupSteps(data.setup_steps as Record<string, boolean>)
      setPageLoading(false)
    }
    init()
  }, [])

  // Hitung otomatis pembagian semester — dipanggil dari handler onChange tanggal
  function calcSemester(tMulai: string, tSelesai: string): SemesterState | null {
    const d1 = new Date(tMulai).getTime()
    const d2 = new Date(tSelesai).getTime()
    if (!tMulai || !tSelesai || d2 <= d1) return null
    const mid     = new Date(Math.floor((d1 + d2) / 2))
    const midNext = new Date(mid.getTime() + 86400000)
    return {
      ganjil: { mulai: tMulai,                             selesai: mid.toISOString().split('T')[0] },
      genap:  { mulai: midNext.toISOString().split('T')[0], selesai: tSelesai },
    }
  }

  // Hitung jumlah dot hijau: completed before this step + 1 (current)
  const completedBefore = STEP_ORDER.slice(0, THIS_STEP_INDEX).filter(k => setupSteps[k]).length
  const greenCount      = completedBefore + 1

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
    const res = await fetch('/api/setup-step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        step: 'tahun_ajaran',
        data: {
          nama:                    nama.trim(),
          tanggal_mulai:           mulai,
          tanggal_selesai:         selesai,
          semester_ganjil_mulai:   semester.ganjil.mulai,
          semester_ganjil_selesai: semester.ganjil.selesai,
          semester_genap_mulai:    semester.genap.mulai,
          semester_genap_selesai:  semester.genap.selesai,
        },
      }),
    })

    const json = await res.json() as { error?: string }
    if (!res.ok) { setError(json.error ?? 'Gagal menyimpan.'); setSaving(false); return }

    try { localStorage.removeItem('siku_setup_steps') } catch { /* ignore */ }
    setSuccess(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 1800)
  }

  if (pageLoading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat...
        </div>
      </div>
    )
  }

  const hasDates = !!mulai && !!selesai && new Date(selesai) > new Date(mulai)

  return (
    <>
    {success && (
      <div style={{
        position: 'fixed', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#1A2C4E', color: '#fff',
        padding: '0.85rem 1.5rem',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(26,44,78,0.45)',
        display: 'flex', alignItems: 'center', gap: '0.65rem',
        fontWeight: 600, fontSize: '0.95rem',
        whiteSpace: 'nowrap',
        animation: 'slideDown 0.3s ease',
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: '#69C183',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: '0.75rem',
        }}>✓</span>
        Tahun ajaran berhasil disimpan!
      </div>
    )}
    <style>{`
      @keyframes slideDown {
        from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `}</style>
    <div className="dashboard-content">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 60, height: 60, background: '#1A2C4E', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)',
          }}>
            <Image src="/icons/IconCalender.png" width={35} height={35} alt="Kalender" />
          </div>
          <div>
            <h1 style={{
              fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)',
              fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2,
            }}>
              Atur tahun ajaran
            </h1>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              Langkah 2 dari 5
            </p>
          </div>
        </div>

        {/* Progress dots */}
        <style>{`
          @keyframes dot-blink {
            0%, 100% { background-color: #69C183; }
            50%       { background-color: #CBD5E1; }
          }
          .dot-active { animation: dot-blink 1.8s ease-in-out infinite; }
        `}</style>
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
          {STEP_ORDER.map((_, i) => {
            const isActive = i === greenCount - 1
            return (
              <div
                key={i}
                className={isActive ? 'dot-active' : undefined}
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  position: 'relative',
                  bottom: 10,
                  right: 6,
                  background: i < greenCount ? '#69C183' : '#CBD5E1',
                  transition: 'background 0.2s',
                  boxShadow: '3px 6px 14px rgba(26, 44, 78, 0.58)',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* ── Info Banner ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        background: '#1A2C4E', borderRadius: 12,
        padding: '1rem 1.25rem', marginBottom: '1rem', color: '#fff',
        boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)',
      }}>
        <p style={{ flex: 1, fontSize: '1.25rem', lineHeight: 1.65, margin: 0 }}>
          Tahun ajaran adalah fondasi dari semua tagihan di SiKu. Isi periode di bawah
          lalu sistem akan <br />otomatis membagi semester Ganjil dan Genap.
        </p>
        <div style={{
          flexShrink: 0, marginLeft: 'auto', width: 40, height: 40,
          background: '#F7DD7D', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          top: '-0.4rem',
          right: '-0.65rem',
        }}>
          <Image src="/icons/IconTSeru.png" width={3.5} height={3.5} alt="Info" style={{ display: 'block' }} />
        </div>
      </div>

      {/* ── Card Form ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid var(--border)',
        borderLeft: '30px solid var(--navy)', borderRadius: 12,
        padding: '1.5rem 1.75rem',
        boxShadow: '10px 16px 14px rgba(18, 47, 102, 0.31)',
      }}>

        {error && (
          <div style={{
            background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8,
            padding: '0.65rem 1rem', marginBottom: '1.25rem',
            fontSize: '0.85rem', color: '#DC2626',
          }}>
            {error}
          </div>
        )}

        {/* Baris form */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={sLabel}>Nama tahun ajaran</label>
            <input
              type="text"
              placeholder="Contoh: 2025/2026"
              value={nama}
              onChange={e => setNama(e.target.value)}
              style={sInput}
            />
          </div>
          <div>
            <label style={sLabel}>Tanggal mulai</label>
            <input
              type="date"
              value={mulai}
              onChange={e => {
                setMulai(e.target.value)
                const calc = calcSemester(e.target.value, selesai)
                if (calc) setSemester(calc)
              }}
              style={sInput}
            />
          </div>
          <div>
            <label style={sLabel}>Tanggal selesai</label>
            <input
              type="date"
              value={selesai}
              onChange={e => {
                setSelesai(e.target.value)
                const calc = calcSemester(mulai, e.target.value)
                if (calc) setSemester(calc)
              }}
              style={sInput}
            />
          </div>
        </div>

        {/* Pembagian semester */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
            <label style={{ ...sLabel, marginBottom: 0 }}>Pembagian semester</label>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Otomatis dan dapat diedit</span>
          </div>

          {!hasDates ? (
            <div style={{
              border: '2px solid #68748A', borderRadius: 10,
              padding: '2rem', textAlign: 'center',
              color: '#6F788A', display: 'flex', flexDirection: 'column',
              fontWeight: 600, fontSize: '0.9rem',
              alignItems: 'center', gap: '1.6rem',
              boxShadow: '0 0 12px rgba(31, 85, 167, 0.58)',
            }}>
              <Image src="/icons/IconNotDate.png" width={65} height={65} alt="Belum ada tanggal" />
              <span style={{ fontSize: '0.875rem' }}>Isi tanggal mulai &amp; selesai untuk melihat pembagian semester</span>
            </div>
          ) : (
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Semester Ganjil */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem', padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy-dark)' }}>Semester Ganjil</span>
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3 }}>Mulai</label>
                  <input
                    type="date"
                    value={semester.ganjil.mulai}
                    onChange={e => setSemester(s => ({ ...s, ganjil: { ...s.ganjil, mulai: e.target.value } }))}
                    style={{ ...sInput, fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3 }}>Selesai</label>
                  <input
                    type="date"
                    value={semester.ganjil.selesai}
                    onChange={e => setSemester(s => ({ ...s, ganjil: { ...s.ganjil, selesai: e.target.value } }))}
                    style={{ ...sInput, fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              {/* Semester Genap */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem', padding: '1rem 1.25rem',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy-dark)' }}>Semester Genap</span>
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3 }}>Mulai</label>
                  <input
                    type="date"
                    value={semester.genap.mulai}
                    onChange={e => setSemester(s => ({ ...s, genap: { ...s.genap, mulai: e.target.value } }))}
                    style={{ ...sInput, fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ ...sLabel, marginBottom: 3 }}>Selesai</label>
                  <input
                    type="date"
                    value={semester.genap.selesai}
                    onChange={e => setSemester(s => ({ ...s, genap: { ...s.genap, selesai: e.target.value } }))}
                    style={{ ...sInput, fontSize: '0.82rem' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer: catatan + tombol */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0, position: 'relative', top: '-2rem', fontWeight: 500 }}>
            <span style={{ fontWeight: 700 }}>ⓘ</span>{' '}
            Tahun ajaran ini akan langsung diset sebagai aktif karena ini setup pertama.
          </p>
          <button
            onClick={handleSimpan}
            disabled={saving}
            style={{
              flexShrink: 0,
              background: saving ? '#D1D5DB' : '#F7DD7D',
              color: '#1A2C4E',
              border: 'none',
              padding: '0.7rem 1.5rem',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
              boxShadow: '0 5px 2px rgba(18, 47, 102, 0.31)',
              marginTop: '2.2rem',
            }}
          >
            {saving ? 'Menyimpan...' : 'Simpan & Lanjutkan →'}
          </button>
        </div>

      </div>
    </div>
    </>
  )
}
