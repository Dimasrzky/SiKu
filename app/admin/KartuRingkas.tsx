import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'

/** Kartu angka di Beranda admin: label, keterangan, ikon, angka besar, dan tombol pintas */
export default function KartuRingkas({ Ikon, warna, angka, label, sub, href, tombol }: {
  Ikon:   LucideIcon
  warna?: 'kuning' | 'hijau'
  angka:  number
  label:  string
  sub:    string
  href:   string
  tombol: string
}) {
  return (
    <div className="admin-ringkas-kartu">
      <div className="admin-ringkas-atas">
        <div>
          <div className="admin-ringkas-label">{label}</div>
          <div className="admin-ringkas-sub">{sub}</div>
        </div>
        <span className={`admin-panel-ikon${warna ? ` admin-panel-ikon--${warna}` : ''}`}><Ikon size={20} /></span>
      </div>
      <div className="admin-ringkas-angka">{angka.toLocaleString('id-ID')}</div>
      <Link href={href} className="admin-tombol admin-tombol--garis admin-tombol--kecil">
        {tombol} <ArrowRight size={14} />
      </Link>
    </div>
  )
}
