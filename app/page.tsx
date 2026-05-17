'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { MOCK_USER } from '@/lib/mockData'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

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
        'siku_auth',
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

        <div
          className="login-card-item"
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', animationDelay: '0.35s' }}
        >
          <Image src="/image/LogoSiKu.png" alt="Logo SiKu" width={80} height={80} priority />
        </div>

        <h1 className="login-title login-card-item" style={{ animationDelay: '0.44s' }}>Masuk ke Dashboard</h1>

        <div
          className="login-card-item"
          style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: '#0369a1',
            animationDelay: '0.53s',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Akun Demo</div>
          <div>Email&nbsp;&nbsp;: <strong>{MOCK_USER.email}</strong></div>
          <div>Password: <strong>{MOCK_USER.password}</strong></div>
          <button
            onClick={() => { setEmail(MOCK_USER.email); setPassword(MOCK_USER.password) }}
            style={{
              marginTop: '0.5rem',
              background: '#0ea5e9',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.3rem 0.75rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Isi Otomatis
          </button>
        </div>

        {error && <div className="login-error login-card-item">{error}</div>}

        <div className="form-group login-card-item" style={{ animationDelay: '0.62s' }}>
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder="Masukkan email demo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div className="form-group login-card-item" style={{ animationDelay: '0.71s' }}>
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="form-input"
            placeholder="Masukkan password demo"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <button
          className="submit-btn login-card-item"
          onClick={handleLogin}
          disabled={loading}
          style={{ marginTop: '0.5rem', animationDelay: '0.8s' }}
        >
          {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
        </button>
      </div>
    </div>
  )
}