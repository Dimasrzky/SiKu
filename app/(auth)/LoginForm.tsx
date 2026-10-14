'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { IsiPanel } from '@/components/auth/IsiPanel'
import { JudulPanel } from '@/components/auth/JudulPanel'
import { KolomSandi } from '@/components/auth/KolomSandi'
import { ukuranIkon } from '@/components/auth/satuan'

const LoginForm = () => {
  const router = useRouter()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  const handleLogin = async () => {
    setError('')
    if (!email || !password) {
      setError('Email dan password wajib diisi.')
      return
    }

    setLoading(true)

    // Cek dulu apakah ini kredensial admin verifikasi pembayaran (bukan akun Supabase)
    const adminRes = await fetch('/api/admin/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    if (adminRes.ok) {
      router.push('/admin/verifikasi-pembayaran')
      return
    }

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
      .select('email, nama, jabatan, sekolah, sekolah_id, avatar, role')
      .eq('id', data.user.id)
      .single()

    // Onboarding belum selesai (belum isi data sekolah) — arahkan untuk melanjutkan
    if (!profile?.sekolah_id) {
      router.push('/daftar')
      setLoading(false)
      return
    }

    localStorage.removeItem('siku_setup_steps')
    localStorage.removeItem('siku_setup_done')
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
    <IsiPanel className="auth-isi--login">
      <JudulPanel judul="Masuk ke Dashboard" />

      <div className="auth-form auth-form--tanpa-sub">
        {error && <div className="auth-galat" role="alert">{error}</div>}

        {/* Label "Username" mengikuti mockup; isinya tetap email (juga dipakai login admin) */}
        <div className="auth-bidang">
          <label className="auth-label" htmlFor="email">Email</label>
          <div className="auth-kotak">
            <input
              id="email"
              type="email"
              className="auth-input"
              placeholder="Masukkan alamat email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <UserRound className="auth-ikon auth-ikon--pengguna" style={ukuranIkon(29)} strokeWidth={1.5} aria-hidden="true" />
          </div>
        </div>

        <div className="auth-bidang">
          <label className="auth-label" htmlFor="password">Password</label>
          <KolomSandi
            id="password"
            value={password}
            onChange={setPassword}
            onEnter={handleLogin}
            placeholder="Masukkan password"
            autoComplete="current-password"
          />
        </div>
      </div>

      <button className="auth-tombol" onClick={handleLogin} disabled={loading}>
        {loading ? 'Memverifikasi...' : 'Masuk Dashboard'}
      </button>

      <p className="auth-kaki">
        Belum punya akun? <Link href="/daftar">Daftar sekarang</Link>
      </p>
    </IsiPanel>
  )
}

export default LoginForm
