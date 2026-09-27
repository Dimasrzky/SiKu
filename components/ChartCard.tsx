'use client'

import React from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
}

export function ChartCard({ title, subtitle, action, children, style }: ChartCardProps) {
  return (
    <div className="card-glass" style={{
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: '0.5rem',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}>
      {/* Header — beradius via overflow:hidden parent */}
      <div className="badge-glass-blue" style={{
        padding: '0.65rem 1rem',
        borderRadius: '0 10px 10px 0',
        maxWidth: '60%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1A2C4E' }}>
          {title}
        </span>
        {action}
      </div>

      {/* Body */}
      <div style={{ padding: '0.5rem 1.25rem 1.1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {subtitle && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            {subtitle}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
