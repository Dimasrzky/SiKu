'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TagihanIndexPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/tagihan/aktif')
  }, [router])

  return null
}
