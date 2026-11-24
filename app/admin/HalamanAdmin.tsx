import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface Jejak { label: string; href?: string }

/**
 * Kerangka satu halaman admin: bar judul putih (jejak, judul, subjudul, tombol aksi di
 * kanan) yang menempel di atas saat digulir, lalu isi halaman.
 */
export default function HalamanAdmin({ judul, subjudul, jejak, aksi, children }: {
  judul:     string
  subjudul?: string
  /** Jejak di atas judul, untuk halaman bertingkat (mis. Verifikasi Pembayaran › sekolah) */
  jejak?:    Jejak[]
  aksi?:     ReactNode
  children:  ReactNode
}) {
  return (
    <>
      <header className="admin-topbar">
        <div className="admin-topbar-teks">
          {jejak && jejak.length > 0 && (
            <nav className="admin-jejak" aria-label="Jejak halaman">
              {jejak.map((j, i) => (
                <Fragment key={`${j.label}-${i}`}>
                  {i > 0 && <ChevronRight size={12} aria-hidden />}
                  {j.href && i < jejak.length - 1
                    ? <Link href={j.href}>{j.label}</Link>
                    : <span aria-current={i === jejak.length - 1 ? 'page' : undefined}>{j.label}</span>}
                </Fragment>
              ))}
            </nav>
          )}
          <h1 className="admin-judul">{judul}</h1>
          {subjudul && <p className="admin-subjudul">{subjudul}</p>}
        </div>
        {aksi && <div className="admin-topbar-aksi">{aksi}</div>}
      </header>
      <main className="admin-isi">{children}</main>
    </>
  )
}
