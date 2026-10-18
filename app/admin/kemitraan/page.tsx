import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { School } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import HalamanAdmin from '../HalamanAdmin'
import KepalaAdmin from '../KepalaAdmin'
import KonfirmasiKemitraan, { type PendaftaranSekolah } from './KonfirmasiKemitraan'

export const metadata: Metadata = {
  title: 'Kemitraan Sekolah',
}

type ProfilJoin     = { nama: string | null; email: string | null }
type PengaturanJoin = { jenjang_sekolah: string | null }
type PendaftaranRow = {
  id:         string
  nama:       string
  no_wa:      string | null
  created_at: string
  // Relasi balik: profiles selalu daftar; pengaturan bisa objek kalau sekolah_id-nya unik
  profiles:   ProfilJoin[] | ProfilJoin | null
  pengaturan: PengaturanJoin[] | PengaturanJoin | null
}

const pertama = <T,>(v: T[] | T | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

const formatTerdaftar = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB'

export default async function KemitraanSekolahPage() {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/')
  }

  const { data } = await createServiceClient()
    .from('sekolah')
    .select('id, nama, no_wa, created_at, profiles(nama, email), pengaturan(jenjang_sekolah)')
    .eq('status_kemitraan', 'menunggu')
    .order('created_at', { ascending: true })
    .limit(200)

  const daftar: PendaftaranSekolah[] = ((data ?? []) as unknown as PendaftaranRow[]).map(s => {
    const profil = pertama(s.profiles)
    return {
      id:            s.id,
      namaSekolah:   s.nama,
      jenjang:       pertama(s.pengaturan)?.jenjang_sekolah ?? null,
      noWa:          s.no_wa?.replace(/\D/g, '') || null,
      namaBendahara: profil?.nama ?? null,
      email:         profil?.email ?? null,
      terdaftar:     formatTerdaftar(s.created_at),
    }
  })

  return (
    <HalamanAdmin jejak={[{ label: 'Kemitraan Sekolah' }]}>
      <KepalaAdmin Ikon={School} judul="Kemitraan Sekolah" subjudul="Konfirmasi sekolah yang baru mendaftar di SiKu" />
      <KonfirmasiKemitraan daftar={daftar} />
    </HalamanAdmin>
  )
}
