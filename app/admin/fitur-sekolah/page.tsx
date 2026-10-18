import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ArrowLeft, Puzzle } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { fiturSah, type KodeFitur } from '@/lib/fiturSekolah'
import AdminLogoutButton from '../AdminLogoutButton'
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
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{ width: 48, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Puzzle size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1A2C4E', margin: 0 }}>Fitur Sekolah</h1>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.15rem 0 0' }}>
                Tambahkan subfitur ke sekolah yang mengajukan
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/admin/verifikasi-pembayaran"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.9rem', background: '#fff', color: '#1A2C4E', border: '1.5px solid #E2E8F0', borderRadius: 10, fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}
            >
              <ArrowLeft size={14} /> Verifikasi Pembayaran
            </Link>
            <AdminLogoutButton />
          </div>
        </div>

        {fiturErr ? (
          <div style={{ background: '#FEE2E2', color: '#B91C1C', borderRadius: 14, padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
            Data subfitur gagal dimuat. Pastikan tabel fitur_sekolah sudah dibuat di database.
          </div>
        ) : (
          <PanelFiturSekolah daftar={daftar} />
        )}
      </div>
    </div>
  )
}
