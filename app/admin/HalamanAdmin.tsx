import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, House } from 'lucide-react'

export interface Jejak { label: string; href?: string }

/** Isi kartu putih halaman admin: jejak 🏠 › … di atas, konten di bawahnya */
export default function HalamanAdmin({ jejak, children }: { jejak: Jejak[]; children: ReactNode }) {
  return (
    <>
      <nav className="admin-jejak" aria-label="Jejak halaman">
        <Link href="/admin" className="admin-jejak-rumah" aria-label="Beranda admin">
          <House size={14} fill="currentColor" strokeWidth={1.5} />
        </Link>
        {jejak.map((j, i) => (
          <Fragment key={`${j.label}-${i}`}>
            <ChevronRight size={12} color="#999999" aria-hidden />
            {j.href && i < jejak.length - 1
              ? <Link href={j.href}>{j.label}</Link>
              : <span aria-current={i === jejak.length - 1 ? 'page' : undefined}>{j.label}</span>}
          </Fragment>
        ))}
      </nav>
      <div className="admin-isi">{children}</div>
    </>
  )
}
