'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, User } from 'lucide-react'

/** Avatar di header kanan; dropdown-nya berisi nama akun dan Keluar */
export default function MenuAkun() {
  const router = useRouter()
  const [buka, setBuka] = useState(false)
  const [keluar, setKeluar] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!buka) return
    const tutup = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setBuka(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false) }
    document.addEventListener('mousedown', tutup)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', tutup)
      document.removeEventListener('keydown', esc)
    }
  }, [buka])

  const handleLogout = async () => {
    setKeluar(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.push('/')
    }
  }

  return (
    <div className="admin-akun" ref={ref}>
      <button className="admin-akun-tombol" onClick={() => setBuka(b => !b)} aria-haspopup="menu" aria-expanded={buka} aria-label="Menu akun">
        <span className="admin-akun-avatar"><User size={26} fill="#111111" strokeWidth={1} /></span>
        <ChevronDown size={12} strokeWidth={3} />
      </button>
      {buka && (
        <div className="admin-akun-menu" role="menu">
          <div className="admin-akun-nama">
            Admin Equanusa
            <small>SiKuAdmin</small>
          </div>
          <button className="admin-akun-keluar" role="menuitem" onClick={handleLogout} disabled={keluar}>
            <LogOut size={15} /> {keluar ? 'Keluar...' : 'Keluar'}
          </button>
        </div>
      )}
    </div>
  )
}
