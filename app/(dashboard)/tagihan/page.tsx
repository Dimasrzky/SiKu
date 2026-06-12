'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TagihanIndexPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/tagihan/aktif')
  }, [router])

  return null
}
