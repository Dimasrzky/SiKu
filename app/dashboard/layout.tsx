'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import './dashboard.css'

// ─── Definisi menu sidebar ────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard',             label: 'Dashboard',     icon: '◉',  enabled: true  },
  { href: '/dashboard/siswa',       label: 'Data Siswa',    icon: '👥', enabled: false },
  { href: '/dashboard/tagihan',     label: 'Tagihan SPP',   icon: '💰', enabled: false },
  { href: '/dashboard/pembayaran',  label: 'Pembayaran',    icon: '🏦', enabled: false },
  { href: '/dashboard/laporan',     label: 'Laporan',       icon: '📊', enabled: false },
  { href: '/dashboard/pengaturan',  label: 'Pengaturan',    icon: '⚙️', enabled: false },
]

interface AuthUser {
  nama: string
  jabatan: string
  sekolah: string
  avatar: string
}

const AUTH_KEY = 'edukas_auth'

function subscribeToAuth(cb: () => void) {
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}

// ─── Layout utama dashboard ───────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const rawAuth = useSyncExternalStore(
    subscribeToAuth,
    () => localStorage.getItem(AUTH_KEY),
    () => null,
  )

  const user = useMemo<AuthUser | null>(() => {
    if (!rawAuth) return null
    try { return JSON.parse(rawAuth) } catch { return null }
  }, [rawAuth])

  const authorized = rawAuth !== null

  useEffect(() => {
    if (rawAuth === null) router.replace('/login')
  }, [rawAuth, router])

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY)
    router.push('/login')
  }

  // Loading state sementara auth dicek
  if (!authorized) {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: '#F1F5F9',
        }}
      >
        <p style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>Memuat...</p>
      </div>
    )
  }

  // Inisial avatar dari nama user
  const avatarLabel =
    user?.avatar ||
    user?.nama
      ?.split(' ')
      .slice(0, 2)
      .map((w: string) => w[0])
      .join('')
      .toUpperCase() ||
    'U'

  return (
    <div className="dashboard-shell">

      {/* ─── SIDEBAR ──────────────────────────────────── */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <span className="sidebar-logo-text">SiKu</span>
          <span className="sidebar-logo-badge">BETA</span>
        </div>

        {/* Info sekolah aktif */}
        <div className="sidebar-school">
          <div className="sidebar-school-name">{user?.sekolah}</div>
          <div className="sidebar-school-period">● April 2025 aktif</div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href

            if (item.enabled) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-item${isActive ? ' active' : ''}`}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            }

            // Menu yang belum tersedia
            return (
              <div
                key={item.href}
                className="sidebar-item disabled"
                title="Fitur ini akan segera hadir"
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span>{item.label}</span>
                <span className="sidebar-soon">Segera</span>
              </div>
            )
          })}
        </nav>

        {/* User info + tombol logout */}
        <div className="sidebar-user">
          <div className="sidebar-avatar">{avatarLabel}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.nama}</div>
            <div className="sidebar-user-role">{user?.jabatan}</div>
          </div>
          <button
            className="sidebar-logout"
            onClick={handleLogout}
            title="Keluar"
          >
            ⏻
          </button>
        </div>

      </aside>

      {/* ─── MAIN CONTENT (diisi children dari page.tsx) ─ */}
      <main className="dashboard-main">
        {children}
      </main>

    </div>
  )
}