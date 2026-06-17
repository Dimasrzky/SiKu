'use client'

import Image from 'next/image'


export default function PembayaranPage() {
  return (
    <div className="dashboard-content">

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 1000 }}>

          <Image src='/gif/programmer.gif' width={150} height={150} alt='develop' style={{ marginLeft: '18rem' }} />

          {/* Badge status */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#FEF9C3',
            color: '#854D0E',
            padding: '0.3rem 1rem',
            borderRadius: 20,
            fontSize: '0.75rem',
            fontWeight: 700,
            marginBottom: '1.25rem',
            border: '1px solid #FDE68A',
            letterSpacing: '0.04em',
          }}>
            SEDANG DALAM PENGEMBANGAN
          </div>

          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 0, marginRight: 'auto', marginBottom: '2rem', marginLeft: 'auto', fontWeight: 600 }}>
            Halaman ini sedang dalam pengembangan. Mohon untuk melihat fitur lainnya terlebih dahulu
          </p>

        </div>
      </div>
    </div>
  )
}
