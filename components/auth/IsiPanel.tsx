'use client'

import { useEffect, useState, type ReactNode } from 'react'

// Sudah adakah isi panel yang tampil di sesi ini? Saat halaman pertama dibuka,
// seluruh panel sedang bergeser masuk (auth.css), jadi isinya tidak ikut bergeser.
// Setelah itu setiap isi baru (pindah Login ↔ Daftar, pindah langkah) bergeser masuk.
let panelSudahTampil = false

interface IsiPanelProps {
  children: ReactNode
  /** maju = masuk dari kanan, mundur = masuk dari kiri (tombol Kembali) */
  arah?: 'maju' | 'mundur'
  className?: string
}

export const IsiPanel = ({ children, arah = 'maju', className }: IsiPanelProps) => {
  // Dibaca sekali saat dipasang: render server dan hidrasi pertama sama-sama false
  const [bergeser] = useState(() => panelSudahTampil)

  useEffect(() => {
    panelSudahTampil = true
  }, [])

  const kelas = [bergeser ? `auth-isi--${arah}` : '', className ?? ''].filter(Boolean).join(' ')
  return <div className={kelas || undefined}>{children}</div>
}
