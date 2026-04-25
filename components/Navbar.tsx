'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()
  const isHome = pathname === '/'

  const scrollTo = (id: string) => {
    if (!isHome) return
    const el = document.getElementById(id)
    if (el) {
      const offset = 72
      const top = el.getBoundingClientRect().top + window.pageYOffset - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        SiKu <span>BETA</span>
      </Link>

      <div className="nav-links">
        {isHome ? (
          <>
            <a
              href="#fitur"
              className="nav-hide-mobile"
              onClick={(e) => { e.preventDefault(); scrollTo('fitur') }}
            >
              Fitur
            </a>
            <a
              href="#cara-kerja"
              className="nav-hide-mobile"
              onClick={(e) => { e.preventDefault(); scrollTo('cara-kerja') }}
            >
              Cara Kerja
            </a>
          </>
        ) : (
          <>
            <Link href="/#fitur" className="nav-hide-mobile">Fitur</Link>
            <Link href="/#cara-kerja" className="nav-hide-mobile">Cara Kerja</Link>
          </>
        )}

        <Link href="/harga" className="nav-hide-mobile">
          Harga
        </Link>

        <Link href="/support" className="nav-hide-mobile">
          Dukungan
        </Link>

        <Link
          href="/login"
          style={{
            color: 'var(--navy)',
            fontSize: '1.125rem',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'color 0.2s',
          }}
          className="nav-hide-mobile"
        >
          Masuk
        </Link>

        <Link href="/daftar" className="btn-nav">
          Coba Gratis
        </Link>
      </div>
    </nav>
  )
}