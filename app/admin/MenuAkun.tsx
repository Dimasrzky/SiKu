'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

/** Akun admin di dasar sidebar: inisial, nama, dan tombol Keluar */
export default function MenuAkun() {
  const router = useRouter()
  const [keluar, setKeluar] = useState(false)

  const handleLogout = async () => {
    setKeluar(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.push('/')
    }
  }

  return (
    <div className="admin-akun">
      <span className="admin-akun-avatar" aria-hidden>AS</span>
      <div className="admin-akun-teks">
        <strong>AdminSiKu</strong>
      </div>
      <button
        type="button"
        className="admin-akun-keluar"
        onClick={handleLogout}
        disabled={keluar}
        aria-label={keluar ? 'Keluar...' : 'Keluar'}
        title="Keluar"
      >
        <LogOut size={17} />
      </button>
    </div>
  )
}
