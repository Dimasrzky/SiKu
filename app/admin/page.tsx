import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import HalamanAdmin from './HalamanAdmin'
import SambutanAdmin from './SambutanAdmin'

// Halaman pertama sesudah admin login
export default async function AdminBerandaPage() {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/')
  }

  return (
    <HalamanAdmin jejak={[{ label: 'Beranda' }]}>
      <SambutanAdmin />
    </HalamanAdmin>
  )
}
