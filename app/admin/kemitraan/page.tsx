import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { CircleAlert } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import HalamanAdmin from '../HalamanAdmin'
import { muatSekolahAdmin } from '../dataSekolah'
import DaftarSekolah from './DaftarSekolah'
import TombolMenunggu from './TombolMenunggu'
import type { StatusPengirim } from './pengirim'

export const metadata: Metadata = {
  title: 'Kemitraan Sekolah',
}

type PengirimRow = { phone: string; provider: StatusPengirim['provider']; status: StatusPengirim['status']; pause_reason: string | null }

export default async function KemitraanSekolahPage({ searchParams }: { searchParams: Promise<{ menunggu?: string }> }) {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/')
  }

  const db = createServiceClient()
  const [{ data: sekolah, error, loginGagal }, { data: pengirimData }, { menunggu: bukaMenunggu }] = await Promise.all([
    muatSekolahAdmin(db),
    // Nomor pengirim bersama semua sekolah (lib/pengingat/pembatas.ts → pilihSender)
    db.from('wa_sender')
      .select('phone, provider, status, pause_reason')
      .is('sekolah_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    searchParams,
  ])

  const p = pengirimData as PengirimRow | null
  const pengirim: StatusPengirim | null = p
    ? {
        phone: p.phone.replace(/\D/g, ''), provider: p.provider, status: p.status, pauseReason: p.pause_reason,
        tokenAda: !!process.env.FONNTE_TOKEN?.trim(),
      }
    : null

  // Akun demo selalu di kartunya sendiri, apa pun status kemitraannya
  const menunggu = sekolah.filter(s => s.status === 'menunggu' && !s.demo)
  const mitra    = sekolah.filter(s => s.status === 'aktif' && !s.demo)
  const demo     = sekolah.filter(s => s.demo)

  return (
    <HalamanAdmin
      judul="Kemitraan Sekolah"
      subjudul="Sekolah mitra SiKu"
      aksi={<TombolMenunggu daftar={menunggu} bukaAwal={bukaMenunggu === '1'} />}
    >
      {error ? (
        <div className="admin-info admin-info--merah">
          <CircleAlert size={16} />
          <span>{error} Muat ulang halaman untuk mencoba lagi.</span>
        </div>
      ) : (
        <DaftarSekolah mitra={mitra} demo={demo} pengirim={pengirim} loginGagal={loginGagal} />
      )}
    </HalamanAdmin>
  )
}
