'use client'

import React from 'react'

interface ChartCardProps {
  /** Tidak tampil di layar — dipakai sebagai label aksesibilitas kartu */
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
}

export function ChartCard({ title, subtitle, action, children, style }: ChartCardProps) {
  return (
    <section aria-label={title} style={{
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 4px 8px rgba(92, 135, 184, 0.15)',
      marginBottom: '0.5rem',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      ...style,
    }}>
      {/* Header — keterangan di kiri, aksi/periode di kanan */}
      {(subtitle || action) && (
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
