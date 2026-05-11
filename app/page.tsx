'use client'

import { useState } from 'react'
import Image from 'next/image'
import {KeySquare} from 'lucide-react'
import { useRouter } from 'next/navigation'
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

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <Image src="/image/LogoSiKu.png" alt="Logo SiKu" width={80} height={80} priority />
        </div>

        <h1 className="login-title">Masuk ke Dashboard</h1>

        {/* Demo credentials box */}
        <div className="demo-creds">
          <div className="demo-creds-label">
            <KeySquare size={17} className="form-privacy-icon" />
            Akun Demo
          </div>
          <div className="demo-creds-row">
            <span>Password</span>
            <code>{MOCK_USER.password}</code>
          </div>
          <button className="demo-autofill" onClick={autoFill}>
            Isi Otomatis
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="form-group">
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

        <div className="form-group">
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
          className="submit-btn"
          onClick={handleLogin}
          disabled={loading}
          style={{ marginTop: '0.5rem' }}
        >
          {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
        </button>
      </div>
    </div>
  )
}