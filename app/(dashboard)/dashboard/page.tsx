'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Users, Calendar, Download,
  Clock, AlertTriangle, CheckCircle2, ChevronRight,
  Banknote, Gift, BookOpen, TrendingUp, TrendingDown,
  ClipboardCheck, Search,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ambilSemua } from '@/lib/ambilSemua'
import { buildPesanTagihanText, buildWaMeLink } from '@/lib/templates/waTagihan'
import { STATUS_TAGIHAN, lewatJatuhTempo, statusEfektif, tanpaKewajiban } from '@/lib/statusTagihan'
import { periodeIndex, TA_PERIODE_SELECT, type PeriodeTahunAjaran } from '@/lib/komponenTagihan'
import { SetupChecklist } from '@/components/SetupChecklist'
import { StatCard } from '@/components/StatCard'
import { FinanceCard } from '@/components/FinanceCard'
import { ChartCard } from '@/components/ChartCard'

// ── Constants ─────────────────────────────────────────────────────────────────

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const BULAN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const KOMPOSISI_COLORS = ['#1A2C4E', '#3B82F6', '#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6']

const JENJANG_MAP: Record<string, string[]> = {
  'TK/PAUD': ['A', 'B', 'C'],
  'SD/MI':   ['1', '2', '3', '4', '5', '6'],
  'SMP/MTs': ['7', '8', '9'],
  'SMA/MA':  ['10', '11', '12'],
  'SMK':     ['10', '11', '12'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rpCompact(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(2).replace('.', ',')} jt`
  if (n >= 1_000)         return `Rp ${Math.round(n / 1_000)}.000`
  return `Rp ${n}`
}

function rpFull(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function getLast6Months(): Array<{ bulan: string; tahun: number; short: string }> {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { bulan: BULAN_NAMES[d.getMonth()], tahun: d.getFullYear(), short: BULAN_SHORT[d.getMonth()] }
  })
}

function daysLeftInMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthUser { nama: string; jabatan: string; sekolah: string }

interface TagihanRaw {
  id:            string
  status:        'lunas' | 'belum_bayar' | 'cicilan'
  total_nominal: number
  bulan:         number
  tahun:         number
  jatuh_tempo:   string | null
  siswa_id:      string
  payment_token: string | null
  siswa: {
    id: string; nama: string; nis: string | null
    no_wa: string | null; nama_wali: string | null
    status: string | null
    kelas: { id: string; nama: string; warna: string; jenjang: string } | null
  } | null
}

interface BeasiswaProgRaw {
  jenis_potongan: 'persen' | 'nominal'
  persen:         number | null
  nominal:        number | null
  /** Komponen tagihan yang dicakup program — potongan hanya berlaku atas komponen ini */
  beasiswa_komponen: { komponen_id: string }[]
  beasiswa_siswa: { siswa_id: string; berlaku_sampai: string | null }[]
}

/** Rincian tagihan bulan berjalan per siswa — dasar hitungan potongan beasiswa */
interface RincianTagihanRaw {
  siswa_id:     string
  tagihan_item: { komponen_id: string | null; nominal: number }[]
}

interface PaketKomposisiRaw {
  paket_kelas:    { kelas_id: string }[]
  paket_komponen: { nominal: number; komponen: { nama: string; kelas_warna: string | null } | null }[]
}

interface TrenItem      { short: string; bulanTahun: string; berjalan: boolean; terkumpul: number; tunggakan: number }
interface KomposisiItem { nama: string; nominal: number; persen: number }
interface KelasItem     { nama: string; lunas: number; total: number }

interface Insight {
  id:           string
  level:        'merah' | 'amber' | 'hijau'
  judul:        string
  desc:         string
  sub?:         string
  actionLabel?: string
  actionHref?:  string
}

// Dua tahap berurutan setelah tahun ajaran berakhir: proses kenaikan kelas dulu,
// lalu pembuatan tahun ajaran baru.
type NaikKelasTahap = 'naik_kelas' | 'tahun_ajaran'

interface NaikKelasAlertData {
  tahap:           NaikKelasTahap
  tahunAjaranNama: string
  tanggalSelesai:  string
  totalSiswaAktif: number
  akanAlumni:      number
  maxJenjangLabel: string
  menunggak:       number
}

interface SiswaBayarRow {
  id:                       string
  nis:                      string
  nama:                     string
  kelas:                    { id: string; nama: string; warna: string; jenjang: string } | null
  tagihan_bulan_ini:        number
  status:                   'lunas' | 'belum_bayar' | 'cicilan'
  /** Per tagihan — jatuh tempo paket tiap kelas bisa berbeda dalam bulan yang sama */
  lewat_tempo:              boolean
  has_verifikasi_menunggu:  boolean
  no_wa:                    string | null
  nama_wali:                string | null
  payment_token:            string | null
}

interface DashData {
  totalSiswaAktif:   number
  totalKelas:        number
  tahunAjaranNama:   string
  totalTunggakan:    number
  siswaBelumBayar:   number
  totalSiswaRef:     number
  lunasRef:          number
  siswaMenunggak:    number
  terkumpulIni:      number
  terkumpulLalu:     number
  targetIni:         number
  belumBayarNominal: number
  belumBayarLalu:    number
  menungguVerifikasiNominal: number
  menungguVerifikasiCount:   number
  totalBeasiswaNom:  number
  penerimaBeasiswa:  number
  totalTagihanNom:   number
  trenData:          TrenItem[]
  komposisi:         KomposisiItem[]
  perKelas:          KelasItem[]
  insights:          Insight[]
  siswaBayarList:    SiswaBayarRow[]
}

// ── SVG: Bar Chart ─────────────────────────────────────────────────────────────

function BarChart({ data }: { data: TrenItem[] }) {
  // Hook harus dipanggil sebelum return bersyarat di bawah
  const [aktif, setAktif] = useState<number | null>(null)
  if (!data.length) return null
  const max    = Math.max(...data.map(d => Math.max(d.terkumpul, d.tunggakan)), 1)
  const bW     = 60
  const bGap   = 6
  const gGap   = 20
  const gW     = bW * 2 + bGap
  const cH     = 600
  const padX   = 12
  const chartW = padX * 2 + data.length * gW + (data.length - 1) * gGap
  const chartH = cH + 34
  // Pita per bulan = kelompok dua batang + separuh celah di kiri-kanannya, jadi saat
  // kursor bergeser antarbulan tidak ada titik mati tanpa tooltip
  const pitaX  = (i: number) => padX + i * (gW + gGap) - gGap / 2
  const pitaW  = gW + gGap

  const titikAktif = aktif === null ? null : data[aktif]

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setAktif(null)}>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 16 }}>
        {aktif !== null && (
          <rect x={pitaX(aktif)} y={0} width={pitaW} height={cH} fill="#F1F5F9" />
        )}
        {data.map((d, i) => {
          const x  = padX + i * (gW + gGap)
          const h1 = (d.terkumpul / max) * cH
          const h2 = (d.tunggakan / max) * cH
          return (
            <g key={d.short}>
              <rect x={x}             y={cH - h1} width={bW} height={Math.max(h1, 2)} rx={5} fill="#10B981" opacity={0.85} />
              <rect x={x + bW + bGap} y={cH - h2} width={bW} height={Math.max(h2, 2)} rx={5} fill="#EF4444" opacity={0.75} />
              <text x={x + bW}        y={cH + 28} textAnchor="middle" fontSize={20} fontWeight="semi-bold" fill="#3c3f45">{d.short}</text>
            </g>
          )
        })}

        {/* Area hover selebar pita bulan — lebih besar dari batangnya, termasuk label bulan */}
        {data.map((d, i) => (
          <rect key={`hit-${d.short}`}
            x={pitaX(i)} y={0} width={pitaW} height={chartH}
            fill="transparent" tabIndex={0} style={{ outline: 'none', cursor: 'default' }}
            aria-label={`${d.bulanTahun}: terkumpul ${rpFull(d.terkumpul)}, tunggakan ${rpFull(d.tunggakan)}`}
            onMouseEnter={() => setAktif(i)} onFocus={() => setAktif(i)} onBlur={() => setAktif(null)} />
        ))}
      </svg>

      {titikAktif && aktif !== null && (
        <div style={{
          position: 'absolute', top: 0, pointerEvents: 'none', whiteSpace: 'nowrap',
          left: `${((padX + aktif * (gW + gGap) + gW / 2) / chartW) * 100}%`,
          // Tooltip di bulan paling pinggir digeser ke dalam supaya tidak keluar kartu
          transform: aktif < 2 ? 'translateX(-12%)' : aktif > data.length - 3 ? 'translateX(-88%)' : 'translateX(-50%)',
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 6px 18px rgba(15,23,42,0.12)',
          padding: '0.55rem 0.7rem', minWidth: 190, fontSize: '0.8rem', zIndex: 5,
        }}>
          <div style={{ color: '#64748B', marginBottom: 6 }}>
            {titikAktif.bulanTahun}{titikAktif.berjalan ? ' · bulan berjalan' : ''}
          </div>
          {[
            { warna: '#10B981', nilai: titikAktif.terkumpul, label: 'terkumpul' },
            { warna: '#EF4444', nilai: titikAktif.tunggakan, label: 'tunggakan' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ width: 12, height: 2, borderRadius: 1, background: r.warna, flexShrink: 0 }} />
              <strong style={{ color: '#0F172A' }}>{rpFull(r.nilai)}</strong>
              <span style={{ color: '#64748B' }}>{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SVG: Donut Chart ──────────────────────────────────────────────────────────

function DonutChart({ items, total }: { items: KomposisiItem[]; total: number }) {
  const R  = 42
  const CX = 58
  const CY = 58
  const C  = 2 * Math.PI * R

  const totalLabel =
    total >= 1_000_000 ? (total / 1_000_000).toFixed(2).replace('.', ',') : total.toLocaleString('id-ID')

  type Seg = { i: number; dash: number; offset: number }

  // Immutable reduce — React Compiler forbids let-mutation inside render functions
  const segments: Seg[] = items.reduce<{ list: Seg[]; cum: number }>(
    ({ list, cum }, item, i) => {
      const dash   = (item.persen / 100) * C
      const offset = C * 0.25 - cum
      return { list: [...list, { i, dash, offset }], cum: cum + dash }
    },
    { list: [], cum: 0 },
  ).list

  return (
    <svg viewBox="0 0 116 116" style={{ width: 116, height: 116, flexShrink: 0 }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth={17} />
      {segments.map(({ i, dash, offset }) => (
        <circle
          key={i}
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={KOMPOSISI_COLORS[i % KOMPOSISI_COLORS.length]}
          strokeWidth={17}
          strokeDasharray={`${dash} ${C - dash}`}
          strokeDashoffset={offset}
        />
      ))}
      <text x={CX} y={CY - 3} textAnchor="middle" fontSize={11} fontWeight="800" fill="#0F172A">
        {totalLabel}
      </text>
      <text x={CX} y={CY + 11} textAnchor="middle" fontSize={8} fill="#6B7280">juta</text>
    </svg>
  )
}

// ── Data Loader ───────────────────────────────────────────────────────────────

async function loadDashData(sid: string, siswaTotal: number): Promise<DashData> {
  const now      = new Date()
  const bulanIni = now.getMonth() + 1        // 1–12
  const tahunIni = now.getFullYear()
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const bulanLalu = prevDate.getMonth() + 1
  const tahunLalu = prevDate.getFullYear()
  const last6    = getLast6Months()
  const today    = now.toISOString().split('T')[0]

  const [
    { count: kelasCount },
    { data: tagihanRaw },
    { data: beasiswaRaw },
    { data: paketRaw },
    { data: taData },
    { data: verifikasiRaw },
    { data: pembayaranRaw },
    { data: rincianBulanIni },
  ] = await Promise.all([
    supabase.from('kelas').select('id', { count: 'exact', head: true }),
    supabase
      .from('tagihan')
      .select('id, status, total_nominal, bulan, tahun, jatuh_tempo, siswa_id, payment_token, siswa:siswa_id(id, nama, nis, no_wa, nama_wali, status, kelas:kelas_id(id, nama, warna, jenjang))')
      .eq('sekolah_id', sid)
      .limit(2000),
    supabase
      .from('beasiswa')
      .select('jenis_potongan, persen, nominal, beasiswa_komponen(komponen_id), beasiswa_siswa(siswa_id, berlaku_sampai)')
      .eq('sekolah_id', sid)
      .eq('jenis', 'beasiswa'),
    supabase
      .from('paket')
      .select('paket_kelas(kelas_id), paket_komponen(nominal, komponen:komponen_id(nama, kelas_warna))')
      .eq('sekolah_id', sid),
    supabase.from('tahun_ajaran').select(`nama, ${TA_PERIODE_SELECT}`).eq('is_aktif', true).maybeSingle(),
    supabase.from('verifikasi_pembayaran').select('tagihan_id').eq('sekolah_id', sid).eq('status', 'menunggu').limit(2000),
    // Cicilan yang sudah masuk harus dikurangkan dari tunggakan — tanpa ini tagihan
    // yang sudah dibayar sebagian tetap terhitung penuh dan angkanya menggelembung
    supabase.from('pembayaran').select('tagihan_id, jumlah').eq('sekolah_id', sid).limit(5000),
    // Rincian tagihan bulan ini, untuk menghitung potongan beasiswa yang benar-benar
    // diberikan. Diambil bertahap supaya tidak terpotong di batas baris PostgREST.
    ambilSemua<RincianTagihanRaw>((dari, sampai) => supabase
      .from('tagihan')
      .select('id, siswa_id, tagihan_item(komponen_id, nominal)')
      .eq('sekolah_id', sid).eq('bulan', bulanIni).eq('tahun', tahunIni)
      .order('id').range(dari, sampai)),
  ])

  // Tagihan Rp 0 (beasiswa penuh) dibaca lunas oleh semua hitungan di bawah —
  // barisnya berstatus belum_bayar selamanya karena memang tidak ada yang dibayar
  const allTagihan = ((tagihanRaw ?? []) as TagihanRaw[])
    .map(t => (tanpaKewajiban(t.total_nominal) ? { ...t, status: 'lunas' as const } : t))
  const bsProgs    = (beasiswaRaw ?? []) as BeasiswaProgRaw[]
  const pakets     = (paketRaw ?? []) as unknown as PaketKomposisiRaw[]
  const verifikasiTagihanIds = new Set(((verifikasiRaw ?? []) as { tagihan_id: string }[]).map(v => v.tagihan_id))

  // ── Filter per bulan ───────────────────────────────────────────────────────
  const tagihanIni  = allTagihan.filter(t => t.bulan === bulanIni  && t.tahun === tahunIni)
  const tagihanLalu = allTagihan.filter(t => t.bulan === bulanLalu && t.tahun === tahunLalu)

  // ── Statistik bulan ini ────────────────────────────────────────────────────
  const lunasIni        = tagihanIni.filter(t => t.status === 'lunas')
  const totalSiswaRef   = tagihanIni.length
  const lunasRef        = lunasIni.length
  const siswaBelumBayar = tagihanIni.filter(t => t.status === 'belum_bayar').length
  const terkumpulIni    = lunasIni.reduce((s, t) => s + t.total_nominal, 0)
  const targetIni       = tagihanIni.reduce((s, t) => s + t.total_nominal, 0)
  const menungguVerifikasiRows = tagihanIni.filter(t => t.status !== 'lunas' && verifikasiTagihanIds.has(t.id))
  const menungguVerifikasiNominal = menungguVerifikasiRows.reduce((s, t) => s + t.total_nominal, 0)
  const menungguVerifikasiCount   = menungguVerifikasiRows.length
  const belumBayarNominal = tagihanIni
    .filter(t => t.status !== 'lunas' && !verifikasiTagihanIds.has(t.id))
    .reduce((s, t) => s + t.total_nominal, 0)

  // ── Statistik bulan lalu ───────────────────────────────────────────────────
  const terkumpulLalu   = tagihanLalu.filter(t => t.status === 'lunas').reduce((s, t) => s + t.total_nominal, 0)
  const belumBayarLalu  = tagihanLalu.filter(t => t.status !== 'lunas').reduce((s, t) => s + t.total_nominal, 0)

  // ── Tunggakan (tagihan yang jatuh temponya sudah lewat dan belum lunas) ────
  // Batas jatuh tempo dan sisa-setelah-dibayar mengikuti halaman laporan &
  // tagihan aktif supaya ketiganya menampilkan angka yang sama.
  const dibayarPerTagihan = new Map<string, number>()
  for (const p of ((pembayaranRaw ?? []) as { tagihan_id: string; jumlah: number }[])) {
    dibayarPerTagihan.set(p.tagihan_id, (dibayarPerTagihan.get(p.tagihan_id) ?? 0) + p.jumlah)
  }

  // "Total Tunggakan Aktif" dibatasi ke tahun ajaran yang sedang berjalan — tagihan
  // periode lama yang sudah diarsipkan tidak ikut menggelembungkan angkanya.
  // Rentangnya dibaca dari tanggal tahun ajaran, bukan kolom tagihan.tahun_ajaran,
  // karena baris lama terlanjur kosong di kolom itu.
  const taPeriode = taData as (PeriodeTahunAjaran & { nama: string }) | null
  const dalamPeriodeAktif = (bulan: number, tahun: number): boolean => {
    if (!taPeriode) return true
    const mulai   = new Date(taPeriode.tanggal_mulai)
    const selesai = new Date(taPeriode.tanggal_selesai)
    const idx     = periodeIndex(bulan, tahun)
    return idx >= periodeIndex(mulai.getMonth() + 1, mulai.getFullYear())
        && idx <= periodeIndex(selesai.getMonth() + 1, selesai.getFullYear())
  }

  // Menunggak ditentukan statusEfektif — sama persis dengan badge di tagihan aktif
  // dan donut di laporan. Cicilan sengaja tidak ikut: pembayarannya sedang berjalan
  // dan di kedua halaman itu pun berstatus Cicilan, bukan Menunggak.
  const tunggakanRows = allTagihan
    .filter(t => dalamPeriodeAktif(t.bulan, t.tahun))
    .filter(t => statusEfektif(
      t.status,
      lewatJatuhTempo(t, now),
      t.siswa?.status === 'alumni',
      t.total_nominal,
    ) === 'menunggak')
    .map(t => ({ ...t, sisa: t.total_nominal - (dibayarPerTagihan.get(t.id) ?? 0) }))
    .filter(t => t.sisa > 0)

  // "Lama" = tunggakan dari bulan-bulan sebelumnya saja — tagihan bulan berjalan
  // yang belum lewat tempo tidak ikut dihitung di sini, itu bagian belumBayarNominal.
  const tunggakanLamaRows    = tunggakanRows.filter(t => !(t.bulan === bulanIni && t.tahun === tahunIni))
  const tunggakanLamaNominal = tunggakanLamaRows.reduce((s, t) => s + t.sisa, 0)

  // Jumlah siswa menunggak dihitung dari SEMUA tagihan menunggak, termasuk bulan ini
  // yang sudah lewat jatuh tempo — sama dengan isi filter Menunggak di Tagihan Aktif,
  // tujuan tautan "Ingatkan sekarang". Nominalnya tetap dari tunggakan lama saja
  // supaya tidak terhitung dua kali dengan belumBayarNominal.
  const siswaMenunggak = new Set(tunggakanRows.map(t => t.siswa_id)).size

  // "Total Tunggakan Aktif" = kewajiban bulan ini yang belum dibayar + tunggakan
  // lama (bulan-bulan sebelumnya yang sudah lewat jatuh tempo), supaya angkanya
  // mencerminkan seluruh kewajiban aktif, bukan cuma yang sudah menunggak.
  const totalTunggakan = belumBayarNominal + tunggakanLamaNominal

  // ── Beasiswa ───────────────────────────────────────────────────────────────
  const activeBsSiswa    = bsProgs.flatMap(bs =>
    bs.beasiswa_siswa.filter(bss => !bss.berlaku_sampai || bss.berlaku_sampai >= today)
  )
  const penerimaBeasiswa = activeBsSiswa.length

  // Total beasiswa = potongan yang benar-benar diberikan pada tagihan bulan ini.
  // Aturannya sama dengan penerbitan tagihan (/api/recalculate-tagihan): potongan
  // berlaku per komponen yang dicakup program DAN memang ditagihkan bulan ini —
  // karena itu dibaca dari snapshot tagihan_item, bukan dari paket.
  // Sebelumnya hanya program bernominal tetap yang dihitung, sehingga program
  // persentase selalu tampil Rp 0.
  const rincianPerSiswa = new Map<string, Map<string, number>>()
  const brutoPerSiswa   = new Map<string, number>()
  for (const t of rincianBulanIni) {
    const komponen = rincianPerSiswa.get(t.siswa_id) ?? new Map<string, number>()
    for (const i of t.tagihan_item ?? []) {
      if (i.komponen_id) komponen.set(i.komponen_id, i.nominal)
      brutoPerSiswa.set(t.siswa_id, (brutoPerSiswa.get(t.siswa_id) ?? 0) + i.nominal)
    }
    rincianPerSiswa.set(t.siswa_id, komponen)
  }
  const potonganPerSiswa = new Map<string, number>()
  for (const bs of bsProgs) {
    for (const bss of bs.beasiswa_siswa) {
      if (bss.berlaku_sampai && bss.berlaku_sampai < today) continue
      const komponen = rincianPerSiswa.get(bss.siswa_id)
      if (!komponen) continue
      const potongan = (bs.beasiswa_komponen ?? []).reduce((s, { komponen_id }) => {
        const nominal = komponen.get(komponen_id)
        if (nominal === undefined) return s
        return s + (bs.jenis_potongan === 'persen' ? Math.round(nominal * (bs.persen ?? 0) / 100) : (bs.nominal ?? 0))
      }, 0)
      potonganPerSiswa.set(bss.siswa_id, (potonganPerSiswa.get(bss.siswa_id) ?? 0) + potongan)
    }
  }
  // Tagihan tidak bisa turun di bawah nol, jadi potongan dibatasi nilai rinciannya
  const totalBeasiswaNom = [...potonganPerSiswa].reduce(
    (s, [siswaId, potongan]) => s + Math.min(potongan, brutoPerSiswa.get(siswaId) ?? 0),
    0,
  )

  // ── Tren 6 bulan ──────────────────────────────────────────────────────────
  // Tunggakan tiap bulan = tagihan bulan itu yang belum lunas + tunggakan bulan-bulan
  // sebelumnya yang sampai sekarang belum dibayar. Bagian "sebelumnya" diambil dari
  // tunggakanRows — aturan yang sama dengan kartu "Total Tunggakan Aktif" — sehingga
  // batang bulan berjalan sama dengan angka di kartu itu. Polanya sama dengan
  // "Tagihan vs realisasi" di Laporan.
  const trenData: TrenItem[] = last6.map(({ short, bulan, tahun }, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1)
    const b = d.getMonth() + 1
    const y = d.getFullYear()
    const mRows = allTagihan.filter(t => t.bulan === b && t.tahun === y)
    const periode = periodeIndex(b, y)
    const tunggakanSebelumnya = tunggakanRows
      .filter(t => periodeIndex(t.bulan, t.tahun) < periode)
      .reduce((s, t) => s + t.sisa, 0)
    return {
      short,
      bulanTahun: `${bulan} ${tahun}`,
      berjalan:   idx === last6.length - 1,
      terkumpul: mRows.filter(t => t.status === 'lunas').reduce((s, t) => s + t.total_nominal, 0),
      tunggakan: mRows.filter(t => t.status !== 'lunas').reduce((s, t) => s + t.total_nominal, 0) + tunggakanSebelumnya,
    }
  })

  // ── Komposisi pemasukan per komponen (siswa lunas bulan ini) ───────────────
  const kelasKompMap = new Map<string, { nama: string; nominal: number }[]>()
  for (const paket of pakets) {
    const komps = paket.paket_komponen
      .filter(pk => pk.komponen)
      .map(pk => ({ nama: pk.komponen!.nama, nominal: pk.nominal }))
    for (const pk of paket.paket_kelas) {
      kelasKompMap.set(pk.kelas_id, komps)
    }
  }
  const kompMap = new Map<string, number>()
  for (const t of lunasIni) {
    const kelasId = t.siswa?.kelas?.id
    if (!kelasId) continue
    for (const k of kelasKompMap.get(kelasId) ?? []) {
      kompMap.set(k.nama, (kompMap.get(k.nama) ?? 0) + k.nominal)
    }
  }
  const totalKom = Math.max(Array.from(kompMap.values()).reduce((s, v) => s + v, 0), 1)
  const komposisi: KomposisiItem[] = Array.from(kompMap.entries())
    .map(([nama, nominal]) => ({ nama, nominal, persen: Math.round((nominal / totalKom) * 100) }))
    .sort((a, b) => b.persen - a.persen)
    .slice(0, 6)

  // ── Pembayaran per kelas ───────────────────────────────────────────────────
  const kelasAggMap = new Map<string, { nama: string; lunas: number; total: number }>()
  for (const t of tagihanIni) {
    const kelas = t.siswa?.kelas
    if (!kelas) continue
    const e = kelasAggMap.get(kelas.id) ?? { nama: kelas.nama, lunas: 0, total: 0 }
    e.total++
    if (t.status === 'lunas') e.lunas++
    kelasAggMap.set(kelas.id, e)
  }
  const perKelas: KelasItem[] = Array.from(kelasAggMap.values())
    .sort((a, b) => (b.total > 0 ? b.lunas / b.total : 0) - (a.total > 0 ? a.lunas / a.total : 0))
    .slice(0, 5)

  // ── Insights ───────────────────────────────────────────────────────────────
  const insights: Insight[] = []
  const pctIni    = totalSiswaRef > 0 ? (lunasRef / totalSiswaRef) * 100 : 0
  const bulanNama = BULAN_NAMES[now.getMonth()]

  const kelasRendah = perKelas.filter(k => k.total > 0 && k.lunas / k.total < 0.5)
  if (kelasRendah.length > 0) insights.push({
    id: 'kelas-rendah', level: 'merah',
    judul: 'Kelas bayar rendah',
    desc: `${kelasRendah.length} kelas memiliki tingkat pembayaran di bawah 50%.`,
    sub: kelasRendah.map(k => k.nama).join(' • '),
    actionLabel: 'Lihat Detail', actionHref: '/tagihan/aktif',
  })

  const sisa = daysLeftInMonth()
  if (sisa <= 5 && totalSiswaRef > 0 && pctIni < 80) insights.push({
    id: 'akhir-bulan', level: 'merah',
    judul: 'Akhir bulan kritis',
    desc: `Sisa ${sisa} hari, tingkat pembayaran baru ${Math.round(pctIni)}%.`,
    sub: 'Kirim pengingat massal ke siswa yang belum membayar.',
    actionLabel: 'Kirim Pengingat',
  })

  if (siswaMenunggak > 0) insights.push({
    id: 'tunggakan-lama', level: 'merah',
    judul: 'Tunggakan kritis',
    desc: `${tunggakanRows.length} tagihan sudah lewat jatuh tempo dan belum lunas.`,
    sub: `${siswaMenunggak} siswa berstatus menunggak.`,
    actionLabel: 'Kirim Pengingat',
  })

  if (penerimaBeasiswa > 0) insights.push({
    id: 'beasiswa-aktif', level: 'amber',
    judul: 'Beasiswa sedang berjalan',
    desc: `${penerimaBeasiswa} siswa sedang menerima program beasiswa.`,
    sub: 'Pastikan data penerima beasiswa sudah sesuai dan terkini.',
    actionLabel: 'Lihat Detail', actionHref: '/tagihan/beasiswa',
  })

  if (terkumpulLalu > 0 && terkumpulIni > terkumpulLalu * 1.05) {
    const pct = Math.round(((terkumpulIni - terkumpulLalu) / terkumpulLalu) * 100)
    insights.push({
      id: 'pemasukan-naik', level: 'hijau',
      judul: 'Pemasukan naik',
      desc: `Pemasukan bulan ini ${pct}% lebih tinggi dari bulan lalu.`,
      sub: `Dibandingkan ${BULAN_NAMES[prevDate.getMonth()]} ${tahunLalu}.`,
      actionLabel: 'Lihat Detail', actionHref: '/laporan',
    })
  }

  const kelas100 = perKelas.filter(k => k.total > 0 && k.lunas >= k.total)
  if (kelas100.length > 0) insights.push({
    id: 'kelas-100', level: 'hijau',
    judul: 'Kelas 100% Lunas',
    desc: `${kelas100.length} kelas sudah mencapai 100% pembayaran bulan ${bulanNama}.`,
    sub: kelas100.map(k => k.nama).join(' • '),
    actionLabel: 'Lihat Detail', actionHref: '/tagihan/aktif',
  })

  if (insights.length === 0) {
    if (tagihanIni.length === 0) {
      insights.push({
        id: 'belum-tagihan', level: 'amber',
        judul: 'Belum ada tagihan bulan ini',
        desc: `Tidak ada tagihan aktif untuk ${bulanNama} ${tahunIni}.`,
        sub: 'Buat tagihan baru untuk memulai monitoring pembayaran bulan ini.',
        actionLabel: 'Buat Tagihan', actionHref: '/tagihan/aktif',
      })
    } else if (pctIni >= 80) {
      insights.push({
        id: 'semua-baik', level: 'hijau',
        judul: 'Pembayaran berjalan baik',
        desc: `${Math.round(pctIni)}% siswa sudah membayar tagihan bulan ${bulanNama}.`,
        sub: `${lunasRef} dari ${totalSiswaRef} siswa lunas.`,
        actionLabel: 'Lihat Detail', actionHref: '/tagihan/aktif',
      })
    } else {
      insights.push({
        id: 'pembayaran-berjalan', level: 'amber',
        judul: 'Pembayaran sedang berlangsung',
        desc: `${Math.round(pctIni)}% siswa sudah membayar tagihan bulan ${bulanNama}.`,
        sub: `${totalSiswaRef - lunasRef} siswa belum membayar.`,
        actionLabel: 'Lihat Detail', actionHref: '/tagihan/aktif',
      })
    }
  }

  // ── Tabel status pembayaran siswa ──────────────────────────────────────────
  const siswaBayarList: SiswaBayarRow[] = tagihanIni
    .filter(t => t.siswa)
    .map(t => ({
      id:                      t.siswa!.id,
      nis:                     t.siswa!.nis ?? '-',
      nama:                    t.siswa!.nama,
      kelas:                   t.siswa!.kelas,
      tagihan_bulan_ini:       t.total_nominal,
      status:                  t.status,
      lewat_tempo:             lewatJatuhTempo(t, now),
      has_verifikasi_menunggu: t.status !== 'lunas' && verifikasiTagihanIds.has(t.id),
      no_wa:                   t.siswa!.no_wa,
      nama_wali:               t.siswa!.nama_wali,
      payment_token:           t.payment_token,
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))

  return {
    totalSiswaAktif:    siswaTotal,
    totalKelas:         kelasCount ?? 0,
    tahunAjaranNama:    (taData as { nama: string } | null)?.nama ?? '-',
    totalTunggakan,
    siswaBelumBayar,
    totalSiswaRef,
    lunasRef,
    siswaMenunggak,
    terkumpulIni,
    terkumpulLalu,
    targetIni,
    belumBayarNominal,
    belumBayarLalu,
    menungguVerifikasiNominal,
    menungguVerifikasiCount,
    totalBeasiswaNom,
    penerimaBeasiswa,
    totalTagihanNom: targetIni,
    trenData,
    komposisi,
    perKelas,
    insights,
    siswaBayarList,
  }
}

// ── Insight Card ──────────────────────────────────────────────────────────────

const INSIGHT_STYLE: Record<string, { border: string; bg: string; iconColor: string; badgeBg: string; badgeColor: string; label: string }> = {
  merah: { border: '#FCA5A5', bg: '#FFF5F5', iconColor: '#DC2626', badgeBg: '#FEE2E2', badgeColor: '#DC2626', label: 'Perlu Diperhatian' },
  amber: { border: '#FCD34D', bg: '#FFFBEB', iconColor: '#D97706', badgeBg: '#FEF3C7', badgeColor: '#D97706', label: 'Pengingat' },
  hijau: { border: '#6EE7B7', bg: '#F0FDF4', iconColor: '#059669', badgeBg: '#D1FAE5', badgeColor: '#059669', label: 'Kabar Baik' },
}

function InsightCard({ insight }: { insight: Insight }) {
  const st = INSIGHT_STYLE[insight.level]
  const Icon = insight.level === 'merah' ? AlertTriangle : insight.level === 'amber' ? Clock : CheckCircle2
  return (
    <div style={{
      background: st.bg,
      border: `1px solid ${st.border}`,
      borderRadius: 12,
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: st.badgeBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} color={st.iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: st.iconColor, marginBottom: 2 }}>{insight.judul}</div>
        <div style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.4 }}>{insight.desc}</div>
        {insight.sub && (
          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: 2 }}>{insight.sub}</div>
        )}
      </div>
      {insight.actionLabel && (
        insight.actionHref ? (
          <Link href={insight.actionHref} style={{
            background: st.iconColor, color: '#fff',
            border: 'none', borderRadius: 8, padding: '0.45rem 1rem',
            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            {insight.actionLabel} <ChevronRight size={13} />
          </Link>
        ) : (
          <button style={{
            background: st.iconColor, color: '#fff',
            border: 'none', borderRadius: 8, padding: '0.45rem 1rem',
            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {insight.actionLabel} <ChevronRight size={13} />
          </button>
        )
      )}
    </div>
  )
}

// ── Status Badge Siswa ────────────────────────────────────────────────────────

// Empat status inti mengikuti palet bersama di lib/statusTagihan agar seragam dengan
// halaman tagihan aktif dan laporan. Dua status sisanya khusus dashboard.
const STATUS_BADGE_MAP: Record<string, { bg: string; color: string; label: string }> = {
  lunas:               { ...STATUS_TAGIHAN.lunas },
  cicilan:             { ...STATUS_TAGIHAN.cicilan },
  belum_bayar:         { ...STATUS_TAGIHAN.belum_bayar },
  tunggakan:           { ...STATUS_TAGIHAN.menunggak, label: 'Tunggakan' },
  menunggu_verifikasi: { bg: '#EDE9FE', color: '#6D28D9', label: 'Menunggu Verifikasi' },
}

function StatusBadgeSiswa({ status }: { status: string }) {
  const s = STATUS_BADGE_MAP[status] ?? STATUS_BADGE_MAP.belum_bayar
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '0.3rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function buildPaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set<number>([1, 2])
  if (current > 1) set.add(current - 1)
  set.add(current)
  if (current < total) set.add(current + 1)
  set.add(total - 1)
  set.add(total)
  const sorted = Array.from(set).filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | '...')[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...')
    result.push(sorted[i])
  }
  return result
}

// ── Setup Berhasil Popup ──────────────────────────────────────────────────────

const SETUP_CSS = `
@keyframes sb-backdrop { from{opacity:0} to{opacity:1} }
@keyframes sb-card {
  0%   { opacity:0; transform:scale(0.78) translateY(40px) }
  65%  { opacity:1; transform:scale(1.03) translateY(-4px) }
  100% { opacity:1; transform:scale(1)    translateY(0)    }
}
@keyframes sb-circle {
  from { stroke-dashoffset:283 }
  to   { stroke-dashoffset:0   }
}
@keyframes sb-check {
  from { stroke-dashoffset:70 }
  to   { stroke-dashoffset:0  }
}
@keyframes sb-text {
  from { opacity:0; transform:translateY(12px) }
  to   { opacity:1; transform:translateY(0)    }
}
@keyframes sb-progress {
  from { width:100% }
  to   { width:0%   }
}
`

function SetupBerhasilPopup({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <>
      <style>{SETUP_CSS}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(8,16,34,0.65)',
        backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        animation: 'sb-backdrop 0.3s ease forwards',
      }} onClick={onClose}>
        <div style={{
          background: '#fff', borderRadius: 20,
          padding: '2.25rem 2rem 1.75rem',
          width: '100%', maxWidth: 400,
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
          animation: 'sb-card 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }} onClick={e => e.stopPropagation()}>

          {/* Progress bar auto-dismiss */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#F1F5F9' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg,#059669,#34D399)',
              animation: 'sb-progress 5s linear forwards',
            }} />
          </div>

          {/* Animated checkmark */}
          <div style={{ margin: '0 auto 1.25rem', width: 88, height: 88 }}>
            <svg viewBox="0 0 100 100" width={88} height={88}>
              <circle cx="50" cy="50" r="45" fill="none" stroke="#E2E8F0" strokeWidth="5" />
              <circle
                cx="50" cy="50" r="45"
                fill="none" stroke="#059669" strokeWidth="5.5" strokeLinecap="round"
                strokeDasharray="283" strokeDashoffset="283"
                transform="rotate(-90 50 50)"
                style={{ animation: 'sb-circle 0.65s cubic-bezier(0.4,0,0.2,1) 0.15s forwards' }}
              />
              <polyline
                points="27,51 42,66 74,34"
                fill="none" stroke="#059669" strokeWidth="5.5"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="70" strokeDashoffset="70"
                style={{ animation: 'sb-check 0.35s cubic-bezier(0.4,0,0.2,1) 0.68s forwards' }}
              />
            </svg>
          </div>

          <h2 style={{
            fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy-dark)',
            margin: '0 0 0.5rem', fontFamily: 'var(--font-dm-sans), sans-serif',
            animation: 'sb-text 0.4s ease 0.85s backwards',
          }}>
            Setup Berhasil!
          </h2>
          <p style={{
            fontSize: '0.875rem', color: 'var(--text-muted)',
            margin: '0 0 0.35rem', lineHeight: 1.6,
            animation: 'sb-text 0.4s ease 0.95s backwards',
          }}>
            SiKu sudah siap digunakan. Semua langkah setup telah selesai.
          </p>
          <p style={{
            fontSize: '0.8rem', color: 'var(--text-muted)',
            margin: '0 0 1.5rem', lineHeight: 1.5,
            animation: 'sb-text 0.4s ease 1.05s backwards',
          }}>
            Kamu bisa mulai membuat tagihan, mengelola siswa, dan memantau pembayaran dari dashboard ini.
          </p>
          <button
            onClick={onClose}
            style={{
              background: '#1A2C4E', color: '#fff', border: 'none',
              padding: '0.75rem 2rem', borderRadius: 10,
              fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
              fontFamily: 'inherit', width: '100%',
              animation: 'sb-text 0.4s ease 1.12s backwards',
            }}
          >
            Mulai Gunakan SiKu →
          </button>
        </div>
      </div>
    </>
  )
}

// ── Auth helpers (same pattern as layout.tsx) ────────────────────────────────

function getAuthRaw()       { return localStorage.getItem('siku_auth') }
function getAuthRawServer() { return null }

// ── Animasi masuk popup alert naik kelas ──────────────────────────────────────

const ALERT_CSS = `
@keyframes nk-backdrop { from { opacity:0 } to { opacity:1 } }
@keyframes nk-card {
  from { opacity:0; transform:scale(0.9) translateY(20px) }
  to   { opacity:1; transform:scale(1)   translateY(0)    }
}
@keyframes nk-icon {
  0%   { opacity:0; transform:scale(0.5) }
  70%  { opacity:1; transform:scale(1.08) }
  100% { opacity:1; transform:scale(1)   }
}
.nk-backdrop { animation: nk-backdrop 0.22s ease }
.nk-card     { animation: nk-card 0.34s cubic-bezier(0.34,1.56,0.64,1) }
.nk-icon     { animation: nk-icon 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.1s backwards }
@media (prefers-reduced-motion: reduce) {
  .nk-backdrop, .nk-card, .nk-icon { animation: none }
}
`

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [hasSiswa,          setHasSiswa]          = useState<boolean | null>(null)
  const [data,              setData]              = useState<DashData | null>(null)
  const [now,               setNow]               = useState(new Date())
  const [lastUpd,           setLastUpd]           = useState<Date | null>(null)
  const [showSetupBerhasil,  setShowSetupBerhasil]  = useState(false)
  const [naikKelasAlert,     setNaikKelasAlert]     = useState<NaikKelasAlertData | null>(null)
  const [showNaikKelasAlert, setShowNaikKelasAlert] = useState(false)
  const [tabAktif,           setTabAktif]           = useState<'semua' | 'belum_bayar' | 'cicilan' | 'lunas' | 'tunggakan' | 'menunggu_verifikasi'>('semua')
  const [searchQuery,       setSearchQuery]       = useState('')
  const [halamanTabel,      setHalamanTabel]      = useState(1)
  const [waSentSuccess,     setWaSentSuccess]     = useState<Set<string>>(new Set())
  const [ingatkanHover,     setIngatkanHover]     = useState(false)

  const sekolahIdRef = useRef<string | null>(null)
  const totalRef      = useRef(0)

  const raw  = useSyncExternalStore(
    (cb) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb) },
    getAuthRaw,
    getAuthRawServer,
  )
  const user: AuthUser | null = raw ? (JSON.parse(raw) as AuthUser) : null

  useEffect(() => {
    try {
      if (localStorage.getItem('siku_setup_berhasil') === '1') {
        localStorage.removeItem('siku_setup_berhasil')
        setTimeout(() => setShowSetupBerhasil(true), 0)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date())
      if (sekolahIdRef.current && totalRef.current > 0) {
        loadDashData(sekolahIdRef.current, totalRef.current)
          .then(d => { setData(d); setLastUpd(new Date()) })
          .catch(() => { /* biarkan data terakhir tetap tampil, coba lagi interval berikutnya */ })
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const load = async () => {
      // Ambil sekolah_id dari profile untuk filter eksplisit — jangan andalkan RLS saja
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('sekolah_id')
        .eq('id', authUser.id)
        .single()

      const sekolahId = profile?.sekolah_id
      if (!sekolahId) { setHasSiswa(false); return }
      sekolahIdRef.current = sekolahId

      const { data } = await supabase
        .from('pengaturan')
        .select('setup_steps')
        .eq('sekolah_id', sekolahId)
        .maybeSingle()

      const steps = data?.setup_steps as Record<string, boolean> | null
      const importSiswaDone = steps?.import_siswa === true

      if (!importSiswaDone) {
        setHasSiswa(false)
        return
      }

      // Setup selesai — hitung siswa aktif untuk tampilkan full dashboard
      const { count } = await supabase
        .from('siswa')
        .select('id', { count: 'exact', head: true })
        .eq('sekolah_id', sekolahId)
        .eq('status', 'aktif')

      const total = count ?? 0
      totalRef.current = total
      setHasSiswa(total > 0)

      // Cek apakah tahun ajaran sudah berakhir → tampilkan popup sesuai tahapnya
      try {
        const { data: taRow } = await supabase
          .from('tahun_ajaran')
          .select('nama, tanggal_selesai, kenaikan_kelas_pada')
          .eq('sekolah_id', sekolahId).eq('is_aktif', true).maybeSingle()

        if (taRow) {
          const selesai = new Date(taRow.tanggal_selesai)
          const today   = new Date(); today.setHours(0,0,0,0); selesai.setHours(0,0,0,0)

          // Inklusif: hari tanggal_selesai itu sendiri sudah dihitung selesai
          if (selesai <= today) {
            const tahap: NaikKelasTahap = taRow.kenaikan_kelas_pada ? 'tahun_ajaran' : 'naik_kelas'
            const dismissed = sessionStorage.getItem(`siku_alert_dismissed_${tahap}`) === '1'
            const base = {
              tahap,
              tahunAjaranNama: taRow.nama as string,
              tanggalSelesai:  taRow.tanggal_selesai as string,
              totalSiswaAktif: total,
            }

            if (!dismissed && tahap === 'naik_kelas') {
              const { data: pengRow } = await supabase
                .from('pengaturan').select('jenjang_sekolah').eq('sekolah_id', sekolahId).maybeSingle()
              const jenjangLevels = JENJANG_MAP[(pengRow as {jenjang_sekolah?:string}|null)?.jenjang_sekolah ?? 'SMP/MTs'] ?? JENJANG_MAP['SMP/MTs']
              const maxLevel = jenjangLevels[jenjangLevels.length - 1]

              const { data: siswaKelas } = await supabase
                .from('siswa').select('id, kelas:kelas_id(jenjang)')
                .eq('sekolah_id', sekolahId).eq('status', 'aktif').limit(2000)

              const akanAlumni = ((siswaKelas ?? []) as {kelas:{jenjang:string}|null}[])
                .filter(s => s.kelas?.jenjang === maxLevel).length

              const now2 = new Date()
              const { data: tagihanRows } = await supabase
                .from('tagihan').select('siswa_id, bulan, tahun, jatuh_tempo, total_nominal')
                .eq('sekolah_id', sekolahId).eq('status', 'belum_bayar').limit(5000)

              const menunggak = new Set(
                ((tagihanRows ?? []) as {siswa_id:string;bulan:number;tahun:number;jatuh_tempo:string|null;total_nominal:number}[])
                  .filter(t => !tanpaKewajiban(t.total_nominal) && lewatJatuhTempo(t, now2))
                  .map(t => t.siswa_id)
              ).size

              setNaikKelasAlert({ ...base, akanAlumni, maxJenjangLabel: maxLevel, menunggak })
              setShowNaikKelasAlert(true)
            } else if (!dismissed) {
              setNaikKelasAlert({ ...base, akanAlumni: 0, maxJenjangLabel: '', menunggak: 0 })
              setShowNaikKelasAlert(true)
            }
          }
        }
      } catch { /* non-blocking */ }

      if (total > 0) {
        loadDashData(sekolahId!, total)
          .then(d => { setData(d); setLastUpd(new Date()) })
          .catch(() => setData({
            totalSiswaAktif: total, totalKelas: 0, tahunAjaranNama: '-',
            totalTunggakan: 0, siswaBelumBayar: 0, totalSiswaRef: total,
            lunasRef: 0, siswaMenunggak: 0,
            terkumpulIni: 0,
            terkumpulLalu: 0, targetIni: 0, belumBayarNominal: 0,
            belumBayarLalu: 0, menungguVerifikasiNominal: 0, menungguVerifikasiCount: 0,
            totalBeasiswaNom: 0, penerimaBeasiswa: 0,
            totalTagihanNom: 0, trenData: [], komposisi: [], perKelas: [],
            siswaBayarList: [],
            insights: [{
              id: 'load-error', level: 'amber',
              judul: 'Gagal memuat data', desc: 'Terjadi kesalahan saat mengambil data dashboard.',
              sub: 'Coba refresh halaman atau periksa koneksi internet.',
            }],
          }))
      }
    }
    load()
  }, [])

  if (hasSiswa === null) {
    return (
      <div className="dashboard-content">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Memuat data...</span>
        </div>
      </div>
    )
  }

  if (!hasSiswa) {
    return (
      <div className="dashboard-content">
        <SetupChecklist />
      </div>
    )
  }

  // ── Computed values ─────────────────────────────────────────────────────────

  const dd       = String(now.getDate()).padStart(2, '0')
  const mName    = BULAN_NAMES[now.getMonth()]
  const yyyy     = now.getFullYear()
  const dateStr  = `${dd} ${mName} ${yyyy}`

  const d              = data
  // Badge di kartu tunggakan: proporsi siswa yang sudah bayar tagihan bulan ini
  const pctSudahBayar = d && d.totalSiswaRef > 0
    ? Math.round((d.lunasRef / d.totalSiswaRef) * 100)
    : 0
  const pctTarget      = d && d.targetIni > 0      ? Math.round((d.terkumpulIni / d.targetIni) * 100) : 0

  const diffTerkumpul  = d ? d.terkumpulIni - d.terkumpulLalu : 0
  const diffBelumBayar = d ? d.belumBayarNominal - d.belumBayarLalu : 0

  const merahInsights  = d?.insights.filter(i => i.level === 'merah') ?? []
  const amberInsights  = d?.insights.filter(i => i.level === 'amber') ?? []
  const hijauInsights  = d?.insights.filter(i => i.level === 'hijau') ?? []

  const loading = !d

  // ── Skeleton value helper ───────────────────────────────────────────────────
  const sk = (val: string) => loading ? '—' : val

  // ── Tabel siswa: filter + pagination ────────────────────────────────────────
  const siswaBayarList   = d?.siswaBayarList ?? []
  const filteredSiswa    = siswaBayarList.filter(s => {
    const isTunggakan = s.lewat_tempo && s.status === 'belum_bayar'
    const eff = s.has_verifikasi_menunggu ? 'menunggu_verifikasi' : isTunggakan ? 'tunggakan' : s.status
    if (tabAktif !== 'semua') {
      if (tabAktif === 'tunggakan' && !isTunggakan) return false
      if (tabAktif === 'menunggu_verifikasi' && !s.has_verifikasi_menunggu) return false
      if (tabAktif !== 'tunggakan' && tabAktif !== 'menunggu_verifikasi' && eff !== tabAktif) return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return s.nama.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q) || (s.kelas?.nama.toLowerCase().includes(q) ?? false)
    }
    return true
  })
  const TABEL_PAGE_SIZE = 10
  const totalHalaman    = Math.max(1, Math.ceil(filteredSiswa.length / TABEL_PAGE_SIZE))
  const paginatedSiswa  = filteredSiswa.slice((halamanTabel - 1) * TABEL_PAGE_SIZE, halamanTabel * TABEL_PAGE_SIZE)

  const fmtTgl = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  // ── Kirim pengingat WA ───────────────────────────────────────────────────────
  const kirimWA = (s: SiswaBayarRow) => {
    if (!s.no_wa) return
    const paymentUrl = s.payment_token
      ? `${window.location.origin}/bayar/${s.payment_token}`
      : undefined
    const content = buildPesanTagihanText({
      namaWali:     s.nama_wali ?? '',
      namaSiswa:    s.nama,
      kelasNama:    s.kelas?.nama ?? '-',
      totalNominal: s.tagihan_bulan_ini,
      bulan:        now.getMonth() + 1,
      tahun:        yyyy,
      namaSekolah:  user?.sekolah,
      paymentUrl,
    })

    window.open(buildWaMeLink(s.no_wa, content), '_blank', 'noopener,noreferrer')
    setWaSentSuccess(prev => new Set(prev).add(s.id))
    setTimeout(() => setWaSentSuccess(prev => { const next = new Set(prev); next.delete(s.id); return next }), 3000)
  }

  return (
    <>

    {/* ── Popup Alert Naik Kelas ─────────────────────────────────────────────── */}
    {showNaikKelasAlert && naikKelasAlert && (
      <>
      <style>{ALERT_CSS}</style>
      <div className="nk-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div className="nk-card" style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', padding: '2rem 2rem 1.5rem' }}>

          {/* Icon + judul */}
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div className="nk-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, marginBottom: '1rem' }}>
              <svg viewBox="0 0 64 64" width="72" height="72" fill="none">
                <path d="M32 4L58 54H6L32 4Z" fill="#FEE2E2" stroke="#EF4444" strokeWidth="3" strokeLinejoin="round"/>
                <path d="M32 24V38" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round"/>
                <circle cx="32" cy="46" r="2.2" fill="#EF4444"/>
              </svg>
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0F172A', marginBottom: '0.5rem' }}>
              {naikKelasAlert.tahap === 'naik_kelas' ? 'Tahun ajaran telah selesai' : 'Belum ada tahun ajaran baru'}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: 1.65 }}>
              {naikKelasAlert.tahap === 'naik_kelas' ? (
                <>
                  Tahun ajaran <strong style={{ color: '#0F172A' }}>{naikKelasAlert.tahunAjaranNama}</strong> resmi berakhir pada{' '}
                  <strong style={{ color: '#0F172A' }}>{fmtTgl(naikKelasAlert.tanggalSelesai)}</strong>.<br />
                  Saatnya memproses kenaikan kelas untuk seluruh siswa
                </>
              ) : (
                <>
                  Kenaikan kelas untuk tahun ajaran <strong style={{ color: '#0F172A' }}>{naikKelasAlert.tahunAjaranNama}</strong> sudah dijalankan.<br />
                  Buat tahun ajaran baru agar periode ini pindah ke Riwayat
                </>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: '#F1F5F9', marginBottom: '1.25rem' }} />

          {/* Stats card — hanya relevan pada tahap kenaikan kelas */}
          {naikKelasAlert.tahap === 'naik_kelas' && (
          <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', marginBottom: '0.875rem' }}>
            {[
              { label: 'Total siswa aktif',  value: `${naikKelasAlert.totalSiswaAktif} siswa`,                              icon: <Users size={16} color="#6982a4" /> },
              { label: 'Akan jadi alumni',   value: `${naikKelasAlert.akanAlumni} siswa kelas ${naikKelasAlert.maxJenjangLabel}`, icon: <BookOpen size={16} color="#64748B" /> },
              { label: 'Masih ada tunggakan',value: `${naikKelasAlert.menunggak} siswa`,                                    icon: <AlertTriangle size={16} color="#F59E0B" /> },
            ].map((row, i) => (
              <div key={i}>
                {i > 0 && <div style={{ height: 1, background: '#F1F5F9' }} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>{row.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }}>{row.value}</span>
                    {row.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Info note */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.5 }}>
              ⓘ Pengingat ini akan muncul kembali saat kamu login berikutnya sampai{' '}
              {naikKelasAlert.tahap === 'naik_kelas'
                ? 'proses kenaikan kelas selesai dijalankan'
                : 'tahun ajaran baru dibuat dan diaktifkan'}
            </span>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { sessionStorage.setItem(`siku_alert_dismissed_${naikKelasAlert.tahap}`, '1'); setShowNaikKelasAlert(false) }}
              style={{ padding: '0.65rem 1.5rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', color: '#475569', fontFamily: 'inherit' }}
            >
              Tutup
            </button>
            <Link
              href={naikKelasAlert.tahap === 'naik_kelas' ? '/siswa/naik-kelas' : '/tagihan/tahun-ajaran'}
              onClick={() => setShowNaikKelasAlert(false)}
              style={{ padding: '0.65rem 1.5rem', borderRadius: 10, border: 'none', background: '#1A2C4E', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
            >
              <ChevronRight size={15} />
              {naikKelasAlert.tahap === 'naik_kelas' ? 'Mulai Proses Kenaikan Kelas' : 'Buat Tahun Ajaran Baru'}
            </Link>
          </div>
        </div>
      </div>
      </>
    )}

    <div className="dashboard-content">

      {/* ── 1. Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: '#1A2C4E',
        borderRadius: '0 0 16px 16px',
        padding: '1.25rem 1.75rem',
        margin: '-1.5rem 0 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        boxShadow: '0 2px 8px rgba(26, 44, 78, 0.7)',
      }}>
        {/* Left */}
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
            Selamat Datang, {user?.nama ?? '—'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', flexShrink: 0, boxShadow: '0 0 6px #22C55E' }} />
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>
              {user?.jabatan ?? ''}{user?.jabatan && user?.sekolah ? ' – ' : ''}{user?.sekolah ?? ''}
            </span>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#A3CDFE', border: '1px solid #A3CDFE',
            color: '#1A2C4E', borderRadius: 10, padding: '0.45rem 0.85rem',
            fontSize: '0.8rem', fontWeight: 600,
          }}>
            <Calendar size={13} />
            {dateStr}
          </div>

          <button className="btn-export btn-export--disabled" style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', borderRadius:10 }}>
            <Download size={13} />
            Export Laporan
          </button>

          <button
            disabled
            title="Fitur pengingat massal belum tersedia — gunakan tombol Ingatkan per siswa di tabel bawah"
            onMouseEnter={() => setIngatkanHover(true)}
            onMouseLeave={() => setIngatkanHover(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: ingatkanHover ? '#94A3B8' : '#22C55E', color: '#fff',
              border: 'none', borderRadius: 10, padding: '0.45rem 0.85rem',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'not-allowed',
              fontFamily: 'inherit', opacity: ingatkanHover ? 0.75 : 1,
              transition: 'background 0.15s, opacity 0.15s',
            }}>
            <Image src="/icons/IconWA.png" width={25} height={25} alt="WhatsApp" />
            Ingatkan
          </button>
        </div>
      </div>

      {/* ── 2. Card Total Tunggakan ─────────────────────────────────────────── */}
      <div style={{
        marginTop: '2rem',
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: '1rem',
        boxShadow: '0 4px 9px rgba(45, 92, 145, 0.52)',
      }}>
        {/* Body */}
        <div style={{ display: 'flex', padding: '1.5rem', gap: '1.25rem', position: 'relative' }}>
          {/* Watermark */}
          <AlertTriangle
            size={130}
            className="watermark-float"
            style={{ position: 'absolute', right: 400, top: '50%', color: '#e16060', pointerEvents: 'none' }}
          />

          {/* Left */}
          <div style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              background: '#1A2C4E', color: '#ffffff',
              padding: '6px 12px', borderRadius: 20,
              fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.03em',
              marginBottom: '0.65rem',
              boxShadow: '0 6px 10px rgba(92, 135, 184, 0.67)',
            }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5A5A', animation: 'dot-pulse-glow 1.6s ease-in-out infinite' }} />
              Total Tunggakan Aktif
            </div>

            <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1.5, marginBottom: '0.6rem', letterSpacing: '-0.02em', borderBottom: '5px solid #1A2C4E', paddingBottom: '0.25rem', display: 'inline-block' }}>
              {sk(rpFull(d?.totalTunggakan ?? 0))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', position: 'relative', top: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '1rem', fontWeight: 500, color: '#1A2C4E' }}>
                <Users size={16} />
                {sk(`${d?.siswaBelumBayar ?? 0} Siswa belum bayar`)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '1rem', fontWeight: 500, color: '#1A2C4E' }}>
                <Clock size={16} />
                {lastUpd ? (() => {
                  const menit = Math.floor((now.getTime() - lastUpd.getTime()) / 60_000)
                  if (menit < 1)  return 'Baru saja diperbarui'
                  if (menit <= 60) return `${menit} menit yang lalu`
                  return `Diperbarui ${lastUpd.getHours()}:${String(lastUpd.getMinutes()).padStart(2, '0')}`
                })() : 'Memuat...'}
              </span>
            </div>
          </div>

          {/* Right: % badge */}
          <div style={{
            background: '#1A2C4E',
            borderRadius: 12,
            minWidth: 138,
            textAlign: 'center',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            boxShadow: '0 6px 10px rgba(92, 135, 184, 0.67)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '12px',
              background: '#F7DD7D',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 4, fontSize: '0.9rem', position: 'relative', bottom: 13,
              marginLeft: '7rem',
            }}>
              <Image src="/icons/IconDollar.png" alt="Lunas" width={20} height={20} />
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#fff', marginTop: '-1.7rem', marginLeft: '-1.5rem' }}>
              {sk(`${pctSudahBayar}%`)}
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F788A' }}>Siswa sudah bayar</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F788A', marginLeft: '-0.2rem' }}>
              {sk(`${d?.lunasRef ?? 0} dari ${d?.totalSiswaRef ?? 0} siswa`)}
            </div>
          </div>
        </div>

        {/* Bottom alert strip */}
        <div style={{
          background: '#DE6666',
          padding: '0.6rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#fff', fontSize: '1rem', fontWeight: 600 }}>
            <AlertTriangle size={16} />
            {d?.siswaMenunggak ? `${d.siswaMenunggak} Siswa berstatus menunggak` : 'Periksa status tunggakan siswa'}
          </div>
          <Link href="/tagihan/aktif?status=menunggak" style={{
            color: '#fff', fontSize: '1rem', fontWeight: 700,
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
            opacity: 0.9, whiteSpace: 'nowrap',
          }}>
            Ingatkan sekarang <ChevronRight size={20} />
          </Link>
        </div>
      </div>

      {/* ── 3. Row 1: Stats cards ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 230px) 1fr', gap: '1.2rem', marginBottom: '1.3rem', marginTop: '2rem' }}>

        <StatCard title="Total siswa aktif" value={sk(String(d?.totalSiswaAktif ?? 0))} icon={Users} />
        <StatCard title="Kelas aktif" value={sk(String(d?.totalKelas ?? 0))} icon={BookOpen} />
        <StatCard title="Tahun ajaran aktif" value={sk((d?.tahunAjaranNama ?? '-').replace(/(\d{4})\/(\d{4})/, (_, y1, y2: string) => `${y1}/${y2.slice(2)}`))} icon={Calendar} valueStyle={{ marginLeft: '-1.8rem', marginTop: '0.2rem', fontSize: '2.2rem' }} />

        {/* Target Pembayaran */}
        <div style={{ background: '#fff', borderRadius: 13, padding: '0.6rem 1.25rem', boxShadow: '0 4px 8px rgba(92, 135, 184, 0.67)',}}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1A2C4E', letterSpacing: '0.05em', display: 'flex', alignItems: 'center' }}>
              <Image src="/icons/IconTarget.png" alt="Target" width={30} height={16} style={{ marginRight: 8 }} />
              Target Pembayaran – {mName} {yyyy}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          </div>
          <div style={{ background: '#E5E7EB', borderRadius: 6, height: 20, overflow: 'hidden', marginBottom: 5, position: 'relative' }}>
            <div style={{ background: 'linear-gradient(90deg,#6366F1,#818CF8)', height: '100%', width: `${pctTarget}%`, borderRadius: 6, transition: 'width 0.6s ease', position: 'absolute', left: 0, top: 0 }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, fontSize: '0.8rem', fontWeight: 600, color: '#1A2C4E', zIndex: 1 }}>
              {pctTarget}%
            </div>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{sk(`${d?.lunasRef ?? 0} siswa sudah lunas`)}</span>
            <span>{sk(`Tersisa ${(d?.totalSiswaRef ?? 0) - (d?.lunasRef ?? 0)}`)}</span>
          </div>
        </div>
      </div>

      {/* ── 4. Row 2: Financial cards ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>

        <FinanceCard
          title="Terkumpul bulan ini"
          value={sk(rpCompact(d?.terkumpulIni ?? 0))}
          valueColor="#69C183"
          info={
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, color: diffTerkumpul >= 0 ? '#69C183' : '#DE6666' }}>
              {diffTerkumpul >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {d && d.terkumpulLalu > 0 ? `${Math.abs(Math.round((diffTerkumpul / d.terkumpulLalu) * 100))}% siswa sudah lunas` : '—'}
            </div>
          }
          progress={pctTarget}
          progressColor="#69C183"
          progressLabel={`${pctTarget}%`}
        />

        <FinanceCard
          title="Belum dibayar"
          value={sk(rpCompact(d?.belumBayarNominal ?? 0))}
          valueColor="#DE6666"
          info={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, color: diffBelumBayar > 0 ? '#DE6666' : '#69C183' }}>
                {diffBelumBayar > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {d && d.belumBayarLalu > 0 ? `${diffBelumBayar > 0 ? 'Naik' : 'Turun'} ${rpCompact(Math.abs(diffBelumBayar))} dari bulan lalu` : '—'}
              </div>
              {d && d.menungguVerifikasiNominal > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 700, color: '#D97706' }}>
                  <Clock size={11} />
                  {rpCompact(d.menungguVerifikasiNominal)} menunggu verifikasi
                </div>
              )}
            </div>
          }
          progress={100 - pctTarget}
          progressColor="#DE6666"
          progressLabel={`${100 - pctTarget}%`}
        />

        <FinanceCard
          title="Total beasiswa"
          value={sk(rpCompact(d?.totalBeasiswaNom ?? 0))}
          valueColor="#BB8848"
          info={d && d.penerimaBeasiswa > 0
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 700, color: '#BB8848' }}>
                <Gift size={11} />
                {d.penerimaBeasiswa} penerima aktif
              </div>
            : undefined
          }
          progress={d && d.totalTagihanNom > 0 ? Math.min(Math.round((d.totalBeasiswaNom / d.totalTagihanNom) * 100), 100) : 0}
          progressColor="#BB8848"
          progressLabel={d && d.totalTagihanNom > 0 ? `${Math.round((d.totalBeasiswaNom / d.totalTagihanNom) * 100)}%` : '—'}
          progressSub="dari total tagihan"
        />
      </div>

      {/* ── 5. Row 3: Chart cards ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <Link href="/laporan" style={{
            position: 'absolute', top: '0.6rem', right: '1rem', zIndex: 1,
            fontSize: '0.8rem', fontWeight: 600, color: '#1A2C4E',
            textDecoration: 'none', opacity: 0.65,
          }}>
            Laporan →
          </Link>
          <ChartCard title="Tren Tagihan Bulanan" subtitle="6 bulan terakhir" style={{ flex: 1 }}>
            <div style={{ marginTop: 'auto' }}>
              {d?.trenData.length ? <BarChart data={d.trenData} /> : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '1rem' }}>Belum ada data</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10B981', flexShrink: 0 }} /> Terkumpul
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#EF4444', flexShrink: 0 }} /> Tunggakan
              </div>
            </div>
          </ChartCard>
        </div>

        <ChartCard
          title="Komposisi Pemasukan"
          subtitle={`Per komponen tagihan · ${mName}`}
        >
          {d?.komposisi.length ? (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <DonutChart items={d.komposisi} total={d.terkumpulIni} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {d.komposisi.map((item, i) => (
                  <div key={item.nama} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: KOMPOSISI_COLORS[i % KOMPOSISI_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nama}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--navy-dark)', flexShrink: 0 }}>{item.persen}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>Belum ada data</div>
          )}
        </ChartCard>

        <ChartCard
          title="Pembayaran per Kelas"
          subtitle="% siswa lunas bulan ini"
          style={{ minHeight: 320 }}
        >
          {d?.perKelas.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {d.perKelas.map((kelas, i) => {
                const pct = kelas.total > 0 ? Math.round((kelas.lunas / kelas.total) * 100) : 0
                const colors = ['#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444']
                return (
                  <div key={kelas.nama}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                        {kelas.nama.startsWith('Kelas') ? kelas.nama : `Kelas ${kelas.nama}`}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{kelas.total} siswa</span>
                    </div>
                    <div style={{ background: '#E5E7EB', borderRadius: 4, height: 7, overflow: 'hidden' }}>
                      <div style={{ background: colors[i % colors.length], height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{pct}%</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>Belum ada data kelas</div>
          )}
        </ChartCard>
      </div>

      {/* ── 6. Insights ─────────────────────────────────────────────────────── */}
      {(merahInsights.length > 0 || amberInsights.length > 0 || hijauInsights.length > 0) && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>

          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Banknote size={15} color="var(--navy)" />
            Insight &amp; Notifikasi
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {merahInsights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            {amberInsights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            {hijauInsights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
          </div>
        </div>
      )}

      {/* ── 7. Tabel Status Pembayaran Siswa ────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '2px 2px 8px 8px rgba(45,91,145,0.10)', marginTop: '1.5rem' }}>

        {/* Tab header + Search bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.2rem', marginBlock: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex' }}>
            {([
              { key: 'semua',               label: 'Semua' },
              { key: 'belum_bayar',         label: 'Belum Bayar' },
              { key: 'cicilan',             label: 'Cicilan' },
              { key: 'lunas',               label: 'Lunas' },
              { key: 'menunggu_verifikasi', label: 'Menunggu Verifikasi' },
            ] as const).map(tab => {
              const active = tabAktif === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => { setTabAktif(tab.key); setHalamanTabel(1) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0.5rem 0.9rem',
                    fontSize: '1rem', fontWeight: active ? 700 : 600,
                    color: active ? '#1A2C4E' : '#1A2C4E',
                    fontFamily: 'inherit',
                    borderBottom: active ? '2.5px solid #1A2C4E' : '2.5px solid transparent',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', border: '3px solid #BABFC7', borderRadius: 14, padding: '0.45rem 0.85rem', minWidth: 260, fontWeight: 500, color: '#6F788A' }}>
            <Search size={18} color="#94A3B8" />
            <input
              type="text"
              placeholder="Cari nama siswa, NIS, atau kelas..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setHalamanTabel(1) }}
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: '0.82rem', color: '#1A2C4E', flex: 1, fontFamily: 'inherit', minWidth: 0 }}
            />
          </div>
        </div>

        {/* Tabel */}
        <div style={{ overflowX: 'auto', padding: '0 1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1A2C4E' }}>
                {(['No', 'NIS', 'Nama', 'Kelas', 'Tagihan Bulan Ini', 'Status', 'Aksi'] as const).map((col, idx, arr) => (
                  <th key={col} style={{
                    padding: '0.6rem 1rem',
                    textAlign: (col === 'No' || col === 'Aksi') ? 'center' : 'left',
                    fontSize: '1rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
                    borderRadius: idx === 0 ? '8px 0 0 8px' : idx === arr.length - 1 ? '0 8px 8px 0' : undefined,
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8', fontSize: '0.88rem' }}>
                    Memuat data...
                  </td>
                </tr>
              ) : paginatedSiswa.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8', fontSize: '0.88rem' }}>
                    {searchQuery ? 'Tidak ada siswa yang cocok dengan pencarian.' : 'Belum ada data tagihan siswa bulan ini.'}
                  </td>
                </tr>
              ) : paginatedSiswa.map((siswa, i) => {
                const effStatus = siswa.has_verifikasi_menunggu
                  ? 'menunggu_verifikasi'
                  : (siswa.lewat_tempo && siswa.status === 'belum_bayar') ? 'tunggakan' : siswa.status
                return (
                  <tr key={siswa.id} /* style={{ borderBottom: '1px solid #F1F5F9' }} */>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'center', fontSize: '0.85rem', color: '#6B7280' }}>
                      {(halamanTabel - 1) * TABEL_PAGE_SIZE + i + 1}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.85rem', color: '#374151' }}>
                      {siswa.nis}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.85rem', fontWeight: 500, color: '#1A2C4E' }}>
                      {siswa.nama}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      {siswa.kelas ? (
                        <span style={{
                          background: `${siswa.kelas.warna}22`,
                          color: siswa.kelas.warna,
                          border: `1.5px solid ${siswa.kelas.warna}`,
                          borderRadius: 8,
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.78rem', fontWeight: 700,
                        }}>
                          {siswa.kelas.nama}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.85rem', color: '#1A2C4E', fontWeight: 500 }}>
                      {rpFull(siswa.tagihan_bulan_ini)}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <StatusBadgeSiswa status={effStatus} />
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'center' }}>
                      {effStatus === 'lunas' ? (
                        <ClipboardCheck size={22} color="#16A34A" />
                      ) : effStatus === 'menunggu_verifikasi' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#D97706', fontSize: '0.78rem', fontWeight: 700 }}>
                          <Clock size={16} /> Diproses
                        </span>
                      ) : siswa.no_wa ? (
                        <button
                          onClick={() => kirimWA(siswa)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: waSentSuccess.has(siswa.id) ? '#16A34A' : '#22C55E', color: '#fff',
                            border: 'none', borderRadius: 10, padding: '0.45rem 0.85rem',
                            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}>
                          <Image src="/icons/IconWA.png" width={25} height={25} alt="WhatsApp" />
                          {waSentSuccess.has(siswa.id) ? 'Terkirim!' : 'Ingatkan'}
                        </button>
                      ) : (
                        <span style={{ color: '#CBD5E1', fontSize: '0.8rem' }}>No. WA belum diisi</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalHalaman > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '1rem 1.5rem', borderTop: '1px solid #F1F5F9' }}>
            <button
              onClick={() => setHalamanTabel(h => Math.max(1, h - 1))}
              disabled={halamanTabel === 1}
              style={{ background: 'none', border: '1px solid #909090', borderRadius: 8, padding: '0.35rem 0.7rem', cursor: halamanTabel === 1 ? 'not-allowed' : 'pointer', color: halamanTabel === 1 ? '#909090' : '#1A2C4E', fontFamily: 'inherit', fontSize: '0.9rem' }}
            >
              ←
            </button>
            {buildPaginationPages(halamanTabel, totalHalaman).map((p, i) =>
              p === '...'
                ? <span key={`dots-${i}`} style={{ color: '#94A3B8', padding: '0 0.2rem', fontSize: '0.85rem' }}>···</span>
                : (
                  <button
                    key={p}
                    onClick={() => setHalamanTabel(p)}
                    style={{
                      background: halamanTabel === p ? '#1A2C4E' : 'none',
                      color: halamanTabel === p ? '#fff' : '#1A2C4E',
                      border: `1px solid ${halamanTabel === p ? '#1A2C4E' : '#909090'}`,
                      borderRadius: 8, padding: '0.35rem 0.65rem',
                      fontSize: '0.85rem', fontWeight: halamanTabel === p ? 700 : 500,
                      cursor: 'pointer', fontFamily: 'inherit', minWidth: 36,
                    }}
                  >
                    {p}
                  </button>
                )
            )}
            <button
              onClick={() => setHalamanTabel(h => Math.min(totalHalaman, h + 1))}
              disabled={halamanTabel === totalHalaman}
              style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.35rem 0.7rem', cursor: halamanTabel === totalHalaman ? 'not-allowed' : 'pointer', color: halamanTabel === totalHalaman ? '#CBD5E1' : '#1A2C4E', fontFamily: 'inherit', fontSize: '0.9rem' }}
            >
              →
            </button>
          </div>
        )}

      </div>

    </div>

    {showSetupBerhasil && (
      <SetupBerhasilPopup onClose={() => setShowSetupBerhasil(false)} />
    )}
    </>
  )
}
