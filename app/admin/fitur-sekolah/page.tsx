import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { CircleAlert } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { fiturSah, type KodeFitur } from '@/lib/fiturSekolah'
import HalamanAdmin from '../HalamanAdmin'
import PanelFiturSekolah, { type SekolahFitur } from './PanelFiturSekolah'

export const metadata: Metadata = {
  title: 'Fitur Sekolah',
}

type FiturRow = { sekolah_id: string; fitur: string }

export default async function FiturSekolahPage() {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/')
  }

  const supabase = createServiceClient()

  // Hanya sekolah yang kemitraannya sudah dikonfirmasi: yang masih menunggu belum bisa memakai aplikasi
  const [{ data: sekolahData }, { data: fiturData, error: fiturErr }] = await Promise.all([
    supabase.from('sekolah').select('id, nama').eq('status_kemitraan', 'aktif').order('nama').limit(2000),
    supabase.from('fitur_sekolah').select('sekolah_id, fitur').limit(10000),
  ])

  const fiturPer = new Map<string, KodeFitur[]>()
  for (const f of (fiturData ?? []) as FiturRow[]) {
    if (!fiturSah(f.fitur)) continue
    fiturPer.set(f.sekolah_id, [...(fiturPer.get(f.sekolah_id) ?? []), f.fitur])
  }

  const daftar: SekolahFitur[] = ((sekolahData ?? []) as { id: string; nama: string }[]).map(s => ({
    id:    s.id,
    nama:  s.nama,
    fitur: fiturPer.get(s.id) ?? [],
  }))

  return (
    <HalamanAdmin judul="Fitur Sekolah" subjudul="Tambahkan subfitur ke sekolah yang mengajukan">
      {fiturErr ? (
        <div className="admin-info admin-info--merah">
          <CircleAlert size={16} />
          <span>Data subfitur gagal dimuat. Pastikan tabel fitur_sekolah sudah dibuat di database.</span>
        </div>
      ) : (
        <PanelFiturSekolah daftar={daftar} />
      )}
    </HalamanAdmin>
  )
}
