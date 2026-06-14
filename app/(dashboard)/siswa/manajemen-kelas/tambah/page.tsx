'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

const WARNA_OPTIONS = [
  '#944949', '#2F1F1F', '#2B7B2B', '#5E3333',
  '#401568', '#704E4E', '#AF9191'
]

const JENJANG_MAP: Record<string, string[]> = {
  TK:  ['A', 'B', 'C'],
  SD:  ['1', '2', '3', '4', '5', '6'],
  SMP: ['7', '8', '9'],
  SMA: ['10', '11', '12'],
  SMK: ['10', '11', '12'],
}

export default function TambahKelasPage() {
  const router = useRouter()

  const [availableTingkat, setAvailableTingkat] = useState<string[]>([])
  const [loading,          setLoading]          = useState(true)
  const [tahunAjaran,      setTahunAjaran]      = useState('')
  const [semester,         setSemester]         = useState('')

  const [formJenjang,       setFormJenjang]       = useState('')
  const [formIdentitasList, setFormIdentitasList] = useState<string[]>([''])
  const [formWarna,         setFormWarna]         = useState(WARNA_OPTIONS[0])
  const [saving,            setSaving]            = useState(false)
  const [error,             setError]             = useState('')

  const isCustomWarna = !WARNA_OPTIONS.includes(formWarna)

  useEffect(() => {
    const load = async () => {
      const [{ data: pData }, { data: kData }, { data: taData }] = await Promise.all([
        supabase.from('pengaturan').select('jenjang_sekolah').maybeSingle(),
        supabase.from('kelas').select('jenjang'),
        supabase.from('tahun_ajaran')
          .select('nama, semester_ganjil_mulai, semester_ganjil_selesai, semester_genap_mulai, semester_genap_selesai')
          .eq('is_aktif', true)
          .maybeSingle(),
      ])

      const jenjangSekolah = (pData as { jenjang_sekolah?: string } | null)?.jenjang_sekolah ?? 'SMP'
      const allTingkat     = JENJANG_MAP[jenjangSekolah] ?? JENJANG_MAP['SMP']
      const existingSet    = new Set((kData ?? []).map((k: { jenjang: string }) => k.jenjang))
      setAvailableTingkat(allTingkat.filter(t => !existingSet.has(t)))

      if (taData) {
        type TaRow = {
          nama: string
          semester_ganjil_mulai?: string; semester_ganjil_selesai?: string
          semester_genap_mulai?: string;  semester_genap_selesai?: string
        }
        const ta = taData as TaRow
        setTahunAjaran(ta.nama)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        let sem = today.getMonth() + 1 >= 7 ? 'Ganjil' : 'Genap'
        if (ta.semester_ganjil_mulai && ta.semester_ganjil_selesai) {
          const s = new Date(ta.semester_ganjil_mulai); const e = new Date(ta.semester_ganjil_selesai)
          if (today >= s && today <= e) sem = 'Ganjil'
        }
        if (ta.semester_genap_mulai && ta.semester_genap_selesai) {
          const s = new Date(ta.semester_genap_mulai); const e = new Date(ta.semester_genap_selesai)
          if (today >= s && today <= e) sem = 'Genap'
        }
        setSemester(sem)
      }

      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [])

  const addIdentitas    = () => setFormIdentitasList(prev => [...prev, ''])
  const removeIdentitas = (i: number) => setFormIdentitasList(prev => prev.filter((_, idx) => idx !== i))
  const updateIdentitas = (i: number, val: string) => setFormIdentitasList(prev => prev.map((v, idx) => idx === i ? val : v))

  const handleSimpan = async () => {
    setError('')
    if (!formJenjang) { setError('Tingkat kelas harus dipilih.'); return }
    const validIds = formIdentitasList.filter(i => i.trim())
    if (validIds.length === 0) { setError('Identitas kelas harus diisi.'); return }
    if (!tahunAjaran) { setError('Tahun ajaran aktif tidak ditemukan.'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sesi tidak ditemukan.'); setSaving(false); return }

    const { data: profile } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).single()
    if (!profile?.sekolah_id) { setError('Data sekolah tidak ditemukan.'); setSaving(false); return }

    const { error: insertError } = await supabase.from('kelas').insert(
      validIds.map(id => ({
        sekolah_id:   profile.sekolah_id,
        nama:         `${formJenjang}-${id.trim().toUpperCase()}`,
        jenjang:      formJenjang,
        warna:        formWarna,
        tahun_ajaran: tahunAjaran,
        semester,
      }))
    )

    if (insertError) { setError(insertError.message); setSaving(false); return }
    router.push('/siswa/manajemen-kelas')
  }

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  const validIds = formIdentitasList.filter(i => i.trim())

  return (
    <div className="dashboard-content">
      <style>{`@keyframes formSlideDown { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Header */}
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-title">Tambah kelas</h1>
          <p className="dashboard-subtitle">Tambahkan tingkat kelas baru ke daftar kelas</p>
        </div>
      </div>

      {/* Form card */}
      <div style={{ ...sCard, animation: 'formSlideDown 0.3s ease', borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18,47,102,0.18)' }}>

        {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Tingkat kelas */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={sLabel}>Tingkat kelas</label>
          <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Hanya tingkat yang belum memiliki kelas yang ditampilkan
          </div>
          {availableTingkat.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', background: '#F8FAFC', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: '0.875rem', color: '#64748B', fontWeight: 500 }}>
              Semua tingkat sudah memiliki kelas. Gunakan Edit untuk menambah identitas baru.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {availableTingkat.map(j => {
                const selected = formJenjang === j
                return (
                  <button
                    key={j}
                    onClick={() => setFormJenjang(prev => prev === j ? '' : j)}
                    style={{
                      padding: '0.55rem 1.1rem', borderRadius: 10, fontFamily: 'inherit',
                      fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s',
                      border: selected ? 'none' : '2px solid #BABFC7',
                      background: selected ? '#1A2C4E' : '#fff',
                      color: selected ? '#fff' : 'var(--text-mid)',
                      boxShadow: selected ? '0 4px 12px rgba(26,44,78,0.3)' : '6px 6px 8px rgba(18,47,102,0.10)',
                    }}
                  >
                    Kelas {j}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

        {/* Identitas kelas */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={sLabel}>Identitas kelas</label>
          <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Akan digabung dengan tingkat. Contoh: {formJenjang || '7'} + A → &ldquo;{formJenjang || '7'}-A&rdquo;
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {formIdentitasList.map((val, i) => {
                const isLast = i === formIdentitasList.length - 1
                return (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', width: '60%' }}>
                    <input
                      type="text"
                      placeholder="Contoh: A, 1, Unggulan, MIPA"
                      value={val}
                      onChange={e => updateIdentitas(i, e.target.value)}
                      style={{ ...sInput, flex: 1 }}
                      autoFocus={i === 0}
                    />
                    {isLast ? (
                      <button
                        onClick={addIdentitas}
                        style={{ flexShrink: 0, marginLeft: '0.5rem', padding: '0 1rem', borderRadius: 10, background: '#1A2C4E', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', color: '#ffffff', whiteSpace: 'nowrap', boxShadow: '6px 6px 8px rgba(18,47,102,0.10)' }}
                      >
                        + Tambah
                      </button>
                    ) : (
                      <button
                        onClick={() => removeIdentitas(i)}
                        style={{ flexShrink: 0, marginLeft: '3.2rem', padding: '0 0.9rem', border: '2.5px solid #c7504e', borderRadius: 10, background: '#dab1b1', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '1.8rem', color: '#000000', lineHeight: 1, boxShadow: '6px 6px 8px rgba(18,47,102,0.10)' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
        </div>

        <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

        {/* Pilih warna */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Pilih warna kelas</div>
          <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
            Berlaku untuk semua kelas baru di batch ini
          </div>
          <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', background: '#fff', border: '3px solid #BABFC7', borderRadius: 13, padding: '0.5rem 0.75rem', boxShadow: '6px 6px 8px rgba(18,47,102,0.18)' }}>
            {WARNA_OPTIONS.map(w => (
              <button key={w} onClick={() => setFormWarna(w)}
                style={{ width: 30, height: 30, borderRadius: 8, background: w, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: formWarna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none', transition: 'all 0.15s' }}
              />
            ))}
            <label style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, cursor: 'pointer' }}>
              <input type="color" value={formWarna} onChange={e => setFormWarna(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }} />
              <div style={{ width: 32, height: 32, borderRadius: 8, background: isCustomWarna ? formWarna : 'transparent', boxShadow: isCustomWarna ? `0 0 0 2px #fff, 0 0 0 4px ${formWarna}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                {!isCustomWarna && <Image src="/icons/IconPipet.png" width={18} height={18} alt="Pipet" />}
              </div>
            </label>
          </div>
        </div>

        <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

        {/* Review */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Review tampilan</div>
          <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>Kelas yang akan dibuat dalam batch ini</div>
          {!formJenjang || validIds.length === 0 ? (
            <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1.1rem 1.4rem', background: '#F8FAFC' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#64748B', marginBottom: '0.25rem' }}>Kelas yang akan dibuat</div>
              <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>Pilih tingkat &amp; tambahkan identitas kelas</div>
            </div>
          ) : (
            <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.25rem', background: '#F8FAFC', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              {validIds.map((id, i) => (
                <div key={i} style={{ background: formWarna, color: '#fff', fontWeight: 800, fontSize: '0.95rem', padding: '0.45rem 1rem', borderRadius: 10, letterSpacing: '0.01em', boxShadow: `0 3px 8px ${formWarna}55` }}>
                  {formJenjang} {id.trim()}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

        {/* Info */}
        <p style={{ fontSize: '0.9rem', fontWeight: 500, color: '#6F788A', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#6F788A1A', borderRadius: 8, padding: '0.6rem 0.875rem' }}>
          <span style={{ flexShrink: 0 }}>ⓘ</span>
          <span>Kelas ini terikat dengan tahun ajaran aktif <strong>{tahunAjaran}</strong>. Jumlah siswa terhitung otomatis setelah import siswa.</span>
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={() => router.push('/siswa/manajemen-kelas')} style={sBtn}>
            Batalkan
          </button>
          <button
            onClick={handleSimpan}
            disabled={saving || availableTingkat.length === 0}
            style={{ background: (saving || availableTingkat.length === 0) ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.7rem 1.5rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: (saving || availableTingkat.length === 0) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: (saving || availableTingkat.length === 0) ? 'none' : '0 5px 2px rgba(18,47,102,0.31)', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan Kelas'}
            {!saving && <Image src="/icons/IconArrowKanan.png" width={12} height={12} alt="Simpan" />}
          </button>
        </div>
      </div>
    </div>
  )
}

const sLabel: React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--text-mid)', marginBottom: 4 }
const sInput: React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2.5px solid #BABFC7', boxShadow: '6px 6px 8px rgba(18,47,102,0.19)', borderRadius: 12, fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const sCard:  React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sBtn:   React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
