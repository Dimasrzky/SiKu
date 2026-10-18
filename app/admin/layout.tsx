import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import SidebarAdmin from './SidebarAdmin'
import MenuAkun from './MenuAkun'
import './admin.css'

export const metadata: Metadata = {
  title: {
    default:  'Dasbor Admin',
    template: '%s | SiKu',
  },
}

/**
 * Kerangka semua halaman SiKuAdmin: header (logo + menu akun), sidebar berisi Kemitraan
 * Sekolah, Verifikasi Pembayaran, dan Fitur Sekolah, lalu satu kartu putih yang diisi
 * halaman lewat HalamanAdmin. Layout dan halaman dirender bersamaan, jadi setiap
 * page.tsx tetap memeriksa sesi admin sendiri sebelum memuat data.
 *
 * Badge jumlah menunggu dihitung di sini. Layout tidak dirender ulang saat berpindah
 * menu, tapi ikut diperbarui oleh router.refresh() sesudah konfirmasi/verifikasi.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/')
  }

  const db = createServiceClient()
  const [{ count: kemitraan }, { count: bukti }] = await Promise.all([
    db.from('sekolah').select('id', { count: 'exact', head: true }).eq('status_kemitraan', 'menunggu'),
    db.from('verifikasi_pembayaran').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
  ])

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link href="/admin" className="admin-logo" aria-label="SiKuAdmin — beranda">
          <Image src="/image/LogoSiKu.png" alt="SiKu" width={95} height={40} className="admin-logo-gambar" priority />
          <span className="admin-logo-teks">ADMIN</span>
        </Link>
        <MenuAkun />
      </header>
      <div className="admin-badan">
        <SidebarAdmin menunggu={{ kemitraan: kemitraan ?? 0, bukti: bukti ?? 0 }} />
        <main className="admin-kartu">{children}</main>
      </div>
    </div>
  )
}
