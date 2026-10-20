'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation'
import { Search, AlertTriangle, Eye, X, ClipboardList, GraduationCap, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { polaIlike } from '@/lib/polaCari'
import { ambilPerPotong, ambilSemua } from '@/lib/ambilSemua'
import { runGenerate } from '@/lib/generateTagihan'
import { bolehDihitungUlang, hitungUlangTagihan, type PotonganBeasiswa } from '@/lib/hitungUlangTagihan'
import { muatRingkasanPeriode, RINGKASAN_PERIODE_KOSONG, type BulanTahun, type RingkasanPeriode } from '@/lib/ringkasanPeriode'
import { pesanPenahanTerbit, statusPenerbitan, type PesanPenahan } from '@/lib/statusPenerbitan'
import { masihBersisa, muatTertagih, rincianSisa, sisaTagihan, tagihanTautan, tagihanTertagih, tunggakanSebelum, type TagihanBayar, type TagihanSisa } from '@/lib/tagihanTertagih'
import { bagiKeTagihan, bagiPerUnit, kunciUnit, labelUnit, rincianKomponen, tagihanBukti, unitBayar } from '@/lib/rincianKomponen'
import { buildPesanTagihanText, buildPesanTunggakanText, buildWaMeLink } from '@/lib/templates/waTagihan'
import { STATUS_TAGIHAN, URUTAN_STATUS, statusEfektif, lewatJatuhTempo, batasJatuhTempo, formatJatuhTempo } from '@/lib/statusTagihan'
import {
  JENIS_LABEL, JENIS_WARNA, periodeIndex,
  bangunRiwayatTagih, TA_PERIODE_SELECT, type PeriodeTahunAjaran,
} from '@/lib/komponenTagihan'
import { usePengingat } from '@/lib/usePengingat'
import { TombolIngatkan } from '@/components/TombolIngatkan'
import { TandaTerkirim, tandaKirim } from '@/components/TandaTerkirim'
import { Blok, BlokTeks, giliran } from '@/components/skeleton/Blok'
import { SkeletonTagihanAktif } from '@/components/skeleton/SkeletonTagihan'
import { usePengingatManual } from '@/lib/usePengingatManual'

// ── Constants ─────────────────────────────────────────────────────────────────

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

/** Nilai khusus dropdown tingkat untuk menyaring siswa yang sudah lulus */
const FILTER_ALUMNI = 'Alumni'

/** Jeda paling pendek antara dua permintaan hitung ulang total ke server */
const JEDA_HITUNG_ULANG_MS = 10_000

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(nama: string): string {
  const parts = nama.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (nama.slice(0, 2)).toUpperCase()
}

/** "Agustus–Oktober 2026", atau "Juli 2026–Februari 2027" kalau tahunnya berbeda */
function labelRentang(awal: BulanTahun | null, akhir: BulanTahun | null): string {
  if (!awal || !akhir) return ''
  const ujung = `${BULAN_NAMES[akhir.bulan]} ${akhir.tahun}`
  if (awal.bulan === akhir.bulan && awal.tahun === akhir.tahun) return ujung
  return awal.tahun === akhir.tahun
    ? `${BULAN_NAMES[awal.bulan]}–${ujung}`
    : `${BULAN_NAMES[awal.bulan]} ${awal.tahun}–${ujung}`
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface SiswaTagihanRow {
  tagihan_id:    string
  siswa_id:      string
  nis:           string
  nama:          string
  kelas_id:      string
  kelas_nama:    string
  kelas_jenjang: string
  kelas_warna:   string
  /** Siswa sudah lulus — kelas_id-nya null, kelas terakhir diambil dari snapshot teks */
  is_alumni:     boolean
  total_nominal: number
  /** Sisa tagihan bulan ini sesudah pembayaran; 0 kalau lunas atau Rp 0 */
  sisa_bulan_ini: number
  /** Yang ditagih halaman bayar lewat payment_token (lib/tagihanTertagih); 0 kalau tidak ada yang bersisa */
  total_ditagih: number
  /** Sisa tunggakan periode sebelumnya (lihat tunggakanSebelum); > 0 berarti Menunggak */
  tunggakan:     number
  /** Rincian tunggakan per bulan, terlama dulu — untuk pesan pengingat WhatsApp */
  tunggakanDaftar: TunggakanBulan[]
  status:        'belum_bayar' | 'lunas' | 'cicilan'
  /** Snapshot dari paket kelas saat tagihan dibuat — tiap kelas bisa berbeda */
  jatuh_tempo:   string | null
  no_wa:         string
  nama_wali:     string
  /** Token tagihan terbaru yang belum lunas — bulan ini, atau tunggakan terbaru kalau bulan ini sudah lunas */
  payment_token: string
}

type KelasNestedRaw    = { id: string; nama: string; jenjang: string; warna: string }
type SiswaNestedRaw    = { id: string; nama: string; nis: string | null; no_wa: string | null; nama_wali: string | null; status: string | null; kelas_terakhir: string | null; kelas: KelasNestedRaw | null }
type TagihanItemRaw    = { id: string; komponen_id: string | null; nominal: number; potongan: number }
type TagihanRawRow     = { id: string; total_nominal: number; status: string; jatuh_tempo: string | null; payment_token: string | null; tagihan_item: TagihanItemRaw[]; siswa: SiswaNestedRaw | null }
type RiwayatRow        = { siswa_id: string; bulan: number; tahun: number; tagihan_item: { komponen_id: string | null }[] }
type TunggakanRaw      = { id: string; siswa_id: string; status: string; bulan: number; tahun: number; jatuh_tempo: string | null; total_nominal: number; payment_token: string | null; siswa: { status: string | null } | null }
/** Tagihan siswa yang belum lunas beserta sisanya, bahan lib/tagihanTertagih */
type TagihanSiswaSisa  = TagihanSisa & { payment_token: string | null }
type BeasiswaSiswaRaw  = { siswa_id: string; beasiswa: { jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null; beasiswa_komponen: { komponen_id: string }[] } | null }
type IndividuSiswaRaw  = { siswa_id: string; komponen_id: string; nominal: number; komponen: { nama: string; jenis: string } | null }
type PaketNominalRaw   = { paket_kelas: { kelas_id: string }[]; paket_komponen: { komponen_id: string; nominal: number }[] }
type CatatSiswaResult  = { id: string; nama: string; nis: string | null; no_wa: string | null; nama_wali: string | null; kelas: { id: string; nama: string; warna: string } | null }
type PembayaranRow     = { id: string; jumlah: number; metode: string; tanggal_bayar: string; catatan: string | null; alokasi: unknown }
/** Tagihan bulan ini di modal Catat Pembayaran — untuk ringkasan dan riwayatnya */
type CatatTagihanRow   = { id: string; total_nominal: number; status: string; bulan: number; tahun: number }
type DetailBeasiswaRow = { nama: string | null; jenis: string; keterangan: string | null; jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null }

/** Label badge potongan: nama program beasiswa, atau alasan potongan personal (yang tidak punya nama) */
const labelPotongan = (bs: DetailBeasiswaRow): string =>
  bs.jenis === 'beasiswa'
    ? bs.nama?.trim() || 'Beasiswa'
    : bs.keterangan?.trim() || 'Potongan personal'
type DetailKomponenRow = { id: string; nama_komponen: string; nominal: number; potongan: number; jenis: string }
/**
 * Satu baris rincian di modal detail. Untuk tagihan yang berincian per komponen, setiap
 * baris adalah komponen beserta sisanya; untuk tagihan yang dibayar utuh, komponen apa
 * adanya lalu baris potongan beasiswa dan yang sudah dibayar (lib/tagihanTertagih rincianSisa).
 */
type BarisRincianDetail = {
  nama_komponen: string
  jenis:         string
  /** Nominal di rincian tagihan, sebelum potongan */
  nominal:       number
  potongan:      number
  terbayar:      number
  /** Yang masih harus dibayar dari baris ini; negatif untuk baris potongan / sudah dibayar */
  sisa:          number
  baris:         'komponen' | 'potongan' | 'tambahan' | 'dibayar'
}
/** Tunggakan satu bulan di modal detail, terlama dulu */
type TunggakanDetail = { tagihan_id: string; bulan: number; tahun: number; sisa: number; perKomponen: boolean; baris: BarisRincianDetail[] }
type TunggakanBulan    = { bulan: number; tahun: number; sisa: number }

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = STATUS_TAGIHAN

type EffectiveStatus = keyof typeof STATUS_CONFIG

/**
 * Baca preset filter dari query string. `allowed` membatasi nilai yang diterima —
 * tanpa itu nilai apa pun diterima apa adanya (dipakai jenjang, yang daftarnya dinamis).
 *
 * Sumbernya useSearchParams, bukan window.location: pada navigasi <Link> App Router,
 * URL di window baru diperbarui setelah komponen tujuan dirender, sehingga preset
 * terbaca kosong. Lewat <a href> biasa tidak terasa karena halamannya dimuat ulang.
 */
function readParam(sp: ReadonlyURLSearchParams, key: string, allowed?: Record<string, unknown>): string {
  const val = sp.get(key)
  if (!val) return 'Semua'
  return !allowed || val in allowed ? val : 'Semua'
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

interface DonutSegment { value: number; color: string }

function DonutChart({ segments, total, label }: { segments: DonutSegment[]; total: number; label: string }) {
  const R = 38; const CX = 50; const CY = 50; const C = 2 * Math.PI * R
  const totalVal = segments.reduce((s, seg) => s + seg.value, 0) || 1

  type Seg = { i: number; dash: number; offset: number; color: string }
  const computed = segments.reduce<{ list: Seg[]; cum: number }>(
    ({ list, cum }, seg, i) => {
      const dash   = (seg.value / totalVal) * C
      const offset = C * 0.25 - cum
      return { list: [...list, { i, dash, offset, color: seg.color }], cum: cum + dash }
    },
    { list: [], cum: 0 },
  ).list

  return (
    <svg viewBox="0 0 100 100" style={{ width: 140, height: 140, flexShrink: 0 }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth={13} />
      {computed.map(({ i, dash, offset, color }) => (
        <circle key={i} cx={CX} cy={CY} r={R} fill="none"
          stroke={color} strokeWidth={13}
          strokeDasharray={`${dash} ${C - dash}`}
          strokeDashoffset={offset}
        />
      ))}
      <text x={CX} y={CY - 2} textAnchor="middle" fontSize={14} fontWeight="800" fill="#0F172A">{total}</text>
      <text x={CX} y={CY + 12} textAnchor="middle" fontSize={7.5} fill="#6B7280">{label}</text>
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// useSearchParams wajib berada di bawah batas Suspense, kalau tidak build gagal
// saat Next mencoba melakukan prerender statis halaman ini.
export default function TagihanAktifPage() {
  return (
    <Suspense fallback={<SkeletonTagihanAktif />}>
      <TagihanAktifContent />
    </Suspense>
  )
}

function TagihanAktifContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // Jam berjalan supaya jatuh tempo, hitung mundur, dan status menunggak ikut
  // bergeser sendiri saat tanggal berganti — tanpa perlu refresh manual
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const bulanIni = now.getMonth() + 1
  const tahunIni = now.getFullYear()

  const [loading,        setLoading]        = useState(true)
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [autoGenError,   setAutoGenError]   = useState('')
  const [namaSekolah,    setNamaSekolah]    = useState('')
  const [hasPaket,       setHasPaket]       = useState(false)
  const [sekolahId,      setSekolahId]      = useState('')
  const [tahunAjaran,    setTahunAjaran]    = useState('')
  const [syncing,        setSyncing]        = useState(false)
  // Filter bisa dipreset lewat URL, mis. /tagihan/aktif?status=menunggak&jenjang=9.
  // Dibaca sekali saat inisialisasi supaya bendahara tetap bebas mengubah dropdown.
  const [filterJenjang,     setFilterJenjang]     = useState(() => readParam(searchParams, 'jenjang'))
  const [filterStatus,      setFilterStatus]      = useState(() => readParam(searchParams, 'status', STATUS_CONFIG))
  const [searchQuery,       setSearchQuery]       = useState('')
  const [tagihanList,       setTagihanList]       = useState<SiswaTagihanRow[]>([])
  // Isi card "Total tagihan periode ini" — seluruh periode, bukan hanya bulan berjalan
  const [ringkasanPeriode,  setRingkasanPeriode]  = useState<RingkasanPeriode>(RINGKASAN_PERIODE_KOSONG)
  const [waSentSuccess,     setWaSentSuccess]     = useState<Set<string>>(new Set())
  // Terisi kalau ada siswa aktif yang tagihan bulan ini tertahan (mis. ada kelas tanpa paket)
  const [penahanTerbit,     setPenahanTerbit]     = useState<{ belumDitagih: number; pesan: PesanPenahan } | null>(null)

  // Modal state
  const [showCatatModal,  setShowCatatModal]  = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  // Konfirmasi "Ingatkan semua" — hanya untuk sekolah yang memakai antrean pengingat
  const [showIngatkanSemua, setShowIngatkanSemua] = useState(false)
  const [detailSiswa,     setDetailSiswa]     = useState<SiswaTagihanRow | null>(null)

  // Modal 1 — Catat Pembayaran
  const [catatQuery,     setCatatQuery]     = useState('')
  const [catatResults,   setCatatResults]   = useState<CatatSiswaResult[]>([])
  const [catatSelected,  setCatatSelected]  = useState<CatatSiswaResult | null>(null)
  const [catatTagihan,   setCatatTagihan]   = useState<CatatTagihanRow | null>(null)
  const [catatRiwayat,   setCatatRiwayat]   = useState<PembayaranRow[]>([])
  // Yang bisa dibayar: tunggakan sebelumnya (terlama dulu), lalu bulan ini kalau masih
  // bersisa — muatTertagih, sama dengan halaman bayar wali
  const [catatDaftar,    setCatatDaftar]    = useState<TagihanBayar[]>([])
  const [catatMuat,      setCatatMuat]      = useState<'memuat' | 'siap' | 'gagal'>('memuat')
  // Yang dicentang (kunciUnit): satu komponen, atau satu tagihan yang dibayar utuh
  const [catatDipilih,   setCatatDipilih]   = useState<Set<string>>(new Set())
  const [catatGalat,     setCatatGalat]     = useState('')
  const [catatJumlah,    setCatatJumlah]    = useState('')
  const [catatTanggal,   setCatatTanggal]   = useState('')
  const [catatMetode,    setCatatMetode]    = useState<'tunai' | 'transfer' | 'qris'>('tunai')
  const [catatCatatan,   setCatatCatatan]   = useState('')
  const [catatSearching, setCatatSearching] = useState(false)
  const [catatSaving,    setCatatSaving]    = useState(false)

  // Modal 2/3 — Detail extras
  const [detailBeasiswa,   setDetailBeasiswa]   = useState<DetailBeasiswaRow[]>([])
  const [detailKomponen,   setDetailKomponen]   = useState<DetailKomponenRow[]>([])
  const [detailTunggakan,  setDetailTunggakan]  = useState<TunggakanDetail[]>([])
  const [detailPembayaran, setDetailPembayaran] = useState<PembayaranRow[]>([])
  const [detailPaketNama,  setDetailPaketNama]  = useState('')
  const [detailLoading,    setDetailLoading]    = useState(false)

  // Pemulihan rincian hanya boleh dicoba sekali per kunjungan — realtime sync
  // memanggil loadTagihan berulang kali dan tanpa pagar ini repair akan
  // dipicu terus-menerus
  const perbaikanRincianRef = useRef(false)
  // Keadaan terakhir yang sudah dimintakan hitung ulang ke server, dan kapan. Keadaan yang
  // sama tidak diminta dua kali (server yang gagal memperbaikinya tidak dipanggil
  // terus-menerus), dan permintaan berikutnya ditahan beberapa detik: selama server masih
  // menulis, tiap perubahan memicu muat ulang yang melihat keadaan setengah jadi.
  const permintaanHitungUlangRef = useRef({ tanda: '', waktu: 0 })
  // Naik tiap siswa dipilih atau modal Catat ditutup: hasil muat untuk siswa sebelumnya
  // yang datang belakangan tidak boleh menimpa pilihan yang sekarang
  const catatMuatRef = useRef(0)

  // ── loadTagihan ─────────────────────────────────────────────────────────────

  // Total tagihan yang sudah terbit dihitung dari snapshot tagihan_item, bukan
  // diturunkan ulang dari paket. Hanya tagihan bulan berjalan yang belum lunas yang
  // nominal rinciannya mengikuti paket + komponen individu hari ini (lib/hitungUlangTagihan,
  // diputuskan 20 Okt 2026); tagihan lunas dan bulan-bulan lalu tetap seperti terbit.
  const loadTagihan = useCallback(async function load(sid: string, bulan: number, tahun: number): Promise<SiswaTagihanRow[]> {
    const [{ data: tagihanData }, riwayatRes, { data: taPeriode, error: eTa }, { data: tunggakanData }] = await Promise.all([
      supabase
        .from('tagihan')
        // kelas_terakhir: alias kolom teks `siswa.kelas` — snapshot kelas terakhir alumni.
        // Perlu di-alias karena `kelas` sudah dipakai sebagai alias relasi kelas_id.
        .select('id, total_nominal, status, jatuh_tempo, payment_token, tagihan_item(id, komponen_id, nominal, potongan), siswa:siswa_id(id, nama, nis, no_wa, nama_wali, status, kelas_terakhir:kelas, kelas:kelas_id(id, nama, jenjang, warna))')
        .eq('sekolah_id', sid)
        .eq('bulan', bulan)
        .eq('tahun', tahun)
        .order('created_at', { ascending: false })
        .limit(500),
      // Riwayat penagihan seluruh periode, diambil bertahap sampai habis: satu permintaan
      // terpotong diam-diam di batas baris PostgREST
      ambilSemua<RiwayatRow>((dari, sampai) => supabase
        .from('tagihan')
        .select('siswa_id, bulan, tahun, tagihan_item(komponen_id)')
        .eq('sekolah_id', sid)
        .order('id')
        .range(dari, sampai)),
      supabase
        .from('tahun_ajaran').select(`nama, ${TA_PERIODE_SELECT}`).eq('sekolah_id', sid).eq('is_aktif', true).maybeSingle(),
      // Tagihan periode sebelumnya yang belum lunas, bahan tunggakan per siswa — cicilan
      // ikut, sisanya dihitung sesudah pembayarannya dimuat. Diambil bertahap: status
      // Menunggak bergantung pada daftar ini, dan satu permintaan bisa diam-diam
      // terpotong di batas baris PostgREST.
      ambilSemua<TunggakanRaw>((dari, sampai) => supabase
        .from('tagihan')
        .select('id, siswa_id, status, bulan, tahun, jatuh_tempo, total_nominal, payment_token, siswa:siswa_id(status)')
        .eq('sekolah_id', sid)
        .neq('status', 'lunas')
        .or(`tahun.lt.${tahun},and(tahun.eq.${tahun},bulan.lt.${bulan})`)
        .order('id')
        .range(dari, sampai)),
    ])

    const riwayat = bangunRiwayatTagih(riwayatRes.data)
    const ta = (taPeriode ?? null) as (PeriodeTahunAjaran & { nama: string }) | null

    const sekarang = new Date()
    const rows     = (tagihanData ?? []) as unknown as TagihanRawRow[]

    // Tagihan tanpa rincian sama sekali tidak bisa ditambal dari sini — insert
    // tagihan_item untuk baris milik siswa lain tertahan RLS. Serahkan ke
    // /api/recalculate-tagihan yang memakai service role, lalu muat ulang.
    if (!perbaikanRincianRef.current && rows.some(r => (r.tagihan_item ?? []).length === 0)) {
      perbaikanRincianRef.current = true
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/recalculate-tagihan', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      }).catch(() => null)
      if (res?.ok) return load(sid, bulan, tahun)
    }

    // ── Total yang seharusnya ─────────────────────────────────────────────────
    // Aturannya di lib/hitungUlangTagihan, sama dengan /api/recalculate-tagihan: hanya
    // tagihan bulan berjalan yang belum lunas yang dihitung ulang. Tagihan lunas tampil
    // apa adanya.
    const sasaran  = rows.filter(r => bolehDihitungUlang({ bulan, tahun, status: r.status }, bulan, tahun))
    const siswaIds = sasaran.map(r => r.siswa?.id).filter(Boolean) as string[]
    const today    = new Date().toISOString().split('T')[0]

    // Daftar siswa dipecah per potongan: ratusan id dalam satu URL ditolak server
    const [bsRes, individuRes, paketRes, bayarRes, buktiRes] = await Promise.all([
      ambilPerPotong<BeasiswaSiswaRaw>(siswaIds, (ids, dari, sampai) => supabase
        .from('beasiswa_siswa')
        .select('siswa_id, beasiswa:beasiswa_id(jenis_potongan, persen, nominal, beasiswa_komponen(komponen_id))')
        .in('siswa_id', ids)
        .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${today}`)
        .order('id')
        .range(dari, sampai)),
      ambilPerPotong<IndividuSiswaRaw>(siswaIds, (ids, dari, sampai) => supabase
        .from('siswa_komponen_individu')
        .select('siswa_id, komponen_id, nominal, komponen:komponen_id(jenis)')
        .in('siswa_id', ids)
        .order('id')
        .range(dari, sampai)),
      // Nominal paket kelas hari ini — dasar nominal rincian bulan ini, dan penentu apakah
      // komponen individu mengganti nominal paket atau ditambahkan
      supabase
        .from('paket')
        .select('paket_kelas(kelas_id), paket_komponen(komponen_id, nominal)')
        .eq('sekolah_id', sid)
        .eq('tahun_ajaran', ta?.nama ?? '')
        .limit(100),
      // Tagihan yang sudah punya pembayaran / bukti menunggu tidak dirapikan rinciannya —
      // syarat yang sama dengan /api/recalculate-tagihan
      ambilPerPotong<{ tagihan_id: string }>(sasaran.map(r => r.id), (ids, dari, sampai) => supabase
        .from('pembayaran')
        .select('id, tagihan_id')
        .in('tagihan_id', ids)
        .order('id')
        .range(dari, sampai)),
      ambilSemua<{ tagihan_id: string; pilihan: unknown }>((dari, sampai) => supabase
        .from('verifikasi_pembayaran')
        .select('id, tagihan_id, pilihan')
        .eq('sekolah_id', sid)
        .eq('status', 'menunggu')
        .order('id')
        .range(dari, sampai)),
    ])
    const adaPembayaran = new Set([
      ...bayarRes.data.map(p => p.tagihan_id),
      ...buktiRes.data.flatMap(tagihanBukti),
    ])

    const kelasPaketMap = new Map<string, { komponen_id: string; nominal: number }[]>()
    for (const p of (paketRes.data ?? []) as unknown as PaketNominalRaw[]) {
      for (const pk of p.paket_kelas) kelasPaketMap.set(pk.kelas_id, p.paket_komponen)
    }

    const siswaBeasiswaMap = new Map<string, PotonganBeasiswa[]>()
    for (const row of bsRes.data) {
      if (!row.beasiswa) continue
      const list = siswaBeasiswaMap.get(row.siswa_id) ?? []
      list.push({ jenis_potongan: row.beasiswa.jenis_potongan, persen: row.beasiswa.persen, nominal: row.beasiswa.nominal, komponen_ids: new Set(row.beasiswa.beasiswa_komponen.map(bk => bk.komponen_id)) })
      siswaBeasiswaMap.set(row.siswa_id, list)
    }

    type IndividuEntry = { komponen_id: string; jenis: string; nominal: number }
    const siswaIndividuMap = new Map<string, IndividuEntry[]>()
    for (const row of individuRes.data) {
      if (!row.komponen) continue
      const list = siswaIndividuMap.get(row.siswa_id) ?? []
      list.push({ komponen_id: row.komponen_id, jenis: row.komponen.jenis, nominal: row.nominal })
      siswaIndividuMap.set(row.siswa_id, list)
    }

    // Kalau ada pembacaan yang gagal, total yang tersimpan ditampilkan apa adanya.
    // Menghitung dari data separuh berarti menampilkan tagihan tanpa potongan beasiswa
    // — dan meminta server menuliskannya.
    const dataLengkap = !riwayatRes.error && !eTa && !bsRes.error && !individuRes.error && !paketRes.error
      && !bayarRes.error && !buktiRes.error

    // tagihan id → total yang seharusnya
    const totalSeharusnya = new Map<string, number>()
    const belumSesuai: string[] = []
    if (dataLengkap) {
      for (const r of sasaran) {
        const siswaId = r.siswa?.id ?? ''
        const hasil = hitungUlangTagihan({
          siswaId, bulan, tahun, totalTersimpan: r.total_nominal,
          rincian:  r.tagihan_item ?? [],
          individu: siswaIndividuMap.get(siswaId) ?? [],
          paket:    kelasPaketMap.get(r.siswa?.kelas?.id ?? '') ?? [],
          beasiswa: siswaBeasiswaMap.get(siswaId) ?? [],
          ta, riwayat,
          rapikan:  r.status === 'belum_bayar' && !adaPembayaran.has(r.id),
        })
        if (hasil.total === null) continue
        totalSeharusnya.set(r.id, hasil.total)
        // Nominal & potongan per komponen yang belum tertulis, dan baris yang harus dibuang —
        // potongan yang tertinggal membuat tagihan itu hanya bisa dibayar utuh di halaman
        // bayar wali. Server juga yang menuliskannya.
        const buang = new Set(hasil.buang)
        const rincianBeda = hasil.buang.length + (r.tagihan_item ?? []).filter((it, i) => !buang.has(i) && (
          (hasil.nominal[i] !== undefined && hasil.nominal[i] !== it.nominal) ||
          (hasil.potongan[i] !== undefined && hasil.potongan[i] !== it.potongan))).length
        if (hasil.total !== r.total_nominal || hasil.susulan.length > 0 || rincianBeda > 0) {
          belumSesuai.push(`${r.id}:${hasil.total}:${hasil.susulan.length}:${rincianBeda}`)
        }
      }
    }

    // Halaman ini tidak menulis total sendiri. Komponen individu susulan harus ikut
    // dicatat ke tagihan_item, dan itu tertahan RLS dari sini — total yang berubah tanpa
    // rinciannya membuat komponen itu ditagihkan lagi bulan depan. Jadi server yang
    // diminta menghitung ulang, lalu data dimuat ulang. Diminta sekali per keadaan:
    // kalau server tidak bisa memperbaikinya, keadaan yang sama tidak diminta lagi dan
    // tabel menampilkan hasil hitungan di atas.
    const tanda    = belumSesuai.sort().join(',')
    const terakhir = permintaanHitungUlangRef.current
    if (tanda && tanda !== terakhir.tanda && Date.now() - terakhir.waktu > JEDA_HITUNG_ULANG_MS) {
      permintaanHitungUlangRef.current = { tanda, waktu: Date.now() }
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/recalculate-tagihan', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      }).catch(() => null)
      if (res?.ok) return load(sid, bulan, tahun)
    }

    // Dimuat sesudah koreksi total di atas tertulis, supaya nilai bulan ini di
    // ringkasan periode sama dengan yang tampil di tabel
    const ringkasanPromise = muatRingkasanPeriode(sid, ta, bulan, tahun)

    // Pembayaran tagihan yang belum lunas — bulan ini dan periode sebelumnya — untuk sisanya
    const pembayaranRes = await ambilPerPotong<{ tagihan_id: string; jumlah: number }>(
      [...rows.filter(r => r.status !== 'lunas').map(r => r.id), ...tunggakanData.map(t => t.id)],
      (ids, dari, sampai) => supabase
        .from('pembayaran')
        .select('id, tagihan_id, jumlah')
        .in('tagihan_id', ids)
        .order('id')
        .range(dari, sampai),
    )
    const terbayar = new Map<string, number>()
    for (const p of pembayaranRes.data) terbayar.set(p.tagihan_id, (terbayar.get(p.tagihan_id) ?? 0) + p.jumlah)

    // siswa_id → tagihan periode sebelumnya yang belum lunas, beserta sisanya
    const lamaPerSiswa = new Map<string, TagihanSiswaSisa[]>()
    for (const { siswa, siswa_id, ...t } of tunggakanData) {
      const daftar = lamaPerSiswa.get(siswa_id) ?? []
      daftar.push({ ...t, is_alumni: siswa?.status === 'alumni', terbayar: terbayar.get(t.id) ?? 0 })
      lamaPerSiswa.set(siswa_id, daftar)
    }

    const result: SiswaTagihanRow[] = rows.map(r => {
      const siswaId = r.siswa?.id ?? ''
      const kelas   = r.siswa?.kelas
      const ini: TagihanSiswaSisa = {
        id: r.id, bulan, tahun, jatuh_tempo: r.jatuh_tempo, status: r.status,
        total_nominal: totalSeharusnya.get(r.id) ?? r.total_nominal,
        is_alumni:     r.siswa?.status === 'alumni',
        terbayar:      terbayar.get(r.id) ?? 0,
        payment_token: r.payment_token,
      }
      // Aturannya lib/tagihanTertagih, sama dengan halaman bayar wali: tunggakan = sisa
      // total_nominal (sesudah potongan beasiswa, bukan jumlah tagihan_item) dari bulan-
      // bulan sebelumnya, termasuk sisa cicilan yang lewat jatuh tempo. Tautannya menuju
      // tagihan terbaru yang belum lunas, dan halaman bayarnya menagih total_ditagih.
      const semua           = [...(lamaPerSiswa.get(siswaId) ?? []), ini]
      const tunggakanDaftar = tagihanTertagih(semua, ini, sekarang).daftar
        .filter(t => t.id !== ini.id)
        .map(t => ({ bulan: t.bulan, tahun: t.tahun, sisa: sisaTagihan(t) }))
      const tautan          = tagihanTautan(semua)
      return {
        tagihan_id:    r.id,
        siswa_id:      siswaId,
        nis:           r.siswa?.nis ?? '-',
        nama:          r.siswa?.nama ?? '—',
        kelas_id:      kelas?.id ?? '',
        // Alumni tidak punya kelas_id lagi — pakai snapshot kelas terakhirnya
        kelas_nama:    kelas?.nama ?? r.siswa?.kelas_terakhir ?? '—',
        kelas_jenjang: kelas?.jenjang ?? '',
        kelas_warna:   kelas?.warna ?? '#1A2C4E',
        is_alumni:     r.siswa?.status === 'alumni',
        total_nominal: ini.total_nominal,
        sisa_bulan_ini: masihBersisa(ini) ? sisaTagihan(ini) : 0,
        total_ditagih: tautan ? tagihanTertagih(semua, tautan, sekarang).total : 0,
        tunggakan:     tunggakanDaftar.reduce((s, d) => s + d.sisa, 0),
        tunggakanDaftar,
        status:        (r.status === 'sebagian' ? 'cicilan' : r.status) as SiswaTagihanRow['status'],
        jatuh_tempo:   r.jatuh_tempo,
        no_wa:         r.siswa?.no_wa ?? '',
        nama_wali:     r.siswa?.nama_wali ?? '',
        payment_token: tautan?.payment_token ?? r.payment_token ?? '',
      }
    })

    setTagihanList(result)
    setRingkasanPeriode(await ringkasanPromise)
    return result
  }, [])

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) { if (!user) router.replace('/'); return }

      const { data: profile } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).single()
      const sid = (profile as { sekolah_id: string } | null)?.sekolah_id ?? ''
      if (cancelled || !sid) return

      const { data: taData } = await supabase.from('tahun_ajaran').select('nama').eq('is_aktif', true).maybeSingle()
      const tahun = (taData as { nama: string } | null)?.nama ?? ''

      const [{ data: paketCheck }, { data: sekolahData }] = await Promise.all([
        supabase.from('paket').select('id').eq('sekolah_id', sid).eq('tahun_ajaran', tahun).limit(1),
        supabase.from('sekolah').select('nama').eq('id', sid).maybeSingle(),
      ])
      if (cancelled) return
      const paketAda = (paketCheck ?? []).length > 0
      setHasPaket(paketAda)
      setNamaSekolah((sekolahData as { nama?: string } | null)?.nama || '')
      setSekolahId(sid)
      setTahunAjaran(tahun)

      if (paketAda) {
        const rows = await loadTagihan(sid, bulanIni, tahunIni)
        if (!cancelled && rows.length === 0) {
          setAutoGenerating(true)
          const res = await runGenerate(supabase, sid, tahun, bulanIni, tahunIni)
          if (cancelled) return
          if (!res.success) {
            setAutoGenError(res.error ?? 'Terjadi kesalahan saat membuat tagihan.')
          } else {
            await loadTagihan(sid, bulanIni, tahunIni)
          }
          setAutoGenerating(false)
        }
      }

      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Realtime sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sekolahId || !tahunAjaran) return
    const channel = supabase
      .channel(`tagihan-live-${sekolahId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tagihan', filter: `sekolah_id=eq.${sekolahId}` },
        () => {
          setSyncing(true)
          runGenerate(supabase, sekolahId, tahunAjaran, bulanIni, tahunIni)
            .then(() => loadTagihan(sekolahId, bulanIni, tahunIni))
            .finally(() => setSyncing(false))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sekolahId, tahunAjaran, bulanIni, tahunIni, loadTagihan])

  // ── Pergantian bulan saat halaman dibiarkan terbuka ──────────────────────────
  // Tanpa ini tabel akan menampilkan baris bulan lama dengan jatuh tempo bulan baru
  const periodeRef = useRef(`${tahunIni}-${bulanIni}`)
  useEffect(() => {
    const periode = `${tahunIni}-${bulanIni}`
    if (periode === periodeRef.current) return
    periodeRef.current = periode
    if (!sekolahId || !tahunAjaran) return

    let alive = true
    // Lewat rantai promise, bukan setState langsung di badan effect
    runGenerate(supabase, sekolahId, tahunAjaran, bulanIni, tahunIni)
      .then(() => { if (alive) return loadTagihan(sekolahId, bulanIni, tahunIni) })
      .catch(() => { /* pertahankan data lama; realtime sync akan menyusul */ })

    return () => { alive = false }
  }, [bulanIni, tahunIni, sekolahId, tahunAjaran, loadTagihan])

  // ── Tagihan bulan ini yang tertahan ───────────────────────────────────────────
  // Dimuat ulang tiap jumlah baris berubah: penyebabnya hilang begitu tagihan terbit
  const jumlahTagihan = tagihanList.length
  useEffect(() => {
    if (!sekolahId) return
    let batal = false
    statusPenerbitan(supabase, sekolahId, bulanIni, tahunIni)
      .then(({ data }) => {
        if (batal) return
        setPenahanTerbit(data?.penahan && data.belumDitagih > 0
          ? { belumDitagih: data.belumDitagih, pesan: pesanPenahanTerbit(data.penahan) }
          : null)
      })
      .catch(() => { /* pemberitahuan ini pelengkap; tabel tetap tampil tanpa dia */ })
    return () => { batal = true }
  }, [sekolahId, bulanIni, tahunIni, jumlahTagihan])

  // ── Search catat siswa ────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!showCatatModal || !catatQuery.trim() || catatSelected) {
        setCatatResults([])
        return
      }
      setCatatSearching(true)
      // Nama dan NIS dicari lewat dua .ilike(), bukan satu .or(): string .or() dipakai apa
      // adanya, jadi koma atau kurung di ketikan bisa menyisipkan kondisi filter lain
      const pola = polaIlike(catatQuery)
      const cari = (kolom: 'nama' | 'nis') => supabase
        .from('siswa')
        .select('id, nama, nis, no_wa, nama_wali, kelas:kelas_id(id, nama, warna)')
        .eq('sekolah_id', sekolahId)
        .eq('status', 'aktif')
        .ilike(kolom, pola)
        .limit(5)
      const [perNama, perNis] = await Promise.all([cari('nama'), cari('nis')])
      // Siswa yang cocok di nama sekaligus NIS cukup tampil sekali
      const hasil = new Map<string, CatatSiswaResult>()
      for (const s of [...(perNama.data ?? []), ...(perNis.data ?? [])] as unknown as CatatSiswaResult[]) {
        if (!hasil.has(s.id)) hasil.set(s.id, s)
      }
      setCatatResults([...hasil.values()].slice(0, 5))
      setCatatSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [catatQuery, catatSelected, showCatatModal, sekolahId])

  // ── Kirim WA ──────────────────────────────────────────────────────────────────

  const kirimWA = (t: SiswaTagihanRow) => {
    if (!t.no_wa) return
    const paymentUrl = t.payment_token
      ? `${window.location.origin}/bayar/${t.payment_token}`
      : undefined

    // Siswa yang punya tunggakan bulan lalu diingatkan dengan rincian tunggakannya
    // (template yang sama dengan pengingat di Laporan). Sisa bulan ini ikut dicantumkan,
    // juga kalau belum jatuh tempo: halaman bayar lewat tautan yang sama menagih bulan
    // ini beserta seluruh tunggakan, jadi total pesan = total_ditagih.
    const bulanIniJatuhTempo = t.is_alumni || lewatJatuhTempo(waktuTagihan(t), now)
    const content = t.tunggakanDaftar.length > 0
      ? buildPesanTunggakanText({
          namaWali:  t.nama_wali,
          namaSiswa: t.nama,
          kelasNama: t.kelas_nama,
          daftar:    t.sisa_bulan_ini > 0
            ? [...t.tunggakanDaftar, { bulan: bulanIni, tahun: tahunIni, sisa: t.sisa_bulan_ini, belumJatuhTempo: !bulanIniJatuhTempo }]
            : t.tunggakanDaftar,
          namaSekolah,
          paymentUrl,
        })
      : buildPesanTagihanText({
          namaWali:     t.nama_wali,
          namaSiswa:    t.nama,
          kelasNama:    t.kelas_nama,
          totalNominal: t.total_ditagih,
          bulan:        bulanIni,
          tahun:        tahunIni,
          namaSekolah,
          paymentUrl,
        })

    window.open(buildWaMeLink(t.no_wa, content), '_blank', 'noopener,noreferrer')
    // Dicatat per siswa (sama dengan Dashboard): ikon Terkirim 3 detik, lalu "H-2"
    pengingatManual.catat(t.siswa_id)
    setWaSentSuccess(prev => new Set(prev).add(t.tagihan_id))
    setTimeout(() => setWaSentSuccess(prev => { const s = new Set(prev); s.delete(t.tagihan_id); return s }), 3000)
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  // Jatuh tempo dibaca per tagihan, bukan per bulan — paket tiap kelas bisa
  // punya tanggalnya sendiri, jadi satu bulan bisa berisi beberapa batas waktu.
  const waktuTagihan = (t: SiswaTagihanRow) => ({ jatuh_tempo: t.jatuh_tempo, bulan: bulanIni, tahun: tahunIni })

  // Tunggakan periode sebelumnya mengalahkan status bulan ini: siswa yang masih
  // berutang dari bulan lalu berstatus Menunggak walaupun tagihan bulan ini Lunas,
  // Cicilan, atau belum jatuh tempo. Dengan begitu filter Menunggak berisi siswa
  // yang sama dengan yang dihitung kartu tunggakan di dashboard (tautan
  // "Ingatkan sekarang" menuju ke sini).
  const getEffStatus = (t: SiswaTagihanRow): EffectiveStatus =>
    t.tunggakan > 0
      ? 'menunggak'
      : statusEfektif(t.status, lewatJatuhTempo(waktuTagihan(t), now), t.is_alumni, t.total_nominal)

  // Preset dari URL ikut dimasukkan supaya select tidak tampil kosong saat jenjang
  // tersebut belum punya tagihan di bulan ini. Alumni ditaruh di dropdown tingkat,
  // bukan dropdown status — status di sana khusus status pembayaran.
  const adaAlumni = tagihanList.some(t => t.is_alumni)
  const uniqueJenjang = [
    'Semua',
    ...Array.from(new Set(
      [...tagihanList.map(t => t.kelas_jenjang), filterJenjang]
        .filter(j => j && j !== 'Semua' && j !== FILTER_ALUMNI)
    )),
    ...(adaAlumni || filterJenjang === FILTER_ALUMNI ? [FILTER_ALUMNI] : []),
  ]

  const filtered = tagihanList.filter(t => {
    const eff = getEffStatus(t)
    const matchJenjang = filterJenjang === 'Semua'
      || (filterJenjang === FILTER_ALUMNI ? t.is_alumni : !t.is_alumni && t.kelas_jenjang === filterJenjang)
    const matchStatus  = filterStatus  === 'Semua' || eff === filterStatus
    const matchSearch  = !searchQuery  || t.nama.toLowerCase().includes(searchQuery.toLowerCase()) || t.nis.toLowerCase().includes(searchQuery.toLowerCase())
    return matchJenjang && matchStatus && matchSearch
  })

  // ── Pengingat WhatsApp ────────────────────────────────────────────────────────
  // Sekolah yang memakai antrean: tombol hanya memasukkan pengingat ke antrean, dan
  // tampilannya (Ingatkan / Mengirim… / Terkirim) datang dari server. Sekolah lain:
  // tombol membuka wa.me seperti biasa.
  const adaTombolIngatkan = (t: SiswaTagihanRow) => !!t.no_wa && getEffStatus(t) !== 'lunas'
  const pengingat = usePengingat(tagihanList.filter(adaTombolIngatkan).map(t => t.siswa_id))
  // Cooldown tombol wa.me (sekolah tanpa antrean), dicatat di browser ini
  const pengingatManual = usePengingatManual(now)
  // "Ingatkan semua" mengikuti baris yang sedang tampil — filter dan pencarian ikut berlaku
  const siapDiingatkan = pengingat.aktif
    ? filtered.filter(t => adaTombolIngatkan(t) && pengingat.tampilan(t.siswa_id) === 'ingatkan').map(t => t.siswa_id)
    : []

  // Diturunkan dari getEffStatus, bukan aturan tersendiri — kartu ringkasan dan
  // badge di tabel harus mustahil berselisih.
  const effCounts = tagihanList.reduce(
    (acc, t) => { acc[getEffStatus(t)] += 1; return acc },
    { lunas: 0, cicilan: 0, belum_bayar: 0, menunggak: 0 } as Record<EffectiveStatus, number>,
  )
  const countLunas     = effCounts.lunas
  const countCicilan   = effCounts.cicilan
  const countBelum     = effCounts.belum_bayar
  const countMenunggak = effCounts.menunggak
  // Card "Total tagihan periode ini" — seluruh tahun ajaran aktif, bukan hanya bulan ini
  const belumMasukPeriode = Math.max(0, ringkasanPeriode.total - ringkasanPeriode.masuk)
  const keteranganPeriode = [tahunAjaran && `TA ${tahunAjaran}`, labelRentang(ringkasanPeriode.awal, ringkasanPeriode.akhir)]
    .filter(Boolean).join(' · ')

  const anyModalOpen = showCatatModal || showDetailModal || showIngatkanSemua

  // Satu tombol untuk dua cara: antrean (TombolIngatkan) atau wa.me. Selama belum
  // diketahui sekolah ini memakai yang mana, tombolnya tampil tetapi belum bisa diklik.
  // Sesudah terkirim: ikon Terkirim 3 detik, lalu hitung mundur "H-n" yang terkunci.
  const tombolIngatkan = (t: SiswaTagihanRow) => {
    const tanda = tandaKirim(pengingat, pengingatManual, t.siswa_id, waSentSuccess.has(t.tagihan_id))
    return tanda !== null ? <TandaTerkirim tanda={tanda} kecil /> : tombolIngatkanSiap(t)
  }
  const tombolIngatkanSiap = (t: SiswaTagihanRow) => pengingat.aktif ? (
    <TombolIngatkan varian="ringkas" hijauPenuh tampilan={pengingat.tampilan(t.siswa_id)} nonaktif={anyModalOpen}
      onKlik={() => pengingat.ingatkan([t.siswa_id])} />
  ) : (
    <button
      onClick={() => { if (!anyModalOpen) kirimWA(t) }}
      disabled={anyModalOpen || pengingat.aktif === null}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#22C55E', color: '#fff', borderRadius: 8, padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: anyModalOpen ? 'not-allowed' : pengingat.aktif === null ? 'progress' : 'pointer', fontFamily: 'inherit', opacity: anyModalOpen ? 0.6 : 1, whiteSpace: 'nowrap' }}>
      <Image src='/icons/IconWA.png' width={16} height={16} alt='WA' />
      Ingatkan
    </button>
  )

  // ── Hitung mundur ke jatuh tempo tagihan ──────────────────────────────────────

  const sisaHari = (t: SiswaTagihanRow) =>
    Math.max(0, Math.floor((batasJatuhTempo(waktuTagihan(t)).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  // ── Detail modal computed values ──────────────────────────────────────────────

  const detailEffStatus: EffectiveStatus = detailSiswa ? getEffStatus(detailSiswa) : 'belum_bayar'
  const detailBadge  = STATUS_CONFIG[detailEffStatus]
  const detailAvatar = detailSiswa?.kelas_warna || '#1A2C4E'
  // Komponen mana yang sudah dibayar — hanya kalau setiap pembayarannya tercatat per
  // komponen (lib/rincianKomponen); selain itu yang tampil hanya riwayat pembayarannya
  const detailRincian = detailSiswa && detailPembayaran.length > 0
    ? rincianKomponen(detailSiswa.total_nominal, detailKomponen, detailPembayaran)
    : null
  const detailPerKomponen = detailRincian?.perKomponen
    ? new Map(detailRincian.komponen.map(k => [k.item.id, k]))
    : null
  const detailTerbayarIni = detailPembayaran.reduce((s, p) => s + p.jumlah, 0)

  // ── Modal 1 handlers ─────────────────────────────────────────────────────────

  const resetCatatModal = () => {
    catatMuatRef.current++
    setCatatQuery('')
    setCatatResults([])
    setCatatSelected(null)
    setCatatTagihan(null)
    setCatatRiwayat([])
    setCatatDaftar([])
    setCatatMuat('memuat')
    setCatatJumlah('')
    setCatatTanggal('')
    setCatatMetode('tunai')
    setCatatCatatan('')
    setCatatDipilih(new Set())
    setCatatGalat('')
  }

  // Tombol × di kartu siswa: kembali ke pencarian, isian tanggal/metode/keterangan tetap
  const lepasCatatSiswa = () => {
    catatMuatRef.current++
    setCatatSelected(null)
    setCatatTagihan(null)
    setCatatRiwayat([])
    setCatatDaftar([])
    setCatatDipilih(new Set())
    setCatatJumlah('')
    setCatatGalat('')
    setCatatQuery('')
  }

  const selectCatatSiswa = async (siswa: CatatSiswaResult) => {
    const urutan = ++catatMuatRef.current
    setCatatSelected(siswa)
    setCatatResults([])
    setCatatQuery(siswa.nama)
    setCatatGalat('')
    setCatatTagihan(null)
    setCatatRiwayat([])
    setCatatDaftar([])
    setCatatDipilih(new Set())
    setCatatJumlah('')
    setCatatMuat('memuat')
    // Tanggal lokal, bukan UTC — toISOString() memberi tanggal kemarin sebelum pukul 07.00 WIB
    setCatatTanggal(new Date().toLocaleDateString('en-CA'))
    const { data: tRow, error: tErr } = await supabase
      .from('tagihan')
      .select('id, total_nominal, status, bulan, tahun')
      .eq('sekolah_id', sekolahId)
      .eq('siswa_id', siswa.id)
      .eq('bulan', bulanIni)
      .eq('tahun', tahunIni)
      .maybeSingle()
    const t = (tRow ?? null) as CatatTagihanRow | null

    const muatRiwayat = async (): Promise<PembayaranRow[] | null> => {
      if (!t) return []
      const { data, error } = await supabase
        .from('pembayaran')
        .select('id, jumlah, metode, tanggal_bayar, catatan, alokasi')
        .eq('tagihan_id', t.id)
        .order('created_at', { ascending: true })
        .limit(20)
      return error ? null : (data ?? []) as PembayaranRow[]
    }
    // Bulan ini beserta tunggakan sebelumnya, dengan rumus halaman bayar wali. Siswa yang
    // belum punya tagihan bulan ini tetap bisa melunasi tunggakannya (id kosong = tanpa
    // tagihan bulan ini). Lengkap atau gagal: daftar yang terpotong menyembunyikan tunggakan.
    const [tertagih, riwayat] = await Promise.all([
      muatTertagih(supabase, { id: t?.id ?? '', siswa_id: siswa.id, sekolah_id: sekolahId, bulan: bulanIni, tahun: tahunIni }, new Date()),
      muatRiwayat(),
    ])
    if (urutan !== catatMuatRef.current) return
    if (tErr || !tertagih.data || !riwayat) { setCatatMuat('gagal'); return }

    setCatatTagihan(t)
    setCatatRiwayat(riwayat)
    setCatatDaftar(tertagih.data.daftar)
    // Semua yang masih bersisa tercentang, sama dengan halaman bayar wali: tanpa mengubah
    // apa pun, nominalnya melunasi bulan ini beserta tunggakannya
    const units = unitBayar(tertagih.data.daftar)
    setCatatDipilih(new Set(units.map(kunciUnit)))
    setCatatJumlah(String(units.reduce((s, u) => s + u.sisa, 0)))
    setCatatMuat('siap')
  }

  // Centang mengubah nominal menjadi sisa semua yang tercentang
  const ubahCatat = (kunci: string[], centang: boolean) => {
    const baru = new Set(catatDipilih)
    for (const k of kunci) {
      if (centang) baru.add(k)
      else baru.delete(k)
    }
    setCatatDipilih(baru)
    setCatatGalat('')
    setCatatJumlah(String(catatUnits.filter(u => baru.has(kunciUnit(u))).reduce((s, u) => s + u.sisa, 0)))
  }

  const simpanPembayaran = async () => {
    if (!catatSelected || catatMuat !== 'siap' || !catatJumlah || !catatTanggal || !sekolahId) return
    const jumlah = parseInt(catatJumlah, 10)
    if (!jumlah || jumlah <= 0) return
    if (catatUnitDipilih.length === 0) { setCatatGalat('Centang komponen yang dibayar.'); return }
    if (jumlah > catatBatas) {
      setCatatGalat(`Jumlah melebihi sisa komponen yang dicentang (${formatRp(catatBatas)}).`)
      return
    }
    setCatatGalat('')
    setCatatSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const tanggalBayar = new Date(catatTanggal).toISOString()
    // Dibagi dengan aturan halaman bayar wali dan verifikasi bukti: bulan terlama dulu, lalu
    // urutan komponen. Satu baris per tagihan beserta komponen yang ditutupnya (null untuk
    // tagihan yang dibayar utuh), disisipkan dalam satu perintah supaya tidak tercatat separuh.
    const { error } = await supabase.from('pembayaran').insert(bagiKeTagihan(catatUnitDipilih, jumlah).map(b => ({
      // Tanpa tagihan_siswa_id: kolom lama itu ber-FK ke tabel tagihan_siswa yang sudah
      // tidak dipakai (kosong), jadi id tagihan apa pun ditolak. Sama dengan halaman
      // Pembayaran dan verifikasi bukti, yang hanya mengisi tagihan_id.
      sekolah_id:    sekolahId,
      tagihan_id:    b.tagihan_id,
      siswa_id:      catatSelected.id,
      jumlah:        b.jumlah,
      alokasi:       b.alokasi,
      metode:        catatMetode,
      tanggal_bayar: tanggalBayar,
      catatan:       catatCatatan || null,
      status:        'terkonfirmasi',
      created_by:    user?.id ?? null,
    })))
    if (error) { alert('Gagal menyimpan: ' + error.message); setCatatSaving(false); return }
    // Status tagihan dihitung database dari pembayaran yang tercatat (trigger
    // pembayaran_segarkan_status), bukan ditulis dari sini
    resetCatatModal()
    setShowCatatModal(false)
    setCatatSaving(false)
    loadTagihan(sekolahId, bulanIni, tahunIni)
  }

  // ── Modal 2/3 handlers ───────────────────────────────────────────────────────

  const openDetailModal = async (t: SiswaTagihanRow) => {
    setDetailSiswa(t)
    setDetailBeasiswa([])
    setDetailKomponen([])
    setDetailTunggakan([])
    setDetailPembayaran([])
    setDetailPaketNama('')
    setDetailLoading(true)
    setShowDetailModal(true)
    const today = new Date().toISOString().split('T')[0]
    const [{ data: bsData }, { data: itemData }, { data: paketData }, { data: tunggakanData }] = await Promise.all([
      supabase
        .from('beasiswa_siswa')
        .select('beasiswa:beasiswa_id(nama, jenis, keterangan, jenis_potongan, persen, nominal)')
        .eq('siswa_id', t.siswa_id)
        .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${today}`),
      supabase
        .from('tagihan_item')
        .select('id, komponen_id, nama_komponen, nominal, potongan, komponen:komponen_id(jenis)')
        .eq('tagihan_id', t.tagihan_id)
        .order('nominal', { ascending: false }),
      supabase
        .from('paket')
        .select('nama, paket_kelas(kelas_id)')
        .eq('sekolah_id', sekolahId)
        .eq('tahun_ajaran', tahunAjaran),
      // Tagihan bulan lain yang belum lunas — sumber komponen tunggakan
      supabase
        .from('tagihan')
        .select('id, status, bulan, tahun, jatuh_tempo, total_nominal, tagihan_item(id, nama_komponen, nominal, potongan, komponen:komponen_id(jenis))')
        .eq('sekolah_id', sekolahId)
        .eq('siswa_id', t.siswa_id)
        .neq('status', 'lunas')
        .neq('id', t.tagihan_id)
        .limit(240),
    ])
    type BsRaw = { beasiswa: DetailBeasiswaRow | null }
    setDetailBeasiswa(((bsData ?? []) as unknown as BsRaw[]).map(r => r.beasiswa).filter((b): b is DetailBeasiswaRow => b !== null))

    // Rincian = snapshot tagihan_item apa adanya. Komponen individu yang ditambahkan
    // setelah tagihan terbit dicatat ke snapshot oleh /api/recalculate-tagihan (hanya
    // untuk tagihan yang belum lunas), jadi tidak digabung lagi di sini — menggabungnya
    // menampilkan komponen yang tidak ikut ditagihkan pada tagihan ini.
    type ItemRaw = { id: string; komponen_id: string | null; nama_komponen: string; nominal: number; potongan: number; komponen: { jenis: string } | null }
    setDetailKomponen(((itemData ?? []) as ItemRaw[])
      .map(i => ({ id: i.id, nama_komponen: i.nama_komponen, nominal: i.nominal, potongan: i.potongan, jenis: i.komponen?.jenis ?? '' })))

    // Komponen dari tagihan periode sebelumnya yang menunggak — aturannya
    // tunggakanSebelum, sama dengan kolom total di tabel dan halaman bayar wali.
    // Hanya ditampilkan sebagai informasi — tidak ikut dijumlahkan ke total bulan ini.
    type TunggakanRaw = {
      id: string; status: string; bulan: number; tahun: number; jatuh_tempo: string | null; total_nominal: number
      tagihan_item: { id: string; nama_komponen: string; nominal: number; potongan: number; komponen: { jenis: string } | null }[]
    }
    const tunggakanRaw = (tunggakanData ?? []) as unknown as TunggakanRaw[]
    // Sisa cicilan lama juga tunggakan, jadi pembayarannya perlu dimuat — beserta komponen
    // yang ditutup tiap pembayaran, supaya nominal per komponen yang tampil adalah sisanya
    const { data: bayarLama } = tunggakanRaw.length > 0
      ? await supabase.from('pembayaran').select('tagihan_id, jumlah, alokasi').in('tagihan_id', tunggakanRaw.map(tg => tg.id)).limit(1000)
      : { data: [] }
    const bayarPerTagihan = new Map<string, { jumlah: number; alokasi: unknown }[]>()
    for (const p of (bayarLama ?? []) as { tagihan_id: string; jumlah: number; alokasi: unknown }[]) {
      bayarPerTagihan.set(p.tagihan_id, [...(bayarPerTagihan.get(p.tagihan_id) ?? []), p])
    }
    const periodeIni = periodeIndex(bulanIni, tahunIni)
    const sekarang   = new Date()
    setDetailTunggakan(
      tunggakanRaw
        .map(tg => {
          const bayar = bayarPerTagihan.get(tg.id) ?? []
          return { ...tg, is_alumni: t.is_alumni, terbayar: bayar.reduce((s, p) => s + p.jumlah, 0), bayar }
        })
        .filter(tg => tunggakanSebelum(tg, periodeIni, sekarang))
        .sort((a, b) => periodeIndex(a.bulan, a.tahun) - periodeIndex(b.bulan, b.tahun))
        .map((tg): TunggakanDetail => {
          // jenis boleh kosong: komponen yang sudah dihapus menyisakan snapshot nama dan
          // nominalnya di tagihan_item, dan itu tetap uang yang terutang
          const items  = (tg.tagihan_item ?? []).map(i => ({ ...i, jenis: i.komponen?.jenis ?? '' }))
          const rinci  = rincianKomponen(tg.total_nominal, items, tg.bayar)
          // Berincian per komponen: setiap komponen tampil dengan sisanya, sama dengan
          // halaman bayar wali. Selain itu potongan beasiswa dan pembayaran yang sudah masuk
          // menjadi baris tersendiri. Keduanya berjumlah sama dengan kolom total di tabel.
          const baris: BarisRincianDetail[] = rinci.perKomponen
            ? rinci.komponen.map(k => ({
                nama_komponen: k.item.nama_komponen, jenis: k.item.jenis, nominal: k.item.nominal,
                potongan: k.item.potongan, terbayar: k.terbayar, sisa: k.sisa, baris: 'komponen',
              }))
            : rincianSisa<BarisRincianDetail>(
                items.map(i => ({ nama_komponen: i.nama_komponen, jenis: i.jenis, nominal: i.nominal, potongan: 0, terbayar: 0, sisa: i.nominal, baris: 'komponen' })),
                tg,
                (nama_komponen, nominal, jenis) => ({ nama_komponen, jenis: '', nominal, potongan: 0, terbayar: 0, sisa: nominal, baris: jenis }),
              )
          return { tagihan_id: tg.id, bulan: tg.bulan, tahun: tg.tahun, sisa: sisaTagihan(tg), perKomponen: rinci.perKomponen, baris }
        })
    )

    type PaketRaw = { nama: string; paket_kelas: { kelas_id: string }[] }
    const paketForKelas = ((paketData ?? []) as unknown as PaketRaw[]).find(p => p.paket_kelas?.some(pk => pk.kelas_id === t.kelas_id))
    setDetailPaketNama(paketForKelas?.nama ?? '—')
    if (t.status === 'cicilan' || t.status === 'lunas') {
      const { data: pembData } = await supabase
        .from('pembayaran')
        .select('id, jumlah, metode, tanggal_bayar, catatan, alokasi')
        .eq('tagihan_id', t.tagihan_id)
        .order('created_at', { ascending: true })
        .limit(20)
      setDetailPembayaran((pembData ?? []) as PembayaranRow[])
    }
    setDetailLoading(false)
  }

  const openCatatFromDetail = async () => {
    if (!detailSiswa) return
    const siswa: CatatSiswaResult = {
      id: detailSiswa.siswa_id, nama: detailSiswa.nama, nis: detailSiswa.nis,
      no_wa: detailSiswa.no_wa, nama_wali: detailSiswa.nama_wali,
      kelas: { id: detailSiswa.kelas_id, nama: detailSiswa.kelas_nama, warna: detailSiswa.kelas_warna },
    }
    resetCatatModal()
    setShowDetailModal(false)
    setShowCatatModal(true)
    await selectCatatSiswa(siswa)
  }

  const catatSiap  = catatSelected !== null && catatMuat === 'siap'
  const catatSudah = catatRiwayat.reduce((s, r) => s + r.jumlah, 0)
  const catatSisa  = catatTagihan ? Math.max(0, catatTagihan.total_nominal - catatSudah) : 0
  // Bulan ini (ada di daftar selama masih bersisa) dan tunggakan sebelumnya
  const catatIni            = catatDaftar.find(t => t.id === catatTagihan?.id) ?? null
  const catatTunggakan      = catatDaftar.filter(t => t.id !== catatTagihan?.id)
  const catatTotalTunggakan = catatTunggakan.reduce((s, t) => s + sisaTagihan(t), 0)
  // Komponen — atau tagihan utuh — yang masih bersisa, dalam urutan pembagian
  // (lib/rincianKomponen): bulan terlama dulu, lalu urutan komponen
  const catatUnits       = unitBayar(catatDaftar)
  const catatUnitDipilih = catatUnits.filter(u => catatDipilih.has(kunciUnit(u)))
  const catatBatas       = catatUnitDipilih.reduce((s, u) => s + u.sisa, 0)
  // Pratinjau pembagian untuk pembayaran sebagian, sama dengan pratinjau cicilan wali
  const catatAngka       = parseInt(catatJumlah, 10) || 0
  const catatPembagian   = catatAngka > 0 && catatAngka < catatBatas ? bagiPerUnit(catatUnitDipilih, catatAngka) : []

  // ── Loading ───────────────────────────────────────────────────────────────────

  // Tagihan bulan ini yang belum terbit dibuat otomatis selama status muat masih
  // berjalan — keterangannya tampil di atas kerangka
  if (loading) {
    return (
      <SkeletonTagihanAktif
        catatan={autoGenerating ? `Membuat tagihan otomatis untuk ${BULAN_NAMES[bulanIni]} ${tahunIni}…` : undefined}
      />
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-content">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 56, height: 56, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '2px 3px 10px rgba(18, 47, 102, 0.54)' }}>
            <Image src="/icons/IconMoney.png" width={30} height={30} alt="Tagihan Aktif" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-dark)', margin: 0, lineHeight: 1.1, fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Tagihan Aktif
            </h1>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
              Ringkasan tagihan dan status pembayaran siswa saat ini
            </p>
          </div>
        </div>

        {tagihanList.length > 0 && (
          <button
            onClick={() => { if (!anyModalOpen) setShowCatatModal(true) }}
            disabled={anyModalOpen}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, padding: '0.6rem 1.2rem', fontSize: '0.82rem', fontWeight: 700, cursor: anyModalOpen ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: anyModalOpen ? 0.5 : 1, transition: 'opacity 0.15s' }}>
            <ClipboardList size={15} />
            Catat Pembayaran Manual
          </button>
        )}
      </div>

      {/* ── States: auto-generating / error / no paket or empty ───────────── */}
      {autoGenerating ? (
        <div style={sCard}>
          <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Membuat tagihan otomatis untuk {BULAN_NAMES[bulanIni]} {tahunIni}...
          </div>
        </div>
      ) : autoGenError ? (
        <div style={{ ...sCard, border: '1.5px solid #FCA5A5', background: '#FFF5F5' }}>
          <div style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
            <div style={{ width: 52, height: 52, background: '#FEE2E2', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <AlertTriangle size={24} color="#DC2626" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#DC2626', marginBottom: '0.4rem' }}>Belum ada tagihan saat ini</div>
            {/* Penerbitan hanya gagal karena data tidak terbaca atau tidak tersimpan — kelas
                yang belum berpaket cukup dilewati — jadi yang menolong adalah mencoba lagi */}
            <div style={{ fontSize: '0.84rem', color: '#374151', marginBottom: '1.25rem', maxWidth: 380, margin: '0 auto 1.25rem' }}>
              {autoGenError}
            </div>
            <button onClick={() => window.location.reload()}
              style={{ background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Muat Ulang
            </button>
          </div>
        </div>
      ) : !hasPaket || tagihanList.length === 0 ? (
        <div style={sCard}>
          <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ width: 64, height: 64, background: '#F1F5F9', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <ClipboardList size={30} color="#94A3B8" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1A2C4E', marginBottom: '0.4rem' }}>Belum ada tagihan saat ini</div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Tagihan akan muncul otomatis setelah paket per kelas dan data siswa sudah diatur
            </div>
            {/* Penyebabnya — belum ada tahun ajaran, atau kelas bersiswa yang belum berpaket —
                disebut di sini: penerbitan tidak gagal karena itu, kelasnya hanya dilewati */}
            {penahanTerbit && (
              <>
                <div style={{ fontSize: '0.84rem', color: '#374151', maxWidth: 420, margin: '1rem auto 1.25rem' }}>
                  {penahanTerbit.pesan.alasan}
                </div>
                <button onClick={() => router.push(penahanTerbit.pesan.aksiHref)}
                  style={{ background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {penahanTerbit.pesan.aksiLabel}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Tagihan bulan ini tertahan untuk sebagian siswa ────────────────── */}
          {penahanTerbit && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap', background: '#FFF5F5', border: '1.5px solid #FCA5A5', borderRadius: 14, padding: '0.875rem 1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 38, height: 38, background: '#FEE2E2', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={19} color="#DC2626" />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#DC2626' }}>
                  Tagihan {BULAN_NAMES[bulanIni]} belum terbit untuk {penahanTerbit.belumDitagih} siswa
                </div>
                <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: 2 }}>
                  Penerbitan tertahan: {penahanTerbit.pesan.alasan}
                </div>
              </div>
              <button onClick={() => router.push(penahanTerbit.pesan.aksiHref)}
                style={{ background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, padding: '0.55rem 1.1rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {penahanTerbit.pesan.aksiLabel}
              </button>
            </div>
          )}

          {/* ── Stat Card Gabungan ─────────────────────────────────────────────── */}
          <div style={{ ...sCard, marginBottom: '1.25rem', padding: 0, overflow: 'hidden', borderLeft: '28px solid #1A2C4E' }}>

            {/* Header outer card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1.1rem 1.5rem' }}>
              <div style={{ width: 40, height: 40, background: '#1A2C4E', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ClipboardList size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A2C4E', lineHeight: 1.2 }}>Ringkasan status pembayaran</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 2 }}>Sebaran dan nilai tagihan saat ini</div>
              </div>
              {syncing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#64748B', background: '#F1F5F9', borderRadius: 20, padding: '0.3rem 0.75rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #94A3B8', borderTopColor: '#1A2C4E', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Memperbarui...
                </div>
              )}
            </div>

            {/* Inner cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1.25rem 1.5rem' }}>

              {/* Inner card 1 — Donut */}
              <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1rem 1.25rem', boxShadow:'0 2px 10px #3244736e' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>Total siswa ditagih</span>
                  <Image src="/icons/DolarBiru.png" width={40} height={40} alt="" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8rem' }}>
                  <DonutChart
                    total={tagihanList.length}
                    label="Siswa"
                    segments={URUTAN_STATUS.map(s => ({
                      value: { lunas: countLunas, cicilan: countCicilan, belum_bayar: countBelum, menunggak: countMenunggak }[s],
                      color: STATUS_TAGIHAN[s].solid,
                    }))}
                  />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {URUTAN_STATUS.map(s => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_TAGIHAN[s].solid, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.8rem', color: '#374151' }}>{STATUS_TAGIHAN[s].label}</span>
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: s === 'menunggak' ? STATUS_TAGIHAN.menunggak.solid : '#1A2C4E' }}>
                          {{ lunas: countLunas, cicilan: countCicilan, belum_bayar: countBelum, menunggak: countMenunggak }[s]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Inner card 2 — Total nominal */}
              <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1rem 1.25rem', boxShadow:'0 2px 10px #3244736e' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>Total tagihan periode ini</span>
                  <Image src="/icons/BankBiru.png" width={30} height={30} alt="" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div>
                    {keteranganPeriode && (
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: 2 }}>{keteranganPeriode}</div>
                    )}
                  </div>
                  <Image src="/icons/IconKomponen.png" width={22} height={22} alt="" style={{ opacity: 0.45 }} />
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A2C4E', letterSpacing: '-0.02em', paddingBottom: '0.75rem', borderBottom: '3px solid #DADBDE', marginBottom: '0.875rem' }}>
                  {formatRp(ringkasanPeriode.total)}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ background: '#F7DD7D', borderRadius: 10, padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.4rem' }}>
                      <Image src='/icons/Sampun.png' width={14} height={14} alt='' />
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A2C4E' }}>Sudah masuk</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: '0.25rem' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A2C4E' }}>{formatRp(ringkasanPeriode.masuk)}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ background: '#F7DD7D', borderRadius: 10, padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.4rem' }}>
                      <Image src='/icons/Dereng.png' width={14} height={14} alt='' />
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A2C4E' }}>Belum masuk</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: '0.25rem' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A2C4E' }}>{formatRp(belumMasukPeriode)}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── Filter + Tabel ──────────────────────────────────────────────── */}
          <div style={{ ...sCard, padding: 0, overflow: 'hidden', borderLeft: 'none' }}>

            {/* Filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <select value={filterJenjang} onChange={e => setFilterJenjang(e.target.value)} style={sSelect}>
                  {uniqueJenjang.map(j => <option key={j} value={j}>{j === 'Semua' ? 'Semua tingkat' : j}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={sSelect}>
                  <option value="Semua">Semua status</option>
                  <option value="lunas">Lunas</option>
                  <option value="cicilan">Cicilan</option>
                  <option value="belum_bayar">Belum bayar</option>
                  <option value="menunggak">Menunggak</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                {/* Hanya untuk sekolah yang memakai antrean pengingat; berlaku untuk baris yang sedang tampil */}
                {pengingat.aktif && (
                  <button
                    onClick={() => { if (!anyModalOpen) setShowIngatkanSemua(true) }}
                    disabled={anyModalOpen || siapDiingatkan.length === 0}
                    title={siapDiingatkan.length === 0 ? 'Tidak ada siswa pada daftar ini yang bisa diingatkan sekarang' : undefined}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 8,
                      padding: '0.5rem 0.9rem', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                      background: siapDiingatkan.length === 0 ? '#F1F5F9' : '#DCFCE7',
                      color:      siapDiingatkan.length === 0 ? '#94A3B8' : '#15803D',
                      cursor:     anyModalOpen || siapDiingatkan.length === 0 ? 'not-allowed' : 'pointer',
                    }}>
                    <Image src='/icons/IconWA.png' width={16} height={16} alt=''
                      style={siapDiingatkan.length === 0 ? { opacity: 0.45, filter: 'grayscale(1)' } : undefined} />
                    Ingatkan semua{siapDiingatkan.length > 0 ? ` (${siapDiingatkan.length})` : ''}
                  </button>
                )}
                <div style={{ position: 'relative' }}>
                  <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    placeholder="Cari nama siswa"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ ...sInput, paddingLeft: '2.25rem', width: 500 }}
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh', padding: '0 1rem 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#1A2C4E' }}>
                    {(['Nama', 'Kelas', 'Total tagihan', 'Status', 'Jatuh tempo', 'Aksi'] as const).map(col => (
                      <th key={col} style={{ padding: '0.45rem 1rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#1A2C4E', zIndex: 1, borderRadius: col === 'Nama' ? '8px 0 0 8px' : col === 'Aksi' ? '0 8px 8px 0' : undefined }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Tidak ada data yang sesuai filter
                      </td>
                    </tr>
                  ) : filtered.map(t => {
                    const eff          = getEffStatus(t)
                    const badge        = STATUS_CONFIG[eff]
                    const avatarColor  = t.kelas_warna || '#1A2C4E'
                    const hasWa        = !!t.no_wa
                    return (
                      <tr key={t.tagihan_id}
                        style={{ borderBottom: '1px solid #F1F5F9' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>

                        {/* Nama */}
                        <td style={sTd}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.76rem', color: '#fff', flexShrink: 0 }}>
                              {getInitials(t.nama)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#1A2C4E', fontSize: '0.875rem' }}>{t.nama}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NIS {t.nis}</div>
                            </div>
                          </div>
                        </td>

                        {/* Kelas — alumni tidak punya kelas aktif, tandai eksplisit */}
                        <td style={sTd}>
                          {t.is_alumni ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#EDE9FE', color: '#6D28D9', border: '1.5px solid #DDD6FE', borderRadius: 8, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              <GraduationCap size={13} />
                              Alumni
                              {t.kelas_nama !== '—' && (
                                <span style={{ fontWeight: 600, opacity: 0.75 }}>· {t.kelas_nama}</span>
                              )}
                            </span>
                          ) : (
                            <span style={{ background: `${avatarColor}20`, color: avatarColor, border: `1.5px solid ${avatarColor}55`, borderRadius: 8, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                              {t.kelas_nama}
                            </span>
                          )}
                        </td>

                        {/* Total = yang ditagih halaman bayar wali: sisa bulan ini + tunggakan
                            periode sebelumnya. Tanpa sisa sama sekali, nilai tagihan bulan ini. */}
                        <td style={{ ...sTd, fontWeight: 700, color: '#1A2C4E', fontVariantNumeric: 'tabular-nums' }}>
                          {formatRp(t.total_ditagih > 0 ? t.total_ditagih : t.total_nominal)}
                          {t.tunggakan > 0 && (
                            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#B45309', marginTop: 2, whiteSpace: 'nowrap' }}>
                              termasuk tunggakan {formatRp(t.tunggakan)}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td style={sTd}>
                          <span style={{ background: badge.bg, color: badge.color, fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                            {badge.label}
                          </span>
                        </td>

                        {/* Jatuh tempo */}
                        <td style={{ ...sTd, color: '#374151', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {formatJatuhTempo(waktuTagihan(t))}
                        </td>

                        {/* Aksi */}
                        <td style={sTd}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {eff === 'cicilan' ? (
                              <>
                                <span style={{ background: '#FEF3C7', color: '#D97706', border: '1.5px solid #FCD34D', borderRadius: 20, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  H-{sisaHari(t)}
                                </span>
                                {hasWa && tombolIngatkan(t)}
                              </>
                            ) : eff === 'lunas' ? null : (
                              hasWa ? tombolIngatkan(t) : (
                                <span style={{ color: '#CBD5E1', fontSize: '0.85rem', minWidth: 24 }}>—</span>
                              )
                            )}

                            {/* Didorong ke tepi kanan sel: lebar tombol di kirinya berbeda-beda
                                (Ingatkan / Mengirim… / H-n / kosong), ikon mata tetap sejajar antarbaris */}
                            <button
                              onClick={() => { if (!anyModalOpen) openDetailModal(t) }}
                              disabled={anyModalOpen}
                              title="Lihat detail"
                              style={{ width: 30, height: 30, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, cursor: anyModalOpen ? 'not-allowed' : 'pointer', color: '#64748B', flexShrink: 0, opacity: anyModalOpen ? 0.4 : 0.8 }}>
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid #F1F5F9', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Menampilkan {filtered.length} dari {tagihanList.length} siswa
            </div>
          </div>
        </>
      )}

      {/* ── Konfirmasi: Ingatkan semua ────────────────────────────────────── */}
      {showIngatkanSemua && (
        <div style={sBackdrop} onClick={() => setShowIngatkanSemua(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="judul-ingatkan-semua"
            style={{ ...sModalCard, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span id="judul-ingatkan-semua" style={{ fontWeight: 800, fontSize: '1rem', color: '#1A2C4E' }}>Ingatkan semua?</span>
              <button onClick={() => setShowIngatkanSemua(false)} style={sBtnClose} aria-label="Tutup"><X size={17} /></button>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.55, marginBottom: '1.25rem' }}>
              Pengingat WhatsApp akan dikirim ke wali <strong>{siapDiingatkan.length} siswa</strong> yang menunggak pada daftar ini.
              Pesan dikirim bertahap pada jam kerja, jadi tidak semuanya langsung terkirim.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowIngatkanSemua(false)} style={sBtnSecondary}>Batal</button>
              <button
                onClick={() => { setShowIngatkanSemua(false); pengingat.ingatkan(siapDiingatkan) }}
                disabled={siapDiingatkan.length === 0}
                style={{ ...sBtnPrimary, opacity: siapDiingatkan.length === 0 ? 0.5 : 1, cursor: siapDiingatkan.length === 0 ? 'not-allowed' : 'pointer' }}>
                Ya, ingatkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 1: Catat Pembayaran Manual ──────────────────────────────── */}
      {showCatatModal && (
        <div style={sBackdrop} onClick={() => { resetCatatModal(); setShowCatatModal(false) }}>
          <div style={{ ...sModalCard, maxWidth: 540 }} onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1A2C4E' }}>Catat Pembayaran Manual</span>
              <button onClick={() => { resetCatatModal(); setShowCatatModal(false) }} style={sBtnClose}><X size={17} /></button>
            </div>

            {/* Cari siswa */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>Cari siswa</div>
              {catatSelected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', border: '1.5px solid #1A2C4E', borderRadius: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: catatSelected.kelas?.warna ?? '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#fff', flexShrink: 0 }}>
                    {getInitials(catatSelected.nama)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1A2C4E' }}>{catatSelected.nama}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{catatSelected.kelas?.nama ?? '—'} &bull; NIS {catatSelected.nis ?? '-'}</div>
                  </div>
                  <button onClick={lepasCatatSiswa} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex' }}><X size={15} /></button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    autoFocus
                    placeholder="Cari nama atau nomor induk siswa"
                    value={catatQuery}
                    onChange={e => setCatatQuery(e.target.value)}
                    style={{ ...sInput, paddingLeft: '2.4rem', width: '100%', boxSizing: 'border-box' as const, border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: '0.875rem' }}
                  />
                  {(catatResults.length > 0 || catatSearching) && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, marginTop: 4, overflow: 'hidden', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                      {catatSearching && <div style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Mencari...</div>}
                      {catatResults.map(s => (
                        <div key={s.id} onClick={() => selectCatatSiswa(s)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #F8FAFC', background: '#fff', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.kelas?.warna ?? '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.78rem', color: '#fff', flexShrink: 0 }}>
                            {getInitials(s.nama)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1A2C4E' }}>{s.nama}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.kelas?.nama ?? '—'} &bull; NIS {s.nis ?? '-'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Memuat — kerangka ringkasan, label tetap teks asli */}
            {catatSelected && catatMuat === 'memuat' && (
              <div aria-busy="true" style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                <span role="status" className="skeleton-sr">Memuat tagihan…</span>
                {['Total tagihan', 'Sudah dibayar'].map((label, i) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.875rem', color: '#374151' }}>
                    <span>{label}</span><BlokTeks lebar={giliran([104, 64], i)} />
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #E2E8F0', fontSize: '0.95rem', fontWeight: 800, color: '#1A2C4E' }}>
                  <span>Sisa tagihan</span><BlokTeks lebar={116} ukuran="0.95rem" />
                </div>
              </div>
            )}

            {catatSelected && catatMuat === 'gagal' && (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#DC2626', fontSize: '0.82rem', fontWeight: 600, marginBottom: '1rem', background: '#FEE2E2', borderRadius: 10 }}>
                Rincian tagihan siswa ini gagal dimuat. Pilih siswanya lagi untuk mencoba ulang.
              </div>
            )}

            {catatSiap && catatSelected && (
              <>
                {/* Riwayat pembayaran tagihan bulan ini */}
                {catatRiwayat.length > 0 && (
                  <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1rem', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A2C4E' }}>Riwayat pembayaran</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1A2C4E', cursor: 'pointer', opacity: 0.75 }}
                        onClick={() => { resetCatatModal(); setShowCatatModal(false); router.push(`/dashboard/pembayaran?siswa_id=${catatSelected.id}`) }}>
                        Lihat semua →
                      </span>
                    </div>
                    {catatRiwayat.map((r, i) => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', borderBottom: i < catatRiwayat.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A2C4E' }}>Pembayaran ke-{i + 1}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(r.tanggal_bayar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} &bull; {r.metode.charAt(0).toUpperCase() + r.metode.slice(1)}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A2C4E' }}>{formatRp(r.jumlah)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!catatTagihan && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#92400E', fontSize: '0.82rem', marginBottom: '1rem', background: '#FEF9C3', borderRadius: 10 }}>
                    Siswa ini belum memiliki tagihan untuk bulan ini.
                  </div>
                )}

                {/* Ringkasan. Dengan tunggakan, Sisa tagihan = sisa bulan ini + tunggakan —
                    sama dengan kolom Total di tabel dan halaman bayar wali */}
                {(catatTagihan || catatTunggakan.length > 0) && (
                  <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                    {catatTagihan && ([
                      { label: catatTunggakan.length > 0 ? `Tagihan ${BULAN_NAMES[catatTagihan.bulan]} ${catatTagihan.tahun}` : 'Total tagihan', val: formatRp(catatTagihan.total_nominal) },
                      { label: 'Sudah dibayar', val: formatRp(catatSudah) },
                    ] as const).map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.875rem', color: '#374151' }}>
                        <span>{row.label}</span><span>{row.val}</span>
                      </div>
                    ))}
                    {catatTunggakan.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.875rem', color: '#92400E' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <AlertTriangle size={13} color="#D97706" /> Tunggakan sebelumnya
                        </span>
                        <span style={{ fontWeight: 700 }}>{formatRp(catatTotalTunggakan)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #E2E8F0', fontSize: '0.95rem', fontWeight: 800, color: '#1A2C4E' }}>
                      <span>Sisa tagihan</span>
                      <span style={{ color: catatSisa + catatTotalTunggakan === 0 ? '#22C55E' : '#1A2C4E' }}>{formatRp(catatSisa + catatTotalTunggakan)}</span>
                    </div>
                  </div>
                )}

                {/* Bulan ini sudah lunas, tunggakannya belum */}
                {catatTagihan && !catatIni && catatTunggakan.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#166534', lineHeight: 1.5 }}>
                    <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      Tagihan <strong>{BULAN_NAMES[catatTagihan.bulan]} {catatTagihan.tahun}</strong> sudah lunas. Masih ada tunggakan bulan sebelumnya di bawah ini.
                    </span>
                  </div>
                )}

                {/* Komponen bulan ini — dipilih seperti di halaman bayar wali */}
                {catatIni && (
                  <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '0.7rem 1rem', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A2C4E' }}>
                        {catatTunggakan.length > 0 ? `Tagihan ${BULAN_NAMES[catatIni.bulan]} ${catatIni.tahun}` : 'Komponen yang dibayar'}
                      </span>
                      <TombolSemuaCatat kunci={kunciTagihan(catatIni)} dipilih={catatDipilih} ubah={ubahCatat} warna="#1A2C4E" />
                    </div>
                    <PilihanTagihanCatat t={catatIni} dipilih={catatDipilih} ubah={ubahCatat}
                      warnaTeks="#374151" warnaNilai="#1A2C4E" garis="1px solid #F8FAFC" />
                  </div>
                )}

                {/* Tunggakan bulan sebelumnya — terlama dulu, dipilih dengan cara yang sama */}
                {catatTunggakan.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem' }}>
                      <AlertTriangle size={14} color="#D97706" />
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400E' }}>Tunggakan bulan sebelumnya</span>
                    </div>
                    <div style={{ border: '1.5px solid #FDE68A', background: '#FFFBEB', borderRadius: 10, overflow: 'hidden', maxHeight: 340, overflowY: 'auto' }}>
                      {catatTunggakan.map((t, i) => (
                        <div key={t.id} style={{ borderTop: i > 0 ? '1.5px solid #FDE68A' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '0.6rem 1rem 0.1rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E' }}>
                              {BULAN_NAMES[t.bulan]} {t.tahun} <span style={{ fontWeight: 600 }}>&middot; sisa {formatRp(sisaTagihan(t))}</span>
                            </span>
                            <TombolSemuaCatat kunci={kunciTagihan(t)} dipilih={catatDipilih} ubah={ubahCatat} warna="#92400E" />
                          </div>
                          <PilihanTagihanCatat t={t} dipilih={catatDipilih} ubah={ubahCatat}
                            warnaTeks="#92400E" warnaNilai="#92400E" garis="1px dashed #FDE68A" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {catatSiap && catatSelected && catatUnits.length > 0 && (
              <>
                {/* Form */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.35rem' }}>Jumlah dibayar</div>
                    <input
                      type="number"
                      value={catatJumlah}
                      onChange={e => { setCatatJumlah(e.target.value); setCatatGalat('') }}
                      placeholder="0"
                      style={{ ...sInput, width: '100%', boxSizing: 'border-box' as const, border: '1.5px solid #E2E8F0', borderRadius: 10 }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      ⓘ Paling banyak {formatRp(catatBatas)} untuk komponen yang dicentang
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.35rem' }}>Tanggal bayar</div>
                    <input
                      type="date"
                      value={catatTanggal}
                      onChange={e => setCatatTanggal(e.target.value)}
                      style={{ ...sInput, width: '100%', boxSizing: 'border-box' as const, border: '1.5px solid #E2E8F0', borderRadius: 10 }}
                    />
                  </div>
                </div>

                {/* Pembayaran sebagian: ke mana uangnya dicatat, dengan aturan yang dipakai saat menyimpan */}
                {catatPembagian.length > 0 && (
                  <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#1A2C4E', marginBottom: 4 }}>Pembayaran ini dicatat untuk</div>
                    {catatPembagian.map(({ unit, jumlah }) => (
                      <div key={kunciUnit(unit)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.75rem', color: '#475569', padding: '2px 0' }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{labelUnit(unit)}</span>
                        <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {formatRp(jumlah)}{jumlah >= unit.sisa ? ' · lunas' : ` dari ${formatRp(unit.sisa)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.35rem' }}>
                    Keterangan <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opsional)</span>
                  </div>
                  <textarea
                    placeholder="Contoh: Bayar langsung ke Bu Siti bendahara"
                    rows={2}
                    value={catatCatatan}
                    onChange={e => setCatatCatatan(e.target.value)}
                    style={{ ...sInput, width: '100%', boxSizing: 'border-box' as const, border: '1.5px solid #E2E8F0', borderRadius: 10, resize: 'none', fontFamily: 'inherit' }}
                  />
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>ⓘ Catatan tambahan seperti metode pembayaran atau siapa penerima pembayaran</div>
                </div>

                {catatGalat && (
                  <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
                    {catatGalat}
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { resetCatatModal(); setShowCatatModal(false) }} style={sBtnSecondary}>Tutup</button>
              {catatSiap && catatUnits.length > 0 && (
                <button onClick={simpanPembayaran} disabled={catatSaving || !catatJumlah || !catatTanggal}
                  style={{ ...sBtnPrimary, opacity: (catatSaving || !catatJumlah || !catatTanggal) ? 0.6 : 1, cursor: (catatSaving || !catatJumlah || !catatTanggal) ? 'not-allowed' : 'pointer' }}>
                  {catatSaving ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2/3: Detail Siswa ────────────────────────────────────────── */}
      {showDetailModal && detailSiswa && (
        <div style={sBackdrop} onClick={() => setShowDetailModal(false)}>
          <div style={{ ...sModalCard, maxWidth: 500 }} onClick={e => e.stopPropagation()}>

            {/* Close */}
            <button onClick={() => setShowDetailModal(false)} style={{ ...sBtnClose, position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
              <X size={17} />
            </button>

            {/* Student header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingRight: '2.5rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: detailAvatar, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.88rem', color: '#fff', flexShrink: 0 }}>
                {getInitials(detailSiswa.nama)}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1A2C4E' }}>{detailSiswa.nama}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{detailSiswa.kelas_nama} • NIS {detailSiswa.nis}</div>
              </div>
            </div>

            {/* Status + badge row */}
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span style={{ background: detailBadge.bg, color: detailBadge.color, fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                {detailBadge.label}
              </span>
              {detailLoading
                ? <Blok lebar={110} tinggi={27} sudut={20} />
                : detailBeasiswa.map((bs, i) => (
                    <span key={i} style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                      🎗 {labelPotongan(bs)}
                    </span>
                  ))
              }
            </div>

            {/* Info rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #F1F5F9' }}>
              {[
                { label: 'Paket berlaku', val: detailLoading ? <Blok lebar={120} tinggi={13} sudut={4} style={{ marginTop: 5 }} /> : detailPaketNama },
                { label: 'Jatuh tempo',   val: formatJatuhTempo(waktuTagihan(detailSiswa)) },
                { label: 'Orang tua',     val: detailSiswa.nama_wali || '—' },
                { label: 'No WA',         val: detailSiswa.no_wa || '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', gap: '1rem' }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: '#1A2C4E', textAlign: 'right' }}>{row.val}</span>
                </div>
              ))}
            </div>

            {/* Riwayat pembayaran */}
            {detailPembayaran.length > 0 && (
              <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1rem', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A2C4E' }}>Riwayat pembayaran</span>
                  <span
                    onClick={() => { setShowDetailModal(false); router.push(`/dashboard/pembayaran?siswa_id=${detailSiswa.siswa_id}`) }}
                    style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1A2C4E', cursor: 'pointer', opacity: 0.75 }}>
                    Lihat semua →
                  </span>
                </div>
                {detailPembayaran.map((r, i) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', borderBottom: i < detailPembayaran.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A2C4E' }}>Pembayaran ke-{i + 1}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(r.tanggal_bayar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} &bull; {r.metode.charAt(0).toUpperCase() + r.metode.slice(1)}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A2C4E' }}>{formatRp(r.jumlah)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Rincian komponen */}
            <div style={{ marginBottom: '0.25rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A2C4E', marginBottom: '0.5rem' }}>Rincian komponen</div>
              <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                {detailLoading ? (
                  [0, 1, 2].map(i => (
                    <div key={i} aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.55rem 1rem', borderBottom: '1px solid #F8FAFC' }}>
                      <Blok lebar={8} tinggi={8} sudut="50%" />
                      <BlokTeks lebar={giliran([120, 96, 140], i)} ukuran="0.82rem" style={{ flex: 1 }} />
                      <BlokTeks lebar={80} ukuran="0.82rem" />
                    </div>
                  ))
                ) : detailKomponen.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Belum ada rincian komponen.</div>
                ) : (
                  <>
                    {detailKomponen.map((k, i) => {
                      // Komponen yang sudah dibayar tampil dengan sisanya (lib/rincianKomponen)
                      const bayar = detailPerKomponen?.get(k.id)
                      return (
                        <BarisRincianModal key={i} warna="#1A2C4E" garis="1px solid #F8FAFC"
                          b={{
                            nama_komponen: k.nama_komponen, jenis: k.jenis, nominal: k.nominal,
                            potongan: bayar ? k.potongan : 0, terbayar: bayar?.terbayar ?? 0, sisa: bayar ? bayar.sisa : k.nominal,
                            baris: 'komponen',
                          }}
                          label={JENIS_LABEL[k.jenis] && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: JENIS_WARNA[k.jenis], background: JENIS_WARNA[k.jenis] + '1F', padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {JENIS_LABEL[k.jenis]}
                            </span>
                          )} />
                      )
                    })}
                    {detailBeasiswa.map((bs, i) => (
                      <div key={`bs-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.55rem 1rem', borderBottom: '1px solid #F8FAFC' }}>
                        <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={labelPotongan(bs)}>🎗 {labelPotongan(bs)}</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#065F46' }}>
                          {bs.jenis_potongan === 'persen' ? `– ${bs.persen}%` : `– ${formatRp(bs.nominal ?? 0)}`}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              {detailKomponen.length > 3 && (
                <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>∨ Scroll untuk lihat komponen lain</div>
              )}
            </div>

            {/* Total bulan berjalan */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.875rem', borderTop: '1.5px solid #E2E8F0', marginTop: '0.75rem', marginBottom: detailTerbayarIni > 0 ? '0.35rem' : detailTunggakan.length > 0 ? '1rem' : '1.25rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1A2C4E' }}>
                Total tagihan {detailTunggakan.length > 0 ? BULAN_NAMES[bulanIni] : ''}
              </span>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1A2C4E' }}>{formatRp(detailSiswa.total_nominal)}</span>
            </div>
            {/* Yang sudah masuk untuk tagihan bulan ini, supaya sisanya terbaca tanpa menghitung */}
            {detailTerbayarIni > 0 && (
              <div style={{ marginBottom: detailTunggakan.length > 0 ? '1rem' : '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#15803D' }}>
                  <span>Sudah dibayar</span>
                  <span>−{formatRp(detailTerbayarIni)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 800, color: '#1A2C4E', marginTop: 2 }}>
                  <span>Sisa {BULAN_NAMES[bulanIni]}</span>
                  <span>{formatRp(Math.max(0, detailSiswa.total_nominal - detailTerbayarIni))}</span>
                </div>
              </div>
            )}

            {/* Tunggakan komponen dari periode sebelumnya (informasi, tidak masuk total di atas) */}
            {!detailLoading && detailTunggakan.length > 0 && (() => {
              const totalTunggakan = detailTunggakan.reduce((s, b) => s + b.sisa, 0)
              // Yang belum lunas dari bulan ini = sisanya, bukan nilai tagihannya: siswa
              // yang bulan ini sudah Lunas/Cicilan tetap bisa punya tunggakan lama.
              // detailPembayaran dimuat untuk tagihan berstatus cicilan dan lunas.
              const sisaBulanIni = Math.max(0, detailSiswa.total_nominal - detailTerbayarIni)
              return (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem' }}>
                    <AlertTriangle size={14} color="#D97706" />
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400E' }}>Tunggakan bulan sebelumnya</span>
                  </div>
                  <div style={{ border: '1.5px solid #FDE68A', background: '#FFFBEB', borderRadius: 10, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
                    {detailTunggakan.map((bln, i) => (
                      <div key={bln.tagihan_id} style={{ borderTop: i > 0 ? '1.5px solid #FDE68A' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '0.55rem 1rem 0.2rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#92400E' }}>{BULAN_NAMES[bln.bulan]} {bln.tahun}</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400E' }}>sisa {formatRp(bln.sisa)}</span>
                        </div>
                        {bln.baris.map((b, j) => (
                          <BarisRincianModal key={j} b={b} warna="#92400E" garis="1px solid #FEF3C7" />
                        ))}
                        {!bln.perKomponen && bln.baris.some(b => b.baris === 'dibayar') && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0 1rem 0.5rem' }}>
                            Pembayaran tagihan ini belum tercatat per komponen, jadi tampil sebagai satu baris.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.6rem', marginTop: '0.5rem', borderTop: '1.5px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Ditagihkan terpisah di bulan asalnya — tidak dijumlahkan ke total di atas
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#92400E' }}>Total keseluruhan belum lunas</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#92400E' }}>
                      {formatRp(sisaBulanIni + totalTunggakan)}
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDetailModal(false)} style={sBtnSecondary}>Tutup</button>
              {/* Bulan ini lunas tapi masih menunggak: tunggakannya tetap bisa dicatat */}
              {(detailSiswa.status !== 'lunas' || detailSiswa.tunggakan > 0) && (
                <button onClick={openCatatFromDetail} style={{ ...sBtnPrimary, gap: 6 }}>
                  <ClipboardList size={14} /> Catat Pembayaran
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Baris rincian modal detail ────────────────────────────────────────────────

/**
 * Satu baris rincian di modal detail. Komponen yang sudah dibayar sebagian tampil dengan
 * sisanya beserta asal angkanya; yang sudah lunas diberi tanda Lunas. Untuk tagihan yang
 * dibayar utuh, baris "Sudah dibayar" diberi warna sendiri supaya tidak terlewat.
 */
function BarisRincianModal({ b, warna, garis, label }: {
  b: BarisRincianDetail; warna: string; garis: string; label?: React.ReactNode
}) {
  const dibayar = b.baris === 'komponen' && b.terbayar > 0
  const lunas   = dibayar && b.sisa <= 0
  const hijau   = b.baris === 'dibayar' || b.baris === 'potongan'
  const catatan = b.baris !== 'komponen' || lunas ? '' : [
    b.potongan > 0 || dibayar ? `dari ${formatRp(b.nominal)}` : null,
    b.potongan > 0 ? `potongan beasiswa ${formatRp(b.potongan)}` : null,
    dibayar ? `sudah dibayar ${formatRp(b.terbayar)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.55rem 1rem', borderBottom: garis, background: b.baris === 'dibayar' ? '#F0FDF4' : undefined }}>
      {b.baris === 'dibayar'
        ? <CheckCircle2 size={13} color="#15803D" style={{ flexShrink: 0 }} />
        : <span style={{ width: 8, height: 8, borderRadius: '50%', background: hijau ? '#22C55E' : (JENIS_WARNA[b.jenis] ?? '#94A3B8'), flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: b.baris === 'dibayar' ? 700 : 400, color: hijau ? '#15803D' : lunas ? '#94A3B8' : '#374151' }}>
          {b.nama_komponen}
        </span>
        {catatan && <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{catatan}</span>}
      </span>
      {label}
      {lunas ? (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#15803D', background: '#DCFCE7', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Lunas
        </span>
      ) : (
        <span style={{ fontSize: '0.82rem', fontWeight: dibayar || b.baris === 'dibayar' ? 800 : 600, color: hijau ? '#15803D' : warna, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {b.sisa < 0 ? `−${formatRp(-b.sisa)}` : formatRp(b.sisa)}
        </span>
      )}
    </div>
  )
}

// ── Pilihan modal Catat Pembayaran ────────────────────────────────────────────

/** Yang bisa dicentang dari satu tagihan: komponen yang masih bersisa, atau tagihannya utuh */
const kunciTagihan = (t: TagihanBayar): string[] => t.rincian.perKomponen
  ? t.rincian.komponen.filter(k => k.sisa > 0).map(k => kunciUnit({ tagihan_id: t.id, tagihan_item_id: k.item.id }))
  : [kunciUnit({ tagihan_id: t.id, tagihan_item_id: null })]

const sCentangCatat: React.CSSProperties = {
  width: 16, height: 16, margin: '3px 0 0', accentColor: '#1A2C4E', flexShrink: 0, cursor: 'inherit',
}

/** Centang semua / kosongkan untuk satu bulan — hanya kalau ada lebih dari satu pilihan */
function TombolSemuaCatat({ kunci, dipilih, ubah, warna }: {
  kunci: string[]; dipilih: Set<string>; ubah: (kunci: string[], centang: boolean) => void; warna: string
}) {
  if (kunci.length < 2) return null
  const semua = kunci.every(k => dipilih.has(k))
  return (
    <button type="button" onClick={() => ubah(kunci, !semua)}
      style={{ background: 'none', border: 'none', padding: 0, color: warna, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
      {semua ? 'Kosongkan' : 'Pilih semua'}
    </button>
  )
}

/**
 * Isi satu tagihan di modal Catat Pembayaran, sama dengan halaman bayar wali: komponen
 * beserta sisanya (yang sudah lunas tercentang dan terkunci), atau — untuk tagihan yang
 * hanya bisa dibayar utuh — satu centang dengan rinciannya sebagai keterangan.
 */
function PilihanTagihanCatat({ t, dipilih, ubah, warnaTeks, warnaNilai, garis }: {
  t: TagihanBayar; dipilih: Set<string>; ubah: (kunci: string[], centang: boolean) => void
  warnaTeks: string; warnaNilai: string; garis: string
}) {
  if (!t.rincian.perKomponen) {
    const kunci   = kunciUnit({ tagihan_id: t.id, tagihan_item_id: null })
    // Komponen apa adanya, lalu potongan beasiswa dan yang sudah dibayar — berjumlah sisanya
    const rincian = rincianSisa(
      t.tagihan_item.map(i => ({ nama_komponen: i.nama_komponen, nominal: i.nominal, warna: i.komponen?.kelas_warna ?? '#94A3B8' })),
      t,
      (nama_komponen, nominal) => ({ nama_komponen, nominal, warna: '#94A3B8' }),
    )
    return (
      <div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.55rem 1rem 0.3rem', cursor: 'pointer', fontSize: '0.85rem', color: warnaTeks }}>
          <input type="checkbox" checked={dipilih.has(kunci)} onChange={e => ubah([kunci], e.target.checked)} style={sCentangCatat} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700 }}>Seluruh tagihan {BULAN_NAMES[t.bulan]} {t.tahun}</span>
              <span style={{ fontWeight: 700, color: warnaNilai, whiteSpace: 'nowrap' }}>{formatRp(sisaTagihan(t))}</span>
            </span>
            <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>Tagihan ini dibayar sekaligus</span>
          </span>
        </label>
        <div style={{ padding: '0 1rem 0.55rem 2.6rem' }}>
          {rincian.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.72rem', color: '#64748B', padding: '1px 0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.warna, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nama_komponen}</span>
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{r.nominal < 0 ? `−${formatRp(-r.nominal)}` : formatRp(r.nominal)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const komponen = t.rincian.komponen
  return (
    <>
      {komponen.map((k, i) => {
        const kunci = kunciUnit({ tagihan_id: t.id, tagihan_item_id: k.item.id })
        const lunas = k.sisa <= 0
        const keterangan = lunas ? '' : [
          k.item.potongan > 0 ? `${formatRp(k.item.nominal)} − potongan beasiswa ${formatRp(k.item.potongan)}` : null,
          k.terbayar > 0 ? `sudah dibayar ${formatRp(k.terbayar)}` : null,
        ].filter(Boolean).join(' · ')
        return (
          <label key={k.item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.55rem 1rem', borderBottom: i < komponen.length - 1 ? garis : 'none', cursor: lunas ? 'default' : 'pointer', fontSize: '0.85rem', color: warnaTeks }}>
            <input type="checkbox" checked={lunas || dipilih.has(kunci)} disabled={lunas} onChange={e => ubah([kunci], e.target.checked)} style={sCentangCatat} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, opacity: lunas ? 0.55 : 1 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: k.item.komponen?.kelas_warna ?? '#94A3B8', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.item.nama_komponen}</span>
                </span>
                {lunas ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', fontWeight: 700, color: '#15803D', background: '#DCFCE7', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                    <CheckCircle2 size={11} /> Lunas
                  </span>
                ) : (
                  <span style={{ fontWeight: 700, color: warnaNilai, whiteSpace: 'nowrap' }}>{formatRp(k.sisa)}</span>
                )}
              </span>
              {keterangan && (
                <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1, paddingLeft: 16 }}>{keterangan}</span>
              )}
            </span>
          </label>
        )
      })}
    </>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sCard: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '6rem 2rem',
  marginBottom: '1rem',
  borderLeft: '28px solid #1A2C4E',
  boxShadow:'0 1px 3px rgba(0,0,0,0.07)',
}

const sSelect: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
  border: '2px solid var(--border)',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: '0.82rem',
  color: 'var(--text-dark)',
  outline: 'none',
  background: '#fff',
  cursor: 'pointer',
  appearance: 'auto',
}

const sInput: React.CSSProperties = {
  padding: '0.55rem 0.85rem',
  border: '2px solid var(--border)',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  color: 'var(--text-dark)',
  outline: 'none',
  background: '#fff',
}

const sTd: React.CSSProperties = {
  padding: '0.875rem 1rem',
  verticalAlign: 'middle',
}

const sBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(18,47,102,0.45)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem',
}

const sModalCard: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: '1.5rem',
  width: '100%',
  boxShadow: '0 24px 64px rgba(18,47,102,0.22)',
  position: 'relative',
  maxHeight: '90vh',
  overflowY: 'auto',
}

const sBtnClose: React.CSSProperties = {
  background: '#F1F5F9', border: 'none', borderRadius: 8,
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: '#64748B', flexShrink: 0,
}

const sBtnSecondary: React.CSSProperties = {
  padding: '0.6rem 1.4rem', borderRadius: 10,
  border: '2px solid #E2E8F0', background: '#fff',
  color: '#374151', fontWeight: 700, fontSize: '0.875rem',
  cursor: 'pointer', fontFamily: 'inherit',
}

const sBtnPrimary: React.CSSProperties = {
  padding: '0.6rem 1.4rem', borderRadius: 10,
  border: 'none', background: '#1A2C4E',
  color: '#fff', fontWeight: 700, fontSize: '0.875rem',
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center',
}
