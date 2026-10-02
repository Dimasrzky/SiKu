'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'
import type { TampilanTombol } from '@/lib/usePengingat'

// Tombol "Ingatkan" untuk sekolah yang memakai antrean pengingat WhatsApp. Klik tidak
// mengirim pesan — hanya memasukkannya ke antrean; tampilannya mengikuti keadaan dari
// server (lib/usePengingat). Sekolah yang belum memakai antrean tetap memakai tombol
// wa.me di tiap halaman, bukan komponen ini.

/** Mengikuti rupa tombol wa.me yang sudah ada di tiap halaman */
type Varian = 'ringkas' | 'penuh' | 'profil'

interface Props {
  tampilan:  TampilanTombol
  /** ringkas = baris tabel (Tagihan Aktif, Laporan Kelas), penuh = tabel Dashboard, profil = Laporan Siswa */
  varian:    Varian
  onKlik:    () => void
  /** Dimatikan dari luar, mis. selama ada modal terbuka */
  nonaktif?: boolean
}

// `display` ikut disamakan: tombol Dashboard berupa flex (rata kiri di selnya), yang lain inline-flex
const UKURAN: Record<Varian, { gaya: CSSProperties; ikon: number }> = {
  ringkas: { gaya: { display: 'inline-flex', gap: 4, borderRadius: 8,  padding: '0.3rem 0.7rem',   fontSize: '0.75rem' }, ikon: 16 },
  penuh:   { gaya: { display: 'flex',        gap: 6, borderRadius: 10, padding: '0.45rem 0.85rem', fontSize: '0.8rem'  }, ikon: 25 },
  profil:  { gaya: { display: 'inline-flex', gap: 6, borderRadius: 8,  padding: '0.45rem 0.9rem',  fontSize: '0.8rem'  }, ikon: 16 },
}

// Hijau muda untuk tombol di dalam tabel dan profil, hijau penuh untuk tabel Dashboard —
// sama dengan tombol wa.me masing-masing halaman
const HIJAU: Record<Varian, { siap: CSSProperties; terkirim: CSSProperties }> = {
  ringkas: { siap: { background: '#DCFCE7', color: '#15803D' }, terkirim: { background: '#BBF7D0', color: '#15803D' } },
  penuh:   { siap: { background: '#22C55E', color: '#fff' },    terkirim: { background: '#16A34A', color: '#fff' } },
  profil:  { siap: { background: '#DCFCE7', color: '#15803D' }, terkirim: { background: '#BBF7D0', color: '#15803D' } },
}

const NETRAL: CSSProperties = { background: '#F1F5F9', color: '#64748B' }
const PUDAR:  CSSProperties = { background: '#F1F5F9', color: '#94A3B8' }
const MERAH:  CSSProperties = { background: '#FEE2E2', color: '#B91C1C' }

interface Rupa { label: string; warna: CSSProperties; bisaDiklik: boolean; kursor: CSSProperties['cursor']; keterangan?: string }

function rupa(tampilan: TampilanTombol, varian: Varian): Rupa {
  const siap = varian === 'profil' ? 'Ingatkan via WhatsApp' : 'Ingatkan'
  switch (tampilan) {
    case 'ingatkan':
      return { label: siap, warna: HIJAU[varian].siap, bisaDiklik: true, kursor: 'pointer' }
    case 'memuat':
      return { label: siap, warna: HIJAU[varian].siap, bisaDiklik: false, kursor: 'progress' }
    case 'mengirim':
      return { label: 'Mengirim…', warna: NETRAL, bisaDiklik: false, kursor: 'default',
        keterangan: 'Pengingat sudah masuk antrean dan dikirim bertahap' }
    case 'terkirim':
      return { label: 'Terkirim', warna: HIJAU[varian].terkirim, bisaDiklik: false, kursor: 'default',
        keterangan: 'Pengingat sudah terkirim. Bisa dikirim lagi dua hari sesudahnya.' }
    case 'gagal':
      return { label: 'Gagal, coba lagi', warna: MERAH, bisaDiklik: true, kursor: 'pointer',
        keterangan: 'Pengingat belum masuk antrean. Klik untuk mencoba lagi.' }
    case 'nonaktif':
      return { label: siap, warna: PUDAR, bisaDiklik: false, kursor: 'not-allowed',
        keterangan: 'Belum ada tunggakan yang lewat jatuh tempo, atau nomor WhatsApp wali belum valid' }
  }
}

export const TombolIngatkan = ({ tampilan, varian, onKlik, nonaktif = false }: Props) => {
  const r      = rupa(tampilan, varian)
  const ukuran = UKURAN[varian]
  const mati   = nonaktif || !r.bisaDiklik
  // Ikon WhatsApp berwarna penuh hanya saat tombolnya memang bisa dipakai
  const ikonPudar = tampilan === 'mengirim' || tampilan === 'nonaktif'

  return (
    <button
      type="button"
      onClick={() => { if (!mati) onKlik() }}
      disabled={mati}
      aria-busy={tampilan === 'mengirim' || tampilan === 'memuat'}
      title={r.keterangan}
      style={{
        alignItems: 'center', border: 'none', fontWeight: 700,
        fontFamily: 'inherit', whiteSpace: 'nowrap',
        ...ukuran.gaya, ...r.warna,
        cursor: nonaktif ? 'not-allowed' : r.kursor,
        opacity: nonaktif ? 0.6 : 1,
      }}>
      <Image src="/icons/IconWA.png" width={ukuran.ikon} height={ukuran.ikon} alt=""
        style={ikonPudar ? { opacity: 0.45, filter: 'grayscale(1)' } : undefined} />
      {r.label}
    </button>
  )
}
