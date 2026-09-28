'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, GraduationCap } from 'lucide-react'

export interface SiswaCari { id: string; nama: string; nis: string | null; kelas: string; isAlumni: boolean }

/**
 * Lompat langsung ke profil siswa dari halaman laporan (prinsip 5 draft: sekolah
 * kecil tidak perlu menelusuri jenjang dan kelas). Dicari di data yang sudah dimuat
 * halaman — siswa tanpa tagihan memang tidak punya apa pun untuk dilaporkan.
 */
export function CariSiswa({ siswa, qsFilter }: { siswa: SiswaCari[]; qsFilter: string }) {
  const router = useRouter()
  const [kata, setKata] = useState('')
  const [buka, setBuka] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!buka) return
    const tutup = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setBuka(false)
    }
    document.addEventListener('mousedown', tutup)
    return () => document.removeEventListener('mousedown', tutup)
  }, [buka])

  const hasil = useMemo(() => {
    const k = kata.trim().toLowerCase()
    if (k.length < 2) return []
    return siswa
      .filter(s => s.nama.toLowerCase().includes(k) || (s.nis ?? '').toLowerCase().includes(k))
      .slice(0, 8)
  }, [kata, siswa])

  const href = (id: string) => `/laporan/siswa/${id}${qsFilter}`

  return (
    <div ref={ref} style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
        <Search size={15} color="#94A3B8" />
        <input
          value={kata}
          onChange={e => { setKata(e.target.value); setBuka(true) }}
          onFocus={() => setBuka(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && hasil[0]) router.push(href(hasil[0].id))
            if (e.key === 'Escape') setBuka(false)
          }}
          placeholder="Cari siswa (nama atau NIS)"
          aria-label="Cari siswa"
          style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.82rem', width: '100%', color: '#0F172A', background: 'transparent' }}
        />
      </div>
      {buka && kata.trim().length >= 2 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', zIndex: 100, maxHeight: 320, overflowY: 'auto' }}>
          {hasil.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#94A3B8' }}>Tidak ada siswa yang cocok.</div>
          ) : hasil.map(s => (
            <Link key={s.id} href={href(s.id)} className="laporan-baris-tautan"
              style={{ display: 'block', padding: '0.6rem 1rem', textDecoration: 'none', borderBottom: '1px solid #F8FAFC' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                {s.nama}
                {s.isAlumni && <GraduationCap size={13} color="#6D28D9" aria-label="Alumni" />}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>NIS {s.nis ?? '—'} · {s.kelas}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
