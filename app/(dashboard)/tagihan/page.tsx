'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SkeletonTagihanAktif } from '@/components/skeleton/SkeletonTagihan'

export default function TagihanIndexPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/tagihan/aktif')
  }, [router])

  // Kerangka halaman tujuan, supaya pengalihan tidak menampilkan layar kosong
  return <SkeletonTagihanAktif />
}
