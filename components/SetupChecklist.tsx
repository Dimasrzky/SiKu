'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SetupSteps {
  profil_sekolah:       boolean
  kelas_tahun_ajaran:   boolean
  komponen_tagihan:     boolean
  import_siswa:         boolean
}

const STEPS = [
  {
    key:   'profil_sekolah',
    label: 'Profil sekolah',
    href:  null,
  },
  {
    key:   'kelas_tahun_ajaran',
    label: 'Buat kelas & tahun ajaran',
    href:  '/dashboard/kelas',
  },
  {
    key:   'komponen_tagihan',
    label: 'Buat komponen tagihan',
    href:  '/dashboard/tagihan',
  },
  {
    key:   'import_siswa',
    label: 'Import data siswa',
    href:  '/dashboard/siswa',
  },
] as const

type StepKey = typeof STEPS[number]['key']

const CACHE_KEY = 'siku_setup_steps'

export function SetupChecklist() {
  const router = useRouter()

  // Baca cache saat inisialisasi — sebelum render pertama, tidak ada setState di effect
  const [steps, setSteps] = useState<SetupSteps | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      return cached ? (JSON.parse(cached) as SetupSteps) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true
    try { return !localStorage.getItem(CACHE_KEY) } catch { return true }
  })

  useEffect(() => {
    let cancelled = false

    async function fetchAndSync() {
      // Semua query jalan paralel sekaligus
      const [{ data: pengaturan }, { count: tagihanCount }, { count: siswaCount }] =
        await Promise.all([
          supabase.from('pengaturan').select('setup_steps').maybeSingle(),
          supabase.from('tagihan').select('id', { count: 'exact', head: true }),
          supabase.from('siswa').select('id', { count: 'exact', head: true }),
        ])

      if (cancelled) return
      if (!pengaturan?.setup_steps) { setLoading(false); return }

      const s = pengaturan.setup_steps as SetupSteps
      let needsUpdate = false
      const updated = { ...s }

      if (!s.komponen_tagihan && (tagihanCount ?? 0) > 0) {
        updated.komponen_tagihan = true; needsUpdate = true
      }
      if (!s.import_siswa && (siswaCount ?? 0) > 0) {
        updated.import_siswa = true; needsUpdate = true
      }

      if (needsUpdate && !cancelled) {
        const { data: { session } } = await supabase.auth.getSession()
        const stepsToSync: Array<'komponen_tagihan' | 'import_siswa'> = []
        if (updated.komponen_tagihan && !s.komponen_tagihan) stepsToSync.push('komponen_tagihan')
        if (updated.import_siswa    && !s.import_siswa)    stepsToSync.push('import_siswa')

        for (const step of stepsToSync) {
          await fetch('/api/setup-step', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify({ step }),
          })
        }
      }

      if (!cancelled) {
        setSteps(updated)
        setLoading(false)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
      }
    }

    fetchAndSync()
    return () => { cancelled = true }
  }, [])

  if (loading || !steps) return null

  const allComplete = (Object.keys(steps) as StepKey[])
    .filter(k => ['profil_sekolah','kelas_tahun_ajaran','komponen_tagihan','import_siswa'].includes(k))
    .every(k => steps[k])

  if (allComplete) return null

  const currentIndex = STEPS.findIndex(s => !steps[s.key])

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderLeft: '4px solid var(--navy)',
      borderRadius: 12,
      padding: '1.25rem 1.5rem',
      marginBottom: '1.5rem',
    }}>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.95rem' }}>
            Sambutan &amp; checklist setup
          </span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Sistem belum aktif — selesaikan {STEPS.length} langkah setup berikut.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {STEPS.map((step, index) => {
          const done    = steps[step.key]
          const current = index === currentIndex
          const locked  = !done && index > currentIndex

          return (
            <div
              key={step.key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.75rem',
                borderRadius: 8,
                background: current ? '#EFF6FF' : 'transparent',
                opacity: locked ? 0.45 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {done
                  ? <CheckCircle2 size={17} color="var(--emerald)" />
                  : <Circle size={17} color={current ? 'var(--navy)' : '#CBD5E1'} />
                }
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: current ? 600 : 400,
                  color: done ? '#94A3B8' : current ? 'var(--navy-dark)' : 'var(--text-muted)',
                  textDecoration: done ? 'line-through' : 'none',
                }}>
                  {step.label}
                </span>
              </div>

              {current && step.href && (
                <button
                  onClick={() => router.push(step.href!)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '0.25rem 0.5rem',
                    borderRadius: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Mulai →
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: '0.875rem',
        background: '#F8FAFC',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.6rem 0.75rem',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-start',
        lineHeight: 1.5,
      }}>
        <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          Checklist hilang otomatis setelah semua langkah selesai.
          Tidak bisa di-dismiss manual — karena sistem memang belum bisa jalan tanpa ini.
        </span>
      </div>
    </div>
  )
}
