'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { BlokTeks } from './skeleton/Blok'

interface SetupSteps {
  profil_sekolah:     boolean
  tahun_ajaran:       boolean
  komponen_tagihan:   boolean
  buat_kelas:         boolean
  import_siswa:       boolean
}

const STEPS = [
  { key: 'profil_sekolah',   label: 'Profil sekolah',           href: null },
  { key: 'tahun_ajaran',     label: 'Mengatur tahun ajaran',     href: '/tagihan/tahun-ajaran' },
  { key: 'komponen_tagihan', label: 'Buat komponen tagihan',     href: '/tagihan/komponen' },
  { key: 'buat_kelas',       label: 'Buat kelas',               href: '/siswa/manajemen-kelas' },
  { key: 'import_siswa',     label: 'Import siswa',             href: '/siswa' },
] as const

const CACHE_KEY = 'siku_setup_steps'
const DONE_FLAG = 'siku_setup_done'

/* ─── Popup sukses ──────────────────────────────────────────────── */

const POPUP_CSS = `
@keyframes sc-backdrop { from { opacity:0 } to { opacity:1 } }
@keyframes sc-card {
  0%   { opacity:0; transform:scale(0.72) translateY(52px) }
  65%  { opacity:1; transform:scale(1.04) translateY(-5px) }
  100% { opacity:1; transform:scale(1)    translateY(0)    }
}
@keyframes sc-circle {
  from { stroke-dashoffset:283 }
  to   { stroke-dashoffset:0   }
}
@keyframes sc-check {
  from { stroke-dashoffset:70 }
  to   { stroke-dashoffset:0  }
}
@keyframes sc-text {
  from { opacity:0; transform:translateY(14px) }
  to   { opacity:1; transform:translateY(0)    }
}
@keyframes sc-progress {
  from { width:100% }
  to   { width:0%   }
}
@keyframes sc-p1 {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg)   }
  40%  { opacity:1; transform:translate(-32px,-44px) scale(1) rotate(20deg)  }
  100% { opacity:0; transform:translate(-50px,-76px) scale(0.4) rotate(42deg) }
}
@keyframes sc-p2 {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg)    }
  40%  { opacity:1; transform:translate(30px,-42px) scale(1) rotate(-18deg)  }
  100% { opacity:0; transform:translate(46px,-72px) scale(0.4) rotate(-36deg) }
}
@keyframes sc-p3 {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg)   }
  40%  { opacity:1; transform:translate(-52px,-8px) scale(1) rotate(30deg)   }
  100% { opacity:0; transform:translate(-80px,-14px) scale(0.4) rotate(62deg) }
}
@keyframes sc-p4 {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg) }
  40%  { opacity:1; transform:translate(50px,-6px) scale(1) rotate(-25deg) }
  100% { opacity:0; transform:translate(78px,-12px) scale(0.4) rotate(-52deg) }
}
@keyframes sc-p5 {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg)  }
  40%  { opacity:1; transform:translate(-22px,38px) scale(1) rotate(-22deg) }
  100% { opacity:0; transform:translate(-36px,62px) scale(0.4) rotate(-46deg) }
}
@keyframes sc-p6 {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg) }
  40%  { opacity:1; transform:translate(24px,36px) scale(1) rotate(28deg) }
  100% { opacity:0; transform:translate(40px,60px) scale(0.4) rotate(56deg) }
}
@keyframes sc-star {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg)   }
  40%  { opacity:1; transform:translate(14px,-58px) scale(1.1) rotate(35deg) }
  100% { opacity:0; transform:translate(22px,-96px) scale(0.3) rotate(70deg) }
}
@keyframes sc-star2 {
  0%   { opacity:0; transform:translate(0,0) scale(0) rotate(0deg)    }
  40%  { opacity:1; transform:translate(-12px,-56px) scale(1.1) rotate(-30deg) }
  100% { opacity:0; transform:translate(-20px,-94px) scale(0.3) rotate(-62deg) }
}
`

const PARTICLE_CONFIGS = [
  { anim: 'sc-p1',    delay: 0.40, size: 10, color: '#F7DD7D', radius: '50%' },
  { anim: 'sc-p2',    delay: 0.45, size: 8,  color: '#69C183', radius: '2px' },
  { anim: 'sc-p3',    delay: 0.42, size: 7,  color: '#4B9FE1', radius: '50%' },
  { anim: 'sc-p4',    delay: 0.47, size: 9,  color: '#F97316', radius: '2px' },
  { anim: 'sc-p5',    delay: 0.44, size: 8,  color: '#A78BFA', radius: '50%' },
  { anim: 'sc-p6',    delay: 0.48, size: 7,  color: '#F43F5E', radius: '3px' },
  { anim: 'sc-star',  delay: 0.38, size: 11, color: '#FCD34D', radius: '2px' },
  { anim: 'sc-star2', delay: 0.41, size: 10, color: '#6EE7B7', radius: '50%' },
]

function SuccessPopup({ onClose }: { onClose: () => void }) {
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => handleClose(), 6200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 280)
  }

  return (
    <>
      <style>{POPUP_CSS}</style>
      <style>{`
        @keyframes sc-close {
          from { opacity:1; transform:scale(1)    translateY(0)    }
          to   { opacity:0; transform:scale(0.88) translateY(24px) }
        }
        @keyframes sc-bd-close {
          from { opacity:1 }
          to   { opacity:0 }
        }
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(8, 16, 34, 0.72)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: closing
            ? 'sc-bd-close 0.28s ease forwards'
            : 'sc-backdrop 0.32s ease forwards',
        }}
        onClick={handleClose}
      >
        {/* Card */}
        <div
          style={{
            background: '#fff',
            borderRadius: 28,
            padding: '3rem 3.5rem 2.75rem',
            textAlign: 'center',
            maxWidth: 440,
            width: '90%',
            boxShadow: '0 40px 100px rgba(0,0,0,0.35)',
            position: 'relative',
            overflow: 'hidden',
            animation: closing
              ? 'sc-close 0.28s cubic-bezier(0.4,0,1,1) forwards'
              : 'sc-card 0.62s cubic-bezier(0.34,1.56,0.64,1) forwards',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Progress bar auto-dismiss */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#F1F5F9' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #69C183, #4B9FE1)',
              animation: 'sc-progress 6.2s linear forwards',
              borderRadius: '0 2px 2px 0',
            }} />
          </div>

          {/* Icon area with particles */}
          <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto 1.6rem' }}>

            {/* Sparkle particles */}
            {PARTICLE_CONFIGS.map((p, i) => (
              <div key={i} style={{
                position: 'absolute',
                top: '50%', left: '50%',
                marginTop: -(p.size / 2),
                marginLeft: -(p.size / 2),
                width: p.size, height: p.size,
                background: p.color,
                borderRadius: p.radius,
                opacity: 0,
                animation: `${p.anim} 1.1s ease-out ${p.delay}s forwards`,
                pointerEvents: 'none',
              }} />
            ))}

            {/* SVG circle + checkmark */}
            <svg viewBox="0 0 100 100" width={110} height={110} style={{ overflow: 'visible' }}>
              {/* Glow filter */}
              <defs>
                <filter id="sc-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {/* Track circle */}
              <circle cx="50" cy="50" r="45" fill="none" stroke="#E2E8F0" strokeWidth="5" />
              {/* Animated fill circle */}
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke="#69C183"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeDasharray="283"
                strokeDashoffset="283"
                transform="rotate(-90 50 50)"
                filter="url(#sc-glow)"
                style={{ animation: 'sc-circle 0.72s cubic-bezier(0.4,0,0.2,1) 0.18s forwards' }}
              />
              {/* Checkmark */}
              <polyline
                points="27,51 42,66 74,34"
                fill="none"
                stroke="#69C183"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="70"
                strokeDashoffset="70"
                filter="url(#sc-glow)"
                style={{ animation: 'sc-check 0.38s cubic-bezier(0.4,0,0.2,1) 0.72s forwards' }}
              />
            </svg>
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#0F172A',
            margin: '0 0 0.55rem',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            animation: 'sc-text 0.48s ease 0.92s backwards',
          }}>
            Setup Selesai!
          </h2>

          {/* Subtitle */}
          <p style={{
            fontSize: '1.05rem',
            color: '#64748B',
            lineHeight: 1.65,
            margin: '0 0 2rem',
            animation: 'sc-text 0.48s ease 1.05s backwards',
          }}>
            Semua langkah berhasil diselesaikan.<br />
            Sistem SiKu kini siap digunakan sepenuhnya.
          </p>

          {/* CTA button */}
          <div style={{ animation: 'sc-text 0.48s ease 1.18s backwards' }}>
            <button
              onClick={handleClose}
              style={{
                background: 'linear-gradient(135deg, #1A2C4E 0%, #2B4A7E 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 14,
                padding: '0.85rem 2.8rem',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                boxShadow: '0 8px 24px rgba(26,44,78,0.35)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 32px rgba(26,44,78,0.45)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = ''
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(26,44,78,0.35)'
              }}
            >
              Mulai Gunakan SiKu
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

/* ─── Kerangka selama langkah setup dimuat ──────────────────────── */

/**
 * Bentuk checklist dengan label langkah asli; teks banner (bergantung langkah yang
 * sedang berjalan) dan status tiap langkah belum diketahui. Dipakai juga Dashboard
 * selama memuat, untuk sekolah yang setupnya belum selesai.
 */
export function SkeletonSetupChecklist() {
  return (
    <div aria-busy="true" style={{ marginBottom: '1.5rem' }}>
      <span role="status" className="skeleton-sr">Memuat checklist setup…</span>

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        background: '#1A2C4E', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '2rem',
        boxShadow: '3px 6px 14px rgba(26, 44, 78, 0.58)',
      }}>
        <div style={{ flex: 1 }}>
          <BlokTeks gelap lebar="94%" ukuran="1.2rem" tinggiBaris={1.65} />
          <BlokTeks gelap lebar="62%" ukuran="1.2rem" tinggiBaris={1.65} />
        </div>
        <div style={{
          flexShrink: 0, position: 'relative', top: '-0.4rem', right: '-0.65rem',
          width: 40, height: 40, background: '#F7DD7D', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Image src="/icons/IconTSeru.png" width={3.5} height={3.5} alt="" style={{ display: 'block' }} />
        </div>
      </div>

      <div style={{
        background: '#fff', border: '1px solid var(--border)', borderLeft: '30px solid var(--navy)',
        borderRadius: 12, padding: '1.25rem 1.5rem', boxShadow: '0 0 12px rgba(31, 85, 167, 0.58)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <span style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '1.8rem', display: 'block', fontFamily: 'var(--font-dm-sans), sans-serif', marginTop: '-0.5rem' }}>
              Sambutan &amp; cheklist setup
            </span>
            <p style={{ fontSize: '0.98rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0.2rem 0 0' }}>
              Selesaikan {STEPS.length} langkah setup berikut terlebih dahulu.
            </p>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1B2B45', color: '#fff',
            padding: '0.3rem 0.85rem', borderRadius: 20, fontSize: '0.9rem', fontWeight: 400,
            whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '1rem',
          }}>
            <span className="dot-pulse" style={{ position: 'relative', right: 6, width: 18, height: 18, borderRadius: '50%', background: '#D35E5E', flexShrink: 0 }} />
            Sistem belum aktif
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {STEPS.map(step => (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem' }}>
              <Circle size={17} color="#CBD5E1" />
              <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Komponen utama ────────────────────────────────────────────── */

export function SetupChecklist() {
  const router = useRouter()

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
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchAndSync() {
      // Ambil pengaturan + sekolah_id dulu agar query siswa/tagihan difilter per sekolah
      const { data: pengaturan } = await supabase
        .from('pengaturan')
        .select('setup_steps, sekolah_id')
        .maybeSingle()

      if (cancelled) return
      if (!pengaturan?.setup_steps) { setLoading(false); return }

      const sekolahId = (pengaturan as { setup_steps: SetupSteps; sekolah_id: string }).sekolah_id

      // Filter eksplisit per sekolah_id — hindari baca data sekolah lain jika RLS belum sempurna
      const [{ count: tagihanCount }, { count: siswaCount }] = await Promise.all([
        supabase.from('tagihan').select('id', { count: 'exact', head: true }).eq('sekolah_id', sekolahId),
        supabase.from('siswa').select('id', { count: 'exact', head: true }).eq('sekolah_id', sekolahId),
      ])

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
        const allDone = STEPS.every(step => updated[step.key])

        // Tampilkan popup sekali saat pertama kali semua step selesai
        if (allDone) {
          try {
            if (!localStorage.getItem(DONE_FLAG)) {
              localStorage.setItem(DONE_FLAG, new Date().toISOString())
              setShowSuccess(true)
            }
          } catch { /* ignore */ }
        } else {
          // Hapus flag jika ada step yang belum selesai (edge case reset)
          try { localStorage.removeItem(DONE_FLAG) } catch { /* ignore */ }
        }

        setSteps(updated)
        setLoading(false)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
      }
    }

    fetchAndSync()
    return () => { cancelled = true }
  }, [])

  if (loading) return <SkeletonSetupChecklist />
  if (!steps) return null

  const allComplete = STEPS.every(s => steps[s.key])

  // Render popup saat baru selesai; sembunyikan checklist jika sudah selesai
  if (allComplete) {
    return showSuccess ? <SuccessPopup onClose={() => setShowSuccess(false)} /> : null
  }

  const currentIndex = STEPS.findIndex(s => !steps[s.key])

  const INFO_TEXT: Record<string, string> = {
    profil_sekolah:   'Mulai dengan melengkapi profil sekolah — nama, jenjang, dan logo. Data ini akan tampil di seluruh laporan dan tagihan yang dikirim ke orang tua.',
    tahun_ajaran:     'Tahun ajaran adalah fondasi dari semua tagihan di SiKu. Isi periode di bawah, lalu sistem akan otomatis membagi semester Ganjil dan Genap.',
    komponen_tagihan: 'Tentukan komponen biaya yang berlaku di sekolah — seperti SPP, uang gedung, atau seragam. Komponen ini akan dipakai sebagai dasar pembuatan tagihan siswa.',
    buat_kelas:       'Buat struktur kelas sesuai jenjang sekolah. Setiap kelas akan terhubung ke siswa dan tagihan, jadi pastikan nama dan jenjang sudah benar sebelum import siswa.',
    import_siswa:     'Langkah terakhir — import data siswa dari file Excel atau tambahkan satu per satu.',
  }
  const currentStepKey  = STEPS[currentIndex]?.key ?? ''
  const infoBannerText  = INFO_TEXT[currentStepKey] ?? ''
  const infoBannerText2 = currentStepKey === 'import_siswa'
    ? 'Setelah siswa masuk, tagihan bisa langsung dibuat secara otomatis.'
    : ''

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
          {infoBannerText}
          {infoBannerText2 && <><br />{infoBannerText2}</>}
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
            <span className="dot-pulse" style={{
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
