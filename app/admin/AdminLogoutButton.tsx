'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function AdminLogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <button
      onClick={handleLogout}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 1rem', background: '#fff', border: '1.5px solid #df6c6c', borderRadius: 10, color: '#e14c4c', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer' }}
    >
      <LogOut size={15} /> Keluar
    </button>
  )
}
