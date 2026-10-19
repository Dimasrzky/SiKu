import Image from 'next/image'
import {
  BarChart2, Banknote, Calendar, ChevronDown, ChevronsUp, FileCheck, Gift, GraduationCap, Layers,
  LayoutDashboard, Lock, LogOut, Package, PieChart, Receipt, Settings, SlidersHorizontal, Users, Wallet, type LucideIcon,
} from 'lucide-react'
import { Blok } from './Blok'
import { SkeletonHalaman } from './SkeletonHalaman'

// Seluruh tampilan dashboard selama data login belum terbaca — termasuk HTML dari
// server, sebelum JavaScript selesai dimuat. Menu mengikuti sidebar di
// app/(dashboard)/layout.tsx (ubah bersamaan); nama sekolah dan avatar berupa blok.
// Gembok menu dipilih CSS dari <html data-setup> (lib/langkahSetup, dashboard.css):
// data-kunci = langkah setup yang membuka menu itu, sama dengan syarat di layout.

/** Langkah setup yang membuka menu — kunci di pengaturan.setup_steps */
type Langkah = 'tahun_ajaran' | 'komponen_tagihan' | 'buat_kelas' | 'import_siswa'

interface ItemMenu {
  label: string
  href: string
  Ikon: LucideIcon
  kunci?: Langkah
  /** Label selama terkunci, bila berbeda (mengikuti layout) */
  labelTerkunci?: string
}

const SUB_TAGIHAN: ItemMenu[] = [
  { label: 'Tahun Ajaran',        href: '/tagihan/tahun-ajaran', Ikon: Calendar },
  { label: 'Tagihan Aktif',       href: '/tagihan/aktif',        Ikon: FileCheck,         kunci: 'import_siswa' },
  { label: 'Komponen Tagihan',    href: '/tagihan/komponen',     Ikon: Layers,            kunci: 'tahun_ajaran' },
  { label: 'Paket per Kelas',     href: '/tagihan/paket-kelas',  Ikon: Package,           kunci: 'import_siswa' },
  { label: 'Beasiswa & Potongan', href: '/tagihan/beasiswa',     Ikon: Gift,              kunci: 'import_siswa', labelTerkunci: 'Beasiswa' },
  { label: 'Komponen Individu',   href: '/tagihan/individu',     Ikon: SlidersHorizontal, kunci: 'import_siswa' },
]

const SUB_SISWA: ItemMenu[] = [
  { label: 'Daftar Siswa',    href: '/siswa/daftar-siswa',    Ikon: Users,         kunci: 'buat_kelas' },
  { label: 'Manajemen Kelas', href: '/siswa/manajemen-kelas', Ikon: GraduationCap, kunci: 'komponen_tagihan' },
  { label: 'Naik Kelas',      href: '/siswa/naik-kelas',      Ikon: ChevronsUp,    kunci: 'import_siswa' },
  { label: 'Alumni',          href: '/siswa/alumni',          Ikon: GraduationCap, kunci: 'import_siswa' },
]

const Menu = ({ label, Ikon, aktif, buka, kunci }: {
  label: string; Ikon: LucideIcon; aktif: boolean; buka?: boolean; kunci?: Langkah
}) => (
  <div className={`sidebar-item${aktif ? ' active' : ''}`} data-kunci={kunci}>
    <Ikon size={18} className="sidebar-icon" />
    <span>{label}</span>
    {buka !== undefined && <ChevronDown size={14} className={`sidebar-chevron kerangka-saat-terbuka${buka ? ' rotated' : ''}`} />}
    {kunci && <Lock size={13} className="kerangka-saat-terkunci" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
  </div>
)

// Submenu Laporan hanya ada untuk sekolah dengan subfitur Pengeluaran (lib/fiturSekolah).
// Kerangka tidak tahu subfitur sekolah, kecuali di halaman Pengeluaran sendiri.
const SUB_LAPORAN: ItemMenu[] = [
  { label: 'Ringkasan',   href: '/laporan',             Ikon: PieChart },
  { label: 'Pengeluaran', href: '/laporan/pengeluaran', Ikon: Wallet },
]

const SubMenu = ({ daftar, buka, pathname }: { daftar: ItemMenu[]; buka: boolean; pathname: string }) => {
  // Awalan terpanjang yang cocok: /laporan/pengeluaran tidak ikut menyalakan /laporan
  const aktif = daftar.filter(d => pathname.startsWith(d.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href
  return (
    <div className={`sidebar-submenu${buka ? ' sidebar-submenu--open' : ''}`}>
      {daftar.map(({ label, href, Ikon, kunci, labelTerkunci }) => (
        <div key={href} className={`sidebar-sub-item${href === aktif ? ' active' : ''}`} data-kunci={kunci}>
          <Ikon size={13} />
          {labelTerkunci
            ? <><span className="kerangka-saat-terbuka">{label}</span><span className="kerangka-saat-terkunci">{labelTerkunci}</span></>
            : <span>{label}</span>}
          {kunci && <Lock size={11} className="kerangka-saat-terkunci" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  )
}

export const SkeletonShell = ({ pathname }: { pathname: string }) => {
  const diTagihan     = pathname.startsWith('/tagihan')
  const diSiswa       = pathname.startsWith('/siswa')
  const diPengeluaran = pathname.startsWith('/laporan/pengeluaran')
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
          <Menu label="Pembayaran" Ikon={Banknote} aktif={pathname === '/pembayaran'} kunci="import_siswa" />
          <Menu label="Tagihan" Ikon={Receipt} aktif={diTagihan} buka={diTagihan} />
          <SubMenu daftar={SUB_TAGIHAN} buka={diTagihan} pathname={pathname} />
          <Menu label="Siswa" Ikon={Users} aktif={diSiswa} buka={diSiswa} kunci="komponen_tagihan" />
          <SubMenu daftar={SUB_SISWA} buka={diSiswa} pathname={pathname} />
          <Menu label="Laporan" Ikon={BarChart2} aktif={pathname.startsWith('/laporan')} buka={diPengeluaran ? true : undefined} kunci="import_siswa" />
          {diPengeluaran && <SubMenu daftar={SUB_LAPORAN} buka pathname={pathname} />}
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
