'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SkeletonDaftarSiswa } from '@/components/skeleton/SkeletonSiswa'

export default function SiswaIndexPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/siswa/daftar-siswa')
  }, [router])

  // Kerangka halaman tujuan, supaya pengalihan tidak menampilkan layar kosong
  return <SkeletonDaftarSiswa />
}
