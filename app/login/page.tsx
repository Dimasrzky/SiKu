'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MOCK_USER } from '@/lib/mockData'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const autoFill = () => {
    setEmail(MOCK_USER.email)
    setPassword(MOCK_USER.password)
    setError('')
  }

  const handleLogin = async () => {
    setError('')
    if (!email || !password) {
      setError('Email dan password wajib diisi.')
      return
    }

    setLoading(true)
    await new Promise((res) => setTimeout(res, 900))

    if (email === MOCK_USER.email && password === MOCK_USER.password) {
      localStorage.setItem(
        'edukas_auth',
        JSON.stringify({
          nama: MOCK_USER.nama,
          jabatan: MOCK_USER.jabatan,
          sekolah: MOCK_USER.sekolah,
          avatar: MOCK_USER.avatar,
        })
      )
      router.push('/dashboard')
    } else {
      setError('Email atau password salah. Gunakan akun demo di atas.')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <Link href="/" className="login-back">
          ← Kembali ke beranda
        </Link>

        {/* Logo */}
        <div className="login-logo">
          <span className="login-logo-text">SiKu</span>
          <span className="login-logo-badge">BETA</span>
        </div>

        <h1 className="login-title">Masuk ke Dashboard</h1>
        <p className="login-subtitle">Akses khusus bendahara &amp; admin sekolah</p>

        {/* Demo credentials box */}
        <div className="demo-creds">
          <div className="demo-creds-label">🔑 Akun Demo</div>
          <div className="demo-creds-row">
            <span>Email</span>
            <code>{MOCK_USER.email}</code>
          </div>
          <div className="demo-creds-row">
            <span>Password</span>
            <code>{MOCK_USER.password}</code>
          </div>
          <button className="demo-autofill" onClick={autoFill}>
            Isi Otomatis →
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder="Email bendahara"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="form-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <button
          className="submit-btn"
          onClick={handleLogin}
          disabled={loading}
          style={{ marginTop: '0.5rem' }}
        >
          {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard →'}
        </button>

        <div className="form-privacy" style={{ marginTop: '1rem' }}>
          Belum punya akun?{' '}
          <Link href="/daftar" style={{ color: 'var(--emerald)', fontWeight: 600, textDecoration: 'none' }}>
            Daftar demo gratis
          </Link>
        </div>

      </div>
    </div>
  )
}