'use client'

import { useEffect, useRef, useSyncExternalStore, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard,
  Banknote,
  Receipt,
  Users,
  BarChart2,
  Settings,
  LogOut,
  RotateCcw,
  ChevronDown,
  Calendar,
  FileCheck,
  Layers,
  Package,
  Gift,
  SlidersHorizontal,
  GraduationCap,
  ChevronsUp,
  Lock,
  Database,
  PieChart,
  Wallet,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  bacaKemitraan, perluHalamanKemitraan, RUTE_KEMITRAAN, simpanStatusLokal, statusLokal, type StatusKemitraan,
} from '@/lib/kemitraan'
import { bacaFiturSaya, fiturLokal, hapusFiturLokal, simpanFiturLokal, type KodeFitur } from '@/lib/fiturSekolah'
import { SkeletonShell } from '@/components/skeleton/SkeletonShell'
import './dashboard.css'

interface AuthUser { nama: string; sekolah: string; avatar: string; role?: string; kemitraan?: StatusKemitraan }

function getAuthRaw() { return localStorage.getItem('siku_auth') }
function getAuthRawServer() { return null }

/* ─── Reset Demo Popup ──────────────────────────────────────────── */

const RESET_CSS = `
@keyframes rd-backdrop { from{opacity:0} to{opacity:1} }
@keyframes rd-card {
  0%   { opacity:0; transform:scale(0.78) translateY(44px) }
  65%  { opacity:1; transform:scale(1.03) translateY(-4px) }
  100% { opacity:1; transform:scale(1)    translateY(0) }
}
@keyframes rd-shake {
  0%,100% { transform:translateX(0) }
  20%      { transform:translateX(-5px) }
  40%      { transform:translateX(5px) }
  60%      { transform:translateX(-4px) }
  80%      { transform:translateX(4px) }
}
@keyframes rd-icon-pulse {
  0%,100% { transform:scale(1) }
  50%     { transform:scale(1.12) }
}
@keyframes rd-fade-up {
  from { opacity:0; transform:translateY(10px) }
  to   { opacity:1; transform:translateY(0) }
}
@keyframes rd-spin { to { transform:rotate(360deg) } }
`

const DELETED_ITEMS = [
  'Semua data siswa',
  'Tagihan & riwayat pembayaran',
  'Kelas & komponen tagihan',
  'Tahun ajaran',
  'Profil & nama sekolah',
]

function ResetDemoPopup({
  resetting,
  onClose,
  onConfirm,
}: {
  resetting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <>
      <style>{RESET_CSS}</style>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(8,16,34,0.75)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'rd-backdrop 0.28s ease forwards',
        }}
        onClick={() => { if (!resetting) onClose() }}
      >
        {/* Card */}
        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: '2.5rem 2.75rem',
            maxWidth: 420,
            width: '90%',
            boxShadow: '0 40px 100px rgba(0,0,0,0.32)',
            animation: 'rd-card 0.56s cubic-bezier(0.34,1.56,0.64,1) forwards',
            overflow: 'hidden',
            position: 'relative',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Red top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 4,
            background: 'linear-gradient(90deg,#EF4444,#F97316)',
          }} />

          {/* Icon */}
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: '#FEF2F2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            animation: 'rd-icon-pulse 2s ease-in-out infinite',
          }}>
            <RotateCcw size={30} color="#EF4444" />
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: '1.55rem', fontWeight: 800,
            color: '#0F172A', textAlign: 'center',
            margin: '0 0 0.5rem',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            animation: 'rd-fade-up 0.4s ease 0.15s backwards',
          }}>
            Reset Semua Data Demo?
          </h2>

          {/* Desc */}
          <p style={{
            textAlign: 'center', color: '#64748B',
            fontSize: '0.9rem', lineHeight: 1.6,
            margin: '0 0 1.25rem',
            animation: 'rd-fade-up 0.4s ease 0.25s backwards',
          }}>
            Tindakan ini <strong style={{ color: '#EF4444' }}>tidak dapat dibatalkan</strong>.
            Data berikut akan dihapus permanen:
          </p>

          {/* List */}
          <ul style={{
            margin: '0 0 1.75rem',
            padding: 0,
            listStyle: 'none',
            display: 'flex', flexDirection: 'column', gap: '0.4rem',
            animation: 'rd-fade-up 0.4s ease 0.32s backwards',
          }}>
            {DELETED_ITEMS.map(item => (
              <li key={item} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                background: '#FFF5F5',
                border: '1px solid #FEE2E2',
                borderRadius: 8,
                padding: '0.45rem 0.75rem',
                fontSize: '0.875rem',
                color: '#7F1D1D',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#EF4444', flexShrink: 0,
                }} />
                {item}
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div style={{
            display: 'flex', gap: '0.75rem',
            animation: 'rd-fade-up 0.4s ease 0.42s backwards',
          }}>
            <button
              onClick={onClose}
              disabled={resetting}
              style={{
                flex: 1,
                background: '#F1F5F9', color: '#475569',
                border: 'none', borderRadius: 12,
                padding: '0.8rem', fontSize: '0.9rem',
                fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                opacity: resetting ? 0.5 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!resetting) (e.currentTarget as HTMLButtonElement).style.background = '#E2E8F0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F1F5F9' }}
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              disabled={resetting}
              style={{
                flex: 1,
                background: resetting ? '#FCA5A5' : 'linear-gradient(135deg,#EF4444,#DC2626)',
                color: '#fff',
                border: 'none', borderRadius: 12,
                padding: '0.8rem', fontSize: '0.9rem',
                fontWeight: 700, cursor: resetting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                boxShadow: resetting ? 'none' : '0 6px 20px rgba(239,68,68,0.4)',
                transition: 'box-shadow 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => { if (!resetting) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
            >
              {resetting ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff',
                    display: 'inline-block',
                    animation: 'rd-spin 0.7s linear infinite',
                  }} />
                  Mereset...
                </>
              ) : (
                <>
                  Ya, Reset Semua
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

/* ─── Isi Data Contoh Popup ─────────────────────────────────────── */

const ISI_CONTOH_ITEMS = [
  'Tahun ajaran lalu dan tahun ajaran aktif',
  '12 kelas dan ±290 siswa, termasuk alumni',
  'Tagihan dan pembayaran 12 bulan terakhir',
  'Pola bayar lancar, telat, cicilan, dan menunggak',
]

function IsiDataContohPopup({
  mengisi,
  galat,
  onClose,
  onConfirm,
}: {
  mengisi:   boolean
  galat:     string
  onClose:   () => void
  onConfirm: () => void
}) {
  return (
    <>
      <style>{RESET_CSS}</style>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(8,16,34,0.75)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'rd-backdrop 0.28s ease forwards',
        }}
        onClick={() => { if (!mengisi) onClose() }}
      >
        <div
          style={{
            background: '#fff', borderRadius: 24, padding: '2.5rem 2.75rem',
            maxWidth: 440, width: '90%',
            boxShadow: '0 40px 100px rgba(0,0,0,0.32)',
            animation: 'rd-card 0.56s cubic-bezier(0.34,1.56,0.64,1) forwards',
            overflow: 'hidden', position: 'relative',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#1A2C4E,#3C75B7)' }} />

          <div style={{
            width: 68, height: 68, borderRadius: '50%', background: '#EFF6FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
          }}>
            <Database size={30} color="#1A2C4E" />
          </div>

          <h2 style={{
            fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', textAlign: 'center',
            margin: '0 0 0.5rem', fontFamily: 'var(--font-dm-sans), sans-serif',
            animation: 'rd-fade-up 0.4s ease 0.15s backwards',
          }}>
            Isi Data Contoh 12 Bulan?
          </h2>

          <p style={{
            textAlign: 'center', color: '#64748B', fontSize: '0.9rem', lineHeight: 1.6,
            margin: '0 0 1.25rem', animation: 'rd-fade-up 0.4s ease 0.25s backwards',
          }}>
            Semua data demo saat ini <strong style={{ color: '#0F172A' }}>diganti</strong> dengan data contoh.
            Nama sekolah dan rekening tetap. Prosesnya sekitar 20 detik.
          </p>

          <ul style={{
            margin: '0 0 1.5rem', padding: 0, listStyle: 'none',
            display: 'flex', flexDirection: 'column', gap: '0.4rem',
            animation: 'rd-fade-up 0.4s ease 0.32s backwards',
          }}>
            {ISI_CONTOH_ITEMS.map(item => (
              <li key={item} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                padding: '0.45rem 0.75rem', fontSize: '0.875rem', color: '#1E293B',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3C75B7', flexShrink: 0 }} />
                {item}
              </li>
            ))}
          </ul>

          {galat && (
            <div style={{ background: '#FEE2E2', color: '#B91C1C', borderRadius: 10, padding: '0.6rem 0.85rem', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              {galat}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', animation: 'rd-fade-up 0.4s ease 0.42s backwards' }}>
            <button
              onClick={onClose}
              disabled={mengisi}
              style={{
                flex: 1, background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 12,
                padding: '0.8rem', fontSize: '0.9rem', fontWeight: 600, cursor: mengisi ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif', opacity: mengisi ? 0.5 : 1,
              }}
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              disabled={mengisi}
              style={{
                flex: 1, background: mengisi ? '#5B6B8C' : '#1A2C4E', color: '#fff', border: 'none', borderRadius: 12,
                padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700, cursor: mengisi ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {mengisi ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                    display: 'inline-block', animation: 'rd-spin 0.7s linear infinite',
                  }} />
                  Mengisi...
                </>
              ) : 'Ya, Isi Data'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showResetModal,  setShowResetModal]  = useState(false)
  const [resetting,       setResetting]       = useState(false)
  const [showContohModal, setShowContohModal] = useState(false)
  const [mengisiContoh,   setMengisiContoh]   = useState(false)
  const [galatContoh,     setGalatContoh]     = useState('')
  const [tagihanOpen, setTagihanOpen] = useState(() => pathname.startsWith('/tagihan'))
  const [siswaOpen,   setSiswaOpen]   = useState(() => pathname.startsWith('/siswa'))
  const [laporanOpen, setLaporanOpen] = useState(() => pathname.startsWith('/laporan'))
  const [prevPath,    setPrevPath]    = useState(pathname)
  const [setupSteps,    setSetupSteps]    = useState<Record<string, boolean>>({})
  // Subfitur khusus sekolah (lib/fiturSekolah) — dipasang tim Equanusa lewat dasbor admin
  const [fitur,         setFitur]         = useState<KodeFitur[]>([])
  const [avatarHover,   setAvatarHover]   = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 80; canvas.height = 80
      const ctx = canvas.getContext('2d')!
      const size = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 80, 80)
      URL.revokeObjectURL(url)
      const base64 = canvas.toDataURL('image/jpeg', 0.85)

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      await supabase.from('profiles').update({ avatar: base64 }).eq('id', authUser.id)

      const authRaw = localStorage.getItem('siku_auth')
      if (authRaw) {
        const newValue = JSON.stringify({ ...JSON.parse(authRaw), avatar: base64 })
        localStorage.setItem('siku_auth', newValue)
        window.dispatchEvent(new StorageEvent('storage', { key: 'siku_auth', newValue }))
      }
    }
    img.src = url
  }

  // Bail-out pattern: auto-open saat masuk section, auto-close saat keluar
  if (prevPath !== pathname) {
    setPrevPath(pathname)
    const wasOnTagihan = prevPath.startsWith('/tagihan')
    const nowOnTagihan = pathname.startsWith('/tagihan')
    const wasOnSiswa   = prevPath.startsWith('/siswa')
    const nowOnSiswa   = pathname.startsWith('/siswa')
    const wasOnLaporan = prevPath.startsWith('/laporan')
    const nowOnLaporan = pathname.startsWith('/laporan')
    if (nowOnTagihan && !tagihanOpen) setTagihanOpen(true)
    if (wasOnTagihan && !nowOnTagihan) setTagihanOpen(false)
    if (nowOnSiswa   && !siswaOpen)   setSiswaOpen(true)
    if (wasOnSiswa   && !nowOnSiswa)  setSiswaOpen(false)
    if (nowOnLaporan && !laporanOpen) setLaporanOpen(true)
    if (wasOnLaporan && !nowOnLaporan) setLaporanOpen(false)
  }

  // Toggle dropdown — accordion: buka satu, tutup yang lain
  const toggleTagihan = () => {
    setTagihanOpen(o => { if (!o) { setSiswaOpen(false); setLaporanOpen(false) } return !o })
  }
  const toggleSiswa = () => {
    setSiswaOpen(o => { if (!o) { setTagihanOpen(false); setLaporanOpen(false) } return !o })
  }
  const toggleLaporan = () => {
    setLaporanOpen(o => { if (!o) { setTagihanOpen(false); setSiswaOpen(false) } return !o })
  }

  const raw = useSyncExternalStore(
    (cb) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb) },
    getAuthRaw,
    getAuthRawServer
  )
  const user: AuthUser | null = raw ? (JSON.parse(raw) as AuthUser) : null

  useEffect(() => {
    if (!localStorage.getItem('siku_auth')) router.replace('/')
  }, [router])

  // Sekolah yang belum dikonfirmasi tim Equanusa, atau baru dikonfirmasi dan belum melihat
  // halaman aktivasinya, diarahkan ke /kemitraan. Diperiksa sekali per muat halaman.
  useEffect(() => {
    let batal = false
    const periksa = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || batal) return
      const kemitraan = await bacaKemitraan(supabase, session.user.id)
      if (batal) return
      if (!kemitraan.data) {
        // Gagal dibaca (atau akun tanpa sekolah): dashboard tetap terbuka, kecuali status
        // terakhirnya masih menunggu — biar halaman kemitraan yang memutuskan
        if (statusLokal() === 'menunggu') router.replace(RUTE_KEMITRAAN)
        return
      }
      if (perluHalamanKemitraan(kemitraan.data)) {
        router.replace(RUTE_KEMITRAAN)
        return
      }
      simpanStatusLokal(kemitraan.data.status)
    }
    periksa()
    return () => { batal = true }
  }, [router])

  useEffect(() => {
    const load = async () => {
      // Render optimistis dari cache, lalu selalu fetch DB untuk pastikan data fresh
      const cached = localStorage.getItem('siku_setup_steps')
      if (cached) {
        try { setSetupSteps(JSON.parse(cached) as Record<string, boolean>) } catch { /* ignore */ }
      }
      const { data } = await supabase.from('pengaturan').select('setup_steps').maybeSingle()
      if (data?.setup_steps) {
        const steps = data.setup_steps as Record<string, boolean>
        setSetupSteps(steps)
        localStorage.setItem('siku_setup_steps', JSON.stringify(steps))
      }
    }
    load()
  }, [pathname])

  // Diperiksa ulang tiap pindah halaman, supaya subfitur yang baru ditambahkan atau
  // dicabut admin ikut terlihat tanpa harus masuk ulang
  useEffect(() => {
    let batal = false
    const load = async () => {
      setFitur(fiturLokal())
      const { data } = await bacaFiturSaya(supabase)
      if (batal || !data) return
      setFitur(data)
      simpanFiturLokal(data)
    }
    load()
    return () => { batal = true }
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('siku_auth')
    localStorage.removeItem('siku_setup_steps')
    localStorage.removeItem('siku_setup_done')
    hapusFiturLokal()
    router.push('/')
  }

  // Data login dibaca dari localStorage, jadi di server dan sesaat sebelum hydrate
  // belum ada: tampilkan kerangka sidebar + kerangka halaman sesuai URL. Sekolah yang
  // terakhir diketahui masih menunggu konfirmasi juga melihat kerangka sampai dialihkan.
  if (!user || user.kemitraan === 'menunggu') return <SkeletonShell pathname={pathname} />

  const schoolInitial   = user?.sekolah?.charAt(0)?.toUpperCase() || 'S'
  const tahunAjaranDone = setupSteps['tahun_ajaran']     === true
  const komponenDone    = setupSteps['komponen_tagihan'] === true
  const buatKelasDone   = setupSteps['buat_kelas']       === true
  const allDone         = setupSteps['import_siswa']     === true
  const isDemo          = user?.role === 'super_admin'

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">

        {/* ── Header ── */}
        <div className="sidebar-header">
          <div
            className="sidebar-school-avatar"
            style={{ position:'relative', cursor:'pointer', overflow:'hidden' }}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
            onClick={() => avatarInputRef.current?.click()}
          >
            {user?.avatar?.startsWith('data:') || user?.avatar?.startsWith('http') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            ) : schoolInitial}
            {avatarHover && (
              <div style={{
                position:'absolute', inset:0, borderRadius:10,
                background:'rgba(0, 0, 0, 0.25)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </div>
            )}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarChange} />
          <div className="sidebar-brand">
            <Image
              src="/image/LogoSiKuBaru.png"
              alt="SiKu"
              width={50}
              height={20}
              className="sidebar-brand-logo"
              priority
            />
            <div className="sidebar-brand-school">{user?.sekolah}</div>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav className="sidebar-nav">
          <Link
            href="/dashboard"
            className={`sidebar-item${pathname === '/dashboard' ? ' active' : ''}`}
          >
            <LayoutDashboard size={18} className="sidebar-icon" />
            <span>Dashboard</span>
          </Link>

          {allDone ? (
            <Link
              href="/pembayaran"
              className={`sidebar-item${pathname === '/pembayaran' ? ' active' : ''}`}
            >
              <Banknote size={18} className="sidebar-icon" />
              <span>Pembayaran</span>
            </Link>
          ) : (
            <div className="sidebar-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
              <Banknote size={18} className="sidebar-icon" />
              <span>Pembayaran</span>
              <Lock size={13} style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </div>
          )}

          {/* Tagihan dropdown */}
          <button
            className={`sidebar-item sidebar-dropdown-trigger${pathname.startsWith('/tagihan') ? ' active' : ''}`}
            onClick={toggleTagihan}
          >
            <Receipt size={18} className="sidebar-icon" />
            <span>Tagihan</span>
            <ChevronDown size={14} className={`sidebar-chevron${tagihanOpen ? ' rotated' : ''}`} />
          </button>
          <div className={`sidebar-submenu${tagihanOpen ? ' sidebar-submenu--open' : ''}`}>
              <Link href="/tagihan/tahun-ajaran" className={`sidebar-sub-item${pathname.startsWith('/tagihan/tahun-ajaran') ? ' active' : ''}`}>
                <Calendar size={13} /><span>Tahun Ajaran</span>
              </Link>
              {allDone ? (
                <Link href="/tagihan/aktif" className={`sidebar-sub-item${pathname === '/tagihan/aktif' ? ' active' : ''}`}>
                  <FileCheck size={13} /><span>Tagihan Aktif</span>
                </Link>
              ) : (
                <div className="sidebar-sub-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                  <FileCheck size={13} /><span>Tagihan Aktif</span>
                  <Lock size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
              {tahunAjaranDone ? (
                <Link href="/tagihan/komponen" className={`sidebar-sub-item${pathname.startsWith('/tagihan/komponen') ? ' active' : ''}`}>
                  <Layers size={13} /><span>Komponen Tagihan</span>
                </Link>
              ) : (
                <div className="sidebar-sub-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                  <Layers size={13} /><span>Komponen Tagihan</span>
                  <Lock size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
              {allDone ? (
                <Link href="/tagihan/paket-kelas" className={`sidebar-sub-item${pathname === '/tagihan/paket-kelas' ? ' active' : ''}`}>
                  <Package size={13} /><span>Paket per Kelas</span>
                </Link>
              ) : (
                <div className="sidebar-sub-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                  <Package size={13} /><span>Paket per Kelas</span>
                  <Lock size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
              {allDone ? (
                <Link href="/tagihan/beasiswa" className={`sidebar-sub-item${pathname === '/tagihan/beasiswa' ? ' active' : ''}`}>
                  <Gift size={13} /><span>Beasiswa & Potongan</span>
                </Link>
              ) : (
                <div className="sidebar-sub-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                  <Gift size={13} /><span>Beasiswa</span>
                  <Lock size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
              {allDone ? (
                <Link href="/tagihan/individu" className={`sidebar-sub-item${pathname === '/tagihan/individu' ? ' active' : ''}`}>
                  <SlidersHorizontal size={13} /><span>Komponen Individu</span>
                </Link>
              ) : (
                <div className="sidebar-sub-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                  <SlidersHorizontal size={13} /><span>Komponen Individu</span>
                  <Lock size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
          </div>

          {/* Siswa dropdown */}
          {komponenDone ? (
            <button
              className={`sidebar-item sidebar-dropdown-trigger${pathname.startsWith('/siswa') ? ' active' : ''}`}
              onClick={toggleSiswa}
            >
              <Users size={18} className="sidebar-icon" />
              <span>Siswa</span>
              <ChevronDown size={14} className={`sidebar-chevron${siswaOpen ? ' rotated' : ''}`} />
            </button>
          ) : (
            <div className="sidebar-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
              <Users size={18} className="sidebar-icon" />
              <span>Siswa</span>
              <Lock size={13} style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </div>
          )}
          <div className={`sidebar-submenu${siswaOpen ? ' sidebar-submenu--open' : ''}`}>
              {buatKelasDone ? (
                <Link href="/siswa/daftar-siswa" className={`sidebar-sub-item${pathname === '/siswa/daftar-siswa' ? ' active' : ''}`}>
                  <Users size={13} /><span>Daftar Siswa</span>
                </Link>
              ) : (
                <div className="sidebar-sub-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                  <Users size={13} /><span>Daftar Siswa</span>
                  <Lock size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
              {komponenDone ? (
                <Link href="/siswa/manajemen-kelas" className={`sidebar-sub-item${pathname.startsWith('/siswa/manajemen-kelas') ? ' active' : ''}`}>
                  <GraduationCap size={13} /><span>Manajemen Kelas</span>
                </Link>
              ) : (
                <div className="sidebar-sub-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                  <GraduationCap size={13} /><span>Manajemen Kelas</span>
                  <Lock size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
              {allDone ? (
                <Link href="/siswa/naik-kelas" className={`sidebar-sub-item${pathname.startsWith('/siswa/naik-kelas') ? ' active' : ''}`}>
                  <ChevronsUp size={13} /><span>Naik Kelas</span>
                </Link>
              ) : (
                <div className="sidebar-sub-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                  <ChevronsUp size={13} /><span>Naik Kelas</span>
                  <Lock size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
              {allDone ? (
                <Link href="/siswa/alumni" className={`sidebar-sub-item${pathname === '/siswa/alumni' ? ' active' : ''}`}>
                  <GraduationCap size={13} /><span>Alumni</span>
                </Link>
              ) : (
                <div className="sidebar-sub-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                  <GraduationCap size={13} /><span>Alumni</span>
                  <Lock size={11} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
          </div>

          {allDone && fitur.includes('pengeluaran') ? (
            <>
              {/* Laporan dropdown — hanya untuk sekolah yang diberi subfitur Pengeluaran */}
              <button
                className={`sidebar-item sidebar-dropdown-trigger${pathname.startsWith('/laporan') ? ' active' : ''}`}
                onClick={toggleLaporan}
              >
                <BarChart2 size={18} className="sidebar-icon" />
                <span>Laporan</span>
                <ChevronDown size={14} className={`sidebar-chevron${laporanOpen ? ' rotated' : ''}`} />
              </button>
              <div className={`sidebar-submenu${laporanOpen ? ' sidebar-submenu--open' : ''}`}>
                <Link
                  href="/laporan"
                  className={`sidebar-sub-item${pathname.startsWith('/laporan') && !pathname.startsWith('/laporan/pengeluaran') ? ' active' : ''}`}
                >
                  <PieChart size={13} /><span>Ringkasan</span>
                </Link>
                <Link
                  href="/laporan/pengeluaran"
                  className={`sidebar-sub-item${pathname.startsWith('/laporan/pengeluaran') ? ' active' : ''}`}
                >
                  <Wallet size={13} /><span>Pengeluaran</span>
                </Link>
              </div>
            </>
          ) : allDone ? (
            <Link
              href="/laporan"
              className={`sidebar-item${pathname === '/laporan' || pathname.startsWith('/laporan/') ? ' active' : ''}`}
            >
              <BarChart2 size={18} className="sidebar-icon" />
              <span>Laporan</span>
            </Link>
          ) : (
            <div className="sidebar-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
              <BarChart2 size={18} className="sidebar-icon" />
              <span>Laporan</span>
              <Lock size={13} style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </div>
          )}

          {/* ── Notifikasi ── 
          <div className="sidebar-notification-wrap">
            <button className="sidebar-notification">
              <span className="sidebar-notif-icon-wrap">
                <Bell size={17} />
              </span>
              <span>Notifikasi</span>
              <span className="sidebar-notif-dot" />
            </button>
          </div>*/}

        </nav>

        {/* ── Bottom (kuning) ── */}
        <div className="sidebar-bottom">
          {isDemo && (
            <button
              className="sidebar-bottom-item"
              onClick={() => { setGalatContoh(''); setShowContohModal(true) }}
            >
              <Database size={18} />
              <span>Isi Data Contoh</span>
            </button>
          )}
          {isDemo && (
            <button
              className="sidebar-bottom-item"
              onClick={() => setShowResetModal(true)}
              style={{ color: '#e83232' }}
            >
              <RotateCcw size={18} />
              <span>Reset Demo</span>
            </button>
          )}
          <Link
            href="/pengaturan"
            className={`sidebar-bottom-item${pathname === '/pengaturan' ? ' active' : ''}`}
          >
            <Settings size={18} />
            <span>Pengaturan</span>
          </Link>
          <button
            className="sidebar-bottom-item sidebar-bottom-logout"
            onClick={() => setShowLogoutModal(true)}
          >
            <LogOut size={18} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">{children}</main>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="logout-modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="logout-modal-icon">
              <LogOut size={28} />
            </div>
            <h3 className="logout-modal-title">Keluar dari SiKu?</h3>
            <p className="logout-modal-desc">Anda akan keluar dari akun <strong>{user?.nama}</strong>. Pastikan semua pekerjaan sudah tersimpan.</p>
            <div className="logout-modal-actions">
              <button className="logout-modal-cancel" onClick={() => setShowLogoutModal(false)}>Batal</button>
              <button className="logout-modal-confirm" onClick={handleLogout}>Ya, Keluar</button>
            </div>
          </div>
        </div>
      )}

      {/* Isi Data Contoh Modal */}
      {showContohModal && (
        <IsiDataContohPopup
          mengisi={mengisiContoh}
          galat={galatContoh}
          onClose={() => setShowContohModal(false)}
          onConfirm={async () => {
            setMengisiContoh(true)
            setGalatContoh('')
            try {
              const { data: { session } } = await supabase.auth.getSession()
              const res  = await fetch('/api/demo-seed', {
                method:  'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
              })
              // Batas waktu fungsi dibalas halaman HTML, bukan JSON
              const json = await res.json().catch(() => ({ error: `Server membalas status ${res.status}. Coba lagi.` })) as { error: string | null }
              if (!res.ok || json.error) {
                setGalatContoh(json.error ?? 'Gagal mengisi data contoh.')
                return
              }
              // Semua langkah setup sudah terisi — cache checklist ikut diperbarui, dan
              // penanda selesai dipasang supaya popup "setup selesai" tidak muncul
              localStorage.setItem('siku_setup_steps', JSON.stringify({
                profil_sekolah: true, tahun_ajaran: true, komponen_tagihan: true, buat_kelas: true, import_siswa: true,
              }))
              localStorage.setItem('siku_setup_done', new Date().toISOString())
              // Muat ulang penuh: setiap halaman menyimpan datanya sendiri di state
              window.location.href = '/laporan'
            } catch {
              setGalatContoh('Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.')
            } finally {
              setMengisiContoh(false)
            }
          }}
        />
      )}

      {/* Reset Demo Modal */}
      {showResetModal && (
        <ResetDemoPopup
          resetting={resetting}
          onClose={() => setShowResetModal(false)}
          onConfirm={async () => {
            setResetting(true)
            try {
              const { data: { session } } = await supabase.auth.getSession()
              await fetch('/api/demo-reset', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
              })
            } finally {
              localStorage.removeItem('siku_auth')
              localStorage.removeItem('siku_setup_steps')
              localStorage.removeItem('siku_setup_done')
              hapusFiturLokal()
              setResetting(false)
              setShowResetModal(false)
              router.push('/')
            }
          }}
        />
      )}
    </div>
  )
}
