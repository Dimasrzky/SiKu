import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DM_Sans } from 'next/font/google'
import { createSessionClient } from '@/lib/supabase-server'
import { bacaStatus } from '@/lib/kemitraan'
import HalamanKemitraan from './HalamanKemitraan'
import { inisialNama, labelSelesai, tautanWaEquanusa } from './format'
import './kemitraan.css'

export const metadata: Metadata = {
  title: 'Konfirmasi Kemitraan',
  robots: { index: false, follow: false },
}

// DM Sans bersumbu optical size, sama dengan halaman Login & Daftar (app/(auth)/layout.tsx):
// mockup Figma memakai opsz 40
const dmSansOpsz = DM_Sans({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-kemitraan',
  display: 'swap',
})

type Profil = {
  email:      string | null
  nama:       string
  jabatan:    string | null
  sekolah:    string | null
  sekolah_id: string | null
  avatar:     string | null
  role:       string | null
}

type Sekolah = { nama: string; status_kemitraan: string; created_at: string }

/**
 * Halaman bendahara selama kemitraan sekolahnya menunggu konfirmasi tim Equanusa, lalu
 * sekali sesudah dikonfirmasi ("Akun Anda Telah Diaktifkan"). Dirender di server dengan
 * sesi bendahara, jadi keadaannya sudah benar sejak HTML pertama.
 */
export default async function KemitraanPage() {
  const supabase = await createSessionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profilData } = await supabase
    .from('profiles')
    .select('email, nama, jabatan, sekolah, sekolah_id, avatar, role')
    .eq('id', user.id)
    .maybeSingle()
  const profil = profilData as Profil | null
  // Pendaftaran berhenti di langkah 1: lanjutkan isi profil sekolah
  if (!profil?.sekolah_id) redirect('/daftar')

  const { data: sekolahData } = await supabase
    .from('sekolah')
    .select('nama, status_kemitraan, created_at')
    .eq('id', profil.sekolah_id)
    .maybeSingle()
  const sekolah = sekolahData as Sekolah | null

  if (!sekolah) {
    // Jangan dialihkan ke mana pun: layout dashboard bisa mengembalikan ke sini
    return (
      <div className={`km km--galat ${dmSansOpsz.variable}`}>
        <p className="km-galat">
          Status kemitraan sekolah belum bisa dimuat. <Link href="/kemitraan">Muat ulang halaman</Link>
        </p>
      </div>
    )
  }

  return (
    <div className={dmSansOpsz.variable}>
      <HalamanKemitraan
        userId={user.id}
        sekolahId={profil.sekolah_id}
        namaSekolah={sekolah.nama}
        namaBendahara={profil.nama}
        inisial={inisialNama(profil.nama)}
        statusAwal={bacaStatus(sekolah.status_kemitraan)}
        selesai={labelSelesai(sekolah.created_at, new Date())}
        tautanWa={tautanWaEquanusa(process.env.EQUANUSA_WA, profil.nama, sekolah.nama)}
        sesiLokal={{
          email:   profil.email ?? user.email ?? '',
          nama:    profil.nama,
          jabatan: profil.jabatan ?? 'Admin',
          sekolah: profil.sekolah ?? sekolah.nama,
          avatar:  profil.avatar ?? '',
          role:    profil.role ?? 'admin',
        }}
      />
    </div>
  )
}
