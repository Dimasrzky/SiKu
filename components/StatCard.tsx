'use client'

import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  icon: LucideIcon
  valueStyle?: React.CSSProperties
}

export function StatCard({ title, value, icon: Icon, valueStyle }: StatCardProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 6px 10px rgba(92, 135, 184, 0.67)',
    }}>
      {/* Header */}
      <div style={{
        background: '#A3CDFE',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '0 0 10px 10px',
        boxShadow: '0 1px 10px rgba(32, 52, 60, 0.61)',
      }}>
        <div style={{
          background: '#1A2C4E',
          borderRadius: 10,
          width: 50,
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={30} color="#fff" />
        </div>
        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1A2C4E', flex: 1, textAlign: 'center' }}>
          {title}
        </span>
      </div>

      {/* Body */}
      <div style={{
        padding: '1rem 1.25rem',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          color: '#1A2C4E',
          lineHeight: 1,
          position: 'relative',
          zIndex: 1,
          ...valueStyle,
        }}>
          {value}
        </div>

        {/* Watermark — ikon sama, warna #E0EEFF, pojok kanan bawah */}
        <div style={{
          position: 'absolute',
          bottom: 4,
          right: 10,
          color: '#E0EEFF',
          pointerEvents: 'none',
        }}>
          <Icon size={30} />
        </div>
      </div>
    </div>
  )
}
