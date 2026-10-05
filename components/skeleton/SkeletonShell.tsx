import Image from 'next/image'
import {
  BarChart2, Banknote, Calendar, ChevronDown, ChevronsUp, FileCheck, Gift, GraduationCap, Layers,
  LayoutDashboard, LogOut, Package, Receipt, Settings, SlidersHorizontal, Users, type LucideIcon,
} from 'lucide-react'
import { Blok } from './Blok'
import { SkeletonHalaman } from './SkeletonHalaman'

// Seluruh tampilan dashboard selama data login belum terbaca — termasuk HTML dari
// server, sebelum JavaScript selesai dimuat. Menu mengikuti sidebar di
// app/(dashboard)/layout.tsx (ubah bersamaan); nama sekolah dan avatar berupa blok.
// Status kunci menu belum diketahui, jadi semua menu tampil terbuka.

interface ItemMenu { label: string; href: string; Ikon: LucideIcon }

const SUB_TAGIHAN: ItemMenu[] = [
  { label: 'Tahun Ajaran',        href: '/tagihan/tahun-ajaran', Ikon: Calendar },
  { label: 'Tagihan Aktif',       href: '/tagihan/aktif',        Ikon: FileCheck },
  { label: 'Komponen Tagihan',    href: '/tagihan/komponen',     Ikon: Layers },
  { label: 'Paket per Kelas',     href: '/tagihan/paket-kelas',  Ikon: Package },
  { label: 'Beasiswa & Potongan', href: '/tagihan/beasiswa',     Ikon: Gift },
  { label: 'Komponen Individu',   href: '/tagihan/individu',     Ikon: SlidersHorizontal },
]

const SUB_SISWA: ItemMenu[] = [
  { label: 'Daftar Siswa',    href: '/siswa/daftar-siswa',    Ikon: Users },
  { label: 'Manajemen Kelas', href: '/siswa/manajemen-kelas', Ikon: GraduationCap },
  { label: 'Naik Kelas',      href: '/siswa/naik-kelas',      Ikon: ChevronsUp },
  { label: 'Alumni',          href: '/siswa/alumni',          Ikon: GraduationCap },
]

const Menu = ({ label, Ikon, aktif, buka }: { label: string; Ikon: LucideIcon; aktif: boolean; buka?: boolean }) => (
  <div className={`sidebar-item${aktif ? ' active' : ''}`}>
    <Ikon size={18} className="sidebar-icon" />
    <span>{label}</span>
    {buka !== undefined && <ChevronDown size={14} className={`sidebar-chevron${buka ? ' rotated' : ''}`} />}
  </div>
)

const SubMenu = ({ daftar, buka, pathname }: { daftar: ItemMenu[]; buka: boolean; pathname: string }) => (
  <div className={`sidebar-submenu${buka ? ' sidebar-submenu--open' : ''}`}>
    {daftar.map(({ label, href, Ikon }) => (
      <div key={href} className={`sidebar-sub-item${pathname.startsWith(href) ? ' active' : ''}`}>
        <Ikon size={13} /><span>{label}</span>
      </div>
    ))}
  </div>
)

export const SkeletonShell = ({ pathname }: { pathname: string }) => {
  const diTagihan = pathname.startsWith('/tagihan')
  const diSiswa   = pathname.startsWith('/siswa')
  return (
    <div className="dashboard-shell">
      {/* Belum bisa dipakai — menu asli muncul begitu data login terbaca */}
      <aside className="sidebar" aria-hidden style={{ pointerEvents: 'none' }}>
        <div className="sidebar-header">
          <Blok gelap lebar={42} tinggi={42} sudut={10} />
          <div className="sidebar-brand">
            <Image src="/image/LogoSiKuBaru.png" alt="" width={50} height={20} className="sidebar-brand-logo" priority />
            <Blok gelap lebar={120} tinggi={9} sudut={4} style={{ marginTop: 4 }} />
          </div>
        </div>

        <nav className="sidebar-nav">
          <Menu label="Dashboard" Ikon={LayoutDashboard} aktif={pathname === '/dashboard'} />
          <Menu label="Pembayaran" Ikon={Banknote} aktif={pathname === '/pembayaran'} />
          <Menu label="Tagihan" Ikon={Receipt} aktif={diTagihan} buka={diTagihan} />
          <SubMenu daftar={SUB_TAGIHAN} buka={diTagihan} pathname={pathname} />
          <Menu label="Siswa" Ikon={Users} aktif={diSiswa} buka={diSiswa} />
          <SubMenu daftar={SUB_SISWA} buka={diSiswa} pathname={pathname} />
          <Menu label="Laporan" Ikon={BarChart2} aktif={pathname.startsWith('/laporan')} />
        </nav>

        <div className="sidebar-bottom">
          <div className={`sidebar-bottom-item${pathname === '/pengaturan' ? ' active' : ''}`}>
            <Settings size={18} /><span>Pengaturan</span>
          </div>
          <div className="sidebar-bottom-item sidebar-bottom-logout">
            <LogOut size={18} /><span>Keluar</span>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <SkeletonHalaman pathname={pathname} />
      </main>
    </div>
  )
}
