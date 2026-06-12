'use client'

import { useEffect, useSyncExternalStore, useState } from 'react'
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
  Bell,
  Calendar,
  FileCheck,
  Layers,
  Package,
  Gift,
  GraduationCap,
  Lock,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import './dashboard.css'

interface AuthUser { nama: string; jabatan: string; sekolah: string; avatar: string; role?: string }

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showResetModal,  setShowResetModal]  = useState(false)
  const [resetting,       setResetting]       = useState(false)
  const [tagihanOpen, setTagihanOpen] = useState(() => pathname.startsWith('/dashboard/tagihan'))
  const [siswaOpen,   setSiswaOpen]   = useState(() => pathname.startsWith('/dashboard/siswa'))
  const [prevPath,    setPrevPath]    = useState(pathname)
  const [setupSteps,  setSetupSteps]  = useState<Record<string, boolean>>({})

  // Bail-out pattern: auto-open saat masuk section, auto-close saat keluar
  if (prevPath !== pathname) {
    setPrevPath(pathname)
    const wasOnTagihan = prevPath.startsWith('/dashboard/tagihan')
    const nowOnTagihan = pathname.startsWith('/dashboard/tagihan')
    const wasOnSiswa   = prevPath.startsWith('/dashboard/siswa')
    const nowOnSiswa   = pathname.startsWith('/dashboard/siswa')
    if (nowOnTagihan && !tagihanOpen) setTagihanOpen(true)
    if (wasOnTagihan && !nowOnTagihan) setTagihanOpen(false)
    if (nowOnSiswa   && !siswaOpen)   setSiswaOpen(true)
    if (wasOnSiswa   && !nowOnSiswa)  setSiswaOpen(false)
  }

  // Toggle dropdown — accordion: buka satu, tutup yang lain
  const toggleTagihan = () => {
    setTagihanOpen(o => { if (!o) setSiswaOpen(false); return !o })
  }
  const toggleSiswa = () => {
    setSiswaOpen(o => { if (!o) setTagihanOpen(false); return !o })
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

  const handleLogout = () => {
    localStorage.removeItem('siku_auth')
    router.push('/')
  }

  if (!user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#F1F5F9' }}>
      <p style={{ color:'#9CA3AF', fontSize:'0.9rem' }}>Memuat...</p>
    </div>
  )

  const schoolInitial   = user?.sekolah?.charAt(0)?.toUpperCase() || 'S'
  const tahunAjaranDone = setupSteps['tahun_ajaran']     === true
  const komponenDone    = setupSteps['komponen_tagihan'] === true
  const buatKelasDone   = setupSteps['buat_kelas']       === true
  const allDone         = setupSteps['import_siswa']     === true
  const isDemo          = user?.role === 'super_admin' && user?.nama === 'Tim SiKu'

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">

        {/* ── Header ── */}
        <div className="sidebar-header">
          <div className="sidebar-school-avatar">{schoolInitial}</div>
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
                  <Gift size={13} /><span>Beasiswa &amp; Override</span>
                </Link>
              ) : (
                <div className="sidebar-sub-item" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                  <Gift size={13} /><span>Beasiswa &amp; Override</span>
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

          {allDone ? (
            <Link
              href="/laporan"
              className={`sidebar-item${pathname === '/laporan' ? ' active' : ''}`}
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

          {/* ── Notifikasi ── */}
          <div className="sidebar-notification-wrap">
            <button className="sidebar-notification">
              <span className="sidebar-notif-icon-wrap">
                <Bell size={17} />
              </span>
              <span>Notifikasi</span>
              <span className="sidebar-notif-dot" />
            </button>
          </div>

        </nav>

        {/* ── Bottom (kuning) ── */}
        <div className="sidebar-bottom">
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
