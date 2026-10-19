import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { School } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import HalamanAdmin from '../HalamanAdmin'
import KepalaAdmin from '../KepalaAdmin'
import KonfirmasiKemitraan, { type PendaftaranSekolah } from './KonfirmasiKemitraan'
import SaklarPengingat, { type SekolahTerkonfirmasi, type StatusPengirim } from './SaklarPengingat'

export const metadata: Metadata = {
  title: 'Kemitraan Sekolah',
}

type ProfilJoin     = { nama: string | null; email: string | null }
type PengaturanJoin = { jenjang_sekolah: string | null; pengingat_wa_aktif?: boolean | null }
type PendaftaranRow = {
  id:         string
  nama:       string
  no_wa:      string | null
  created_at: string
  // Relasi balik: profiles selalu daftar; pengaturan bisa objek kalau sekolah_id-nya unik
  profiles:   ProfilJoin[] | ProfilJoin | null
  pengaturan: PengaturanJoin[] | PengaturanJoin | null
}
type TerkonfirmasiRow = Omit<PendaftaranRow, 'no_wa' | 'created_at'> & { kemitraan_dikonfirmasi_at: string | null }
type PengirimRow = { phone: string; provider: StatusPengirim['provider']; status: StatusPengirim['status']; pause_reason: string | null }

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

  const db = createServiceClient()
  const [{ data }, { data: aktifData }, { data: pengirimData }] = await Promise.all([
    db.from('sekolah')
      .select('id, nama, no_wa, created_at, profiles(nama, email), pengaturan(jenjang_sekolah)')
      .eq('status_kemitraan', 'menunggu')
      .order('created_at', { ascending: true })
      .limit(200),
    // Sekolah terkonfirmasi + saklar pengingat WhatsApp otomatisnya
    db.from('sekolah')
      .select('id, nama, kemitraan_dikonfirmasi_at, profiles(nama, email), pengaturan(jenjang_sekolah, pengingat_wa_aktif)')
      .eq('status_kemitraan', 'aktif')
      .order('nama', { ascending: true })
      .limit(500),
    // Nomor pengirim bersama semua sekolah (lib/pengingat/pembatas.ts → pilihSender)
    db.from('wa_sender')
      .select('phone, provider, status, pause_reason')
      .is('sekolah_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const terkonfirmasi: SekolahTerkonfirmasi[] = ((aktifData ?? []) as unknown as TerkonfirmasiRow[]).map(s => {
    const profil     = pertama(s.profiles)
    const pengaturan = pertama(s.pengaturan)
    return {
      id:             s.id,
      namaSekolah:    s.nama,
      jenjang:        pengaturan?.jenjang_sekolah ?? null,
      namaBendahara:  profil?.nama ?? null,
      email:          profil?.email ?? null,
      dikonfirmasi:   s.kemitraan_dikonfirmasi_at ? formatTerdaftar(s.kemitraan_dikonfirmasi_at) : null,
      pengingatAktif: pengaturan ? pengaturan.pengingat_wa_aktif === true : null,
    }
  })

  const p = pengirimData as PengirimRow | null
  const pengirim: StatusPengirim | null = p
    ? {
        phone: p.phone.replace(/\D/g, ''), provider: p.provider, status: p.status, pauseReason: p.pause_reason,
        tokenAda: !!process.env.FONNTE_TOKEN?.trim(),
      }
    : null

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
      <KepalaAdmin Ikon={School} judul="Kemitraan Sekolah" subjudul="Konfirmasi sekolah baru dan atur notifikasi WhatsApp sekolah mitra" />
      <KonfirmasiKemitraan daftar={daftar} />
      <SaklarPengingat daftar={terkonfirmasi} pengirim={pengirim} />
    </HalamanAdmin>
  )
}
