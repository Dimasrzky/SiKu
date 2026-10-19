'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { bacaKemitraan, perluHalamanKemitraan, RUTE_KEMITRAAN, type StatusKemitraan } from '@/lib/kemitraan'
import { JABATAN } from '@/lib/jabatan'
import { simpanLangkahSetupLokal } from '@/lib/langkahSetup'
import { IsiPanel } from '@/components/auth/IsiPanel'
import { JudulPanel } from '@/components/auth/JudulPanel'
import { KolomSandi } from '@/components/auth/KolomSandi'
import { LangkahDaftar } from '@/components/auth/LangkahDaftar'
import { ukuranIkon } from '@/components/auth/satuan'

type Step = 1 | 2 | 3

const PanahPilih = () => (
  <ChevronDown className="auth-ikon auth-panah" style={ukuranIkon(24.7)} strokeWidth={1.5} aria-hidden="true" />
)

const PanahTombol = ({ arah }: { arah: 'kiri' | 'kanan' }) => {
  const Ikon = arah === 'kiri' ? ChevronLeft : ChevronRight
  return <Ikon style={ukuranIkon(19)} strokeWidth={2} aria-hidden="true" />
}

export default function DaftarPage() {
  const router = useRouter()
  const [step, setStep]         = useState<Step>(1)
  // Arah geser isi panel: maju saat lanjut, mundur saat Kembali
  const [arah, setArah]         = useState<'maju' | 'mundur'>('maju')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Step 1
  const [nama, setNama]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')

  // Step 2
  const [namaSekolah,    setNamaSekolah]    = useState('')
  const [noWaSekolah,    setNoWaSekolah]    = useState('')
  const [noWaError,      setNoWaError]      = useState('')
  const [emailError,     setEmailError]     = useState('')
  const [jenjangSekolah, setJenjangSekolah] = useState('SMP/MTs')
  // Pilihan bawaan tampil samar seperti placeholder di mockup sampai diganti user
  const [jenjangDiubah,  setJenjangDiubah]  = useState(false)

  // Email yang sudah berhasil di-signUp di sesi ini (untuk handle navigasi kembali ke step 1)
  const [step1Email, setStep1Email] = useState('')

  const lanjutKe = (s: Step) => {
    setArah('maju')
    setStep(s)
  }

  // Jika sudah login, arahkan ke dashboard atau halaman kemitraan (onboarding selesai), atau biarkan isi form dari awal
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, nama, sekolah, sekolah_id, avatar, role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile?.sekolah_id) {
        const [kemitraan] = await Promise.all([
          bacaKemitraan(supabase, session.user.id),
          simpanLangkahSetupLokal(supabase, profile.sekolah_id),
        ])
        localStorage.setItem('siku_auth', JSON.stringify({
          email:   profile.email   ?? session.user.email ?? '',
          nama:    profile.nama    ?? session.user.email ?? '',
          sekolah: profile.sekolah ?? '',
          avatar:  profile.avatar  ?? '',
          role:    profile.role    ?? 'admin',
          ...(kemitraan.data ? { kemitraan: kemitraan.data.status } : {}),
        }))
        router.replace(kemitraan.data && perluHalamanKemitraan(kemitraan.data) ? RUTE_KEMITRAAN : '/dashboard')
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
      if (!nama.trim()) {
        setError('Semua field wajib diisi.')
        return
      }
      lanjutKe(2)
      return
    }

    if (!nama.trim() || !email.trim() || !password) {
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
      // Profil awal dibuat dari metadata ini (sebelum langkah 2), jadi jabatannya ikut ditetapkan
      options: { data: { nama: nama.trim(), jabatan: JABATAN } },
    })

    // Email sudah terdaftar: Supabase mengembalikan user.identities = []
    const emailSudahAda =
      !signUpError && signUpData.user?.identities?.length === 0

    if (emailSudahAda || signUpError?.message === 'User already registered') {
      if (email.trim() === 'demosiku@gmail.com') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) {
          setError('Password salah untuk akun demo.')
          setLoading(false)
          return
        }
        // Peran super_admin diperiksa /api/onboarding; jawabannya menentukan langkah 3
        lanjutKe(2)
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
          lanjutKe(2)
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
    lanjutKe(2)
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
        namaSekolah:   namaSekolah.trim(),
        noWaSekolah:   '62' + noWaSekolah.trim(),
        jenjangSekolah,
      }),
    })

    const json = await res.json() as { data?: { role: string; kemitraan?: StatusKemitraan }; error?: string }
    if (!res.ok) {
      setError(json.error ?? 'Gagal menyimpan data sekolah.')
      setLoading(false)
      return
    }

    localStorage.setItem('siku_auth', JSON.stringify({
      email:     email.trim(),
      nama:      nama.trim(),
      sekolah:   namaSekolah.trim(),
      avatar:    nama.trim().charAt(0).toUpperCase(),
      role:      json.data?.role ?? 'admin',
      kemitraan: json.data?.kemitraan ?? 'menunggu',
    }))

    // Sekolah baru menunggu konfirmasi kemitraan dari tim Equanusa; tombol tetap
    // "Menyimpan..." sampai halamannya terbuka
    if (json.data?.role !== 'super_admin') {
      router.push(RUTE_KEMITRAAN)
      return
    }

    lanjutKe(3)
    setLoading(false)
  }

  // ── Step 3: Konfirmasi (hanya akun demo) ───────────────────────────────────
  if (step === 3) {
    return (
      <IsiPanel key={3} arah="maju">
        <LangkahDaftar langkah={3} />
        <JudulPanel judul="Demo siap digunakan!" panjang />
        <p className="auth-teks">Selamat datang, <strong>{nama}</strong>.</p>
        <p className="auth-teks">Dashboard <strong>{namaSekolah}</strong> siap untuk presentasi.</p>
        <button className="auth-tombol" onClick={() => router.push('/dashboard')}>
          Masuk ke Dashboard <PanahTombol arah="kanan" />
        </button>
      </IsiPanel>
    )
  }

  // ── Step 1 & 2 ─────────────────────────────────────────────────────────────
  return (
    <IsiPanel key={step} arah={arah} className={step === 1 ? 'auth-isi--daftar1' : undefined}>
      <LangkahDaftar langkah={step} />
      <JudulPanel
        judul={step === 1 ? 'Buat Akun' : 'Profil Sekolah'}
        sub={step === 1
          ? 'Data pribadi pengelola keuangan sekolah'
          : 'Informasi sekolah yang akan menggunakan SiKu'}
      />

      <div className="auth-form">
        {error && <div className="auth-galat" role="alert">{error}</div>}

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <>
            <div className="auth-bidang">
              <label className="auth-label" htmlFor="nama">Nama Lengkap</label>
              <div className="auth-kotak">
                <input
                  id="nama" type="text" className="auth-input"
                  placeholder="cth: Sri Wahyuni, S. Pd" autoComplete="name"
                  value={nama} onChange={(e) => setNama(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                />
              </div>
            </div>

            <div className="auth-bidang">
              <label className="auth-label" htmlFor="email">Email Sekolah</label>
              <div className={`auth-kotak${emailError ? ' auth-kotak--galat' : ''}`}>
                <input
                  id="email" type="email" className="auth-input"
                  placeholder="email@sekolah.sch.id" autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                />
              </div>
              {emailError && (
                <p className="auth-galat-isian">
                  {emailError} <Link href="/">Masuk di sini</Link>
                </p>
              )}
            </div>

            <div className="auth-bidang">
              <label className="auth-label" htmlFor="password">Password</label>
              <KolomSandi
                id="password"
                value={password}
                onChange={setPassword}
                onEnter={handleStep1}
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
              />
            </div>
          </>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <>
            <div className="auth-bidang">
              <label className="auth-label" htmlFor="namaSekolah">Nama Sekolah</label>
              <div className="auth-kotak">
                <input
                  id="namaSekolah" type="text" className="auth-input"
                  placeholder="cth: SDIT Al-Hikmah Yogyakarta" autoComplete="organization"
                  value={namaSekolah} onChange={(e) => setNamaSekolah(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStep2()}
                />
              </div>
            </div>

            <div className="auth-bidang">
              <label className="auth-label" htmlFor="jenjangSekolah">Jenjang Sekolah</label>
              <div className="auth-kotak">
                <select
                  id="jenjangSekolah"
                  className={`auth-input auth-pilih${jenjangDiubah ? '' : ' auth-pilih--samar'}`}
                  value={jenjangSekolah}
                  onChange={(e) => {
                    setJenjangSekolah(e.target.value)
                    setJenjangDiubah(true)
                  }}
                >
                  <option value="TK/PAUD">TK/PAUD</option>
                  <option value="SD/MI">SD/MI</option>
                  <option value="SMP/MTs">SMP/MTs</option>
                  <option value="SMA/MA">SMA/MA</option>
                  <option value="SMK">SMK</option>
                </select>
                <PanahPilih />
              </div>
            </div>

            <div className="auth-bidang">
              <label className="auth-label" htmlFor="noWa">Nomor WhatsApp Sekolah</label>
              <div className={`auth-kotak${noWaError ? ' auth-kotak--galat' : ''}`}>
                <span className="auth-awalan">+62</span>
                <input
                  id="noWa" type="tel" inputMode="numeric"
                  className="auth-input auth-input--awalan"
                  placeholder="8xxxxxxxxxx"
                  value={noWaSekolah}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    setNoWaSekolah(val)
                    if (noWaError) setNoWaError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleStep2()}
                />
              </div>
              {noWaError && <p className="auth-galat-isian">{noWaError}</p>}
            </div>
          </>
        )}
      </div>

      {step === 1 ? (
        <button className="auth-tombol" onClick={handleStep1} disabled={loading}>
          {loading ? 'Memproses...' : <>Lanjut <PanahTombol arah="kanan" /></>}
        </button>
      ) : (
        <div className="auth-baris-tombol">
          <button
            className="auth-tombol auth-tombol--garis"
            onClick={() => { setArah('mundur'); setStep(1); setError('') }}
          >
            <PanahTombol arah="kiri" /> Kembali
          </button>
          <button className="auth-tombol" onClick={handleStep2} disabled={loading}>
            {loading ? 'Menyimpan...' : <>Simpan &amp; Lanjut <PanahTombol arah="kanan" /></>}
          </button>
        </div>
      )}

      <p className="auth-kaki">
        Sudah punya akun? <Link href="/">Masuk sekarang</Link>
      </p>
    </IsiPanel>
  )
}
