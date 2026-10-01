'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation'
import { Search, AlertTriangle, Eye, X, ClipboardList, GraduationCap } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { ambilSemua } from '@/lib/ambilSemua'
import { muatRingkasanPeriode, RINGKASAN_PERIODE_KOSONG, type BulanTahun, type RingkasanPeriode } from '@/lib/ringkasanPeriode'
import { buildPesanTagihanText, buildPesanTunggakanText, buildWaMeLink } from '@/lib/templates/waTagihan'
import { STATUS_TAGIHAN, URUTAN_STATUS, statusEfektif, lewatJatuhTempo, batasJatuhTempo, formatJatuhTempo } from '@/lib/statusTagihan'
import {
  JENIS_LABEL, JENIS_WARNA, komponenDitagihkan, periodeIndex,
  bangunRiwayatTagih, TA_PERIODE_SELECT, type PeriodeTahunAjaran,
} from '@/lib/komponenTagihan'

// ── Constants ─────────────────────────────────────────────────────────────────

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

/** Nilai khusus dropdown tingkat untuk menyaring siswa yang sudah lulus */
const FILTER_ALUMNI = 'Alumni'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(nama: string): string {
  const parts = nama.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (nama.slice(0, 2)).toUpperCase()
}

/**
 * Tagihan periode sebelumnya yang dihitung sebagai tunggakan siswa — aturan yang sama
 * dengan kartu "Total Tunggakan Aktif" di dashboard: menurut statusEfektif Menunggak
 * (belum dibayar dan lewat jatuh tempo). Tagihan Rp 0 karena beasiswa penuh dibaca
 * lunas, dan cicilan tidak ikut — sisanya terlacak lewat halaman Laporan.
 */
function adalahTunggakanLama(
  t: { status: string; bulan: number; tahun: number; jatuh_tempo: string | null; total_nominal: number },
  periodeIni: number,
  sekarang: Date,
  isAlumni: boolean,
): boolean {
  return periodeIndex(t.bulan, t.tahun) < periodeIni
    && statusEfektif(t.status, lewatJatuhTempo(t, sekarang), isAlumni, t.total_nominal) === 'menunggak'
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
  /** Jumlah tunggakan periode sebelumnya (lihat adalahTunggakanLama); > 0 berarti Menunggak */
  tunggakan:     number
  /** Rincian tunggakan per bulan, terlama dulu — untuk pesan pengingat WhatsApp */
  tunggakanDaftar: TunggakanBulan[]
  status:        'belum_bayar' | 'lunas' | 'cicilan'
  /** Snapshot dari paket kelas saat tagihan dibuat — tiap kelas bisa berbeda */
  jatuh_tempo:   string | null
  no_wa:         string
  nama_wali:     string
  payment_token: string
}

type KelasNestedRaw    = { id: string; nama: string; jenjang: string; warna: string }
type SiswaNestedRaw    = { id: string; nama: string; nis: string | null; no_wa: string | null; nama_wali: string | null; status: string | null; kelas_terakhir: string | null; kelas: KelasNestedRaw | null }
type TagihanItemRaw    = { komponen_id: string | null; nominal: number }
type TagihanRawRow     = { id: string; total_nominal: number; status: string; jatuh_tempo: string | null; payment_token: string | null; tagihan_item: TagihanItemRaw[]; siswa: SiswaNestedRaw | null }
type PaketKomponenRaw  = { komponen_id: string; nominal: number; komponen: { nama: string; jenis: string } | null }
type PaketKelasRaw     = { kelas_id: string }
type PaketForGenerate  = { id: string; paket_kelas: PaketKelasRaw[]; paket_komponen: PaketKomponenRaw[] }
type SiswaForGenerate  = { id: string; nama: string; kelas_id: string }
type ExistingTagRow    = { siswa_id: string }
type BeasiswaSiswaRaw  = { siswa_id: string; beasiswa: { jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null; beasiswa_komponen: { komponen_id: string }[] } | null }
type IndividuSiswaRaw  = { siswa_id: string; komponen_id: string; nominal: number; komponen: { nama: string; jenis: string } | null }
type CatatSiswaResult  = { id: string; nama: string; nis: string | null; no_wa: string | null; nama_wali: string | null; kelas: { id: string; nama: string; warna: string } | null }
type PembayaranRow     = { id: string; jumlah: number; metode: string; tanggal_bayar: string; catatan: string | null }
type DetailBeasiswaRow = { nama: string; jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null }
type DetailKomponenRow = { nama_komponen: string; nominal: number; jenis: string }
type TunggakanRow      = { nama_komponen: string; nominal: number; jenis: string; bulan: number; tahun: number }
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

// ── Generate logic (standalone) ───────────────────────────────────────────────

async function runGenerate(
  sid: string, tahunAjaran: string, bulan: number, tahun: number,
): Promise<{ success: boolean; error?: string }> {
  const { data: paketData, error: e1 } = await supabase
    .from('paket')
    .select('id, paket_kelas(kelas_id), paket_komponen(komponen_id, nominal, komponen:komponen_id(nama, jenis))')
    .eq('sekolah_id', sid)
    .eq('tahun_ajaran', tahunAjaran)
  if (e1 || !paketData) return { success: false, error: 'Gagal memuat data paket.' }

  const kelasToKomponen = new Map<string, { komponen_id: string; nominal: number; nama: string; jenis: string }[]>()
  for (const p of (paketData as unknown as PaketForGenerate[])) {
    const komps = p.paket_komponen.map(pk => ({
      komponen_id: pk.komponen_id, nominal: pk.nominal,
      nama: pk.komponen?.nama ?? '', jenis: pk.komponen?.jenis ?? '',
    }))
    for (const pk of p.paket_kelas) kelasToKomponen.set(pk.kelas_id, komps)
  }

  const { data: allKelasData } = await supabase.from('kelas').select('id').eq('sekolah_id', sid)
  const missingKelas = (allKelasData ?? []).filter((k: { id: string }) => !kelasToKomponen.has(k.id))
  if (missingKelas.length > 0)
    return { success: false, error: 'Beberapa kelas belum memiliki paket. Konfigurasi paket per kelas terlebih dahulu.' }

  const { data: siswaData, error: e2 } = await supabase
    .from('siswa').select('id, nama, kelas_id').eq('sekolah_id', sid).eq('status', 'aktif').limit(1000)
  if (e2 || !siswaData) return { success: false, error: 'Gagal memuat data siswa.' }

  const siswaPorKelas = new Set((siswaData as SiswaForGenerate[]).map(s => s.kelas_id))
  const kelasKosong   = [...kelasToKomponen.keys()].filter(kid => !siswaPorKelas.has(kid))
  if (kelasKosong.length > 0)
    return { success: false, error: 'Beberapa kelas yang sudah dipaketkan belum memiliki siswa.' }

  const siswaIds = (siswaData as SiswaForGenerate[]).map(s => s.id)
  const today    = new Date().toISOString().split('T')[0]
  const [{ data: bsData }, { data: individuData }] = await Promise.all([
    supabase
      .from('beasiswa_siswa')
      .select('siswa_id, beasiswa:beasiswa_id(jenis_potongan, persen, nominal, beasiswa_komponen(komponen_id))')
      .in('siswa_id', siswaIds)
      .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${today}`),
    supabase
      .from('siswa_komponen_individu')
      .select('siswa_id, komponen_id, nominal, komponen:komponen_id(nama, jenis)')
      .in('siswa_id', siswaIds),
  ])

  const siswaBeasiswaMap = new Map<string, { jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null; komponen_ids: Set<string> }[]>()
  for (const row of ((bsData ?? []) as unknown as BeasiswaSiswaRaw[])) {
    if (!row.beasiswa) continue
    const list = siswaBeasiswaMap.get(row.siswa_id) ?? []
    list.push({ jenis_potongan: row.beasiswa.jenis_potongan, persen: row.beasiswa.persen, nominal: row.beasiswa.nominal, komponen_ids: new Set(row.beasiswa.beasiswa_komponen.map(bk => bk.komponen_id)) })
    siswaBeasiswaMap.set(row.siswa_id, list)
  }

  const siswaIndividuMap = new Map<string, { komponen_id: string; nama: string; jenis: string; nominal: number }[]>()
  for (const row of ((individuData ?? []) as unknown as IndividuSiswaRaw[])) {
    if (!row.komponen) continue
    const list = siswaIndividuMap.get(row.siswa_id) ?? []
    list.push({ komponen_id: row.komponen_id, nama: row.komponen.nama, jenis: row.komponen.jenis, nominal: row.nominal })
    siswaIndividuMap.set(row.siswa_id, list)
  }

  const { data: existingData } = await supabase
    .from('tagihan').select('siswa_id').eq('sekolah_id', sid).eq('bulan', bulan).eq('tahun', tahun)
  const existingIds = new Set(((existingData ?? []) as ExistingTagRow[]).map(t => t.siswa_id))

  // Riwayat penagihan per siswa per komponen — dasar aturan "sekali per semester"
  // dan "sekali per tahun ajaran". Diambil dari tagihan_item, bukan sekadar
  // "siswa punya tagihan di bulan lain".
  const [{ data: riwayatRows }, { data: taPeriode }] = await Promise.all([
    supabase
      .from('tagihan')
      .select('siswa_id, bulan, tahun, tagihan_item(komponen_id)')
      .eq('sekolah_id', sid)
      .limit(5000),
    supabase
      .from('tahun_ajaran').select(TA_PERIODE_SELECT).eq('sekolah_id', sid).eq('is_aktif', true).maybeSingle(),
  ])

  const riwayat = bangunRiwayatTagih(
    (riwayatRows ?? []) as unknown as { siswa_id: string; bulan: number; tahun: number; tagihan_item: { komponen_id: string | null }[] }[]
  )
  const ta = (taPeriode ?? null) as PeriodeTahunAjaran | null

  const toInsert: { sekolah_id: string; siswa_id: string; bulan: number; tahun: number; total_nominal: number; status: string }[] = []
  const itemsByTempId: { komponen_id: string; nama_komponen: string; nominal: number; siswa_id: string }[] = []

  for (const siswa of (siswaData as SiswaForGenerate[])) {
    if (existingIds.has(siswa.id)) continue
    const komps = kelasToKomponen.get(siswa.kelas_id)
    if (!komps || komps.length === 0) continue

    const bolehTagih = (k: { jenis: string; komponen_id: string }) =>
      komponenDitagihkan(k.jenis, bulan, tahun, ta, siswa.id, k.komponen_id, riwayat)

    const filtered = komps.filter(bolehTagih)
    const individu = (siswaIndividuMap.get(siswa.id) ?? []).filter(bolehTagih)

    const allKomps = [...filtered, ...individu]
    if (allKomps.length === 0) continue

    const tagihanKompIds = new Set(allKomps.map(k => k.komponen_id))
    let totalPotongan = 0
    for (const bs of (siswaBeasiswaMap.get(siswa.id) ?? [])) {
      for (const kid of bs.komponen_ids) {
        if (!tagihanKompIds.has(kid)) continue
        const komp = allKomps.find(k => k.komponen_id === kid)
        if (!komp) continue
        totalPotongan += bs.jenis_potongan === 'persen'
          ? Math.round(komp.nominal * (bs.persen ?? 0) / 100)
          : bs.nominal ?? 0
      }
    }

    const total = Math.max(0, allKomps.reduce((s, k) => s + k.nominal, 0) - totalPotongan)
    // kelas_id, tahun_ajaran_id, dan jatuh_tempo sengaja tidak dikirim — trigger
    // database tagihan_isi_snapshot mengisinya dari siswa, rentang tahun ajaran,
    // dan tanggal jatuh tempo paket kelasnya
    toInsert.push({ sekolah_id: sid, siswa_id: siswa.id, bulan, tahun, total_nominal: total, status: 'belum_bayar' })
    for (const k of allKomps) itemsByTempId.push({ komponen_id: k.komponen_id, nama_komponen: k.nama, nominal: k.nominal, siswa_id: siswa.id })
  }

  if (toInsert.length === 0) return { success: true }

  const { data: inserted, error: e3 } = await supabase.from('tagihan').insert(toInsert).select('id, siswa_id')
  if (e3) {
    // 23505 = unique violation: tagihan sudah ada dari concurrent call sebelumnya, anggap sukses
    if (e3.code === '23505') return { success: true }
    return { success: false, error: 'Gagal menyimpan tagihan.' }
  }
  if (!inserted) return { success: false, error: 'Gagal menyimpan tagihan.' }

  const siswaToTagihanId = new Map(((inserted) as { id: string; siswa_id: string }[]).map(t => [t.siswa_id, t.id]))
  const tagItems = itemsByTempId
    .map(item => ({ tagihan_id: siswaToTagihanId.get(item.siswa_id) ?? '', komponen_id: item.komponen_id, nama_komponen: item.nama_komponen, nominal: item.nominal }))
    .filter(i => i.tagihan_id)
  if (tagItems.length > 0) {
    const { error: e4 } = await supabase.from('tagihan_item').insert(tagItems)
    // Tagihan tanpa rincian dibaca nol oleh seluruh hilir (total tabel, modal
    // detail, halaman bayar, laporan). Lebih baik kegagalannya terlihat
    // daripada diam-diam menerbitkan tagihan Rp 0.
    if (e4) return { success: false, error: 'Tagihan tersimpan, tetapi rincian komponennya gagal dibuat.' }
  }

  return { success: true }
}

// ── Page ──────────────────────────────────────────────────────────────────────

// useSearchParams wajib berada di bawah batas Suspense, kalau tidak build gagal
// saat Next mencoba melakukan prerender statis halaman ini.
export default function TagihanAktifPage() {
  return (
    <Suspense fallback={
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Memuat data...</div>
      </div>
    }>
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

  // Modal state
  const [showCatatModal,  setShowCatatModal]  = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailSiswa,     setDetailSiswa]     = useState<SiswaTagihanRow | null>(null)

  // Modal 1 — Catat Pembayaran
  const [catatQuery,     setCatatQuery]     = useState('')
  const [catatResults,   setCatatResults]   = useState<CatatSiswaResult[]>([])
  const [catatSelected,  setCatatSelected]  = useState<CatatSiswaResult | null>(null)
  const [catatTagihan,   setCatatTagihan]   = useState<{ id: string; total_nominal: number; status: string } | null>(null)
  const [catatRiwayat,   setCatatRiwayat]   = useState<PembayaranRow[]>([])
  const [catatJumlah,    setCatatJumlah]    = useState('')
  const [catatTanggal,   setCatatTanggal]   = useState('')
  const [catatMetode,    setCatatMetode]    = useState<'tunai' | 'transfer' | 'qris'>('tunai')
  const [catatCatatan,   setCatatCatatan]   = useState('')
  const [catatSearching, setCatatSearching] = useState(false)
  const [catatSaving,    setCatatSaving]    = useState(false)

  // Modal 2/3 — Detail extras
  const [detailBeasiswa,   setDetailBeasiswa]   = useState<DetailBeasiswaRow[]>([])
  const [detailKomponen,   setDetailKomponen]   = useState<DetailKomponenRow[]>([])
  const [detailTunggakan,  setDetailTunggakan]  = useState<TunggakanRow[]>([])
  const [detailPembayaran, setDetailPembayaran] = useState<PembayaranRow[]>([])
  const [detailPaketNama,  setDetailPaketNama]  = useState('')
  const [detailLoading,    setDetailLoading]    = useState(false)

  // Pemulihan rincian hanya boleh dicoba sekali per kunjungan — realtime sync
  // memanggil loadTagihan berulang kali dan tanpa pagar ini repair akan
  // dipicu terus-menerus
  const perbaikanRincianRef = useRef(false)

  // ── loadTagihan ─────────────────────────────────────────────────────────────

  // Total tagihan yang sudah terbit dihitung dari snapshot tagihan_item, bukan
  // diturunkan ulang dari paket. Paket yang diedit belakangan tidak boleh mengubah
  // nominal tagihan yang kuitansinya sudah dipegang orang tua.
  const loadTagihan = useCallback(async function load(sid: string, bulan: number, tahun: number): Promise<SiswaTagihanRow[]> {
    const [{ data: tagihanData }, { data: riwayatRows }, { data: taPeriode }, { data: tunggakanData }] = await Promise.all([
      supabase
        .from('tagihan')
        // kelas_terakhir: alias kolom teks `siswa.kelas` — snapshot kelas terakhir alumni.
        // Perlu di-alias karena `kelas` sudah dipakai sebagai alias relasi kelas_id.
        .select('id, total_nominal, status, jatuh_tempo, payment_token, tagihan_item(komponen_id, nominal), siswa:siswa_id(id, nama, nis, no_wa, nama_wali, status, kelas_terakhir:kelas, kelas:kelas_id(id, nama, jenjang, warna))')
        .eq('sekolah_id', sid)
        .eq('bulan', bulan)
        .eq('tahun', tahun)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('tagihan')
        .select('siswa_id, bulan, tahun, tagihan_item(komponen_id)')
        .eq('sekolah_id', sid)
        .limit(5000),
      supabase
        .from('tahun_ajaran').select(TA_PERIODE_SELECT).eq('sekolah_id', sid).eq('is_aktif', true).maybeSingle(),
      // Tunggakan periode sebelumnya per siswa — hanya tagihan sebelum bulan ini.
      // status = belum_bayar: tagihan yang sudah dicicil sebagian tidak terhitung
      // di sini — sisanya terlacak lewat halaman Laporan Tunggakan.
      // Diambil bertahap: status Menunggak bergantung pada daftar ini, dan satu
      // permintaan bisa diam-diam terpotong di batas baris PostgREST.
      ambilSemua((dari, sampai) => supabase
        .from('tagihan')
        .select('id, siswa_id, status, bulan, tahun, jatuh_tempo, total_nominal, siswa:siswa_id(status)')
        .eq('sekolah_id', sid)
        .eq('status', 'belum_bayar')
        .or(`tahun.lt.${tahun},and(tahun.eq.${tahun},bulan.lt.${bulan})`)
        .order('id')
        .range(dari, sampai)),
    ])

    const riwayat = bangunRiwayatTagih(
      (riwayatRows ?? []) as unknown as { siswa_id: string; bulan: number; tahun: number; tagihan_item: { komponen_id: string | null }[] }[]
    )
    const ta = (taPeriode ?? null) as PeriodeTahunAjaran | null

    // siswa_id → tunggakan periode sebelum bulan ini, per bulan, terlama dulu.
    // Aturannya adalahTunggakanLama — sama dengan blok tunggakan di modal detail agar
    // angka di tabel dan di modal tidak berselisih.
    //
    // Nominalnya total_nominal, bukan jumlah tagihan_item: rincian dicatat sebelum
    // potongan beasiswa, jadi menjumlahkannya membesarkan tunggakan penerima beasiswa
    // dan memunculkan tunggakan palsu untuk tagihan Rp 0 (beasiswa penuh).
    type TunggakanRaw = {
      siswa_id: string; status: string; bulan: number; tahun: number
      jatuh_tempo: string | null; total_nominal: number
      siswa: { status: string | null } | null
    }
    const periodeIni = periodeIndex(bulan, tahun)
    const sekarang   = new Date()
    const tunggakanPerSiswa = new Map<string, TunggakanBulan[]>()
    for (const t of ((tunggakanData ?? []) as unknown as TunggakanRaw[])) {
      if (!adalahTunggakanLama(t, periodeIni, sekarang, t.siswa?.status === 'alumni')) continue
      const daftar = tunggakanPerSiswa.get(t.siswa_id) ?? []
      daftar.push({ bulan: t.bulan, tahun: t.tahun, sisa: t.total_nominal })
      tunggakanPerSiswa.set(t.siswa_id, daftar)
    }
    for (const daftar of tunggakanPerSiswa.values()) {
      daftar.sort((a, b) => periodeIndex(a.bulan, a.tahun) - periodeIndex(b.bulan, b.tahun))
    }

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

    const siswaIds = rows.map(r => r.siswa?.id).filter(Boolean) as string[]
    const today    = new Date().toISOString().split('T')[0]

    const [{ data: bsData }, { data: individuData }] = siswaIds.length > 0
      ? await Promise.all([
          supabase
            .from('beasiswa_siswa')
            .select('siswa_id, beasiswa:beasiswa_id(jenis_potongan, persen, nominal, beasiswa_komponen(komponen_id))')
            .in('siswa_id', siswaIds)
            .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${today}`),
          supabase
            .from('siswa_komponen_individu')
            .select('siswa_id, komponen_id, nominal, komponen:komponen_id(jenis)')
            .in('siswa_id', siswaIds),
        ])
      : [{ data: [] }, { data: [] }]

    const siswaBeasiswaMap = new Map<string, { jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null; komponen_ids: Set<string> }[]>()
    for (const row of ((bsData ?? []) as unknown as BeasiswaSiswaRaw[])) {
      if (!row.beasiswa) continue
      const list = siswaBeasiswaMap.get(row.siswa_id) ?? []
      list.push({ jenis_potongan: row.beasiswa.jenis_potongan, persen: row.beasiswa.persen, nominal: row.beasiswa.nominal, komponen_ids: new Set(row.beasiswa.beasiswa_komponen.map(bk => bk.komponen_id)) })
      siswaBeasiswaMap.set(row.siswa_id, list)
    }

    type IndividuEntry = { komponen_id: string; jenis: string; nominal: number }
    const siswaIndividuMap = new Map<string, IndividuEntry[]>()
    for (const row of ((individuData ?? []) as unknown as IndividuSiswaRaw[])) {
      if (!row.komponen) continue
      const list = siswaIndividuMap.get(row.siswa_id) ?? []
      list.push({ komponen_id: row.komponen_id, jenis: row.komponen.jenis, nominal: row.nominal })
      siswaIndividuMap.set(row.siswa_id, list)
    }

    const siswaCorrectTotal = new Map<string, number>()
    for (const r of rows) {
      const siswaId = r.siswa?.id ?? ''

      // Dasar total = snapshot komponen yang benar-benar diterbitkan pada tagihan ini
      const snapshot   = r.tagihan_item ?? []
      const paketBase  = snapshot.reduce((s, i) => s + i.nominal, 0)
      const kompNomMap = new Map(
        snapshot.filter(i => i.komponen_id).map(i => [i.komponen_id as string, i.nominal])
      )

      // Komponen individu yang ditambahkan setelah tagihan terbit ikut dihitung,
      // selama jenisnya memang boleh ditagih pada bulan ini
      const individuTotal = (siswaIndividuMap.get(siswaId) ?? [])
        .filter(k => !kompNomMap.has(k.komponen_id))
        .filter(k => komponenDitagihkan(k.jenis, bulan, tahun, ta, siswaId, k.komponen_id, riwayat))
        .reduce((s, k) => s + k.nominal, 0)

      // Potongan beasiswa hanya berlaku atas komponen yang ditagihkan bulan ini
      let deduction = 0
      for (const bs of (siswaBeasiswaMap.get(siswaId) ?? [])) {
        for (const kid of bs.komponen_ids) {
          const kNom = kompNomMap.get(kid)
          if (kNom === undefined) continue
          deduction += bs.jenis_potongan === 'persen' ? Math.round(kNom * (bs.persen ?? 0) / 100) : (bs.nominal ?? 0)
        }
      }
      const correct = Math.max(0, paketBase + individuTotal - deduction)

      // Snapshot kosong bukan bukti tagihannya memang nol — bisa jadi rinciannya
      // yang belum sempat dibuat. Baris seperti ini dipulihkan oleh backfill di
      // /api/recalculate-tagihan, bukan dinolkan di sini: sekali total_nominal
      // ditimpa nol, angka aslinya tidak bisa diturunkan ulang dari mana pun.
      if (snapshot.length === 0 && correct === 0 && r.total_nominal > 0) continue

      siswaCorrectTotal.set(siswaId, correct)
    }

    // Number.isFinite menyaring NaN: satu nominal yang hilang cukup untuk membuat
    // seluruh perhitungan NaN, dan menulisnya ke database akan mengosongkan
    // total_nominal (JSON.stringify(NaN) → null) sehingga nilai aslinya hilang.
    const toUpdate = rows.flatMap(r => {
      const siswaId = r.siswa?.id ?? ''
      const correct = siswaCorrectTotal.get(siswaId)
      return correct !== undefined && Number.isFinite(correct) && correct !== r.total_nominal
        ? [{ id: r.id, total: correct }]
        : []
    })
    if (toUpdate.length > 0) {
      await Promise.all(toUpdate.map(({ id, total }) => supabase.from('tagihan').update({ total_nominal: total }).eq('id', id)))
    }

    // Dimuat sesudah koreksi total di atas tertulis, supaya nilai bulan ini di
    // ringkasan periode sama dengan yang tampil di tabel
    const ringkasanPromise = muatRingkasanPeriode(sid, ta, bulan, tahun)

    const result: SiswaTagihanRow[] = rows.map(r => {
      const siswaId         = r.siswa?.id ?? ''
      const kelas           = r.siswa?.kelas
      const tunggakanDaftar = tunggakanPerSiswa.get(siswaId) ?? []
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
        total_nominal: siswaCorrectTotal.get(siswaId) ?? r.total_nominal,
        tunggakan:     tunggakanDaftar.reduce((s, d) => s + d.sisa, 0),
        tunggakanDaftar,
        status:        (r.status === 'sebagian' ? 'cicilan' : r.status) as SiswaTagihanRow['status'],
        jatuh_tempo:   r.jatuh_tempo,
        no_wa:         r.siswa?.no_wa ?? '',
        nama_wali:     r.siswa?.nama_wali ?? '',
        payment_token: r.payment_token ?? '',
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
          const res = await runGenerate(sid, tahun, bulanIni, tahunIni)
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
          runGenerate(sekolahId, tahunAjaran, bulanIni, tahunIni)
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
    runGenerate(sekolahId, tahunAjaran, bulanIni, tahunIni)
      .then(() => { if (alive) return loadTagihan(sekolahId, bulanIni, tahunIni) })
      .catch(() => { /* pertahankan data lama; realtime sync akan menyusul */ })

    return () => { alive = false }
  }, [bulanIni, tahunIni, sekolahId, tahunAjaran, loadTagihan])

  // ── Search catat siswa ────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!showCatatModal || !catatQuery.trim() || catatSelected) {
        setCatatResults([])
        return
      }
      setCatatSearching(true)
      const { data } = await supabase
        .from('siswa')
        .select('id, nama, nis, no_wa, nama_wali, kelas:kelas_id(id, nama, warna)')
        .eq('sekolah_id', sekolahId)
        .eq('status', 'aktif')
        .or(`nama.ilike.%${catatQuery.trim()}%,nis.ilike.%${catatQuery.trim()}%`)
        .limit(5)
      setCatatResults((data ?? []) as unknown as CatatSiswaResult[])
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
    // (template yang sama dengan pengingat di Laporan). Tagihan bulan ini ikut
    // dicantumkan kalau sudah lewat jatuh tempo juga; halaman bayar lewat tautan
    // yang sama menagih bulan ini beserta seluruh tunggakan.
    const bulanIniLewatTempo = statusEfektif(
      t.status, lewatJatuhTempo({ jatuh_tempo: t.jatuh_tempo, bulan: bulanIni, tahun: tahunIni }, now), t.is_alumni, t.total_nominal,
    ) === 'menunggak'
    const content = t.tunggakanDaftar.length > 0
      ? buildPesanTunggakanText({
          namaWali:  t.nama_wali,
          namaSiswa: t.nama,
          kelasNama: t.kelas_nama,
          daftar:    bulanIniLewatTempo
            ? [...t.tunggakanDaftar, { bulan: bulanIni, tahun: tahunIni, sisa: t.total_nominal }]
            : t.tunggakanDaftar,
          namaSekolah,
          paymentUrl,
        })
      : buildPesanTagihanText({
          namaWali:     t.nama_wali,
          namaSiswa:    t.nama,
          kelasNama:    t.kelas_nama,
          totalNominal: t.total_nominal,
          bulan:        bulanIni,
          tahun:        tahunIni,
          namaSekolah,
          paymentUrl,
        })

    window.open(buildWaMeLink(t.no_wa, content), '_blank', 'noopener,noreferrer')
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

  const anyModalOpen = showCatatModal || showDetailModal

  // ── Hitung mundur ke jatuh tempo tagihan ──────────────────────────────────────

  const sisaHari = (t: SiswaTagihanRow) =>
    Math.max(0, Math.floor((batasJatuhTempo(waktuTagihan(t)).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  // ── Detail modal computed values ──────────────────────────────────────────────

  const detailEffStatus: EffectiveStatus = detailSiswa ? getEffStatus(detailSiswa) : 'belum_bayar'
  const detailBadge  = STATUS_CONFIG[detailEffStatus]
  const detailAvatar = detailSiswa?.kelas_warna || '#1A2C4E'

  // ── Modal 1 handlers ─────────────────────────────────────────────────────────

  const resetCatatModal = () => {
    setCatatQuery('')
    setCatatResults([])
    setCatatSelected(null)
    setCatatTagihan(null)
    setCatatRiwayat([])
    setCatatJumlah('')
    setCatatTanggal('')
    setCatatMetode('tunai')
    setCatatCatatan('')
  }

  const selectCatatSiswa = async (siswa: CatatSiswaResult) => {
    setCatatSelected(siswa)
    setCatatResults([])
    setCatatQuery(siswa.nama)
    // Tanggal lokal, bukan UTC — toISOString() memberi tanggal kemarin sebelum pukul 07.00 WIB
    setCatatTanggal(new Date().toLocaleDateString('en-CA'))
    const { data: tRow } = await supabase
      .from('tagihan')
      .select('id, total_nominal, status')
      .eq('siswa_id', siswa.id)
      .eq('bulan', bulanIni)
      .eq('tahun', tahunIni)
      .maybeSingle()
    if (tRow) {
      const t = tRow as { id: string; total_nominal: number; status: string }
      setCatatTagihan(t)
      const { data: riwayatData } = await supabase
        .from('pembayaran')
        .select('id, jumlah, metode, tanggal_bayar, catatan')
        .eq('tagihan_id', t.id)
        .order('created_at', { ascending: true })
        .limit(20)
      const riwayat = (riwayatData ?? []) as PembayaranRow[]
      setCatatRiwayat(riwayat)
      setCatatJumlah(String(Math.max(0, t.total_nominal - riwayat.reduce((s, r) => s + r.jumlah, 0))))
    }
  }

  const simpanPembayaran = async () => {
    if (!catatSelected || !catatTagihan || !catatJumlah || !catatTanggal || !sekolahId) return
    const jumlah = parseInt(catatJumlah, 10)
    if (!jumlah || jumlah <= 0) return
    setCatatSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('pembayaran').insert({
      sekolah_id:       sekolahId,
      tagihan_siswa_id: catatTagihan.id,
      tagihan_id:       catatTagihan.id,
      siswa_id:         catatSelected.id,
      jumlah,
      metode:           catatMetode,
      tanggal_bayar:    new Date(catatTanggal).toISOString(),
      catatan:          catatCatatan || null,
      status:           'terkonfirmasi',
      created_by:       user?.id ?? null,
    })
    if (error) { alert('Gagal menyimpan: ' + error.message); setCatatSaving(false); return }
    const sudah = catatRiwayat.reduce((s, r) => s + r.jumlah, 0) + jumlah
    await supabase.from('tagihan').update({ status: sudah >= catatTagihan.total_nominal ? 'lunas' : 'cicilan' }).eq('id', catatTagihan.id)
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
        .select('beasiswa:beasiswa_id(nama, jenis_potongan, persen, nominal)')
        .eq('siswa_id', t.siswa_id)
        .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${today}`),
      supabase
        .from('tagihan_item')
        .select('komponen_id, nama_komponen, nominal, komponen:komponen_id(jenis)')
        .eq('tagihan_id', t.tagihan_id)
        .order('nominal', { ascending: false }),
      supabase
        .from('paket')
        .select('nama, paket_kelas(kelas_id)')
        .eq('sekolah_id', sekolahId)
        .eq('tahun_ajaran', tahunAjaran),
      // Tagihan bulan lain yang belum dibayar sama sekali — sumber komponen tunggakan
      supabase
        .from('tagihan')
        .select('id, status, bulan, tahun, jatuh_tempo, total_nominal, tagihan_item(nama_komponen, nominal, komponen:komponen_id(jenis))')
        .eq('sekolah_id', sekolahId)
        .eq('siswa_id', t.siswa_id)
        .eq('status', 'belum_bayar')
        .neq('id', t.tagihan_id)
        .limit(24),
    ])
    type BsRaw = { beasiswa: DetailBeasiswaRow | null }
    setDetailBeasiswa(((bsData ?? []) as unknown as BsRaw[]).map(r => r.beasiswa).filter((b): b is DetailBeasiswaRow => b !== null))

    // Merge tagihan_item snapshot + komponen individu yang ditambah belakangan
    type ItemRaw = { komponen_id: string | null; nama_komponen: string; nominal: number; komponen: { jenis: string } | null }
    const snapshotItems = (itemData ?? []) as ItemRaw[]
    const snapshotKompIds = new Set(snapshotItems.map(i => i.komponen_id).filter(Boolean) as string[])
    const { data: individuData } = await supabase
      .from('siswa_komponen_individu')
      .select('komponen_id, nominal, komponen:komponen_id(nama, jenis)')
      .eq('siswa_id', t.siswa_id)
    type IndivRaw = { komponen_id: string; nominal: number; komponen: { nama: string; jenis: string } | null }
    const extraItems: DetailKomponenRow[] = ((individuData ?? []) as unknown as IndivRaw[])
      .filter(i => i.komponen && !snapshotKompIds.has(i.komponen_id))
      .map(i => ({ nama_komponen: i.komponen!.nama, nominal: i.nominal, jenis: i.komponen!.jenis }))
    setDetailKomponen([
      ...snapshotItems.map(i => ({ nama_komponen: i.nama_komponen, nominal: i.nominal, jenis: i.komponen?.jenis ?? '' })),
      ...extraItems,
    ])

    // Komponen dari tagihan periode sebelumnya yang menunggak — aturannya
    // adalahTunggakanLama, sama dengan kolom total di tabel.
    // Hanya ditampilkan sebagai informasi — tidak ikut dijumlahkan ke total bulan ini.
    type TunggakanRaw = {
      status: string; bulan: number; tahun: number; jatuh_tempo: string | null; total_nominal: number
      tagihan_item: { nama_komponen: string; nominal: number; komponen: { jenis: string } | null }[]
    }
    const periodeIni = periodeIndex(bulanIni, tahunIni)
    const sekarang   = new Date()
    setDetailTunggakan(
      ((tunggakanData ?? []) as unknown as TunggakanRaw[])
        .filter(tg => adalahTunggakanLama(tg, periodeIni, sekarang, t.is_alumni))
        .flatMap(tg => {
          // jenis boleh kosong: komponen yang sudah dihapus menyisakan snapshot
          // nama dan nominalnya di tagihan_item, dan itu tetap uang yang terutang
          const rincian = (tg.tagihan_item ?? []).map(i => ({ nama_komponen: i.nama_komponen, nominal: i.nominal, jenis: i.komponen?.jenis ?? '', bulan: tg.bulan, tahun: tg.tahun }))
          // tagihan_item dicatat sebelum potongan beasiswa (dan tanpa komponen individu
          // yang ditambah belakangan). Selisihnya dengan total_nominal jadi baris
          // tersendiri, supaya jumlah blok ini sama dengan kolom total di tabel.
          const selisih = tg.total_nominal - rincian.reduce((s, i) => s + i.nominal, 0)
          return selisih === 0 ? rincian : [...rincian, {
            nama_komponen: selisih < 0 ? 'Potongan beasiswa' : 'Komponen tambahan',
            nominal: selisih, jenis: '', bulan: tg.bulan, tahun: tg.tahun,
          }]
        })
        .sort((a, b) => periodeIndex(a.bulan, a.tahun) - periodeIndex(b.bulan, b.tahun))
    )

    type PaketRaw = { nama: string; paket_kelas: { kelas_id: string }[] }
    const paketForKelas = ((paketData ?? []) as unknown as PaketRaw[]).find(p => p.paket_kelas?.some(pk => pk.kelas_id === t.kelas_id))
    setDetailPaketNama(paketForKelas?.nama ?? '—')
    if (t.status === 'cicilan' || t.status === 'lunas') {
      const { data: pembData } = await supabase
        .from('pembayaran')
        .select('id, jumlah, metode, tanggal_bayar, catatan')
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

  const catatSudah = catatRiwayat.reduce((s, r) => s + r.jumlah, 0)
  const catatSisa  = catatTagihan ? Math.max(0, catatTagihan.total_nominal - catatSudah) : 0

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Memuat data...</div>
      </div>
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

      {/* ── States: no paket / auto-generating / error / empty ───────────── */}
      {!hasPaket ? (
        <div style={sCard}>
          <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ width: 64, height: 64, background: '#F1F5F9', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <ClipboardList size={30} color="#94A3B8" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1A2C4E', marginBottom: '0.4rem' }}>Belum ada tagihan saat ini</div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Tagihan akan muncul otomatis setelah paket per kelas dan data siswa sudah diatur
            </div>
          </div>
        </div>
      ) : autoGenerating ? (
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
            <div style={{ fontSize: '0.84rem', color: '#374151', marginBottom: '1.25rem', maxWidth: 380, margin: '0 auto 1.25rem' }}>
              {autoGenError}
            </div>
            <button onClick={() => router.push('/tagihan/paket-kelas')}
              style={{ background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Konfigurasi Paket Per Kelas
            </button>
          </div>
        </div>
      ) : tagihanList.length === 0 ? (
        <div style={sCard}>
          <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ width: 64, height: 64, background: '#F1F5F9', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <ClipboardList size={30} color="#94A3B8" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1A2C4E', marginBottom: '0.4rem' }}>Belum ada tagihan saat ini</div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Tagihan akan muncul otomatis setelah paket per kelas dan data siswa sudah diatur
            </div>
          </div>
        </div>
      ) : (
        <>
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
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>Total siswa ditagih</span>
                  <Image src="/icons/IconDollar.png" width={22} height={22} alt="" style={{ opacity: 0.45 }} />
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
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>Total tagihan periode ini</span>
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A2C4E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/><path d="M5 5v14"/></svg>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A2C4E' }}>Sudah masuk</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: '0.25rem' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A2C4E' }}>{formatRp(ringkasanPeriode.masuk)}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ background: '#F7DD7D', borderRadius: 10, padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.4rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A2C4E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/><path d="M19 5v14"/></svg>
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
              <div style={{ position: 'relative' }}>
                <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  placeholder="Cari nama siswa"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ ...sInput, paddingLeft: '2.25rem', width: 220 }}
                />
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

                        {/* Total — tagihan bulan ini digabung dengan tunggakan periode sebelumnya */}
                        <td style={{ ...sTd, fontWeight: 700, color: '#1A2C4E', fontVariantNumeric: 'tabular-nums' }}>
                          {formatRp((t.total_nominal ?? 0) + (t.tunggakan ?? 0))}
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
                                {hasWa && (
                                  <button
                                    onClick={() => { if (!anyModalOpen) kirimWA(t) }}
                                    disabled={anyModalOpen}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: waSentSuccess.has(t.tagihan_id) ? '#BBF7D0' : '#DCFCE7', color: '#15803D', borderRadius: 8, padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: anyModalOpen ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: anyModalOpen ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                                    <Image src='/icons/IconWA.png' width={16} height={16} alt='WA' />
                                    {waSentSuccess.has(t.tagihan_id) ? 'Terkirim!' : 'Ingatkan'}
                                  </button>
                                )}
                              </>
                            ) : eff === 'lunas' ? null : (
                              hasWa ? (
                                <button
                                  onClick={() => { if (!anyModalOpen) kirimWA(t) }}
                                  disabled={anyModalOpen}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: waSentSuccess.has(t.tagihan_id) ? '#BBF7D0' : '#DCFCE7', color: '#15803D', borderRadius: 8, padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: anyModalOpen ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: anyModalOpen ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                                  <Image src='/icons/IconWA.png' width={16} height={16} alt='WA' />
                                  {waSentSuccess.has(t.tagihan_id) ? 'Terkirim!' : 'Ingatkan'}
                                </button>
                              ) : (
                                <span style={{ color: '#CBD5E1', fontSize: '0.85rem', minWidth: 24 }}>—</span>
                              )
                            )}

                            <button
                              onClick={() => { if (!anyModalOpen) openDetailModal(t) }}
                              disabled={anyModalOpen}
                              title="Lihat detail"
                              style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, cursor: anyModalOpen ? 'not-allowed' : 'pointer', color: '#64748B', flexShrink: 0, opacity: anyModalOpen ? 0.4 : 0.8 }}>
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
                  <button onClick={() => { setCatatSelected(null); setCatatTagihan(null); setCatatRiwayat([]); setCatatJumlah(''); setCatatQuery('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex' }}><X size={15} /></button>
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

            {catatSelected && catatTagihan && (
              <>
                {/* Riwayat pembayaran */}
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

                {/* Summary */}
                <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                  {([
                    { label: 'Total tagihan',  val: formatRp(catatTagihan.total_nominal) },
                    { label: 'Sudah dibayar', val: formatRp(catatSudah) },
                  ] as const).map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.875rem', color: '#374151' }}>
                      <span>{row.label}</span><span>{row.val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #E2E8F0', fontSize: '0.95rem', fontWeight: 800, color: '#1A2C4E' }}>
                    <span>Sisa tagihan</span>
                    <span style={{ color: catatSisa === 0 ? '#22C55E' : '#1A2C4E' }}>{formatRp(catatSisa)}</span>
                  </div>
                </div>

                {/* Form */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.35rem' }}>Jumlah dibayar</div>
                    <input
                      type="number"
                      value={catatJumlah}
                      onChange={e => setCatatJumlah(e.target.value)}
                      placeholder="0"
                      style={{ ...sInput, width: '100%', boxSizing: 'border-box' as const, border: '1.5px solid #E2E8F0', borderRadius: 10 }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>ⓘ Isi jumlah yang dibayar</div>
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
              </>
            )}

            {catatSelected && !catatTagihan && (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#92400E', fontSize: '0.82rem', marginBottom: '1rem', background: '#FEF9C3', borderRadius: 10 }}>
                Siswa ini belum memiliki tagihan untuk bulan ini.
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { resetCatatModal(); setShowCatatModal(false) }} style={sBtnSecondary}>Tutup</button>
              {catatSelected && catatTagihan && (
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
                ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0' }}>Memuat...</span>
                : detailBeasiswa.map((bs, i) => (
                    <span key={i} style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                      🎗 {bs.nama}
                    </span>
                  ))
              }
            </div>

            {/* Info rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #F1F5F9' }}>
              {[
                { label: 'Paket berlaku', val: detailLoading ? '...' : detailPaketNama },
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
                  <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Memuat rincian...</div>
                ) : detailKomponen.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Belum ada rincian komponen.</div>
                ) : (
                  <>
                    {detailKomponen.map((k, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.55rem 1rem', borderBottom: '1px solid #F8FAFC' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: JENIS_WARNA[k.jenis] ?? '#94A3B8', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '0.82rem', color: '#374151' }}>{k.nama_komponen}</span>
                        {JENIS_LABEL[k.jenis] && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: JENIS_WARNA[k.jenis], background: JENIS_WARNA[k.jenis] + '1F', padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {JENIS_LABEL[k.jenis]}
                          </span>
                        )}
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A2C4E' }}>{formatRp(k.nominal)}</span>
                      </div>
                    ))}
                    {detailBeasiswa.map((bs, i) => (
                      <div key={`bs-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.55rem 1rem', borderBottom: '1px solid #F8FAFC' }}>
                        <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>🎗 {bs.nama}</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.875rem', borderTop: '1.5px solid #E2E8F0', marginTop: '0.75rem', marginBottom: detailTunggakan.length > 0 ? '1rem' : '1.25rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1A2C4E' }}>
                Total tagihan {detailTunggakan.length > 0 ? BULAN_NAMES[bulanIni] : ''}
              </span>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1A2C4E' }}>{formatRp(detailSiswa.total_nominal)}</span>
            </div>

            {/* Tunggakan komponen dari periode sebelumnya (informasi, tidak masuk total di atas) */}
            {!detailLoading && detailTunggakan.length > 0 && (() => {
              const totalTunggakan = detailTunggakan.reduce((s, k) => s + k.nominal, 0)
              // Yang belum lunas dari bulan ini = sisanya, bukan nilai tagihannya: siswa
              // yang bulan ini sudah Lunas/Cicilan tetap bisa punya tunggakan lama.
              // detailPembayaran dimuat untuk tagihan berstatus cicilan dan lunas.
              const sisaBulanIni = Math.max(0, detailSiswa.total_nominal - detailPembayaran.reduce((s, p) => s + p.jumlah, 0))
              return (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem' }}>
                    <AlertTriangle size={14} color="#D97706" />
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400E' }}>Tunggakan bulan sebelumnya</span>
                  </div>
                  <div style={{ border: '1.5px solid #FDE68A', background: '#FFFBEB', borderRadius: 10, overflow: 'hidden', maxHeight: 160, overflowY: 'auto' }}>
                    {detailTunggakan.map((k, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.55rem 1rem', borderBottom: '1px solid #FEF3C7' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: JENIS_WARNA[k.jenis] ?? '#94A3B8', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '0.82rem', color: '#374151' }}>{k.nama_komponen}</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#92400E', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {BULAN_NAMES[k.bulan]} {k.tahun}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#92400E' }}>
                          {k.nominal < 0 ? `−${formatRp(-k.nominal)}` : formatRp(k.nominal)}
                        </span>
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
              {detailSiswa.status !== 'lunas' && (
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

// ── Style constants ───────────────────────────────────────────────────────────

const sCard: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '6rem 2rem',
  marginBottom: '1rem',
  borderLeft: '28px solid #1A2C4E',
  boxShadow: '0 0 10px #1a2c4e6e',
}

const sSelect: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
  border: '1.5px solid var(--border)',
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
  border: '1.5px solid var(--border)',
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
