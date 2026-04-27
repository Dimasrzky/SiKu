'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import './dashboard.css'

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Dashboard',   icon: '◉'  },
  { href: '/dashboard/siswa',      label: 'Data Siswa',  icon: '👥' },
  { href: '/dashboard/tagihan',    label: 'Tagihan SPP', icon: '💰' },
  { href: '/dashboard/pembayaran', label: 'Pembayaran',  icon: '🏦' },
  { href: '/dashboard/laporan',    label: 'Laporan',     icon: '📊' },
  { href: '/dashboard/pengaturan', label: 'Pengaturan',  icon: '⚙️' },
]

interface AuthUser { nama: string; jabatan: string; sekolah: string; avatar: string }

function getAuthRaw() { return localStorage.getItem('siku_auth') }
function getAuthRawServer() { return null }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const raw  = useSyncExternalStore(
    (cb) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb) },
    getAuthRaw,
    getAuthRawServer
  )
  const user: AuthUser | null = raw ? (JSON.parse(raw) as AuthUser) : null

  useEffect(() => {
    if (!user) router.replace('/login')
  }, [user, router])

  const handleLogout = () => {
    localStorage.removeItem('siku_auth')
    router.push('/login')
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
          <div className="sidebar-school-period">● April 2025 aktif</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${pathname === item.href ? ' active' : ''}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{avatarLabel}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.nama}</div>
            <div className="sidebar-user-role">{user?.jabatan}</div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} title="Keluar">⏻</button>
        </div>
      </aside>

      <main className="dashboard-main">{children}</main>
    </div>
  )
}