'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

interface SetupSteps {
  profil_sekolah:     boolean
  tahun_ajaran:       boolean
  komponen_tagihan:   boolean
  buat_kelas:         boolean
  import_siswa:       boolean
}

const STEPS = [
  {
    key:   'profil_sekolah',
    label: 'Profil sekolah',
    href:  null,
  },
  {
    key:   'tahun_ajaran',
    label: 'Mengatur tahun ajaran (Sub fitur tagihan)',
    href:  '/dashboard/tagihan/tahun-ajaran',
  },
  {
    key:   'komponen_tagihan',
    label: 'Buat komponen tagihan',
    href:  '/dashboard/tagihan',
  },
  {
    key:   'buat_kelas',
    label: 'Buat kelas (Manajemen siswa sub fitur siswa)',
    href:  '/dashboard/kelas',
  },
  {
    key:   'import_siswa',
    label: 'Import siswa',
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
    .filter(k => ['profil_sekolah','tahun_ajaran','komponen_tagihan','buat_kelas','import_siswa'].includes(k))
    .every(k => steps[k])

  if (allComplete) return null

  const currentIndex = STEPS.findIndex(s => !steps[s.key])

  return (
    <div style={{ marginBottom: '1.5rem' }}>

      {/* ── Info Banner ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        background: '#1A2C4E',
        borderRadius: 12,
        padding: '1rem 1.25rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: '3px 6px 14px rgba(26, 44, 78, 0.58)',
      }}>
        <p style={{ flex: 1, fontSize: '1.2rem', lineHeight: 1.65, margin: 0 }}>
          Tahun ajaran adalah fondasi dari semua tagihan di SiKu. Isi periode di bawah lalu sistem akan <br />otomatis membagi semester Ganjil dan Genap.
        </p>
        <div style={{
          flexShrink: 0,
          position: 'relative',
          top: '-0.4rem',
          right: '-0.65rem',
          width: 40,
          height: 40,
          background: '#F7DD7D',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Image
            src="/icons/IconTSeru.png"
            width={3.5}
            height={3.5}
            alt="Informasi"
            style={{ display: 'block' }}
          />
        </div>
      </div>

      {/* ── Card Setup Checklist ─────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderLeft: '30px solid var(--navy)',
        borderRadius: 12,
        padding: '1.25rem 1.5rem',
        boxShadow: '0 0 12px rgba(31, 85, 167, 0.58)',
      }}>

        {/* Header card */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <span style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '1.8rem', display: 'block', fontFamily: 'var(--font-dm-sans), sans-serif', marginTop: '-0.5rem' }}>
              Sambutan &amp; cheklist setup
            </span>
            <p style={{ fontSize: '0.98rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0.2rem 0 0' }}>
              Selesaikan {STEPS.length} langkah setup berikut terlebih dahulu.
            </p>
          </div>

          {/* Badge Sistem belum aktif */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#1B2B45',
            color: '#fff',
            padding: '0.3rem 0.85rem',
            borderRadius: 20,
            fontSize: '0.9rem',
            fontWeight: 400,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            marginLeft: '1rem',
          }}>
            <span style={{
              position: 'relative',
              right: 6,
              width: 18, height: 18,
              borderRadius: '50%',
              background: '#D35E5E',
              flexShrink: 0,
            }} />
            Sistem belum aktif
          </div>
        </div>

        {/* Step list */}
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
                  borderRadius: 15,
                  background: current ? '#E6E8EC' : 'transparent',
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
                    fontSize: '1.2rem',
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
                      position: 'relative',
                      right: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--navy)', fontWeight: 700, fontSize: '1rem',
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '0.25rem 0.5rem',
                      borderRadius: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Mulai<Image src="/icons/IconArrowKanan.png" width={12} height={12} alt="" style={{ display: 'block' }} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
