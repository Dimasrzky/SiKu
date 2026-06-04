'use client'

import { useEffect, useSyncExternalStore, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  Receipt,
  Banknote,
  BarChart2,
  Settings,
  LogOut,
  RotateCcw,
  GraduationCap,
} from 'lucide-react'
import './dashboard.css'

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/dashboard/kelas',      label: 'Kelas',           icon: GraduationCap   },
  { href: '/dashboard/siswa',      label: 'Manajemen Siswa', icon: Users           },
  { href: '/dashboard/tagihan',    label: 'Tagihan',         icon: Receipt         },
  { href: '/dashboard/pembayaran', label: 'Pembayaran',      icon: Banknote        },
  { href: '/dashboard/laporan',    label: 'Laporan',         icon: BarChart2       },
  { href: '/dashboard/pengaturan', label: 'Pengaturan',      icon: Settings        },
]

interface AuthUser { nama: string; jabatan: string; sekolah: string; avatar: string; role?: string }

function getAuthRaw() { return localStorage.getItem('siku_auth') }
function getAuthRawServer() { return null }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showResetModal,  setShowResetModal]  = useState(false)
  const [resetting,       setResetting]       = useState(false)

  const raw  = useSyncExternalStore(
    (cb) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb) },
    getAuthRaw,
    getAuthRawServer
  )
  const user: AuthUser | null = raw ? (JSON.parse(raw) as AuthUser) : null

  // Baca localStorage setelah hydration selesai — menghindari false-redirect
  // akibat server snapshot (null) dari useSyncExternalStore
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

  const avatarLabel = user?.avatar || 'U'

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-text">SiKu</span>
          <span className="sidebar-logo-badge">BETA</span>
        </div>

        <div className="sidebar-school">
          <div className="sidebar-school-name">{user?.sekolah}</div>
          <div className="sidebar-school-period">
            ● {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} aktif
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${pathname === item.href ? ' active' : ''}`}
            >
              <item.icon size={18} className="sidebar-icon" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {user?.role === 'super_admin' && (
          <button
            className="sidebar-item"
            onClick={() => setShowResetModal(true)}
            style={{ color:'#F87171', marginTop:'0.25rem' }}
            title="Reset demo untuk sekolah baru"
          >
            <RotateCcw size={18} className="sidebar-icon" />
            <span>Reset Demo</span>
          </button>
        )}

        <div className="sidebar-user">
          <div className="sidebar-avatar">{avatarLabel}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.nama}</div>
            <div className="sidebar-user-role">{user?.jabatan}</div>
          </div>
          <button className="sidebar-logout" onClick={() => setShowLogoutModal(true)} title="Keluar"><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="dashboard-main">{children}</main>

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

      {showResetModal && (
        <div className="logout-modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="logout-modal-icon" style={{ background:'#FEF2F2', color:'#EF4444' }}>
              <RotateCcw size={28} />
            </div>
            <h3 className="logout-modal-title">Reset Demo?</h3>
            <p className="logout-modal-desc">
              Semua data demo akan <strong>dihapus permanen</strong> — siswa, tagihan, pembayaran, dan profil sekolah saat ini.
            </p>
            <p className="logout-modal-desc" style={{ marginTop:'0.5rem', color:'#6B7280', fontSize:'0.8rem' }}>
              Kamu akan mengisi ulang nama, jabatan, dan profil sekolah untuk kunjungan berikutnya.
            </p>
            <div className="logout-modal-actions">
              <button className="logout-modal-cancel" onClick={() => setShowResetModal(false)}>Batal</button>
              <button
                className="logout-modal-confirm"
                style={{ background:'#EF4444', borderColor:'#EF4444', opacity: resetting ? 0.7 : 1 }}
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