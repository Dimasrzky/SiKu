'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatRupiah } from '@/lib/formatLaporan'
import { kunciKomponen, WARNA_LAINNYA } from '@/lib/kasKomponen'
import type { BarisRiwayatKas } from '@/lib/riwayatKas'
import { DaftarChip, KOLOM_RIWAYAT, NAVY, sKartuPutih, StatusKas, WARNA_KELUAR, WARNA_MASUK } from './BagianPengeluaran'

// Riwayat pemasukan dan pengeluaran bulan terpilih (tab Ringkasan Kas). Pemasukan satu
// baris per pembayaran siswa, jadi satu bulan bisa ratusan baris — ditampilkan per halaman.
// Halaman kembali ke awal saat bulannya berganti: pemanggil memberi `key` per bulan.

const PER_HALAMAN = 8

const tanggalPendek = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

const sTh: React.CSSProperties = {
  padding: '0.85rem 1rem 0.7rem', textAlign: 'left', fontSize: '0.84rem', fontWeight: 500, color: NAVY,
  borderBottom: '2px solid #E5E7EB', whiteSpace: 'nowrap',
}
const sTd: React.CSSProperties = {
  padding: '0.7rem 1rem', fontSize: '0.8rem', color: '#6B7280', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top',
}

export const TabelRiwayatKas = ({ baris, warna, labelBulan }: {
  baris:      BarisRiwayatKas[]
  warna:      Map<string, string>
  labelBulan: string
}) => {
  const [halaman, setHalaman] = useState(0)
  const jumlahHalaman = Math.max(1, Math.ceil(baris.length / PER_HALAMAN))
  const hal = Math.min(halaman, jumlahHalaman - 1)
  const tampil = baris.slice(hal * PER_HALAMAN, (hal + 1) * PER_HALAMAN)

  return (
    <section aria-label={`Riwayat kas ${labelBulan}`} style={{ ...sKartuPutih, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>{KOLOM_RIWAYAT.map(k => <th key={k} style={{ ...sTh, textAlign: k === 'Jumlah' ? 'right' : 'left' }}>{k}</th>)}</tr>
          </thead>
          <tbody>
            {tampil.length === 0 ? (
              <tr>
                <td colSpan={KOLOM_RIWAYAT.length} style={{ ...sTd, textAlign: 'center', padding: '2.5rem 1rem', color: '#94A3B8', borderBottom: 'none' }}>
                  Belum ada pemasukan atau pengeluaran di {labelBulan}.
                </td>
              </tr>
            ) : tampil.map(b => (
              <tr key={b.id}>
                <td style={{ ...sTd, whiteSpace: 'nowrap', width: 72 }}>{tanggalPendek(b.tanggal)}</td>
                <td style={{ ...sTd, minWidth: 150 }}>
                  <div style={{ color: '#4B5563', overflowWrap: 'anywhere' }}>{b.judul}</div>
                  {b.keterangan && <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: 2 }}>{b.keterangan}</div>}
                </td>
                <td style={sTd}>
                  {b.komponen.length === 0
                    ? <span style={{ color: '#CBD5E1' }}>—</span>
                    : <DaftarChip nama={b.komponen} warna={n => warna.get(kunciKomponen(n)) ?? WARNA_LAINNYA} />}
                </td>
                <td style={{ ...sTd, textAlign: 'right', whiteSpace: 'nowrap', color: b.jenis === 'masuk' ? WARNA_MASUK : WARNA_KELUAR, fontVariantNumeric: 'tabular-nums' }}>
                  {b.jenis === 'masuk' ? '+ ' : '− '}{formatRupiah(b.jumlah)}
                </td>
                <td style={{ ...sTd, width: 110 }}><StatusKas jenis={b.jenis} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {baris.length > PER_HALAMAN && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 1rem', fontSize: '0.74rem', color: '#6B7280' }}>
          <span>{hal * PER_HALAMAN + 1}–{Math.min(baris.length, (hal + 1) * PER_HALAMAN)} dari {baris.length} transaksi</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" onClick={() => setHalaman(h => Math.max(0, Math.min(h, jumlahHalaman - 1) - 1))} disabled={hal === 0}
              aria-label="Halaman sebelumnya" className="fp-tekan" style={sTombolHal(hal === 0)}><ChevronLeft size={15} /></button>
            <span style={{ minWidth: 44, textAlign: 'center' }}>{hal + 1} / {jumlahHalaman}</span>
            <button type="button" onClick={() => setHalaman(h => Math.min(jumlahHalaman - 1, h + 1))} disabled={hal >= jumlahHalaman - 1}
              aria-label="Halaman berikutnya" className="fp-tekan" style={sTombolHal(hal >= jumlahHalaman - 1)}><ChevronRight size={15} /></button>
          </span>
        </div>
      )}
    </section>
  )
}

const sTombolHal = (mati: boolean): React.CSSProperties => ({
  width: 28, height: 28, borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#fff', color: NAVY,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: mati ? 'not-allowed' : 'pointer', opacity: mati ? 0.4 : 1,
})
