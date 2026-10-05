'use client'

import { TrendingUp, PieChart, CalendarCheck, AlertTriangle } from 'lucide-react'
import { formatRupiah as fmt, formatPersen } from '@/lib/formatLaporan'
import type { RingkasanMetrik } from '@/lib/metrikLaporan'
import { sKartu, sKepalaKartu, sJudulKartu, sIkonKartu, sNilaiKartu, sKetKartu, sBarisKartu } from './gayaLaporan'

/**
 * Empat kartu metrik yang sama di level Jenjang, Kelas, dan Siswa (prinsip 1: rumus
 * sama dari sekolah sampai siswa). Jumlah selalu ditulis di samping persen (prinsip 4).
 * Halaman Laporan utama memakai KartuRingkasanUtama (RingkasanUtama.tsx): tiga kartu
 * tanpa Ketepatan waktu — di level Kelas, status "Lancar" dibaca dari ketepatan waktu.
 */
export function KartuRingkasan({ ringkasan, pemasukan }: {
  ringkasan: RingkasanMetrik
  pemasukan: { total: number; transaksi: number }
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem', marginBottom: '0.9rem' }}>

      {/* Total Pemasukan */}
      <div style={sKartu}>
        <div style={sKepalaKartu}>
          <span style={sJudulKartu}>Total pemasukan</span>
          <div style={{ ...sIkonKartu, background: '#F0FDF4' }}>
            <TrendingUp size={16} color="#22C55E" />
          </div>
        </div>
        <div style={sNilaiKartu}>{fmt(pemasukan.total)}</div>
        <div style={sKetKartu}>Dari {pemasukan.transaksi} transaksi</div>
      </div>

      {/* Tingkat Pelunasan — hanya tagihan yang sudah jatuh tempo */}
      <div style={sKartu}>
        <div style={sKepalaKartu}>
          <span style={sJudulKartu}>Tingkat pelunasan</span>
          <div style={{ ...sIkonKartu, background: '#EFF6FF' }}>
            <PieChart size={16} color="#3B82F6" />
          </div>
        </div>
        <div style={sNilaiKartu}>{formatPersen(ringkasan.tingkatPelunasan)}</div>
        <div style={{ height: 12, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden', margin: '0.4rem 0 0.5rem' }}>
          <div style={{ height: '100%', width: `${ringkasan.tingkatPelunasan ?? 0}%`, background: '#69C183', borderRadius: 99 }} />
        </div>
        <div style={sKetKartu}>
          {ringkasan.tingkatPelunasan === null
            ? 'Belum ada tagihan yang jatuh tempo'
            : `${fmt(ringkasan.terbayarJatuhTempo)} dari ${fmt(ringkasan.nilaiJatuhTempo)} yang sudah jatuh tempo`}
        </div>
      </div>

      {/* Ketepatan Waktu */}
      <div style={sKartu}>
        <div style={sKepalaKartu}>
          <span style={sJudulKartu}>Ketepatan waktu</span>
          <div style={{ ...sIkonKartu, background: '#EEF2FF' }}>
            <CalendarCheck size={16} color="#4F46E5" />
          </div>
        </div>
        <div style={sNilaiKartu}>{formatPersen(ringkasan.ketepatanWaktu)}</div>
        <div style={{ ...sKetKartu, marginBottom: '0.6rem' }}>
          {ringkasan.ketepatanWaktu === null
            ? 'Belum ada tagihan yang jatuh tempo'
            : `${ringkasan.jumlahTepatWaktu} dari ${ringkasan.jumlahDinilai} tagihan lunas tepat waktu`}
        </div>
        <div style={sBarisKartu}>
          <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Rata-rata telat</span>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0F172A' }}>
            {ringkasan.rataHariTelat === null
              ? '—'
              : `${Math.round(ringkasan.rataHariTelat)} hari · ${ringkasan.jumlahTelat} tagihan`}
          </span>
        </div>
      </div>

      {/* Tunggakan + yang akan masuk */}
      <div style={sKartu}>
        <div style={sKepalaKartu}>
          <span style={sJudulKartu}>Tunggakan</span>
          <div style={{ ...sIkonKartu, background: '#FEF2F2' }}>
            <AlertTriangle size={16} color="#EF4444" />
          </div>
        </div>
        <div style={{ ...sNilaiKartu, marginBottom: '0.75rem' }}>{fmt(ringkasan.tunggakanBerjalan)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={sBarisKartu}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
              <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Siswa menunggak</span>
            </div>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0F172A' }}>{ringkasan.siswaMenunggak} siswa</span>
          </div>
          <div style={sBarisKartu}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
              <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Akan masuk</span>
            </div>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0F172A' }}>{fmt(ringkasan.akanMasuk)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
