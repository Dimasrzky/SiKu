'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  const handleLogin = async () => {
    setError('')
    if (!email || !password) {
      setError('Email dan password wajib diisi.')
      return
    }

    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError(authError?.message === 'Invalid login credentials'
        ? 'Email atau password salah.'
        : (authError?.message ?? 'Gagal masuk. Coba lagi.'))
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, nama, jabatan, sekolah, avatar, role')
      .eq('id', data.user.id)
      .single()

    localStorage.setItem(
      'siku_auth',
      JSON.stringify({
        email:   profile?.email   ?? data.user.email ?? '',
        nama:    profile?.nama    ?? data.user.email ?? '',
        jabatan: profile?.jabatan ?? 'Admin',
        sekolah: profile?.sekolah ?? '',
        avatar:  profile?.avatar  ?? '',
        role:    profile?.role    ?? 'admin',
      })
    )

    router.push('/dashboard')
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <div
          className="login-card-item"
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', animationDelay: '0.35s' }}
        >
          <Image src="/image/LogoSiKu.png" alt="Logo SiKu" width={80} height={80} priority />
        </div>

        <h1 className="login-title login-card-item" style={{ animationDelay: '0.44s' }}>Masuk ke Dashboard</h1>

        {error && <div className="login-error login-card-item">{error}</div>}

        <div className="form-group login-card-item" style={{ animationDelay: '0.53s' }}>
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder="Masukkan email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div className="form-group login-card-item" style={{ animationDelay: '0.62s' }}>
          <label className="form-label" htmlFor="password">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              style={{ paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: 'absolute', right: '0.75rem', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', cursor: 'pointer', padding: 0,
                color: '#94a3b8', display: 'flex', alignItems: 'center',
              }}
              tabIndex={-1}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          className="submit-btn login-card-item"
          onClick={handleLogin}
          disabled={loading}
          style={{ marginTop: '0.5rem', animationDelay: '0.71s' }}
        >
          {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
        </button>

        <p className="login-card-item" style={{ textAlign:'center', marginTop:'1rem', fontSize:'0.8rem', color:'var(--text-muted)', animationDelay:'0.8s' }}>
          Belum punya akun?{' '}
          <Link href="/daftar" style={{ color:'var(--navy)', fontWeight:600, textDecoration:'none' }}>
            Daftar sekarang
          </Link>
        </p>

      </div>
    </div>
  )
}
