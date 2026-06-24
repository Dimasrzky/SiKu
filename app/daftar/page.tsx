'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 1 | 2 | 3


const JABATAN_OPTIONS = [
  'Bendahara', 'Kepala Sekolah',
  'Tata Usaha', 'Staff Administrasi', 'Operator',
]

export default function DaftarPage() {
  const router = useRouter()
  const [step, setStep]         = useState<Step>(1)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Step 1
  const [nama, setNama]             = useState('')
  const [jabatan, setJabatan]       = useState('')
  const [jabatanCustom, setJabatanCustom] = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Step 2
  const [namaSekolah,    setNamaSekolah]    = useState('')
  const [noWaSekolah,    setNoWaSekolah]    = useState('')
  const [noWaError,      setNoWaError]      = useState('')
  const [emailError,     setEmailError]     = useState('')
  const [jenjangSekolah, setJenjangSekolah] = useState('SMP/MTs')

  const jabatanFinal = jabatan === 'lainnya' ? jabatanCustom : jabatan
  const [isDemo, setIsDemo] = useState(false)
  // Email yang sudah berhasil di-signUp di sesi ini (untuk handle navigasi kembali ke step 1)
  const [step1Email, setStep1Email] = useState('')

  // Jika sudah login, arahkan ke dashboard (onboarding selesai) atau biarkan isi form dari awal
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, nama, jabatan, sekolah, sekolah_id, avatar, role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile?.sekolah_id) {
        localStorage.setItem('siku_auth', JSON.stringify({
          email:   profile.email   ?? session.user.email ?? '',
          nama:    profile.nama    ?? session.user.email ?? '',
          jabatan: profile.jabatan ?? 'Admin',
          sekolah: profile.sekolah ?? '',
          avatar:  profile.avatar  ?? '',
          role:    profile.role    ?? 'admin',
        }))
        router.replace('/dashboard')
      }
      // Onboarding belum selesai — form tetap kosong, user isi sendiri
    }
    checkSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStep1 = async () => {
    setError('')
    setEmailError('')

    // Navigasi kembali ke step 1 dengan email yang sama di sesi ini — skip signUp
    if (step1Email && step1Email === email.trim()) {
      if (!nama.trim() || !jabatanFinal.trim()) {
        setError('Semua field wajib diisi.')
        return
      }
      setStep(2)
      return
    }

    if (!nama.trim() || !jabatanFinal.trim() || !email.trim() || !password) {
      setError('Semua field wajib diisi.')
      return
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }
    setLoading(true)

    // Coba signUp dulu untuk trial baru
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { nama: nama.trim(), jabatan: jabatanFinal.trim() } },
    })

    // Email sudah terdaftar: Supabase mengembalikan user.identities = []
    const emailSudahAda =
      !signUpError && signUpData.user?.identities?.length === 0

    if (emailSudahAda || signUpError?.message === 'User already registered') {
      if (email.trim() === 'demosiku@gmail.com') {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) {
          setError('Password salah untuk akun demo.')
          setLoading(false)
          return
        }
        const userId = signInData.user?.id
        const { data: profile } = await supabase
          .from('profiles')
          .select('sekolah_id, role')
          .eq('id', userId!)
          .single()
        if (profile?.role === 'super_admin') setIsDemo(true)
        setStep(2)
        setLoading(false)
        return
      }

      // Cek apakah sesi aktif cocok — user ini yang belum selesai onboarding
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email === email.trim()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('sekolah_id')
          .eq('id', session.user.id)
          .maybeSingle()
        if (!profile?.sekolah_id) {
          // Onboarding belum selesai — lanjut ke step 2
          setStep1Email(email.trim())
          setStep(2)
          setLoading(false)
          return
        }
      }

      setEmailError('Email ini sudah terdaftar. Silakan masuk.')
      setLoading(false)
      return
    }

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // signUp berhasil → trial baru
    setStep1Email(email.trim())
    setStep(2)
    setLoading(false)
  }

  const handleStep2 = async () => {
    setError('')
    setNoWaError('')
    if (!namaSekolah.trim() || !noWaSekolah.trim()) {
      setError('Nama sekolah dan nomor WhatsApp wajib diisi.')
      return
    }
    if (!/^\d+$/.test(noWaSekolah.trim())) {
      setNoWaError('Nomor WhatsApp hanya boleh berisi angka.')
      return
    }
    if (noWaSekolah.trim().startsWith('0')) {
      setNoWaError('Jangan awali dengan 0. Contoh: 81234567890')
      return
    }
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/onboarding', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        nama:          nama.trim(),
        jabatan:       jabatanFinal.trim(),
        namaSekolah:   namaSekolah.trim(),
        noWaSekolah:   '62' + noWaSekolah.trim(),
        jenjangSekolah,
      }),
    })

    const json = await res.json() as { data?: { role: string }; error?: string }
    if (!res.ok) {
      setError(json.error ?? 'Gagal menyimpan data sekolah.')
      setLoading(false)
      return
    }

    localStorage.setItem('siku_auth', JSON.stringify({
      email:    email.trim(),
      nama:     nama.trim(),
      jabatan:  jabatanFinal.trim(),
      sekolah:  namaSekolah.trim(),
      avatar:   nama.trim().charAt(0).toUpperCase(),
      role:     json.data?.role ?? 'admin',
    }))

    setStep(3)
    setLoading(false)
  }

  // ── Step 3: Konfirmasi ─────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div style={{ textAlign:'center', padding:'1rem 0' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:'1rem' }}>🎉</div>
            <h2 style={{
              fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.3rem',
              fontWeight:700, color:'var(--navy-dark)', marginBottom:'0.5rem',
            }}>
              {isDemo ? 'Demo siap digunakan!' : 'Sekolah berhasil didaftarkan!'}
            </h2>
            <p style={{ fontSize:'0.875rem', color:'var(--text-muted)', lineHeight:1.7, marginBottom:'0.5rem' }}>
              Selamat datang, <strong>{nama}</strong>.
            </p>
            <p style={{ fontSize:'0.875rem', color:'var(--text-muted)', lineHeight:1.7, marginBottom:'1.75rem' }}>
              {isDemo
                ? <>Dashboard <strong>{namaSekolah}</strong> siap untuk presentasi.</>
                : <><strong>{namaSekolah}</strong> aktif dengan trial gratis <strong>30 hari</strong>.</>
              }
            </p>

            <button className="submit-btn" onClick={() => router.push('/dashboard')}>
              Masuk ke Dashboard →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 1 & 2 ─────────────────────────────────────────────────────────────
  return (
    <div className="login-page">
      <div className="login-card">

        <div style={{ display:'flex', justifyContent:'center', marginBottom:'1rem' }}>
          <Image src="/image/LogoSiKu.png" alt="Logo SiKu" width={64} height={64} priority />
        </div>

        {/* Step indicator */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', marginBottom:'1.5rem' }}>
          {([1, 2] as const).map((s) => (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
              <div style={{
                width:28, height:28, borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'0.75rem', fontWeight:700,
                background: step >= s ? 'var(--navy)' : '#E2E8F0',
                color:      step >= s ? '#fff'        : '#94A3B8',
                transition: 'background 0.2s',
              }}>
                {step > s ? '✓' : s}
              </div>
              {s < 2 && (
                <div style={{
                  width:40, height:2,
                  background: step > s ? 'var(--navy)' : '#E2E8F0',
                  transition: 'background 0.2s',
                }} />
              )}
            </div>
          ))}
        </div>

        <h1 className="login-title" style={{ marginBottom:'0.25rem' }}>
          {step === 1 ? 'Buat Akun' : 'Profil Sekolah'}
        </h1>
        <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', textAlign:'center', marginBottom:'1.25rem' }}>
          {step === 1
            ? 'Data pribadi pengelola keuangan sekolah'
            : 'Informasi sekolah yang akan menggunakan SiKu'}
        </p>

        {error && <div className="login-error">{error}</div>}

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="nama">Nama Lengkap</label>
              <input
                id="nama" type="text" className="form-input"
                placeholder="cth: Sri Rahayu, S.Pd"
                value={nama} onChange={(e) => setNama(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="jabatan">Jabatan</label>
              <select
                id="jabatan" className="form-input"
                value={jabatan} onChange={(e) => setJabatan(e.target.value)}
                style={{ appearance:'auto' }}
              >
                <option value="">-- Pilih Jabatan --</option>
                {JABATAN_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                <option value="lainnya">Lainnya...</option>
              </select>
            </div>

            {jabatan === 'lainnya' && (
              <div className="form-group">
                <label className="form-label" htmlFor="jabatanCustom">Jabatan (isi manual)</label>
                <input
                  id="jabatanCustom" type="text" className="form-input"
                  placeholder="Tulis jabatan kamu"
                  value={jabatanCustom} onChange={(e) => setJabatanCustom(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Sekolah</label>
              <input
                id="email" type="email" className="form-input"
                placeholder="email@sekolah.sch.id"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                style={emailError ? { borderColor: '#EF4444' } : undefined}
              />
              {emailError && (
                <p style={{ color: '#EF4444', fontSize: '0.78rem', marginTop: 4 }}>
                  {emailError}{' '}
                  <Link href="/" style={{ color: '#EF4444', fontWeight: 600 }}>Masuk di sini</Link>
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div style={{ position:'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Minimal 6 karakter"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                  style={{ paddingRight:'2.5rem' }}
                />
                <button
                  type="button" tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position:'absolute', right:'0.75rem', top:'50%',
                    transform:'translateY(-50%)', background:'none',
                    border:'none', cursor:'pointer', padding:0,
                    color:'#94a3b8', display:'flex', alignItems:'center',
                  }}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              className="submit-btn"
              onClick={handleStep1}
              disabled={loading}
              style={{ marginTop:'0.5rem' }}
            >
              {loading ? 'Memproses...' : 'Lanjut →'}
            </button>
          </>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="namaSekolah">Nama Sekolah</label>
              <input
                id="namaSekolah" type="text" className="form-input"
                placeholder="cth: SDIT Al-Hikmah Yogyakarta"
                value={namaSekolah} onChange={(e) => setNamaSekolah(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStep2()}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="jenjangSekolah">Jenjang Sekolah</label>
              <select
                id="jenjangSekolah" className="form-input"
                value={jenjangSekolah} onChange={(e) => setJenjangSekolah(e.target.value)}
                style={{ appearance: 'auto' }}
              >
                <option value="TK/PAUD">TK/PAUD</option>
                <option value="SD/MI">SD/MI</option>
                <option value="SMP/MTs">SMP/MTs</option>
                <option value="SMA/MA">SMA/MA</option>
                <option value="SMK">SMK</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="noWa">Nomor WhatsApp Sekolah</label>
              <div style={{ display: 'flex', alignItems: 'stretch', border: `1.5px solid ${noWaError ? '#EF4444' : 'var(--border)'}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <span style={{ padding: '0 0.75rem', background: '#F1F5F9', color: '#475569', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', borderRight: `1.5px solid ${noWaError ? '#EF4444' : 'var(--border)'}`, whiteSpace: 'nowrap', userSelect: 'none' }}>
                  +62
                </span>
                <input
                  id="noWa" type="tel"
                  placeholder="8xxxxxxxxxx"
                  value={noWaSekolah}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    setNoWaSekolah(val)
                    if (noWaError) setNoWaError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleStep2()}
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '0.65rem 0.85rem', fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', background: 'transparent' }}
                />
              </div>
              {noWaError && (
                <p style={{ color: '#EF4444', fontSize: '0.78rem', marginTop: 4 }}>{noWaError}</p>
              )}
            </div>

            <div style={{ display:'flex', gap:'0.75rem' }}>
              <button
                onClick={() => { setStep(1); setError('') }}
                style={{
                  background:'transparent', color:'var(--navy)',
                  border:'1.5px solid var(--navy)', padding:'0.65rem 1rem',
                  borderRadius:8, fontWeight:600, fontSize:'0.875rem',
                  cursor:'pointer', fontFamily:'inherit', flexShrink:0,
                }}
              >
                ← Kembali
              </button>
              <button
                className="submit-btn"
                onClick={handleStep2}
                disabled={loading}
                style={{ flex:1 }}
              >
                {loading ? 'Menyimpan...' : 'Simpan & Lanjut →'}
              </button>
            </div>
          </>
        )}

        <p style={{ textAlign:'center', marginTop:'1.25rem', fontSize:'0.8rem', color:'var(--text-muted)' }}>
          Sudah punya akun?{' '}
          <Link href="/" style={{ color:'var(--navy)', fontWeight:600, textDecoration:'none' }}>
            Masuk
          </Link>
        </p>

      </div>
    </div>
  )
}
