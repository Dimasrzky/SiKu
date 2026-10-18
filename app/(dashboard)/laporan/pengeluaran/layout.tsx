import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createSessionClient } from '@/lib/supabase-server'
import { sekolahPunyaFitur } from '@/lib/fiturSekolah'

// Metadata halaman (page.tsx di folder ini client component) sekaligus penjaga subfitur:
// Pengeluaran hanya terbuka untuk sekolah yang sudah ditambahkan tim Equanusa lewat
// /admin/fitur-sekolah. Sekolah lain yang membuka URL-nya langsung dikembalikan ke Laporan.
export const metadata: Metadata = {
  title: 'Pengeluaran',
}

const PengeluaranLayout = async ({ children }: { children: React.ReactNode }) => {
  const db = await createSessionClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/')

  const { data: profil } = await db.from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
  const sekolahId = (profil as { sekolah_id: string | null } | null)?.sekolah_id
  if (!sekolahId) redirect('/laporan')

  const fitur = await sekolahPunyaFitur(db, sekolahId, 'pengeluaran')
  if (!fitur.data) redirect('/laporan')

  return children
}

export default PengeluaranLayout
