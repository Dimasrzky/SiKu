'use client'

import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, TrendingUp, TriangleAlert, UsersRound } from 'lucide-react'
import { formatRupiah as fmt, formatPersen, formatRingkasSpasi, formatRupiahRingkas } from '@/lib/formatLaporan'
import type { KelompokUmur, RingkasanMetrik } from '@/lib/metrikLaporan'
import type { StatusTagihan } from '@/lib/statusTagihan'
import { sKartuTab, WARNA_LAPORAN as WARNA } from './gayaLaporan'

// Isi halaman Laporan utama yang dirombak mengikuti mockup Okt 2026. Hanya level
// Sekolah — Jenjang, Kelas, dan Siswa tetap memakai KartuRingkasan.

// ── Bagian kecil ─────────────────────────────────────────────────────────────

/** Batang persen dengan labelnya di ujung kanan, di dalam batang */
const BatangPersen = ({ persen, warna = WARNA.hijau, style }: { persen: number | null; warna?: string; style?: CSSProperties }) => (
  <div style={{ position: 'relative', height: 14, background: WARNA.track, borderRadius: 99, overflow: 'hidden', ...style }}>
    {persen !== null && persen > 0 && (
      <div style={{ height: '100%', width: `${Math.min(100, persen)}%`, minWidth: 14, background: warna, borderRadius: 99 }} />
    )}
    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', fontWeight: 600, lineHeight: 1, color: WARNA.navy, opacity: 0.7 }}>
      {formatPersen(persen)}
    </span>
  </div>
)

/** Rupiah ringkas; angka lengkapnya muncul saat kursor diarahkan */
const Ringkas = ({ nilai, style }: { nilai: number; style?: CSSProperties }) => (
  <span title={fmt(nilai)} style={{ whiteSpace: 'nowrap', ...style }}>{formatRupiahRingkas(nilai)}</span>
)

const Kosong = ({ children }: { children: ReactNode }) => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 0', textAlign: 'center', fontSize: '0.82rem', color: WARNA.abuMuda }}>
    {children}
  </div>
)

// ── Baris 1: kartu metrik ────────────────────────────────────────────────────

// Diekspor untuk kerangka halaman (components/skeleton/SkeletonLaporan.tsx)
export const sKartuMetrik:  CSSProperties = { ...sKartuTab, padding: '0.6rem 0.75rem 0.7rem 1rem' }
export const sKepalaMetrik: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }
export const sJudulMetrik:  CSSProperties = { fontSize: '1.2rem', fontWeight: 400, lineHeight: 1.2, color: WARNA.abu }
const sNilaiMetrik:  CSSProperties = { fontSize: '1.9rem', fontWeight: 700, lineHeight: 1.15, color: WARNA.navy, overflowWrap: 'anywhere' }
export const sGarisBawah:   CSSProperties = { display: 'inline-block', paddingBottom: 2, borderBottom: '1.5px solid #D5D7DD' }
export const sKetMetrik:    CSSProperties = { fontSize: '1rem', lineHeight: 1.4, color: WARNA.abuMuda }
/** Nilai dan rinciannya menjorok dari judul kartu, seperti di mockup */
export const sIsiMetrik:    CSSProperties = { paddingLeft: '1rem', marginTop: '1.1rem' }

const BarisRincian = ({ warna, label, nilai, warnaNilai = WARNA.abu }: { warna: string; label: string; nilai: number; warnaNilai?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
    <span style={{ ...sKetMetrik, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: warna, flexShrink: 0 }} />
      {label}
    </span>
    <Ringkas nilai={nilai} style={{ ...sKetMetrik, color: warnaNilai }} />
  </div>
)

/**
 * Tiga kartu: tanpa Ketepatan waktu, dan Total tunggakan = belum jatuh tempo +
 * menunggak — sejalan dengan "Total Tunggakan Aktif" di Dashboard, yang juga memuat
 * tagihan bulan ini yang belum jatuh tempo. Tingkat pelunasan tetap hanya tagihan
 * yang sudah jatuh tempo.
 */
export const KartuRingkasanUtama = ({ ringkasan, pemasukan }: {
  ringkasan: RingkasanMetrik
  pemasukan: { total: number; transaksi: number }
}) => {
  const pelunasan = ringkasan.tingkatPelunasan
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
      <div style={sKartuMetrik}>
        <div style={sKepalaMetrik}>
          <span style={sJudulMetrik}>Total pemasukan</span>
          <TrendingUp size={26} color={WARNA.navy} strokeWidth={2.25} aria-hidden />
        </div>
        <div style={sIsiMetrik}>
          <div style={{ ...sNilaiMetrik, ...sGarisBawah }}>{fmt(pemasukan.total)}</div>
          <div style={{ ...sKetMetrik, marginTop: '0.85rem' }}>Dari {pemasukan.transaksi} transaksi</div>
        </div>
      </div>

      <div style={sKartuMetrik}>
        <div style={sKepalaMetrik}>
          <span style={sJudulMetrik}>Tingkat pelunasan</span>
          <Image src="/icons/Pie.png" alt="" width={24} height={24} />
        </div>
        <div style={sIsiMetrik}>
          <div style={sNilaiMetrik}>{formatPersen(pelunasan)}</div>
          {/* Di bawah kanan angka, tepat di atas batang — seperti mockup */}
          <div style={{ ...sKetMetrik, textAlign: 'right', marginTop: '-0.25rem' }}>
            {pelunasan === null
              ? 'Belum ada tagihan yang jatuh tempo'
              : `${formatRupiahRingkas(ringkasan.terbayarJatuhTempo)} dari ${formatRingkasSpasi(ringkasan.nilaiJatuhTempo)}`}
          </div>
        </div>
        <BatangPersen persen={pelunasan} style={{ marginTop: '0.5rem' }} />
      </div>

      <div style={sKartuMetrik}>
        <div style={sKepalaMetrik}>
          <span style={sJudulMetrik}>Total tunggakan</span>
          <TriangleAlert size={26} color={WARNA.navy} strokeWidth={2} aria-hidden />
        </div>
        <div style={sIsiMetrik}>
          <div style={{ ...sNilaiMetrik, ...sGarisBawah }}>{fmt(ringkasan.akanMasuk + ringkasan.tunggakanBerjalan)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.85rem' }}>
            <BarisRincian warna={WARNA.hijau} label="Belum jatuh tempo" nilai={ringkasan.akanMasuk} />
            <BarisRincian warna={WARNA.merah} label="Menunggak" nilai={ringkasan.tunggakanBerjalan} warnaNilai={WARNA.merah} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Baris 2: komposisi status ────────────────────────────────────────────────

export const URUTAN_DONUT: { status: StatusTagihan; label: string; warna: string }[] = [
  { status: 'lunas',       label: 'Lunas',       warna: WARNA.hijau },
  { status: 'cicilan',     label: 'Cicilan',     warna: WARNA.navy },
  { status: 'belum_bayar', label: 'Belum bayar', warna: WARNA.biruMuda },
  { status: 'menunggak',   label: 'Menunggak',   warna: WARNA.merah },
]

/** Donut per siswa (komposisiStatusSiswa) — mulai dari arah jam 3, searah jarum jam, seperti mockup */
export const KomposisiStatus = ({ jumlah }: { jumlah: Record<StatusTagihan, number> }) => {
  const total    = URUTAN_DONUT.reduce((s, d) => s + jumlah[d.status], 0)
  const UKURAN   = 124; const R = 52; const TEBAL = 16; const PUSAT = UKURAN / 2
  const KELILING = 2 * Math.PI * R
  const potongan = URUTAN_DONUT.reduce<{ status: StatusTagihan; warna: string; panjang: number; mulai: number }[]>((acc, d) => {
    const mulai = acc.reduce((s, p) => s + p.panjang, 0)
    return [...acc, { status: d.status, warna: d.warna, panjang: total > 0 ? (jumlah[d.status] / total) * KELILING : 0, mulai }]
  }, [])

  // Rata atas seperti mockup — sisa tinggi kartu (mengikuti grafik di sebelahnya) dibiarkan kosong
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem 2rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
      <svg width={UKURAN} height={UKURAN} viewBox={`0 0 ${UKURAN} ${UKURAN}`} style={{ flexShrink: 0 }}
        role="img" aria-label={`${total} siswa: ${URUTAN_DONUT.map(d => `${d.label} ${jumlah[d.status]}`).join(', ')}`}>
        <circle cx={PUSAT} cy={PUSAT} r={R} fill="none" stroke={WARNA.track} strokeWidth={TEBAL} />
        {potongan.filter(p => p.panjang > 0).map(p => (
          <circle key={p.status} cx={PUSAT} cy={PUSAT} r={R} fill="none" stroke={p.warna} strokeWidth={TEBAL}
            strokeDasharray={`${p.panjang} ${KELILING - p.panjang}`} strokeDashoffset={-p.mulai} />
        ))}
        <text x={PUSAT} y={PUSAT - 1} textAnchor="middle" fontSize={22} fontWeight={700} fill={WARNA.navy}>{total}</text>
        <text x={PUSAT} y={PUSAT + 23} textAnchor="middle" fontSize={22} fontWeight={700} fill={WARNA.navy}>Siswa</text>
      </svg>
      <div style={{ flex: '1 1 150px', minWidth: 0 }}>
        {URUTAN_DONUT.map((d, i) => (
          <div key={d.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.65rem 0', borderTop: i > 0 ? `1px solid ${WARNA.garis}` : 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: WARNA.abuMuda }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: d.warna, flexShrink: 0 }} />
              {d.label}
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: d.status === 'menunggak' ? WARNA.merah : WARNA.navy, fontVariantNumeric: 'tabular-nums' }}>
              {jumlah[d.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Baris 3: komponen paling banyak belum dibayar ────────────────────────────

export interface KomponenBelum {
  nama:  string
  /** Siswa — bukan tagihan — yang tagihannya memuat komponen ini dan belum lunas */
  siswa: number
  total: number
}

// Badge mengikuti urutan warna di mockup; nominal termahal merah, lalu coklat, lalu abu
const WARNA_BADGE   = ['#5C9BE4', '#85E45C', '#BE5CE4', '#193B62']
const WARNA_NOMINAL = [WARNA.merah, WARNA.coklat, WARNA.coklat, WARNA.abu]

/** "Uang Gedung" → UG, "SPP" → SPP, "Seragam" → SR (huruf pertama + konsonan berikutnya) */
function inisialKomponen(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean)
  if (kata.length >= 2) return (kata[0][0] + kata[1][0]).toUpperCase()
  const satu = kata[0] ?? ''
  if (satu.length <= 3 && satu === satu.toUpperCase()) return satu
  const konsonan = satu.slice(1).match(/[b-df-hj-np-tv-z]/i)?.[0] ?? satu[1] ?? ''
  return (satu.slice(0, 1) + konsonan).toUpperCase()
}

export const KomponenBelumDibayar = ({ data }: { data: KomponenBelum[] }) => {
  if (data.length === 0) return <Kosong>Tidak ada komponen yang belum dibayar.</Kosong>
  return (
    <div>
      {data.map((k, i) => (
        <div key={`${k.nama}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.65rem 0', borderTop: i > 0 ? `1px solid ${WARNA.garisTegas}` : 'none' }}>
          <span style={{ width: 30, height: 30, borderRadius: 5, background: WARNA_BADGE[i % WARNA_BADGE.length], color: '#fff', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {inisialKomponen(k.nama)}
          </span>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
            <div style={{ fontSize: '1rem', fontWeight: 500, color: WARNA.navy }}>{k.nama}</div>
            <div style={{ fontSize: '0.9rem', color: WARNA.abu }}>{k.siswa} siswa belum bayar</div>
          </div>
          <Ringkas nilai={k.total} style={{ fontSize: '1rem', fontWeight: 500, color: WARNA_NOMINAL[i] ?? WARNA.abu }} />
        </div>
      ))}
    </div>
  )
}

// ── Baris 4: umur tunggakan ──────────────────────────────────────────────────

/** `kelompok` berurutan seperti umurTunggakan: 1–30 hari dulu. Yang termuda coklat, sisanya merah. */
export const UmurTunggakan = ({ total, siswa, kelompok, tertunggak }: {
  total:      number
  siswa:      number
  kelompok:   KelompokUmur[]
  /** Siswa berstatus Tertunggak — lihat jumlahSiswaTertunggak */
  tertunggak: number
}) => {
  if (total === 0) return <Kosong>Tidak ada tunggakan.</Kosong>
  // Terlama di atas, seperti mockup. Nilainya kumulatif (keputusan 1 Okt 2026),
  // jadi batang 1–30 hari selalu penuh.
  const baris = kelompok.map((k, i) => ({ k, warna: i === 0 ? WARNA.coklat : WARNA.merah })).reverse()
  return (
    <>
      <div style={{ padding: '0 0 0.85rem 0.6rem', borderBottom: `1px solid ${WARNA.garisTegas}` }}>
        <Ringkas nilai={total} style={{ display: 'block', fontSize: '1.55rem', fontWeight: 700, lineHeight: 1.2, color: WARNA.navy }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.85rem', color: WARNA.abu }}>
          <UsersRound size={15} aria-hidden /> {siswa} Siswa
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.4rem' }}>
        {baris.map(({ k, warna }) => (
          <div key={k.label}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 500, color: WARNA.navy }}>{k.label}</span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <Ringkas nilai={k.nominal} style={{ fontSize: '0.85rem', fontWeight: 700, color: WARNA.navy }} />
                <span style={{ fontSize: '0.75rem', color: WARNA.abuMuda }}> – {k.jumlahSiswa} Siswa</span>
              </span>
            </div>
            <BatangPersen persen={(k.nominal / total) * 100} warna={warna} />
          </div>
        ))}
      </div>
      {tertunggak > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '2px', paddingTop: '1.4rem', fontSize: '1.1rem', color: WARNA.merah }}>
          <TriangleAlert size={18} aria-hidden /> {tertunggak} Siswa butuh tindakan segera
        </div>
      )}
    </>
  )
}

// ── Baris 4: pembayaran per jenjang ──────────────────────────────────────────

export interface JenjangRingkas {
  kode:         string
  /** Tingkat pelunasan 0–100; null kalau belum ada tagihan yang jatuh tempo */
  pct:          number | null
  tunggakan:    number
  siswaLunas:   number
  siswaDinilai: number
}

const KotakJenjang = ({ judul, jenjang, warna }: { judul: string; jenjang: JenjangRingkas; warna: string }) => (
  <div style={{ flex: '1 1 150px', border: `1px solid ${WARNA.garis}`, borderRadius: 8, boxShadow: '0 1px 4px rgba(26, 44, 78, 0.12)', padding: '0.6rem 0.8rem' }}>
    <div style={{ fontSize: '1rem', fontWeight: 500, color: WARNA.navy }}>{judul}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginTop: 4 }}>
      <span style={{ fontSize: '1.25rem', color: WARNA.abu }}>Jenjang {jenjang.kode}</span>
      <span style={{ fontSize: '1.3rem', fontWeight: 500, color: warna }}>{formatPersen(jenjang.pct)}</span>
    </div>
  </div>
)

/** Terbaik / perlu perhatian = tingkat pelunasan tertinggi / terendah; tampil kalau berbeda */
export const PembayaranPerJenjang = ({ data, qsFilter }: { data: JenjangRingkas[]; qsFilter: string }) => {
  if (data.length === 0) return <Kosong>Belum ada data.</Kosong>
  let terbaik:   JenjangRingkas | null = null
  let perhatian: JenjangRingkas | null = null
  for (const j of data) {
    if (j.pct === null) continue
    if (!terbaik   || j.pct > (terbaik.pct ?? 0))     terbaik = j
    if (!perhatian || j.pct < (perhatian.pct ?? 100)) perhatian = j
  }
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginTop: '0.5rem' }}>
        {data.map(j => (
          <Link key={j.kode} href={`/laporan/jenjang/${encodeURIComponent(j.kode)}${qsFilter}`} className="laporan-baris-tautan"
            style={{ display: 'block', padding: '0.5rem 0.6rem', margin: '0 -0.6rem', borderRadius: 8, textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.9rem', fontWeight: 500, color: WARNA.navy }}>
                Jenjang {j.kode} <ChevronRight size={13} aria-hidden />
              </span>
              <span title={fmt(j.tunggakan)} style={{ whiteSpace: 'nowrap', fontSize: '0.9rem', color: j.tunggakan > 0 ? WARNA.merah : WARNA.abuMuda }}>
                {formatRupiahRingkas(j.tunggakan)} tunggakan
              </span>
            </div>
            <BatangPersen persen={j.pct} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.4rem', fontSize: '0.9rem', color: WARNA.abuMuda }}>
              <UsersRound size={18} aria-hidden />
              {j.siswaDinilai === 0 ? 'Belum ada tagihan yang jatuh tempo' : `${j.siswaLunas} dari ${j.siswaDinilai} siswa lunas`}
            </span>
          </Link>
        ))}
      </div>
      {terbaik && perhatian && terbaik.kode !== perhatian.kode && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '1rem' }}>
          <KotakJenjang judul="Jenjang terbaik" jenjang={terbaik} warna={WARNA.hijau} />
          <KotakJenjang judul="Perlu perhatian" jenjang={perhatian} warna={WARNA.merah} />
        </div>
      )}
    </>
  )
}
