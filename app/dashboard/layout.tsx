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
} from 'lucide-react'
import './dashboard.css'

interface AuthUser { nama: string; jabatan: string; sekolah: string; avatar: string; role?: string }

function getAuthRaw() { return localStorage.getItem('siku_auth') }
function getAuthRawServer() { return null }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showResetModal,  setShowResetModal]  = useState(false)
  const [resetting,       setResetting]       = useState(false)
  // Collapsed state — hanya berlaku saat on-path; reset otomatis saat masuk ulang ke section
  const [tagihanCollapsed, setTagihanCollapsed] = useState(false)
  const [siswaCollapsed,   setSiswaCollapsed]   = useState(false)
  const [prevPath,         setPrevPath]         = useState(pathname)

  // Bail-out pattern: deteksi perpindahan section, reset collapsed tanpa useEffect
  if (prevPath !== pathname) {
    setPrevPath(pathname)
    const wasOnTagihan = prevPath.startsWith('/dashboard/tagihan')
    const nowOnTagihan = pathname.startsWith('/dashboard/tagihan')
    const wasOnSiswa   = prevPath.startsWith('/dashboard/siswa') || prevPath === '/dashboard/kelas'
    const nowOnSiswa   = pathname.startsWith('/dashboard/siswa') || pathname === '/dashboard/kelas'
    if (!wasOnTagihan && nowOnTagihan && tagihanCollapsed) setTagihanCollapsed(false)
    if (!wasOnSiswa   && nowOnSiswa   && siswaCollapsed)   setSiswaCollapsed(false)
  }

  const tagihanPathOpen = pathname.startsWith('/dashboard/tagihan')
  const siswaPathOpen   = pathname.startsWith('/dashboard/siswa') || pathname === '/dashboard/kelas'

  // Dropdown hanya bisa terbuka saat on-path — tidak ada "force open" dari halaman lain
  const tagihanOpen = tagihanPathOpen && !tagihanCollapsed
  const siswaOpen   = siswaPathOpen   && !siswaCollapsed

  // Toggle: saat on-path → buka/tutup; saat off-path → navigasi ke section default
  const toggleTagihan = () => tagihanPathOpen ? setTagihanCollapsed(c => !c) : router.push('/dashboard/tagihan')
  const toggleSiswa   = () => siswaPathOpen   ? setSiswaCollapsed(c => !c)   : router.push('/dashboard/siswa')

  const raw = useSyncExternalStore(
    (cb) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb) },
    getAuthRaw,
    getAuthRawServer
  )
  const user: AuthUser | null = raw ? (JSON.parse(raw) as AuthUser) : null

  useEffect(() => {
    if (!localStorage.getItem('siku_auth')) router.replace('/')
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('siku_auth')
    router.push('/')
  }

  if (!user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#F1F5F9' }}>
      <p style={{ color:'#9CA3AF', fontSize:'0.9rem' }}>Memuat...</p>
    </div>
  )

  const schoolInitial = user?.sekolah?.charAt(0)?.toUpperCase() || 'S'

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

          <Link
            href="/dashboard/pembayaran"
            className={`sidebar-item${pathname === '/dashboard/pembayaran' ? ' active' : ''}`}
          >
            <Banknote size={18} className="sidebar-icon" />
            <span>Pembayaran</span>
          </Link>

          {/* Tagihan dropdown */}
          <button
            className={`sidebar-item sidebar-dropdown-trigger${pathname.startsWith('/dashboard/tagihan') ? ' active' : ''}`}
            onClick={toggleTagihan}
          >
            <Receipt size={18} className="sidebar-icon" />
            <span>Tagihan</span>
            <ChevronDown size={14} className={`sidebar-chevron${tagihanOpen ? ' rotated' : ''}`} />
          </button>
          {tagihanOpen && (
            <div className="sidebar-submenu">
              <Link href="/dashboard/tagihan/tahun-ajaran" className={`sidebar-sub-item${pathname === '/dashboard/tagihan/tahun-ajaran' ? ' active' : ''}`}>
                <Calendar size={13} /><span>Tahun Ajaran</span>
              </Link>
              <Link href="/dashboard/tagihan" className={`sidebar-sub-item${pathname === '/dashboard/tagihan' ? ' active' : ''}`}>
                <FileCheck size={13} /><span>Tagihan Aktif</span>
              </Link>
              <Link href="/dashboard/tagihan/komponen" className={`sidebar-sub-item${pathname === '/dashboard/tagihan/komponen' ? ' active' : ''}`}>
                <Layers size={13} /><span>Komponen Tagihan</span>
              </Link>
              <Link href="/dashboard/tagihan/paket-kelas" className={`sidebar-sub-item${pathname === '/dashboard/tagihan/paket-kelas' ? ' active' : ''}`}>
                <Package size={13} /><span>Paket per Kelas</span>
              </Link>
              <Link href="/dashboard/tagihan/beasiswa" className={`sidebar-sub-item${pathname === '/dashboard/tagihan/beasiswa' ? ' active' : ''}`}>
                <Gift size={13} /><span>Beasiswa &amp; Override</span>
              </Link>
            </div>
          )}

          {/* Siswa dropdown */}
          <button
            className={`sidebar-item sidebar-dropdown-trigger${pathname.startsWith('/dashboard/siswa') || pathname === '/dashboard/kelas' ? ' active' : ''}`}
            onClick={toggleSiswa}
          >
            <Users size={18} className="sidebar-icon" />
            <span>Siswa</span>
            <ChevronDown size={14} className={`sidebar-chevron${siswaOpen ? ' rotated' : ''}`} />
          </button>
          {siswaOpen && (
            <div className="sidebar-submenu">
              <Link href="/dashboard/siswa" className={`sidebar-sub-item${pathname === '/dashboard/siswa' ? ' active' : ''}`}>
                <Users size={13} /><span>Daftar Siswa</span>
              </Link>
              <Link href="/dashboard/kelas" className={`sidebar-sub-item${pathname === '/dashboard/kelas' ? ' active' : ''}`}>
                <GraduationCap size={13} /><span>Manajemen Kelas</span>
              </Link>
              <Link href="/dashboard/siswa/alumni" className={`sidebar-sub-item${pathname === '/dashboard/siswa/alumni' ? ' active' : ''}`}>
                <GraduationCap size={13} /><span>Alumni</span>
              </Link>
            </div>
          )}

          <Link
            href="/dashboard/laporan"
            className={`sidebar-item${pathname === '/dashboard/laporan' ? ' active' : ''}`}
          >
            <BarChart2 size={18} className="sidebar-icon" />
            <span>Laporan</span>
          </Link>

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

          {/* Reset Demo — super_admin only */}
          {user?.role === 'super_admin' && (
            <button
              className="sidebar-item"
              onClick={() => setShowResetModal(true)}
              style={{ color: '#F87171', marginTop: 'auto', marginLeft: '-0.75rem' }}
            >
              <RotateCcw size={18} className="sidebar-icon" />
              <span>Reset Demo</span>
            </button>
          )}
        </nav>

        {/* ── Bottom (kuning) ── */}
        <div className="sidebar-bottom">
          <Link
            href="/dashboard/pengaturan"
            className={`sidebar-bottom-item${pathname === '/dashboard/pengaturan' ? ' active' : ''}`}
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
        <div className="logout-modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="logout-modal-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
              <RotateCcw size={28} />
            </div>
            <h3 className="logout-modal-title">Reset Demo?</h3>
            <p className="logout-modal-desc">
              Semua data demo akan <strong>dihapus permanen</strong> — siswa, tagihan, pembayaran, dan profil sekolah saat ini.
            </p>
            <p className="logout-modal-desc" style={{ marginTop: '0.5rem', color: '#6B7280', fontSize: '0.8rem' }}>
              Kamu akan mengisi ulang nama, jabatan, dan profil sekolah untuk kunjungan berikutnya.
            </p>
            <div className="logout-modal-actions">
              <button className="logout-modal-cancel" onClick={() => setShowResetModal(false)}>Batal</button>
              <button
                className="logout-modal-confirm"
                style={{ background: '#EF4444', borderColor: '#EF4444', opacity: resetting ? 0.7 : 1 }}
                disabled={resetting}
                onClick={async () => {
                  setResetting(true)
                  try {
                    const { createBrowserClient } = await import('@supabase/ssr')
                    const sb = createBrowserClient(
                      process.env.NEXT_PUBLIC_SUPABASE_URL!,
                      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                    )
                    const { data: { session } } = await sb.auth.getSession()
                    await fetch('/api/demo-reset', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
                    })
                  } finally {
                    localStorage.removeItem('siku_auth')
                    setResetting(false)
                    setShowResetModal(false)
                    router.push('/')
                  }
                }}
              >
                {resetting ? 'Mereset...' : 'Ya, Reset Demo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
