'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { FileExclamationPoint, Settings } from 'lucide-react'
import type { PesanKop } from '@/lib/useKopLaporan'

// Pop up saat laporan tidak bisa diunduh karena isian kop (email, alamat, yayasan,
// telepon, logo) masih kosong — atau gagal dimuat. Dipakai halaman Laporan dan
// Pengeluaran.

export const ModalKopBelumLengkap = ({ pesan, onTutup }: { pesan: PesanKop; onTutup: () => void }) => {
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup() }
    window.addEventListener('keydown', tekan)
    return () => window.removeEventListener('keydown', tekan)
  }, [onTutup])

  return (
    <div
      onClick={onTutup}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        role="alertdialog" aria-modal="true" aria-labelledby="judul-kop-laporan" aria-describedby="teks-kop-laporan"
        className="pg-muncul"
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', textAlign: 'center', padding: '2rem 1.75rem 1.5rem' }}
      >
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <FileExclamationPoint size={26} color="#B45309" />
        </div>
        <div id="judul-kop-laporan" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 6 }}>
          {pesan.judul}
        </div>
        <div id="teks-kop-laporan" style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.55, marginBottom: '1.5rem' }}>
          {pesan.teks}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onTutup}
            style={{ flex: 1, padding: '0.7rem', background: pesan.kePengaturan ? '#fff' : '#1A2C4E', color: pesan.kePengaturan ? '#64748B' : '#fff', border: pesan.kePengaturan ? '1.5px solid #E2E8F0' : 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Tutup
          </button>
          {pesan.kePengaturan && (
            <Link
              href="/pengaturan#profil-sekolah"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '0.7rem', background: '#1A2C4E', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}
            >
              <Settings size={15} /> Buka Pengaturan
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
