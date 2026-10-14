'use client'

import { useState } from 'react'
import { IkonMata, IkonMataCoret } from './IkonAuth'
import { ukuranIkon } from './satuan'

interface KolomSandiProps {
  id: string
  value: string
  onChange: (nilai: string) => void
  onEnter: () => void
  placeholder: string
  autoComplete: 'current-password' | 'new-password'
}

// Isian password dengan tombol mata. Mengikuti mockup: mata dicoret saat password
// tersembunyi, mata terbuka saat password terlihat.
export const KolomSandi = ({ id, value, onChange, onEnter, placeholder, autoComplete }: KolomSandiProps) => {
  const [tampil, setTampil] = useState(false)

  return (
    <div className="auth-kotak">
      <input
        id={id}
        type={tampil ? 'text' : 'password'}
        className="auth-input"
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
      />
      <button
        type="button"
        className="auth-ikon-tombol"
        onClick={() => setTampil((v) => !v)}
        tabIndex={-1}
        aria-label={tampil ? 'Sembunyikan password' : 'Tampilkan password'}
      >
        {tampil ? <IkonMata style={ukuranIkon(26.7)} /> : <IkonMataCoret style={ukuranIkon(26.7)} />}
      </button>
    </div>
  )
}
