'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Puzzle, School, ShieldCheck, type LucideIcon } from 'lucide-react'

export interface JumlahMenunggu {
  /** Sekolah yang menunggu konfirmasi kemitraan */
  kemitraan: number
  /** Bukti transfer yang menunggu verifikasi */
  bukti:     number
}

const MENU: { href: string; label: string; Ikon: LucideIcon; badge?: keyof JumlahMenunggu }[] = [
  { href: '/admin/kemitraan',             label: 'Kemitraan Sekolah',     Ikon: School,      badge: 'kemitraan' },
  { href: '/admin/verifikasi-pembayaran', label: 'Verifikasi Pembayaran', Ikon: ShieldCheck, badge: 'bukti' },
  { href: '/admin/fitur-sekolah',         label: 'Fitur Sekolah',         Ikon: Puzzle },
]

export default function SidebarAdmin({ menunggu }: { menunggu: JumlahMenunggu }) {
  const pathname = usePathname()

  return (
    <aside className="admin-sidebar">
      <nav className="admin-nav" aria-label="Menu admin">
        {MENU.map(({ href, label, Ikon, badge }) => {
          const aktif  = pathname === href || pathname.startsWith(`${href}/`)
          const jumlah = badge ? menunggu[badge] : 0
          return (
            <Link key={href} href={href} className={`admin-nav-item${aktif ? ' active' : ''}`} aria-current={aktif ? 'page' : undefined}>
              <Ikon size={18} className="admin-nav-ikon" />
              <span>{label}</span>
              {jumlah > 0 && (
                <span className="admin-nav-badge" aria-label={`${jumlah} menunggu`}>{jumlah > 99 ? '99+' : jumlah}</span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
