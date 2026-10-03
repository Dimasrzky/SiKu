'use client'

import React from 'react'

interface FinanceCardProps {
  title: string
  value: string
  valueColor: string
  info?: React.ReactNode
  progress: number
  progressColor: string
  progressLabel: string
  progressSub?: string
}

export function FinanceCard({
  title, value, valueColor, info,
  progress, progressColor, progressLabel, progressSub,
}: FinanceCardProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 4px 8px rgba(92, 135, 184, 0.15)',
      marginBottom: '0.5rem',
    }}>
      {/* Body */}
      <div style={{ padding: '1.1rem 1.25rem 0.2rem', flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1A2C4E', letterSpacing: '0.05em', bottom: 6, position: 'relative' }}>
            {title}
          </span>
          {info}
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: valueColor, lineHeight: 1 }}>
          {value}
        </div>
      </div>

      {/* Bottom: tanda kiri + kolom persentase+bar di pojok kanan */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingRight: '1rem',
        paddingBottom: '0.5rem',
      }}>
        {/* Tanda — flush pojok kiri bawah */}
        <div style={{
          background: '#1A2C4E',
          borderRadius: '0 8px 0 8px',
          position: 'relative',
          top: 8,
          width: 100,
          height: 25,
          flexShrink: 0,
        }} />

        {/* Kolom kanan: persentase di atas, progress bar kecil di bawah */}
        <div style={{ flex: 1, minWidth: 0, marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
              {progressLabel}
            </span>
            {progressSub && (
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {progressSub}
              </span>
            )}
          </div>
          {/* Lebar mengikuti ruang kartu (maks 280px) supaya tidak meluap di layar sempit */}
          <div style={{ background: '#E5E7EB', borderRadius: 999, height: 10, width: '80%', maxWidth: 280, overflow: 'hidden', marginTop: 2 }}>
            <div style={{
              background: progressColor,
              height: '100%',
              width: `${Math.min(progress, 100)}%`,
              borderRadius: 999,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}
