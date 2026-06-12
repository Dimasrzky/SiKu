'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SiswaIndexPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/siswa/daftar-siswa')
  }, [router])

  return null
}
