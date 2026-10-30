import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { sBingkai } from '@/components/laporan/gayaLaporan'

// Potongan tampilan halaman Pengeluaran yang dipakai bersama halaman dan kerangkanya
// (components/skeleton/SkeletonPengeluaran), supaya bentuk keduanya tidak berselisih.
// Bentuknya mengikuti mockup user 27 Okt 2026 (DM Sans, kartu putih berbayang).

export type TabPengeluaran = 'kas' | 'daftar'

export const LABEL_TAB: Record<TabPengeluaran, string> = {
  kas:    'Ringkasan Kas',
  daftar: 'Daftar Pengeluaran',
}

export const JUDUL_HALAMAN    = 'Pengeluaran'
export const SUBJUDUL_HALAMAN = 'Catatan pengeluaran sekolah dan ringkasan kas'

export const KOLOM_RIWAYAT = ['Tanggal', 'Keterangan', 'Komponen', 'Jumlah', 'Status'] as const
export const KOLOM_DAFTAR  = ['No', 'Jenis', 'Nama', 'Tanggal', 'Volume', 'Satuan', 'Biaya Satuan', 'Jumlah', 'Komponen', 'Aksi'] as const

export const FONT_PENGELUARAN = 'var(--font-dm-sans), sans-serif'
export const NAVY = '#1A2C4E'

/** Bingkai atas berisi tab, tombol unduh, dan tiga kartu */
export const sBingkaiPengeluaran: CSSProperties = {
  ...sBingkai, padding: '1.1rem 1.75rem 1.5rem', gap: '1rem', fontFamily: FONT_PENGELUARAN, letterSpacing: '-0.01em',
}

/** Kartu putih di bawah bingkai: riwayat, panel saldo komponen, daftar pengeluaran */
export const sKartuPutih: CSSProperties = {
  background: '#fff', borderRadius: 12, boxShadow: '0 2px 14px rgba(50, 68, 115, 0.26)',
  fontFamily: FONT_PENGELUARAN, letterSpacing: '-0.01em', minWidth: 0,
}

/** Pilihan tab. Tanpa `onPilih` (kerangka) tombolnya tidak bisa diklik. */
export const PilihanTab = ({ aktif, onPilih }: { aktif: TabPengeluaran; onPilih?: (t: TabPengeluaran) => void }) => (
  <div role="tablist" style={{ display: 'inline-flex', background: '#E5E9F0', borderRadius: 9, padding: 3, gap: 2 }}>
    {(Object.keys(LABEL_TAB) as TabPengeluaran[]).map(t => {
      const dipilih = t === aktif
      return (
        <button
          key={t}
          role="tab" aria-selected={dipilih}
          onClick={onPilih ? () => onPilih(t) : undefined}
          tabIndex={onPilih ? 0 : -1}
          className={onPilih ? 'fp-tekan' : undefined}
          style={{
            border: dipilih ? '1px solid #CBD5E1' : '1px solid transparent', borderRadius: 7, padding: '0.45rem 1rem',
            fontSize: '0.82rem', fontWeight: 500, fontFamily: 'inherit', letterSpacing: 'inherit',
            background: dipilih ? '#fff' : 'transparent', color: dipilih ? NAVY : '#4B5563',
            boxShadow: dipilih ? '0 1px 3px rgba(26,44,78,0.12)' : 'none', cursor: onPilih ? 'pointer' : 'default', whiteSpace: 'nowrap',
            transition: 'background-color 160ms ease, color 160ms ease, box-shadow 160ms ease',
          }}
        >
          {LABEL_TAB[t]}
        </button>
      )
    })}
  </div>
)

/** Kartu angka: Pemasukan, Pengeluaran, Selisih */
export const KartuKas = ({ label, Ikon, warnaIkon, nilai, warnaNilai = NAVY, keterangan }: {
  label:       string
  Ikon:        LucideIcon
  warnaIkon:   string
  nilai:       ReactNode
  warnaNilai?: string
  keterangan:  ReactNode
}) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: '0.85rem 1.1rem 1rem', boxShadow: '0 2px 12px rgba(50, 68, 115, 0.32)', minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#4B5563' }}>{label}</span>
      <Ikon size={20} color={warnaIkon} strokeWidth={2} style={{ flexShrink: 0 }} />
    </div>
    <div style={{ padding: '0.45rem 0 0 1rem' }}>
      <div style={{ display: 'inline-block', fontSize: '1.5rem', fontWeight: 700, color: warnaNilai, lineHeight: 1.25, paddingBottom: '0.3rem', borderBottom: '1.5px solid #E2E8F0', overflowWrap: 'anywhere' }}>
        {nilai}
      </div>
      <div style={{ fontSize: '0.74rem', color: '#6F788A', lineHeight: 1.45, marginTop: '0.45rem' }}>{keterangan}</div>
    </div>
  </div>
)

export const sBarisKartu: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }

/** Chip satu komponen, berwarna komponennya */
export const ChipKomponen = ({ nama, warna }: { nama: string; warna: string }) => (
  <span title={nama} style={{
    display: 'inline-block', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    fontSize: '0.64rem', fontWeight: 600, color: '#fff', background: warna, borderRadius: 20, padding: '2px 9px', lineHeight: 1.5,
  }}>
    {nama}
  </span>
)

/**
 * Chip komponen dengan batas: lebih dari `maks` → sisanya diringkas jadi satu chip "+n"
 * (nama-namanya muncul saat diarahkan), supaya kolom tidak penuh
 */
export const DaftarChip = ({ nama, warna, maks = 3 }: { nama: string[]; warna: (nama: string) => string; maks?: number }) => {
  const tampil = nama.length > maks ? nama.slice(0, maks) : nama
  const sisa   = nama.slice(tampil.length)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {tampil.map(n => <ChipKomponen key={n} nama={n} warna={warna(n)} />)}
      {sisa.length > 0 && (
        <span title={sisa.join(', ')} style={{
          display: 'inline-block', fontSize: '0.64rem', fontWeight: 700, color: '#475569', background: '#E2E8F0',
          borderRadius: 20, padding: '2px 8px', lineHeight: 1.5, cursor: 'default', whiteSpace: 'nowrap',
        }}>
          +{sisa.length}
        </span>
      )}
    </div>
  )
}

/** Status di tabel riwayat */
export const StatusKas = ({ jenis }: { jenis: 'masuk' | 'keluar' }) => jenis === 'masuk' ? (
  <span style={{ display: 'inline-block', fontSize: '0.66rem', fontWeight: 600, color: '#fff', background: '#4CC07A', borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>
    Pemasukan
  </span>
) : (
  <span style={{ display: 'inline-block', fontSize: '0.66rem', fontWeight: 600, color: '#E05A5A', background: '#FFE1E1', border: '1px solid #F7B3B3', borderRadius: 20, padding: '1px 9px', whiteSpace: 'nowrap' }}>
    Pengeluaran
  </span>
)

export const WARNA_MASUK  = '#3DAE6B'
export const WARNA_KELUAR = '#E05A5A'
