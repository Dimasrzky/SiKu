'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function TagihanAktifPage() {
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('pengaturan')
        .select('setup_steps')
        .maybeSingle()

      const steps = (data?.setup_steps ?? {}) as Record<string, boolean>
      if (!steps['tahun_ajaran']) {
        router.replace('/dashboard/tagihan/tahun-ajaran')
      }
    })()
  }, [router])

  return (
    <div className="dashboard-content">
      <div style={{
        background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
        padding: '4rem 2rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🚧</div>
        <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.4rem', fontSize: '1.1rem' }}>
          Tagihan Aktif
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Selesaikan semua langkah setup terlebih dahulu untuk mengakses Tagihan Aktif.
        </div>
      </div>
    </div>
  )
}
