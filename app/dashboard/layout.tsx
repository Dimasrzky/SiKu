'use client'

import { useEffect, useSyncExternalStore } from 'react'
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
} from 'lucide-react'
import './dashboard.css'

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/dashboard/siswa',      label: 'Data Siswa', icon: Users           },
  { href: '/dashboard/tagihan',    label: 'Tagihan',    icon: Receipt         },
  { href: '/dashboard/pembayaran', label: 'Pembayaran', icon: Banknote        },
  { href: '/dashboard/laporan',    label: 'Laporan',    icon: BarChart2       },
  { href: '/dashboard/pengaturan', label: 'Pengaturan', icon: Settings        },
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
              <item.icon size={18} className="sidebar-icon" />
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
          <button className="sidebar-logout" onClick={handleLogout} title="Keluar"><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="dashboard-main">{children}</main>
    </div>
  )
}