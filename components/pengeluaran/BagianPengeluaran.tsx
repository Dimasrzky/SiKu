import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { sBingkai } from '@/components/laporan/gayaLaporan'

// Potongan tampilan halaman Pengeluaran yang dipakai bersama halaman dan kerangkanya
// (components/skeleton/SkeletonPengeluaran), supaya bentuk keduanya tidak berselisih.

export type TabPengeluaran = 'rincian' | 'kas'

export const LABEL_TAB: Record<TabPengeluaran, string> = {
  rincian: 'Rincian Pengeluaran',
  kas:     'Ringkasan Kas',
}

export const JUDUL_HALAMAN    = 'Pengeluaran'
export const SUBJUDUL_HALAMAN = 'Catatan pengeluaran sekolah dan ringkasan kas'

/** Kolom tabel rincian — sama dengan format laporan pengeluaran sekolah, ditambah Aksi */
export const KOLOM_RINCIAN = ['No', 'Jenis', 'Keterangan Barang', 'Volume', 'Satuan', 'Biaya Satuan', 'Jumlah', 'Aksi'] as const
export const KOLOM_KAS     = ['Bulan', 'Pemasukan SPP', 'Pengeluaran', 'Selisih', 'Saldo Kumulatif'] as const

/** Kolom angka (rata kanan) di tabel rincian */
export const KOLOM_RINCIAN_KANAN = new Set([5, 6])

export const sBingkaiPengeluaran: CSSProperties = { ...sBingkai, padding: '1.5rem 1.875rem 2rem', gap: '1.5rem' }

export const sTh: CSSProperties = {
  background: '#1A2C4E', color: '#fff', fontSize: '0.78rem', fontWeight: 700, padding: '0.6rem 0.75rem',
  border: '1px solid #2B3F63', textAlign: 'left', whiteSpace: 'nowrap',
}
export const sTd: CSSProperties = {
  border: '1px solid #E2E8F0', padding: '0.55rem 0.75rem', fontSize: '0.83rem', color: '#0F172A', verticalAlign: 'top',
}
export const sTdKaki: CSSProperties = { ...sTd, background: '#F1F5F9', fontWeight: 800 }

export const sTabel: CSSProperties = { width: '100%', borderCollapse: 'collapse', minWidth: 760 }

/** Pilihan tab. Tanpa `onPilih` (kerangka) tombolnya tidak bisa diklik. */
export const PilihanTab = ({ aktif, onPilih }: { aktif: TabPengeluaran; onPilih?: (t: TabPengeluaran) => void }) => (
  <div role="tablist" style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: 10, padding: 4, gap: 4 }}>
    {(Object.keys(LABEL_TAB) as TabPengeluaran[]).map(t => {
      const dipilih = t === aktif
      return (
        <button
          key={t}
          role="tab" aria-selected={dipilih}
          onClick={onPilih ? () => onPilih(t) : undefined}
          tabIndex={onPilih ? 0 : -1}
          style={{
            border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit',
            background: dipilih ? '#fff' : 'transparent', color: dipilih ? '#1A2C4E' : '#64748B',
            boxShadow: dipilih ? '0 1px 4px rgba(26,44,78,0.18)' : 'none', cursor: onPilih ? 'pointer' : 'default', whiteSpace: 'nowrap',
          }}
        >
          {LABEL_TAB[t]}
        </button>
      )
    })}
  </div>
)

/** Kartu angka di atas tabel: Pemasukan SPP, Pengeluaran, Selisih/Saldo */
export const KartuKas = ({ label, Ikon, warna, latar, nilai, keterangan }: {
  label:      string
  Ikon:       LucideIcon
  warna:      string
  latar:      string
  nilai:      ReactNode
  keterangan: ReactNode
}) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: '1rem 1.1rem', boxShadow: '0 2px 10px #3244736e', minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: latar, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Ikon size={17} color={warna} />
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#101010' }}>{label}</div>
    </div>
    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: '0.3rem', overflowWrap: 'anywhere' }}>{nilai}</div>
    <div style={{ fontSize: '0.76rem', color: '#6F788A', lineHeight: 1.45 }}>{keterangan}</div>
  </div>
)

export const sBarisKartu: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }
