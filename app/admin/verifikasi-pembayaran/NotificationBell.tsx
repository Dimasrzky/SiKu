'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'

interface PendingSekolah {
  id:    string
  nama:  string
  count: number
}

interface Pendaftaran {
  id:   string
  nama: string
}

export default function NotificationBell({ pending, pendaftaran }: { pending: PendingSekolah[]; pendaftaran: Pendaftaran[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const total = pending.reduce((s, p) => s + p.count, 0) + pendaftaran.length

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          position: 'relative', width: 44, height: 44, background: '#fff', border: '1.5px solid #E2E8F0',
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        <Bell size={20} color="#1A2C4E" />
        {total > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, padding: '0 5px',
            background: '#DC2626', color: '#fff', borderRadius: 20, fontSize: '0.7rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #F1F5F9',
          }}>
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 300, maxHeight: 360, overflowY: 'auto',
          background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', zIndex: 100,
        }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: '0.85rem', color: '#1A2C4E' }}>
            Notifikasi
          </div>
          {pendaftaran.map(p => (
            <a
              key={p.id}
              href="#kemitraan"
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '0.75rem 1rem', borderBottom: '1px solid #F8FAFC', textDecoration: 'none',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#0F172A' }}>{p.nama}</span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748B' }}>Pendaftaran baru, menunggu konfirmasi kemitraan</span>
              </span>
              <span style={{
                padding: '2px 8px', background: '#DCE9FF', color: '#1A2C4E', borderRadius: 20,
                fontSize: '0.68rem', fontWeight: 800, flexShrink: 0,
              }}>
                Baru
              </span>
            </a>
          ))}
          {pending.length === 0 ? (
            <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' }}>
              Tidak ada bukti transfer yang menunggu.
            </div>
          ) : (
            pending.map(p => (
              <Link
                key={p.id}
                href={`/admin/verifikasi-pembayaran/${p.id}`}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '0.75rem 1rem', borderBottom: '1px solid #F8FAFC', textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#0F172A' }}>{p.nama}</span>
                <span style={{
                  minWidth: 22, height: 22, padding: '0 6px', background: '#FEF3C7', color: '#D97706',
                  borderRadius: 20, fontSize: '0.72rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {p.count}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
