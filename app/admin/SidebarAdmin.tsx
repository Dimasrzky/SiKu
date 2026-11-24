'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { House, Menu, Puzzle, School, ShieldCheck, X, type LucideIcon } from 'lucide-react'
import MenuAkun from './MenuAkun'

export interface JumlahMenunggu {
  /** Sekolah yang menunggu konfirmasi kemitraan */
  kemitraan: number
  /** Bukti transfer yang menunggu verifikasi */
  bukti:     number
}

const MENU: { href: string; label: string; Ikon: LucideIcon; badge?: keyof JumlahMenunggu }[] = [
  { href: '/admin',                       label: 'Beranda',               Ikon: House },
  { href: '/admin/kemitraan',             label: 'Kemitraan Sekolah',     Ikon: School,      badge: 'kemitraan' },
  { href: '/admin/verifikasi-pembayaran', label: 'Verifikasi Pembayaran', Ikon: ShieldCheck, badge: 'bukti' },
  { href: '/admin/fitur-sekolah',         label: 'Fitur Sekolah',         Ikon: Puzzle },
]

const angka = (n: number) => (n > 99 ? '99+' : String(n))

const Logo = () => (
  <div className="admin-sidebar-kepala">
    <Link href="/admin" className="admin-sidebar-logo" aria-label="SiKuAdmin — beranda">
      <Image src="/image/LogoSiKuBaru.png" alt="SiKu" width={80} height={34} priority />
    </Link>
    <span className="admin-sidebar-label">ADMIN</span>
  </div>
)

/**
 * Sidebar navy setinggi layar: logo, menu dengan angka menunggu, akun + Keluar di dasar.
 * Di layar sempit sidebar menjadi laci yang dibuka dari bar navy di atas halaman.
 */
export default function SidebarAdmin({ menunggu }: { menunggu: JumlahMenunggu }) {
  const pathname = usePathname()
  const [buka, setBuka] = useState(false)
  const totalMenunggu = menunggu.kemitraan + menunggu.bukti

  return (
    <>
      <div className="admin-bar-ponsel">
        <Logo />
        <button
          type="button"
          className="admin-bar-menu"
          onClick={() => setBuka(true)}
          aria-label="Buka menu"
          aria-expanded={buka}
          aria-controls="admin-sidebar"
        >
          <Menu size={20} />
          {totalMenunggu > 0 && <span className="admin-hitung">{angka(totalMenunggu)}</span>}
        </button>
      </div>

      <aside id="admin-sidebar" className={`admin-sidebar${buka ? ' terbuka' : ''}`}>
        <div className="admin-sidebar-atas">
          <Logo />
          {buka && (
            <button type="button" className="admin-sidebar-tutup" onClick={() => setBuka(false)} aria-label="Tutup menu">
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="admin-nav" aria-label="Menu admin">
          {MENU.map(({ href, label, Ikon, badge }) => {
            const aktif  = href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
            const jumlah = badge ? menunggu[badge] : 0
            return (
              <Link
                key={href}
                href={href}
                className={`admin-nav-item${aktif ? ' active' : ''}`}
                aria-current={aktif ? 'page' : undefined}
                onClick={() => setBuka(false)}
              >
                <span className="admin-nav-ikon"><Ikon size={17} /></span>
                <span className="admin-nav-teks">{label}</span>
                {jumlah > 0 && <span className="admin-hitung" aria-label={`${jumlah} menunggu`}>{angka(jumlah)}</span>}
              </Link>
            )
          })}
        </nav>

        <MenuAkun />
      </aside>

      {buka && <div className="admin-tirai" onClick={() => setBuka(false)} aria-hidden />}
    </>
  )
}
