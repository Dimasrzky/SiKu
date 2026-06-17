'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const WARNA_OPTIONS = [
  '#944949', '#2F1F1F', '#2B7B2B', '#5E3333',
  '#401568', '#704E4E', '#AF9191'
]

const TIPE_OPTIONS = [
  { value: 'rutin_bulanan', label: 'Rutin Bulanan' },
  { value: 'sekali_bayar',  label: 'Sekali Bayar'  },
  { value: 'per_semester',  label: 'Per Semester'  },
]

const TIPE_WARNA: Record<string, string> = {
  rutin_bulanan: '#69C183',
  sekali_bayar:  '#3C75B7',
  per_semester:  '#7D7ADC',
}

export default function TambahKomponenPage() {
  const router = useRouter()

  const [nama,       setNama]       = useState('')
  const [tipe,       setTipe]       = useState('')
  const [nominal,    setNominal]    = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [warna,      setWarna]      = useState(WARNA_OPTIONS[0])
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const isCustomWarna = !WARNA_OPTIONS.includes(warna)

  const inisial = nama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')

  const handleSimpan = async () => {
    setError('')
    if (!nama.trim()) { setError('Nama komponen harus diisi.'); return }
    if (!tipe)        { setError('Tipe pembayaran harus dipilih.'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sesi tidak ditemukan. Silakan login ulang.'); setSaving(false); return }

    const [{ data: profile }, { data: taData }] = await Promise.all([
      supabase.from('profiles').select('sekolah_id').eq('id', user.id).single(),
      supabase.from('tahun_ajaran')
        .select('nama, semester_ganjil_mulai, semester_ganjil_selesai, semester_genap_mulai, semester_genap_selesai')
        .eq('is_aktif', true)
        .maybeSingle(),
    ])

    if (!profile?.sekolah_id) { setError('Data sekolah tidak ditemukan.'); setSaving(false); return }
    if (!taData?.nama)        { setError('Tahun ajaran aktif tidak ditemukan.'); setSaving(false); return }

    // Deteksi semester aktif
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let semester = today.getMonth() + 1 >= 7 ? 'Ganjil' : 'Genap'
    if (taData.semester_ganjil_mulai && taData.semester_ganjil_selesai) {
      const s = new Date(taData.semester_ganjil_mulai); const e = new Date(taData.semester_ganjil_selesai)
      if (today >= s && today <= e) semester = 'Ganjil'
    }
    if (taData.semester_genap_mulai && taData.semester_genap_selesai) {
      const s = new Date(taData.semester_genap_mulai); const e = new Date(taData.semester_genap_selesai)
      if (today >= s && today <= e) semester = 'Genap'
    }

    const nominalNum = parseInt(nominal.replace(/\./g, ''), 10) || null

    const { error: insertError } = await supabase
      .from('komponen_tagihan')
      .insert({
        sekolah_id:      profile.sekolah_id,
        jenis:           tipe,
        nama:            nama.trim(),
        kelas_warna:     warna,
        keterangan:      keterangan.trim() || null,
        nominal_default: nominalNum,
        tahun_ajaran:    taData.nama,
        semester,
      })

    if (insertError) { setError(insertError.message); setSaving(false); return }

    router.push('/tagihan/komponen')
  }

  return (
    <div className="dashboard-content">
      <style>{`
        @keyframes formSlideDown { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-title">Tambah komponen</h1>
          <p className="dashboard-subtitle">Tambahkan item pembayaran baru ke daftar komponen</p>
        </div>
      </div>

      {/* Form card */}
      <div style={{ ...sCard, animation: 'formSlideDown 0.3s ease', borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18,47,102,0.18)' }}>

        {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Baris 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={sLabel}>Nama komponen</label>
            <input
              type="text" placeholder="Contoh: SPP, Uang Gedung"
              value={nama} onChange={e => setNama(e.target.value)}
              style={sInput} autoFocus
            />
          </div>
          <div>
            <label style={sLabel}>Tipe pembayaran</label>
            <div style={{ position: 'relative' }}>
              <select
                value={tipe} onChange={e => setTipe(e.target.value)}
                style={{ ...sInput, appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.5rem' }}
              >
                <option value="" disabled hidden>Pilih tipe</option>
                {TIPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronDown size={16} color="#6F788A" style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        {/* Baris 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.4rem' }}>
          <div>
            <label style={sLabel}>
              Nominal default{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: 'var(--text-muted)', pointerEvents: 'none', userSelect: 'none' }}>
                Rp
              </span>
              <input
                type="text" inputMode="numeric" placeholder="0"
                value={nominal}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '')
                  const num = parseInt(raw, 10)
                  setNominal(raw ? num.toLocaleString('id-ID') : '')
                }}
                style={{ ...sInput, paddingLeft: '2.5rem' }}
              />
            </div>
          </div>
          <div>
            <label style={sLabel}>
              Keterangan{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span>
            </label>
            <input
              type="text" placeholder="Contoh: Dibayar tiap awal bulan"
              value={keterangan} onChange={e => setKeterangan(e.target.value)}
              style={sInput}
            />
          </div>
        </div>

        <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F788A', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>ⓘ</span> Bisa berbeda per kelas saat assign ke paket
        </p>

        <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

        {/* Pilih warna */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Pilih warna komponen</div>
          <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
            Membedakan komponen secara visual di grafik &amp; laporan dashboard
          </div>
          <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', background: '#fff', border: '3px solid #BABFC7', borderRadius: 13, padding: '0.5rem 0.75rem', boxShadow: '6px 6px 8px rgba(18,47,102,0.18)' }}>
            {WARNA_OPTIONS.map(w => (
              <button key={w} onClick={() => setWarna(w)} style={{ width: 30, height: 30, borderRadius: 8, background: w, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: warna === w ? `0 0 0 2px #fff, 0 0 0 4px ${w}` : 'none', transition: 'all 0.15s' }} />
            ))}
            <label style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, cursor: 'pointer' }}>
              <input type="color" value={warna} onChange={e => setWarna(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }} />
              <div style={{ width: 32, height: 32, borderRadius: 8, background: isCustomWarna ? warna : 'transparent', boxShadow: isCustomWarna ? `0 0 0 2px #fff, 0 0 0 4px ${warna}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                {!isCustomWarna && <Image src="/icons/IconPipet.png" width={18} height={18} alt="Pipet" />}
              </div>
            </label>
          </div>
        </div>

        <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

        {/* Review tampilan */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Review tampilan</div>
          <div style={{ fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
            Tampilan komponen di grafik &amp; laporan dashboard
          </div>

          {!nama.trim() ? (
            <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1.1rem 1.4rem', background: '#F8FAFC' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#64748B', marginBottom: '0.25rem' }}>Komponen tagihan yang akan dibuat</div>
              <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>Isi nama &amp; tipe pembayaran untuk melihat tampilan</div>
            </div>
          ) : (
            <div style={{ border: '2px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.25rem', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: warna, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.02em' }}>{inisial}</span>
              </div>
              <div style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>{nama}</span>
                  {tipe && (
                    <span style={{ background: TIPE_WARNA[tipe] ?? warna, color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, flexShrink: 0 }}>
                      {TIPE_OPTIONS.find(t => t.value === tipe)?.label}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {keterangan.trim() || <span style={{ color: '#CBD5E1' }}>Belum ada keterangan</span>}
                </div>
              </div>
              <div style={{ width: 1.5, height: 40, background: '#CBD5E1', flexShrink: 0, marginLeft: '1%' }} />
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.2rem' }}>Nominal default</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>
                  {nominal ? `Rp ${nominal}` : <span style={{ color: '#CBD5E1' }}>—</span>}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: '0.75rem', padding: '0.65rem 1rem', background: '#F1F5F9', borderRadius: 10, fontSize: '0.82rem', color: '#64748B', fontWeight: 500, lineHeight: 1.5 }}>
            <span>ⓘ </span>Warna yang dipilih digunakan sebagai penanda komponen di grafik &amp; laporan dashboard
          </div>
        </div>

        <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={() => router.push('/tagihan/komponen')} style={sBtn}>
            Batalkan
          </button>
          <button
            onClick={handleSimpan}
            disabled={saving}
            style={{ background: saving ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.7rem 1.5rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: saving ? 'none' : '0 5px 2px rgba(18,47,102,0.31)', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan Komponen'}
            {!saving && <Image src="/icons/IconArrowKanan.png" width={12} height={12} alt="Simpan" />}
          </button>
        </div>
      </div>
    </div>
  )
}

const sLabel: React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--text-mid)', marginBottom: 4 }
const sInput: React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2.5px solid #BABFC7', boxShadow: '6px 6px 8px rgba(18,47,102,0.19)', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const sCard:  React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sBtn:   React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
