import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { School, ShieldCheck, UserRound } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import HalamanAdmin from './HalamanAdmin'
import KartuRingkas from './KartuRingkas'
import SambutanAdmin from './SambutanAdmin'
import { muatSekolahAdmin } from './dataSekolah'
import { formatHariIniWIB } from './format'

// Halaman pertama sesudah admin login
export default async function AdminBerandaPage() {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/')
  }

  const db = createServiceClient()
  const [{ data: sekolah }, { count: bukti }] = await Promise.all([
    muatSekolahAdmin(db, { denganLogin: false }),
    db.from('verifikasi_pembayaran').select('id', { count: 'exact', head: true }).eq('status', 'menunggu'),
  ])

  const mitra    = sekolah.filter(s => s.status === 'aktif' && !s.demo)
  const selesai  = mitra.filter(s => s.setup.selesai).length
  const menunggu = sekolah.filter(s => s.status === 'menunggu' && !s.demo).length

  return (
    <HalamanAdmin judul="Beranda" subjudul={formatHariIniWIB()}>
      <SambutanAdmin menunggu={menunggu} />

      <div className="admin-ringkas">
        <KartuRingkas
          Ikon={School} angka={mitra.length} label="Sekolah mitra"
          sub={`${selesai} selesai setup · ${mitra.length - selesai} tahap setup`}
          href="/admin/kemitraan" tombol="Lihat sekolah"
        />
        <KartuRingkas
          Ikon={UserRound} warna="kuning" angka={menunggu} label="Menunggu konfirmasi"
          sub="Sekolah baru mendaftar"
          href="/admin/kemitraan?menunggu=1" tombol="Tinjau"
        />
        <KartuRingkas
          Ikon={ShieldCheck} warna="hijau" angka={bukti ?? 0} label="Bukti transfer"
          sub="Menunggu verifikasi admin"
          href="/admin/verifikasi-pembayaran" tombol="Verifikasi"
        />
      </div>
    </HalamanAdmin>
  )
}
