'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import Image from 'next/image'
import { BarChart2, Database, AlertTriangle, Download, Receipt, Users, GraduationCap, FileSpreadsheet, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { unduhTabel, type FormatEkspor } from '@/lib/unduhTabelLaporan'
import { useKopLaporan } from '@/lib/useKopLaporan'
import { ModalKopBelumLengkap } from '@/components/laporan/ModalKopBelumLengkap'
import { ModalPilihKomponen } from '@/components/laporan/ModalPilihKomponen'
import { batasJatuhTempo, type WaktuTagihan } from '@/lib/statusTagihan'
import {
  hitungRingkasan, hitungPemasukan, umurTunggakan, trenTagihanRealisasi, adalahTunggakan,
  komposisiStatusSiswa, jumlahSiswaTertunggak,
} from '@/lib/metrikLaporan'
import { komponenBelumDibayar, komposisiPerTagihan, ringkasPerJenjang, hitungMetrikUtama, type MetrikUtama } from '@/lib/laporanUtama'
import { unduhLaporanUtamaPdf, type KolomUtama } from '@/lib/laporanUtamaPdf'
import {
  akhiranNamaFile, bagiBuktiKeKunci, bagiKeKunci, daftarOpsiKomponen, itemKas, jumlahDalam, kolomKomponen,
  kunciItemKomponen, pilihanAwal, pisahPerKomponen, proyeksiSemua, rincianSemuaTagihan, simpanPilihanKomponen,
  teksKomponen, type KolomKomponen, type PilihanKomponen,
} from '@/lib/komponenLaporan'
import type { ItemTagihanKas } from '@/lib/kasKomponen'
import { tagihanBukti } from '@/lib/rincianKomponen'
import { BULAN_PANJANG as BULAN_NAMES_FULL } from '@/lib/formatLaporan'
import { useDataLaporan } from '@/lib/useDataLaporan'
import { useFilterLaporan, monthsInRange } from '@/lib/useFilterLaporan'
import { HeaderLaporan } from '@/components/laporan/HeaderLaporan'
import { FilterLaporan } from '@/components/laporan/FilterLaporan'
import { TrenTagihanChart } from '@/components/laporan/TrenTagihanChart'
import { CariSiswa, type SiswaCari } from '@/components/laporan/CariSiswa'
import { KartuTab } from '@/components/laporan/KartuTab'
import {
  KartuRingkasanUtama, KomposisiStatus, KomponenBelumDibayar, UmurTunggakan, PembayaranPerJenjang,
  type JenjangRingkas, type KomponenBelum,
} from '@/components/laporan/RingkasanUtama'
import { sBingkai, WARNA_LAPORAN } from '@/components/laporan/gayaLaporan'
import { SkeletonLaporan } from '@/components/skeleton/SkeletonLaporan'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Sama seperti naik-kelas & dashboard — dipakai untuk menurunkan angkatan dari posisi jenjang siswa.
const JENJANG_MAP: Record<string, string[]> = {
  'TK/PAUD': ['A', 'B', 'C'],
  'SD/MI':   ['1', '2', '3', '4', '5', '6'],
  'SMP/MTs': ['7', '8', '9'],
  'SMA/MA':  ['10', '11', '12'],
  'SMK':     ['10', '11', '12'],
}

const periodKey = (bulan: number, tahun: number) => `${tahun}-${bulan}`

const METODE_LABELS: Record<string, string> = {
  tunai:    'Tunai',
  transfer: 'Transfer Manual',
  qris:     'QRIS',
  va:       'Virtual Account',
}
const metodeLabel = (m: string | null) => (m ? (METODE_LABELS[m] ?? m) : 'Transfer Manual')

function jenisPembayaranLabel(
  items: { nama_komponen: string; komponen: { jenis: string } | null }[],
  bulan: number,
  tahun: number,
): string {
  if (items.length === 0) return '-'
  return items
    .map(item => item.komponen?.jenis === 'rutin_bulanan'
      ? `${item.nama_komponen} ${BULAN_NAMES_FULL[bulan]} ${tahun}`
      : item.nama_komponen)
    .join(', ')
}

interface PaketKelasInfo { nama: string; komponenIds: Set<string> }

// Tagihan bulanan biasanya cuma berisi sebagian komponen paket (rutin_bulanan tiap bulan,
// sekali_bayar cuma bulan pertama, per_semester cuma bulan semester) — jadi dicek dengan subset,
// bukan exact match, terhadap komponen paket kelas siswa tsb. Kalau semua item tagihan berasal dari
// paket standar (tidak ada komponen individu/kustom di luar paket), tampilkan nama paketnya saja.
function resolveJenisLabel(
  items: { komponen_id: string | null; nama_komponen: string; komponen: { jenis: string } | null }[],
  bulan: number,
  tahun: number,
  kelasId: string | null,
  paketByKelas: Map<string, PaketKelasInfo>,
): string {
  if (items.length === 0) return '-'
  const paket = kelasId ? paketByKelas.get(kelasId) : undefined
  if (paket) {
    const isFromPaket = items.every(i => i.komponen_id && paket.komponenIds.has(i.komponen_id))
    if (isFromPaket) return paket.nama
  }
  return jenisPembayaranLabel(items, bulan, tahun)
}

/**
 * Label jenis untuk unduhan per komponen: hanya komponen yang `terima`. Kalau semua
 * komponen tagihannya diterima, labelnya sama dengan unduhan biasa (nama paket).
 */
function resolveJenisTerpilih(
  items: { komponen_id: string | null; nama_komponen: string; komponen: { jenis: string; nama: string } | null }[],
  bulan: number,
  tahun: number,
  kelasId: string | null,
  paketByKelas: Map<string, PaketKelasInfo>,
  terima: (kunci: string) => boolean,
): string {
  const masuk = items.filter(i => terima(kunciItemKomponen(i)))
  if (masuk.length === items.length) return resolveJenisLabel(items, bulan, tahun, kelasId, paketByKelas)
  return jenisPembayaranLabel(masuk, bulan, tahun)
}

/** Jumlah rupiah untuk kunci-kunci komponen tertentu */
const jumlahKunci = (bagian: Map<string, number>, kunci: ReadonlySet<string>): number =>
  [...bagian].reduce((s, [k, j]) => (kunci.has(k) ? s + j : s), 0)

async function buildPaketByKelasMap(sekolahId: string): Promise<Map<string, PaketKelasInfo>> {
  const { data, error } = await supabase
    .from('paket')
    .select('nama, paket_kelas(kelas_id), paket_komponen(komponen_id)')
    .eq('sekolah_id', sekolahId)
    .limit(200)
  if (error) console.error('[Laporan] gagal memuat paket kelas:', error)

  const map = new Map<string, PaketKelasInfo>()
  for (const p of ((data ?? []) as unknown as { nama: string; paket_kelas: { kelas_id: string }[]; paket_komponen: { komponen_id: string }[] }[])) {
    const komponenIds = new Set(p.paket_komponen.map(k => k.komponen_id))
    for (const pk of p.paket_kelas) map.set(pk.kelas_id, { nama: p.nama, komponenIds })
  }
  return map
}

/** Unduhan berisi rupiah — yang bisa dipilih komponennya */
type JenisUnduhan = 'utama' | 'transaksi' | 'tunggakan' | 'alumni' | 'tahunan'

/** Keterangan dan akhiran nama berkas untuk unduhan per komponen */
interface InfoKomponen {
  /** " · Komponen: SPP" — ditempel ke keterangan */
  keterangan: string
  /** "_SPP" — ditempel ke nama berkas */
  akhiran:    string
}

// Data sekolah demo cuma isi NIS, belum isi NISN — fallback ke NIS supaya kolom tidak kosong.
function nisnOrNis(siswa: { nisn: string | null; nis: string | null } | null | undefined): string {
  return siswa?.nisn ?? siswa?.nis ?? '-'
}

function generateIdTransaksi(tanggalIso: string, seq: number): string {
  const d = new Date(tanggalIso)
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `TRX${yyyymmdd}${String(seq).padStart(3, '0')}`
}

function formatTanggalExcel(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Jatuh tempo per tagihan (snapshot paket kelasnya), ditulis sebagai tanggal WIB
// YYYY-MM-DD — batasJatuhTempo berupa 23:59:59 WIB, jadi tanggalnya dibaca di zona itu.
function getJatuhTempoTanggal(t: WaktuTagihan): string {
  return batasJatuhTempo(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** Rincian tagihan di unduhan — cukup untuk label jenis dan pembagian per komponen */
interface ItemEkspor {
  id:            string
  komponen_id:   string | null
  nama_komponen: string
  nominal:       number
  potongan:      number | null
  komponen:      { jenis: string; nama: string } | null
}
const ITEM_EKSPOR_SELECT = 'tagihan_item(id, komponen_id, nama_komponen, nominal, potongan, komponen:komponen_id(jenis, nama))'

interface ExportTagihanNested {
  id:           string
  bulan:        number
  tahun:        number
  siswa:        { nama: string; nis: string | null; nisn: string | null; kelas: { id: string; nama: string } | null } | null
  tagihan_item: ItemEkspor[]
}
interface PembayaranExportRaw {
  id:             string
  jumlah:         number
  metode:         string
  tanggal_bayar:  string
  gateway_trx_id: string | null
  tagihan_id:     string
  alokasi:        unknown
}
interface VerifikasiExportRaw {
  id:               string
  nominal_diajukan: number
  created_at:       string
  tagihan_id:       string
  pilihan:          unknown
  tagihan:          ExportTagihanNested | null
}
interface ItemBuktiRaw {
  id:            string
  tagihan_id:    string
  nama_komponen: string
  nominal:       number
  potongan:      number | null
  komponen:      { nama: string } | null
}
interface GatewayTrxRaw {
  ipaymu_trx_id:   string | null
  ipaymu_response: { fee?: string } | null
}
interface TunggakanTagihanRaw {
  id:            string
  bulan:         number
  tahun:         number
  status:        'lunas' | 'belum_bayar' | 'cicilan'
  total_nominal: number
  jatuh_tempo:   string | null
  siswa:         { nama: string; nis: string | null; nisn: string | null; kelas: { id: string; nama: string } | null } | null
  tagihan_item:  ItemEkspor[]
}
interface ExportRow {
  tanggal:         string
  nisn:            string
  nama:            string
  kelas:           string
  jenisPembayaran: string
  metode:          string
  nominal:         number
  /** Unduhan per komponen yang dipisah: nominal tiap kolom komponen */
  perKolom:        number[]
  biayaAdmin:      number
  status:          string
}
interface SiswaAktifRaw {
  nama:         string
  nis:          string | null
  nisn:         string | null
  no_wa:        string | null
  nama_wali:    string | null
  status:       'aktif' | 'alumni'
  jenis_alumni: string | null
  kelas:        string | null
  kelasRef:     { nama: string; jenjang: string } | null
}
interface AlumniRaw {
  id:          string
  nama:        string
  nis:         string | null
  nisn:        string | null
  tahun_lulus: string | null
}
interface TahunAjaranFullRaw {
  nama:            string
  tanggal_mulai:   string
  tanggal_selesai: string
  is_aktif:        boolean
}

// ── Page ──────────────────────────────────────────────────────────────────────

// useSearchParams wajib berada di bawah batas Suspense, kalau tidak build gagal
// saat Next mencoba melakukan prerender statis halaman ini.
export default function LaporanPage() {
  return (
    <Suspense fallback={<SkeletonLaporan />}>
      <LaporanContent />
    </Suspense>
  )
}

function LaporanContent() {
  // Data dan filter dipakai bersama semua level drill-down — lib/useDataLaporan
  // dan lib/useFilterLaporan. Filter tinggal di URL (?ta=&periode=).
  const { sekolahId, loading, rows: metrikRows, pembayaran, kelas, activeTA, archivedTAs, sekarang } = useDataLaporan()
  const filter = useFilterLaporan(activeTA, archivedTAs, sekarang)
  const { taTerpilih, selectedFilter, dalamPeriode, qsFilter } = filter
  // Setiap unduhan (PDF dan Excel) memeriksa kelengkapan kop sekolah lebih dulu
  const { siapkanKop, pesanKop, tutupPesanKop } = useKopLaporan(sekolahId)

  // ── Pilihan komponen sebelum unduh (lib/komponenLaporan) — semua sekolah sejak 6 Nov 2026 ──

  // Ejaan resmi dan warna komponen untuk daftar centang
  const [komponenResmi, setKomponenResmi] = useState<{ nama: string; kelas_warna: string | null }[]>([])
  useEffect(() => {
    if (!sekolahId) return
    let batal = false
    const muat = async () => {
      const { data, error } = await supabase.from('komponen_tagihan').select('nama, kelas_warna')
        .eq('sekolah_id', sekolahId).order('created_at', { ascending: false }).limit(500)
      if (error) console.error('[Laporan] gagal memuat komponen tagihan:', error)
      if (!batal) setKomponenResmi((data ?? []) as { nama: string; kelas_warna: string | null }[])
    }
    void muat()
    return () => { batal = true }
  }, [sekolahId])

  // Ditagih dan diterima per komponen untuk setiap tagihan
  const rincianPerTagihan = useMemo(() => rincianSemuaTagihan(metrikRows, pembayaran), [metrikRows, pembayaran])
  const opsiKomponen = useMemo(() => daftarOpsiKomponen(rincianPerTagihan.values(), komponenResmi), [rincianPerTagihan, komponenResmi])

  const [mintaKomponen, setMintaKomponen] = useState<{ jenis: JenisUnduhan; judul: string; format: FormatEkspor; awal: PilihanKomponen } | null>(null)
  // Stabil supaya pendengar tombol Esc di modal tidak dipasang ulang tiap render
  const tutupPilihKomponen = useCallback(() => setMintaKomponen(null), [])

  /** Keterangan + akhiran nama berkas; kosong untuk unduhan tanpa pilihan komponen */
  const infoKomponen = (pilihan: PilihanKomponen | null): InfoKomponen => (pilihan
    ? { keterangan: ` · Komponen: ${teksKomponen(pilihan, opsiKomponen)}`, akhiran: akhiranNamaFile(pilihan, opsiKomponen) }
    : { keterangan: '', akhiran: '' })

  const [exportingTransaksi, setExportingTransaksi] = useState(false)
  const [exportingTunggakan, setExportingTunggakan] = useState(false)
  const [exportingSiswaAktif, setExportingSiswaAktif] = useState(false)
  const [exportingAlumni, setExportingAlumni] = useState(false)
  const [exportingKeuanganTahunan, setExportingKeuanganTahunan] = useState(false)
  // Format yang sedang diproses — supaya "Memproses..." muncul di tombol yang diklik saja
  const [formatEkspor, setFormatEkspor] = useState<FormatEkspor>('excel')
  const [exportNotice, setExportNotice] = useState('')
  const [generatingUtama, setGeneratingUtama] = useState(false)

  // ── Data untuk periode terpilih ───────────────────────────────────────────

  const periodTagihan = useMemo(() => metrikRows.filter(dalamPeriode), [metrikRows, dalamPeriode])

  const now      = new Date()
  const nowTahun = now.getFullYear()

  // Pelunasan, akan masuk, ketepatan waktu, tunggakan — semua dari lib/metrikLaporan
  const ringkasan = useMemo(() => hitungRingkasan(periodTagihan, sekarang), [periodTagihan, sekarang])
  const pemasukan = useMemo(() => hitungPemasukan(periodTagihan), [periodTagihan])

  // Umur tunggakan tidak mengikuti filter apa pun: piutang lama tidak hilang hanya
  // karena periode atau tahun ajarannya diganti. Tren tidak mengikuti periode, tapi
  // mengikuti tahun ajaran: 12 bulan yang berakhir di akhir tahun ajaran terpilih,
  // tidak pernah melewati bulan ini — untuk tahun ajaran aktif = 12 bulan terakhir.
  const akhirTA        = taTerpilih?.tanggal_selesai ?? null
  const semuaTunggakan = useMemo(() => hitungRingkasan(metrikRows, sekarang), [metrikRows, sekarang])
  const umur           = useMemo(() => umurTunggakan(metrikRows, sekarang), [metrikRows, sekarang])
  // "Butuh tindakan segera" di kartu umur — ikut tidak memakai filter, seperti kartunya
  const tertunggak     = useMemo(() => jumlahSiswaTertunggak(metrikRows, sekarang), [metrikRows, sekarang])
  const tren           = useMemo(
    () => trenTagihanRealisasi(metrikRows, sekarang, akhirTA ? new Date(akhirTA) : sekarang),
    [metrikRows, sekarang, akhirTA],
  )

  // Daftar siswa untuk pencarian — kelas diambil dari tagihan terbarunya
  const daftarCariSiswa = useMemo<SiswaCari[]>(() => {
    const terbaru = new Map<string, (typeof metrikRows)[number]>()
    for (const t of metrikRows) {
      const lama = terbaru.get(t.siswa_id)
      if (!lama || t.tahun * 12 + t.bulan > lama.tahun * 12 + lama.bulan) terbaru.set(t.siswa_id, t)
    }
    return [...terbaru.values()]
      .map(t => ({
        id:       t.siswa_id,
        nama:     t.siswa?.nama ?? '—',
        nis:      t.siswa?.nis ?? null,
        kelas:    t.is_alumni ? 'Alumni' : (t.kelas_id ? kelas.get(t.kelas_id)?.nama ?? '—' : '—'),
        isAlumni: t.is_alumni,
      }))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  }, [metrikRows, kelas])

  // Donut di layar menghitung siswa — satu status per siswa, aturan Tagihan Aktif
  const komposisiSiswa = useMemo(() => komposisiStatusSiswa(periodTagihan, sekarang), [periodTagihan, sekarang])

  // Per tagihan — hanya untuk PDF Laporan Utama, yang tabel komposisinya masih
  // berjudul "Jumlah Tagihan". Rumusnya di lib/laporanUtama, dipakai juga unduhan per komponen.
  const komposisiTagihan = useMemo(() => komposisiPerTagihan(periodTagihan, sekarang), [periodTagihan, sekarang])

  const jenjangData = useMemo<(JenjangRingkas & { jenjang: string; terbayar: number; nilai: number })[]>(
    () => ringkasPerJenjang(periodTagihan, kelas, sekarang),
    [periodTagihan, kelas, sekarang],
  )

  // `jumlah` = tagihan (dipakai PDF), `siswa` = siswa berbeda (dipakai kartu)
  const komponenData = useMemo<(KomponenBelum & { jumlah: number })[]>(() => komponenBelumDibayar(periodTagihan), [periodTagihan])

  const hasData = periodTagihan.length > 0

  // ── Export Laporan Transaksi (Excel / PDF) ───────────────────────────────

  // Per komponen: tiap pembayaran dibagi ke komponennya (aturan kas Pengeluaran); hanya
  // pembayaran yang menyentuh komponen terpilih yang tampil, nominalnya bagian komponen itu
  const handleExportTransaksi = async (format: FormatEkspor, pilihan: PilihanKomponen | null) => {
    if (!selectedFilter || !sekolahId) return
    const pilih = pilihan ? new Set(pilihan.kunci) : null
    const kolom = pilihan ? kolomKomponen(pilihan, opsiKomponen) : null
    const pisah = !!pilihan && pisahPerKomponen(pilihan)
    const info  = infoKomponen(pilihan)
    const pesanKosong = pilihan ? 'Tidak ada transaksi komponen terpilih pada periode ini.' : 'Tidak ada transaksi pada periode ini.'

    const sortedMonths = [...selectedFilter.months].sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan)
    const first = sortedMonths[0]
    const last  = sortedMonths[sortedMonths.length - 1]
    if (!first || !last) {
      setExportNotice(pesanKosong)
      return
    }
    // Rentang berdasarkan tanggal transaksi aktual (tanggal_bayar / created_at), bukan bulan tagihan —
    // supaya pembayaran yang terjadi di periode ini tetap masuk walau melunasi tagihan bulan lain.
    const startIso = new Date(first.tahun, first.bulan - 1, 1).toISOString()
    const endIso   = new Date(last.tahun, last.bulan, 1).toISOString()

    setExportingTransaksi(true)
    try {
      const kop = await siapkanKop(format)
      if (!kop) return

      const NESTED_SELECT = `id, bulan, tahun, siswa:siswa_id(nama, nis, nisn, kelas:kelas_id(id, nama)), ${ITEM_EKSPOR_SELECT}`

      // pembayaran.tagihan_id tidak terdaftar sebagai foreign key di PostgREST schema cache,
      // jadi tagihan tidak bisa di-embed langsung di sini — harus di-fetch terpisah lalu digabung manual
      // (pola yang sama dipakai di pembayaran/page.tsx).
      const [{ data: pembData, error: pembErr }, { data: verifData, error: verifErr }, paketByKelas] = await Promise.all([
        supabase
          .from('pembayaran')
          .select('id, jumlah, metode, tanggal_bayar, gateway_trx_id, tagihan_id, alokasi')
          .eq('sekolah_id', sekolahId)
          .gte('tanggal_bayar', startIso)
          .lt('tanggal_bayar', endIso)
          .order('tanggal_bayar', { ascending: true })
          .limit(5000),
        supabase
          .from('verifikasi_pembayaran')
          .select(`id, nominal_diajukan, created_at, tagihan_id, pilihan, tagihan:tagihan_id(${NESTED_SELECT})`)
          .eq('sekolah_id', sekolahId)
          .eq('status', 'menunggu')
          .gte('created_at', startIso)
          .lt('created_at', endIso)
          .limit(2000),
        buildPaketByKelasMap(sekolahId),
      ])

      if (pembErr)  console.error('[Export Laporan Transaksi] gagal memuat pembayaran:', pembErr)
      if (verifErr) console.error('[Export Laporan Transaksi] gagal memuat verifikasi_pembayaran:', verifErr)

      const pembList  = (pembData ?? []) as unknown as PembayaranExportRaw[]
      const verifList = (verifData ?? []) as unknown as VerifikasiExportRaw[]

      const pembTagihanIds = Array.from(new Set(pembList.map(p => p.tagihan_id)))
      let tagihanMap = new Map<string, ExportTagihanNested>()
      if (pembTagihanIds.length > 0) {
        const { data: tagihanData, error: tagihanErr } = await supabase
          .from('tagihan')
          .select(NESTED_SELECT)
          .in('id', pembTagihanIds)
        if (tagihanErr) console.error('[Export Laporan Transaksi] gagal memuat tagihan:', tagihanErr)
        tagihanMap = new Map(((tagihanData ?? []) as unknown as ExportTagihanNested[]).map(t => [t.id, t]))
      }

      const gatewayTrxIds = Array.from(new Set(pembList.map(p => p.gateway_trx_id).filter((id): id is string => !!id)))
      let feeMap = new Map<string, number>()
      if (gatewayTrxIds.length > 0) {
        const { data: gwData } = await supabase
          .from('payment_gateway_trx')
          .select('ipaymu_trx_id, ipaymu_response')
          .in('ipaymu_trx_id', gatewayTrxIds)
          .limit(gatewayTrxIds.length)
        feeMap = new Map(
          ((gwData ?? []) as unknown as GatewayTrxRaw[])
            .filter(g => g.ipaymu_trx_id)
            .map(g => [g.ipaymu_trx_id as string, Number(g.ipaymu_response?.fee ?? 0) || 0])
        )
      }

      // Bukti transfer dibagi menurut pilihan wali, yang bisa mencakup tagihan bulan lain —
      // rincian semua tagihan itu dimuat sekali
      const itemsBukti = new Map<string, ItemTagihanKas[]>()
      if (pilih) {
        const idBukti = Array.from(new Set(verifList.flatMap(v => tagihanBukti(v))))
        if (idBukti.length > 0) {
          const { data: itemData, error: itemErr } = await supabase
            .from('tagihan_item')
            .select('id, tagihan_id, nama_komponen, nominal, potongan, komponen:komponen_id(nama)')
            .in('tagihan_id', idBukti)
            .limit(5000)
          if (itemErr) console.error('[Export Laporan Transaksi] gagal memuat rincian bukti transfer:', itemErr)
          const perTagihan = new Map<string, ItemBuktiRaw[]>()
          for (const i of (itemData ?? []) as unknown as ItemBuktiRaw[]) {
            const daftar = perTagihan.get(i.tagihan_id)
            if (daftar) daftar.push(i)
            else perTagihan.set(i.tagihan_id, [i])
          }
          for (const [id, daftar] of perTagihan) itemsBukti.set(id, itemKas(daftar))
        }
      }

      /** Bagian komponen terpilih dari satu transaksi; null kalau tidak menyentuhnya */
      const bagianTerpilih = (bagian: Map<string, number>) => {
        if (!pilih || !kolom) return null
        const nominal = jumlahKunci(bagian, pilih)
        if (nominal <= 0) return null
        return {
          nominal,
          perKolom: kolom.map(k => jumlahKunci(bagian, k.kunci)),
          terima:   (kunci: string) => pilih.has(kunci) && (bagian.get(kunci) ?? 0) > 0,
        }
      }

      const rows: ExportRow[] = []

      for (const p of pembList) {
        const tagihan = tagihanMap.get(p.tagihan_id)
        if (!tagihan) continue
        const kelasId = tagihan.siswa?.kelas?.id ?? null
        const biaya   = p.gateway_trx_id ? (feeMap.get(p.gateway_trx_id) ?? 0) : 0
        let nominal   = p.jumlah
        let perKolom: number[] = []
        let jenis     = resolveJenisLabel(tagihan.tagihan_item, tagihan.bulan, tagihan.tahun, kelasId, paketByKelas)
        let biayaAdmin = biaya
        if (pilih) {
          const b = bagianTerpilih(bagiKeKunci(p, itemKas(tagihan.tagihan_item)))
          if (!b) continue
          nominal  = b.nominal
          perKolom = b.perKolom
          jenis    = resolveJenisTerpilih(tagihan.tagihan_item, tagihan.bulan, tagihan.tahun, kelasId, paketByKelas, b.terima)
          // Biaya admin satu transaksi dibagi sebanding bagian komponen terpilih
          biayaAdmin = p.jumlah > 0 ? Math.round((biaya * b.nominal) / p.jumlah) : 0
        }
        rows.push({
          tanggal:         p.tanggal_bayar,
          nisn:            nisnOrNis(tagihan.siswa),
          nama:            tagihan.siswa?.nama ?? '-',
          kelas:           tagihan.siswa?.kelas?.nama ?? '-',
          jenisPembayaran: jenis,
          metode:          metodeLabel(p.metode),
          nominal,
          perKolom,
          biayaAdmin,
          status:          'Berhasil',
        })
      }

      for (const v of verifList) {
        if (!v.tagihan) continue
        const kelasId = v.tagihan.siswa?.kelas?.id ?? null
        let nominal   = v.nominal_diajukan
        let perKolom: number[] = []
        let jenis     = resolveJenisLabel(v.tagihan.tagihan_item, v.tagihan.bulan, v.tagihan.tahun, kelasId, paketByKelas)
        if (pilih) {
          const b = bagianTerpilih(bagiBuktiKeKunci(v, itemsBukti))
          if (!b) continue
          nominal  = b.nominal
          perKolom = b.perKolom
          jenis    = resolveJenisTerpilih(v.tagihan.tagihan_item, v.tagihan.bulan, v.tagihan.tahun, kelasId, paketByKelas, b.terima)
        }
        rows.push({
          tanggal:         v.created_at,
          nisn:            nisnOrNis(v.tagihan.siswa),
          nama:            v.tagihan.siswa?.nama ?? '-',
          kelas:           v.tagihan.siswa?.kelas?.nama ?? '-',
          jenisPembayaran: jenis,
          metode:          'Transfer Manual',
          nominal,
          perKolom,
          biayaAdmin:      0,
          status:          'Menunggu Verifikasi',
        })
      }

      if (rows.length === 0) {
        setExportNotice(pesanKosong)
        return
      }

      rows.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())

      // Dipisah: kolom Nominal diganti satu kolom per komponen di bawah judul "Nominal"
      const kolomNominal = pisah && kolom ? kolom.map(k => k.label) : ['Nominal']
      const n = kolomNominal.length
      const periodeLabel = `${selectedFilter.label}_${selectedFilter.sublabel}`.replace(/\s+/g, '_')
      await unduhTabel({
        format,
        namaFile:    `Laporan_Transaksi_${periodeLabel}${info.akhiran}`,
        namaSheet:   'Laporan Transaksi',
        judul:       'Laporan Transaksi',
        keterangan:  `Periode: ${selectedFilter.label} - ${selectedFilter.sublabel} (menurut tanggal transaksi)${info.keterangan}`,
        kop,
        headers:     ['No', 'Tanggal Transaksi', 'ID Transaksi', 'NISN', 'Nama Siswa', 'Kelas', 'Jenis Pembayaran', 'Metode', ...kolomNominal, 'Biaya Admin', 'Total Bayar', 'Status'],
        grupKepala:  pisah ? [{ label: 'Nominal', dari: 8, jumlah: n }] : undefined,
        baris:       rows.map((r, i) => [
          i + 1,
          formatTanggalExcel(r.tanggal),
          generateIdTransaksi(r.tanggal, i + 1),
          r.nisn,
          r.nama,
          r.kelas,
          r.jenisPembayaran,
          r.metode,
          ...(pisah ? r.perKolom : [r.nominal]),
          r.biayaAdmin,
          r.nominal + r.biayaAdmin,
          r.status,
        ]),
        lebarKolom:  [5, 16, 16, 14, 24, 10, 26, 16, ...kolomNominal.map(() => 14), 12, 14, 18],
        kolomRupiah: Array.from({ length: n + 2 }, (_, i) => 8 + i),
      })
    } finally {
      setExportingTransaksi(false)
    }
  }

  // ── Export Laporan Tunggakan (Excel / PDF) ────────────────────────────────
  // Selalu semua tunggakan outstanding sampai hari ini — tidak terikat filter periode dropdown,
  // karena tunggakan bersifat akumulatif (piutang lintas bulan), bukan snapshot satu periode.
  // Isinya sama persis dengan kartu Umur tunggakan: predikat adalahTunggakan yang sama.

  // Per komponen: tagihan diproyeksikan ke komponen terpilih lebih dulu, jadi tagihan yang
  // SPP-nya sudah lunas tidak ikut walau komponen lainnya masih menunggak
  const handleExportTunggakan = async (format: FormatEkspor, pilihan: PilihanKomponen | null) => {
    if (!sekolahId) return
    const pilih = pilihan ? new Set(pilihan.kunci) : null
    const kolom = pilihan ? kolomKomponen(pilihan, opsiKomponen) : null
    const pisah = !!pilihan && pisahPerKomponen(pilihan)
    const info  = infoKomponen(pilihan)
    const pesanKosong = pilihan ? 'Tidak ada tunggakan komponen terpilih saat ini.' : 'Tidak ada tunggakan saat ini.'

    const tunggakanRows     = (pilih ? proyeksiSemua(metrikRows, rincianPerTagihan, pilih) : metrikRows)
      .filter(t => adalahTunggakan(t, sekarang))
    const tunggakanIds      = tunggakanRows.map(t => t.id)
    const terbayarPerTagihan = new Map(tunggakanRows.map(t => [t.id, t.terbayar]))
    const proyeksiPerTagihan = new Map(tunggakanRows.map(t => [t.id, t]))

    /** Sisa tiap kolom komponen satu tagihan */
    const sisaPerKolom = (id: string): number[] => {
      const r = rincianPerTagihan.get(id)
      return (kolom ?? []).map(k => {
        if (!r) return 0
        const j = jumlahDalam(r, k.kunci)
        return Math.max(0, j.ditagih - j.terbayar)
      })
    }

    if (tunggakanIds.length === 0) {
      setExportNotice(pesanKosong)
      return
    }

    setExportingTunggakan(true)
    try {
      const kop = await siapkanKop(format)
      if (!kop) return

      const [{ data: tagihanData, error }, paketByKelas] = await Promise.all([
        supabase
          .from('tagihan')
          .select(`id, bulan, tahun, status, total_nominal, jatuh_tempo, siswa:siswa_id(nama, nis, nisn, kelas:kelas_id(id, nama)), ${ITEM_EKSPOR_SELECT}`)
          .in('id', tunggakanIds)
          .limit(5000),
        buildPaketByKelasMap(sekolahId),
      ])

      if (error) console.error('[Export Laporan Tunggakan] gagal memuat tagihan:', error)

      const detailList = (tagihanData ?? []) as unknown as TunggakanTagihanRaw[]

      const rows = detailList
        .map(t => {
          const kelasId  = t.siswa?.kelas?.id ?? null
          const proyeksi = proyeksiPerTagihan.get(t.id)
          const perKolom = pisah ? sisaPerKolom(t.id) : []
          const r        = rincianPerTagihan.get(t.id)
          // Per komponen: yang disebut hanya komponen terpilih yang masih bersisa
          const masihBersisa = (kunci: string) => {
            const b = r?.komponen.get(kunci)
            return !!pilih?.has(kunci) && !!b && b.ditagih > b.terbayar
          }
          return {
            nisn:       nisnOrNis(t.siswa),
            nama:       t.siswa?.nama ?? '-',
            kelas:      t.siswa?.kelas?.nama ?? '-',
            jenis:      pilih
              ? resolveJenisTerpilih(t.tagihan_item, t.bulan, t.tahun, kelasId, paketByKelas, masihBersisa)
              : resolveJenisLabel(t.tagihan_item, t.bulan, t.tahun, kelasId, paketByKelas),
            periode:    `${BULAN_NAMES_FULL[t.bulan]} ${t.tahun}`,
            nominal:    pisah
              ? perKolom.reduce((s, x) => s + x, 0)
              : pilih && proyeksi
                ? proyeksi.total_nominal - proyeksi.terbayar
                : t.total_nominal - (terbayarPerTagihan.get(t.id) ?? 0),
            perKolom,
            jatuhTempo: getJatuhTempoTanggal(t),
            status:     (pilih ? proyeksi?.status : t.status) === 'cicilan' ? 'Cicilan' : 'Belum Bayar',
            bulan:      t.bulan,
            tahun:      t.tahun,
          }
        })
        .sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan || a.nama.localeCompare(b.nama, 'id'))

      if (rows.length === 0) {
        setExportNotice(pesanKosong)
        return
      }

      // Dipisah: satu kolom per komponen + total, di bawah judul "Nominal Tunggakan"
      const kolomNominal = pisah && kolom ? [...kolom.map(k => k.label), 'Total'] : ['Nominal Tunggakan']
      const n = kolomNominal.length
      await unduhTabel({
        format,
        namaFile:    `Laporan_Tunggakan_${formatDateLocal(now)}${info.akhiran}`,
        namaSheet:   'Laporan Tunggakan',
        judul:       'Laporan Tunggakan',
        keterangan:  `Semua tunggakan yang sudah lewat jatuh tempo per ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}${info.keterangan}`,
        kop,
        headers:     ['No', 'NISN', 'Nama Siswa', 'Kelas', 'Jenis Tunggakan', 'Bulan/Periode', ...kolomNominal, 'Jatuh Tempo', 'Status'],
        grupKepala:  pisah ? [{ label: 'Nominal Tunggakan', dari: 6, jumlah: n }] : undefined,
        baris:       rows.map((r, i) => [
          i + 1, r.nisn, r.nama, r.kelas, r.jenis, r.periode,
          ...(pisah ? [...r.perKolom, r.nominal] : [r.nominal]),
          r.jatuhTempo, r.status,
        ]),
        lebarKolom:  [5, 14, 24, 10, 32, 16, ...kolomNominal.map(() => (pisah ? 15 : 18)), 14, 14],
        kolomRupiah: Array.from({ length: n }, (_, i) => 6 + i),
      })
    } finally {
      setExportingTunggakan(false)
    }
  }

  // ── Export Laporan Data Siswa Aktif (Excel / PDF) ─────────────────────────
  // Angkatan tidak tersimpan untuk siswa aktif — diturunkan dari posisi jenjang siswa
  // dalam JENJANG_MAP dikurangkan dari tahun mulai tahun ajaran aktif (pola sama dgn naik-kelas).
  // Status "Nonaktif" mencakup alumni yang keluar/pindah sebelum lulus (jenis_alumni pindah/keluar).

  const handleExportSiswaAktif = async (format: FormatEkspor) => {
    if (!sekolahId) return

    setExportingSiswaAktif(true)
    try {
      const kop = await siapkanKop(format)
      if (!kop) return

      const [{ data: pengData }, { data: siswaData, error }] = await Promise.all([
        supabase.from('pengaturan').select('jenjang_sekolah').eq('sekolah_id', sekolahId).maybeSingle(),
        supabase
          .from('siswa')
          .select('nama, nis, nisn, no_wa, nama_wali, status, jenis_alumni, kelas, kelasRef:kelas_id(nama, jenjang)')
          .eq('sekolah_id', sekolahId)
          .or('status.eq.aktif,and(status.eq.alumni,jenis_alumni.in.(pindah,keluar))')
          .limit(5000),
      ])

      if (error) console.error('[Export Laporan Siswa Aktif] gagal memuat siswa:', error)

      const jenjangSekolah = (pengData as { jenjang_sekolah?: string } | null)?.jenjang_sekolah ?? 'SMP/MTs'
      const jenjangLevels  = JENJANG_MAP[jenjangSekolah] ?? JENJANG_MAP['SMP/MTs']
      const taMulaiTahun   = activeTA ? new Date(activeTA.tanggal_mulai).getFullYear() : nowTahun

      const list = (siswaData ?? []) as unknown as SiswaAktifRaw[]

      const rows = list
        .map(s => {
          const isAktif   = s.status === 'aktif'
          const kelasNama = s.kelasRef?.nama ?? s.kelas ?? '-'
          const levelIdx  = isAktif && s.kelasRef?.jenjang ? jenjangLevels.indexOf(s.kelasRef.jenjang) : -1
          const angkatan  = levelIdx >= 0 ? String(taMulaiTahun - levelIdx) : '-'
          return {
            nisn:     nisnOrNis(s),
            nama:     s.nama,
            kelas:    kelasNama,
            angkatan,
            namaOrtu: s.nama_wali ?? '-',
            noWa:     s.no_wa ?? '-',
            status:   isAktif ? 'Aktif' : 'Nonaktif',
          }
        })
        .sort((a, b) =>
          (a.status === b.status ? 0 : a.status === 'Aktif' ? -1 : 1) ||
          a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) ||
          a.nama.localeCompare(b.nama, 'id')
        )

      if (rows.length === 0) {
        setExportNotice('Tidak ada data siswa aktif.')
        return
      }

      await unduhTabel({
        format,
        namaFile:    `Laporan_Siswa_Aktif_${formatDateLocal(now)}`,
        namaSheet:   'Siswa Aktif',
        judul:       'Laporan Data Siswa Aktif',
        keterangan:  `Data per ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · termasuk siswa pindah/keluar (Nonaktif)`,
        kop,
        headers:     ['No', 'NISN', 'Nama Siswa', 'Kelas', 'Angkatan', 'Nama Orang Tua', 'No. WhatsApp', 'Status'],
        baris:       rows.map((r, i) => [i + 1, r.nisn, r.nama, r.kelas, r.angkatan, r.namaOrtu, r.noWa, r.status]),
        lebarKolom:  [5, 14, 24, 10, 12, 22, 16, 12],
      })
    } finally {
      setExportingSiswaAktif(false)
    }
  }

  // ── Export Laporan Alumni (Excel / PDF) ───────────────────────────────────
  // Total Tagihan/Terbayar dihitung dari SELURUH tagihan siswa sejak awal masuk hingga sebelum
  // jadi alumni (bukan cuma periode tertentu) — karena tagihan berhenti dibuat begitu siswa
  // jadi alumni (kelas_id dikosongkan), jumlah semua tagihan siswa itu = riwayat penuhnya.
  // Angkatan = tahun lulus dikurangi jumlah level jenjang (pola sama dgn Laporan Siswa Aktif,
  // dihitung dari sisi lulus, bukan sisi aktif).

  // Per komponen: dihitung dari tagihan dan pembayaran yang sudah dimuat halaman ini
  // (lib/komponenLaporan), bukan query total — totalnya perlu dipecah per komponen
  const handleExportAlumni = async (format: FormatEkspor, pilihan: PilihanKomponen | null) => {
    if (!sekolahId) return
    const kolom = pilihan ? kolomKomponen(pilihan, opsiKomponen) : null
    const pisah = !!pilihan && pisahPerKomponen(pilihan)
    const info  = infoKomponen(pilihan)

    setExportingAlumni(true)
    try {
      const kop = await siapkanKop(format)
      if (!kop) return

      const [{ data: pengData }, { data: alumniData, error: alumniErr }] = await Promise.all([
        supabase.from('pengaturan').select('jenjang_sekolah').eq('sekolah_id', sekolahId).maybeSingle(),
        supabase
          .from('siswa')
          .select('id, nama, nis, nisn, tahun_lulus')
          .eq('sekolah_id', sekolahId)
          .eq('status', 'alumni')
          .eq('jenis_alumni', 'lulus')
          .limit(5000),
      ])

      if (alumniErr) console.error('[Export Laporan Alumni] gagal memuat alumni:', alumniErr)

      const jenjangSekolah = (pengData as { jenjang_sekolah?: string } | null)?.jenjang_sekolah ?? 'SMP/MTs'
      const jenjangLevels  = JENJANG_MAP[jenjangSekolah] ?? JENJANG_MAP['SMP/MTs']

      const alumniList = (alumniData ?? []) as unknown as AlumniRaw[]
      const alumniIds  = alumniList.map(a => a.id)

      if (alumniIds.length === 0) {
        setExportNotice('Belum ada data alumni.')
        return
      }

      // Total tagihan, terbayar, dan sisa per alumni — satu kelompok per kolom komponen
      type NilaiAlumni = { tagihan: number; bayar: number; sisa: number }
      const nilaiPerAlumni = new Map<string, NilaiAlumni[]>()

      if (!kolom) {
        const [{ data: tagihanData, error: tagihanErr }, { data: pembData, error: pembErr }] = await Promise.all([
          supabase.from('tagihan').select('siswa_id, total_nominal').in('siswa_id', alumniIds).limit(20000),
          supabase.from('pembayaran').select('siswa_id, jumlah').in('siswa_id', alumniIds).limit(20000),
        ])
        if (tagihanErr) console.error('[Export Laporan Alumni] gagal memuat tagihan:', tagihanErr)
        if (pembErr)    console.error('[Export Laporan Alumni] gagal memuat pembayaran:', pembErr)

        const totalTagihanMap = new Map<string, number>()
        for (const t of ((tagihanData ?? []) as { siswa_id: string; total_nominal: number }[])) {
          totalTagihanMap.set(t.siswa_id, (totalTagihanMap.get(t.siswa_id) ?? 0) + t.total_nominal)
        }
        const totalBayarMap = new Map<string, number>()
        for (const p of ((pembData ?? []) as { siswa_id: string; jumlah: number }[])) {
          totalBayarMap.set(p.siswa_id, (totalBayarMap.get(p.siswa_id) ?? 0) + p.jumlah)
        }
        for (const id of alumniIds) {
          const tagihan = totalTagihanMap.get(id) ?? 0
          const bayar   = totalBayarMap.get(id) ?? 0
          nilaiPerAlumni.set(id, [{ tagihan, bayar, sisa: tagihan - bayar }])
        }
      } else {
        const idAlumni = new Set(alumniIds)
        for (const t of metrikRows) {
          if (!idAlumni.has(t.siswa_id)) continue
          const r = rincianPerTagihan.get(t.id)
          if (!r) continue
          const nilai = nilaiPerAlumni.get(t.siswa_id) ?? kolom.map(() => ({ tagihan: 0, bayar: 0, sisa: 0 }))
          kolom.forEach((k, i) => {
            const j = jumlahDalam(r, k.kunci)
            nilai[i].tagihan += j.ditagih
            nilai[i].bayar   += j.terbayar
            nilai[i].sisa     = nilai[i].tagihan - nilai[i].bayar
          })
          nilaiPerAlumni.set(t.siswa_id, nilai)
        }
      }
      const nolSemua = (kolom ?? [null]).map(() => ({ tagihan: 0, bayar: 0, sisa: 0 }))

      const rows = alumniList
        .map(a => {
          const nilai         = nilaiPerAlumni.get(a.id) ?? nolSemua
          const sisa          = nilai.reduce((s, v) => s + v.sisa, 0)
          const tahunLulusNum = a.tahun_lulus ? parseInt(a.tahun_lulus, 10) : null
          const angkatan      = tahunLulusNum ? String(tahunLulusNum - jenjangLevels.length) : '-'
          return {
            nisn:       nisnOrNis(a),
            nama:       a.nama,
            angkatan,
            tahunLulus: a.tahun_lulus ?? '-',
            nilai,
            status: sisa === 0 ? 'Lunas' : 'Belum Lunas',
          }
        })
        .sort((a, b) => a.tahunLulus.localeCompare(b.tahunLulus) || a.nama.localeCompare(b.nama, 'id'))

      // Dipisah: kelompok Tagihan/Terbayar/Sisa di bawah nama tiap komponen
      const kelompok   = pisah && kolom ? kolom : null
      const kolomNilai = kelompok ? kelompok.flatMap(() => ['Tagihan', 'Terbayar', 'Sisa']) : ['Total Tagihan', 'Total Terbayar', 'Sisa Tunggakan']
      await unduhTabel({
        format,
        namaFile:    `Laporan_Alumni_${formatDateLocal(now)}${info.akhiran}`,
        namaSheet:   'Laporan Alumni',
        judul:       'Laporan Alumni',
        keterangan:  `Seluruh alumni yang lulus · total dari semua tagihan sejak masuk hingga lulus${info.keterangan}`,
        kop,
        headers:     ['No', 'NISN', 'Nama Siswa', 'Angkatan', 'Tahun Lulus', ...kolomNilai, 'Status Pelunasan'],
        grupKepala:  kelompok?.map((k, i) => ({ label: k.label, dari: 5 + i * 3, jumlah: 3 })),
        baris:       rows.map((r, i) => [
          i + 1, r.nisn, r.nama, r.angkatan, r.tahunLulus,
          ...r.nilai.flatMap(v => [v.tagihan, v.bayar, v.sisa]),
          r.status,
        ]),
        lebarKolom:  [5, 14, 24, 10, 12, ...kolomNilai.map(() => (kelompok ? 14 : 16)), 16],
        kolomRupiah: kolomNilai.map((_, i) => 5 + i),
      })
    } finally {
      setExportingAlumni(false)
    }
  }

  // ── Export Laporan Keuangan Tahunan (Excel / PDF) ─────────────────────────
  // Satu baris per tahun ajaran (fetch ulang semua tahun ajaran tanpa batas — bukan reuse
  // activeTA/archivedTAs yang di halaman ini sengaja dibatasi 5 utk dropdown). Target/Realisasi
  // dihitung dari tagihan yg bulan/tahunnya masuk rentang tahun ajaran tsb (pola monthsInRange
  // yang sama dipakai utk filter dropdown periode).

  // Per komponen: target/realisasi dipecah lewat rincian per tagihan yang sudah dimuat halaman
  // ini; transaksi dihitung kalau sebagian uangnya jatuh ke komponen terpilih
  const handleExportKeuanganTahunan = async (format: FormatEkspor, pilihan: PilihanKomponen | null) => {
    if (!sekolahId) return
    const pilih = pilihan ? new Set(pilihan.kunci) : null
    const kolom = pilihan ? kolomKomponen(pilihan, opsiKomponen) : null
    const pisah = !!pilihan && pisahPerKomponen(pilihan)
    const info  = infoKomponen(pilihan)

    setExportingKeuanganTahunan(true)
    try {
      const kop = await siapkanKop(format)
      if (!kop) return

      const [{ data: taData, error: taErr }, { data: tagihanData, error: tagihanErr }, { data: pembData, error: pembErr }] = await Promise.all([
        supabase
          .from('tahun_ajaran')
          .select('nama, tanggal_mulai, tanggal_selesai, is_aktif')
          .eq('sekolah_id', sekolahId)
          .order('tanggal_mulai', { ascending: true })
          .limit(200),
        supabase.from('tagihan').select('id, bulan, tahun, total_nominal').eq('sekolah_id', sekolahId).limit(10000),
        supabase.from('pembayaran').select('tagihan_id, jumlah').eq('sekolah_id', sekolahId).limit(20000),
      ])

      if (taErr)      console.error('[Export Laporan Keuangan Tahunan] gagal memuat tahun ajaran:', taErr)
      if (tagihanErr) console.error('[Export Laporan Keuangan Tahunan] gagal memuat tagihan:', tagihanErr)
      if (pembErr)    console.error('[Export Laporan Keuangan Tahunan] gagal memuat pembayaran:', pembErr)

      const taList      = (taData ?? []) as unknown as TahunAjaranFullRaw[]
      const tagihanList = (tagihanData ?? []) as { id: string; bulan: number; tahun: number; total_nominal: number }[]
      const pembList    = (pembData ?? []) as { tagihan_id: string; jumlah: number }[]

      if (taList.length === 0) {
        setExportNotice('Belum ada data tahun ajaran.')
        return
      }

      const paidMap = new Map<string, number>()
      for (const p of pembList) paidMap.set(p.tagihan_id, (paidMap.get(p.tagihan_id) ?? 0) + p.jumlah)

      type NilaiTahun = { target: number; realisasi: number; tunggakan: number }

      /** Per komponen: dari tagihan yang sudah dimuat halaman, dipecah per kolom komponen */
      const nilaiPerKomponen = (monthSet: Set<string>, pilih: ReadonlySet<string>, kolom: KolomKomponen[]) => {
        const nilai: NilaiTahun[] = kolom.map(() => ({ target: 0, realisasi: 0, tunggakan: 0 }))
        let jumlahTransaksi = 0
        for (const t of metrikRows) {
          if (!monthSet.has(periodKey(t.bulan, t.tahun))) continue
          const r = rincianPerTagihan.get(t.id)
          if (!r) continue
          kolom.forEach((k, i) => {
            const j = jumlahDalam(r, k.kunci)
            nilai[i].target    += j.ditagih
            nilai[i].realisasi += j.terbayar
          })
          jumlahTransaksi += r.bayar.filter(disentuh => [...disentuh].some(kunci => pilih.has(kunci))).length
        }
        for (const v of nilai) v.tunggakan = v.target - v.realisasi
        return { nilai, jumlahTransaksi }
      }

      const rows = taList.map(ta => {
        const monthSet = new Set(monthsInRange(ta.tanggal_mulai, ta.tanggal_selesai).map(m => periodKey(m.bulan, m.tahun)))
        let nilai: NilaiTahun[]
        let jumlahTransaksi: number

        if (pilih && kolom) {
          ({ nilai, jumlahTransaksi } = nilaiPerKomponen(monthSet, pilih, kolom))
        } else {
          const tagihanTA = tagihanList.filter(t => monthSet.has(periodKey(t.bulan, t.tahun)))
          const tagihanIds = new Set(tagihanTA.map(t => t.id))

          const totalTarget    = tagihanTA.reduce((s, t) => s + t.total_nominal, 0)
          const totalRealisasi = tagihanTA.reduce((s, t) => s + (paidMap.get(t.id) ?? 0), 0)
          jumlahTransaksi = pembList.filter(p => tagihanIds.has(p.tagihan_id)).length
          nilai = [{ target: totalTarget, realisasi: totalRealisasi, tunggakan: totalTarget - totalRealisasi }]
        }

        return {
          tahunAjaran:    ta.nama,
          nilai,
          jumlahTransaksi,
          statusAudit:    ta.is_aktif ? 'Berjalan' : 'Terverifikasi',
        }
      })

      // Dipisah: kelompok Target/Realisasi/Tunggakan di bawah nama tiap komponen
      const kelompok   = pisah && kolom ? kolom : null
      const kolomNilai = kelompok ? kelompok.flatMap(() => ['Target', 'Realisasi', 'Tunggakan']) : ['Total Target', 'Total Realisasi', 'Total Tunggakan']
      await unduhTabel({
        format,
        namaFile:    `Laporan_Keuangan_Tahunan_${formatDateLocal(now)}${info.akhiran}`,
        namaSheet:   'Keuangan Tahunan',
        judul:       'Laporan Keuangan Tahunan',
        keterangan:  `Semua tahun ajaran · target = tagihan yang terbit, realisasi = yang sudah dibayar${info.keterangan}`,
        kop,
        headers:     ['No', 'Tahun Ajaran', ...kolomNilai, 'Jumlah Transaksi', 'Status Audit'],
        grupKepala:  kelompok?.map((k, i) => ({ label: k.label, dari: 2 + i * 3, jumlah: 3 })),
        baris:       rows.map((r, i) => [
          i + 1, r.tahunAjaran,
          ...r.nilai.flatMap(v => [v.target, v.realisasi, v.tunggakan]),
          r.jumlahTransaksi, r.statusAudit,
        ]),
        lebarKolom:  [5, 14, ...kolomNilai.map(() => (kelompok ? 15 : 16)), 16, 14],
        kolomRupiah: kolomNilai.map((_, i) => 2 + i),
      })
    } finally {
      setExportingKeuanganTahunan(false)
    }
  }

  // ── Generate Laporan Utama (PDF) ───────────────────────────────────────────
  // Merangkum seluruh blok "Ringkasan periode ini" yang tampil di layar (kartu metrik,
  // komposisi status, tagihan vs realisasi, umur tunggakan, pelunasan per jenjang,
  // komponen belum dibayar) jadi satu dokumen PDF sesuai periode di dropdown atas.
  // Per komponen: rumus yang sama atas tagihan yang diproyeksikan ke komponen terpilih;
  // dipisah = satu kolom per komponen ditambah kolom Total di setiap tabel.

  const handleGenerateLaporanUtama = async (pilihan: PilihanKomponen | null) => {
    if (!selectedFilter || !sekolahId) return

    let kolom: KolomUtama[]
    let gabungan: MetrikUtama
    if (!pilihan) {
      if (!hasData) {
        setExportNotice('Tidak ada data pada periode ini untuk digenerate.')
        return
      }
      // Angka yang sama dengan yang tampil di layar
      gabungan = { ringkasan, pemasukan, komposisiTagihan, tren, umur, jenjang: jenjangData, komponen: komponenData }
      kolom    = [{ label: 'Nilai', m: gabungan }]
    } else {
      const akhir   = akhirTA ? new Date(akhirTA) : sekarang
      const metrik  = (pilih: ReadonlySet<string>) =>
        hitungMetrikUtama(proyeksiSemua(metrikRows, rincianPerTagihan, pilih), dalamPeriode, kelas, sekarang, akhir)
      const pilih   = new Set(pilihan.kunci)
      if (!proyeksiSemua(metrikRows, rincianPerTagihan, pilih).some(dalamPeriode)) {
        setExportNotice('Tidak ada tagihan komponen terpilih pada periode ini untuk digenerate.')
        return
      }
      gabungan = metrik(pilih)
      kolom    = pisahPerKomponen(pilihan)
        ? [...kolomKomponen(pilihan, opsiKomponen).map(k => ({ label: k.label, m: metrik(k.kunci) })), { label: 'Total', m: gabungan }]
        : [{ label: 'Total', m: gabungan }]
    }

    setGeneratingUtama(true)
    try {
      const dataKop = await siapkanKop('pdf')
      if (!dataKop) return
      const periodeLabel = `${selectedFilter.label}_${selectedFilter.sublabel}`.replace(/\s+/g, '_')
      unduhLaporanUtamaPdf({
        kop:      dataKop,
        periode:  `${selectedFilter.label} - ${selectedFilter.sublabel}`,
        komponen: pilihan ? teksKomponen(pilihan, opsiKomponen) : undefined,
        kolom,
        gabungan,
        namaFile: `Laporan_Utama_${periodeLabel}${infoKomponen(pilihan).akhiran}`,
      })
    } finally {
      setGeneratingUtama(false)
    }
  }

  // ── Alur unduh: pilih komponen dulu, lalu unduh ─────────────────────────────

  const jalankanUnduhan = (jenis: JenisUnduhan, format: FormatEkspor, pilihan: PilihanKomponen | null): Promise<void> => {
    switch (jenis) {
      case 'utama':     return handleGenerateLaporanUtama(pilihan)
      case 'transaksi': return handleExportTransaksi(format, pilihan)
      case 'tunggakan': return handleExportTunggakan(format, pilihan)
      case 'alumni':    return handleExportAlumni(format, pilihan)
      case 'tahunan':   return handleExportKeuanganTahunan(format, pilihan)
    }
  }

  const mulaiUnduhan = (jenis: JenisUnduhan, judul: string, format: FormatEkspor) => {
    setFormatEkspor(format)
    // Satu komponen saja (atau belum ada tagihan) tidak perlu dipilih
    if (opsiKomponen.length < 2) {
      void jalankanUnduhan(jenis, format, null)
      return
    }
    setMintaKomponen({ jenis, judul, format, awal: pilihanAwal(sekolahId, opsiKomponen) })
  }

  const unduhDenganKomponen = (pilihan: PilihanKomponen) => {
    if (!mintaKomponen) return
    simpanPilihanKomponen(sekolahId, pilihan)
    const { jenis, format } = mintaKomponen
    setMintaKomponen(null)
    // Semua komponen ditotalkan = laporan biasa, persis seperti sebelum ada pilihan
    const semuaDitotal = !pisahPerKomponen(pilihan) && pilihan.kunci.length === opsiKomponen.length
    void jalankanUnduhan(jenis, format, semuaDitotal ? null : pilihan)
  }

  if (loading) return <SkeletonLaporan />

  return (
    <div className="dashboard-content">

      {/* ── Header ── */}
      <HeaderLaporan
        judul="Laporan"
        subjudul="Analisis keuangan dan unduhan laporan per periode"
        kanan={(
          <>
            <FilterLaporan filter={filter} activeTAId={activeTA?.id ?? null} />
            <button
              onClick={() => mulaiUnduhan('utama', 'Laporan Utama', 'pdf')}
              disabled={generatingUtama}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: generatingUtama ? '#5B6B8C' : '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: generatingUtama ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              <Download size={20} /> {generatingUtama ? 'Memproses...' : 'Generate Laporan Utama'}
            </button>
          </>
        )}
      />

      {/* ── Empty State ── */}
      {!hasData && (
        <div style={{
          background: '#fff',
          borderRadius: 14,
          borderTop: '1.5px solid #F1F5F9',
          borderRight: '1.5px solid #F1F5F9',
          borderBottom: '1.5px solid #F1F5F9',
          borderLeft: '28px solid #1A2C4E',
          boxShadow: '0 0 10px rgba(0,0,0,0.04)',
          minHeight: 360,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '5rem 2rem',
        }}>
          <Database size={56} strokeWidth={1.2} color="#CBD5E1" style={{ marginBottom: '1.25rem' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', marginBottom: '0.5rem' }}>
            Belum ada data untuk periode ini
          </div>
          <div style={{ fontSize: '0.875rem', color: '#94A3B8', textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
            Transaksi akan muncul di sini setelah ada pembayaran yang masuk di periode yang dipilih
          </div>
        </div>
      )}

      {/* ── Data State ── */}
      {hasData && (
        <>
          {/* Semua baris stat dalam satu wrapper card border-left. Huruf DM Sans seperti
              mockup Figma (Okt 2026); kelas laporan-utama merapatkan jarak hurufnya. */}
          <div className="laporan-utama" style={{ ...sBingkai, padding: '1.5rem 1.875rem 2.5rem', gap: '1.75rem', fontFamily: 'var(--font-dm-sans), sans-serif' }}>

            {/* Section header + pencarian siswa langsung (prinsip 5 draft) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 70, height: 46, background: WARNA_LAPORAN.navy, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 6px rgba(26, 44, 78, 0.3)' }}>
                  <Image src="/icons/Grafik.png" alt="" width={22} height={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.2, color: WARNA_LAPORAN.navy }}>Ringkasan periode ini</h2>
                  <div style={{ fontSize: '0.875rem', color: WARNA_LAPORAN.abu }}>Analisis status dan kondisi pembayaran berdasarkan periode yang dipilih</div>
                </div>
              </div>
              <CariSiswa siswa={daftarCariSiswa} qsFilter={qsFilter} />
            </div>

            {/* Kartu menjorok sedikit dari judul, seperti mockup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', padding: '0 0.875rem' }}>

              {/* Baris 1: kartu metrik — semuanya mengikuti filter periode */}
              <KartuRingkasanUtama ringkasan={ringkasan} pemasukan={pemasukan} />

              {/* Baris 2: komposisi per siswa (filter periode) + tagihan vs realisasi
                  (12 bulan tahun ajaran terpilih, tidak mengikuti periode) */}
              <div className="laporan-baris-dua">
                <KartuTab judul="Komposisi status pembayaran">
                  <KomposisiStatus jumlah={komposisiSiswa} />
                </KartuTab>
                <TrenTagihanChart data={tren} ringkasAwalPakai judul="Tagihan vs realisasi" />
              </div>

              {/* Baris 3: komponen belum dibayar — filter periode */}
              <KartuTab judul="Komponen paling banyak belum dibayar">
                <KomponenBelumDibayar data={komponenData} />
              </KartuTab>

              {/* Baris 4: umur tunggakan (semua tunggakan per hari ini, tanpa filter) +
                  pembayaran per jenjang (filter periode, menurut kelas saat ditagih) */}
              <div className="laporan-baris-empat">
                <KartuTab judul="Umur tunggakan">
                  <UmurTunggakan total={semuaTunggakan.tunggakanBerjalan} siswa={semuaTunggakan.siswaMenunggak} kelompok={umur} tertunggak={tertunggak} />
                </KartuTab>
                <KartuTab judul="Pembayaran per jenjang">
                  <PembayaranPerJenjang data={jenjangData} qsFilter={qsFilter} />
                </KartuTab>
              </div>

            </div>
          </div>

          {/* ── Daftar Laporan ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem', marginTop: '1.3rem' }}>
            {([
              {
                icon: <Receipt size={22} color="#fff" />,
                title: 'Laporan transaksi',
                subtitle: 'Rekap seluruh transaksi pembayaran periode ini',
                sedang: exportingTransaksi,
                ekspor: (format: FormatEkspor) => mulaiUnduhan('transaksi', 'Laporan transaksi', format),
              },
              {
                icon: <AlertTriangle size={22} color="#fff" />,
                title: 'Laporan tunggakan',
                subtitle: 'Daftar siswa yang masih memiliki tunggakan',
                sedang: exportingTunggakan,
                ekspor: (format: FormatEkspor) => mulaiUnduhan('tunggakan', 'Laporan tunggakan', format),
              },
              {
                icon: <Users size={22} color="#fff" />,
                title: 'Laporan data siswa aktif',
                subtitle: 'Data lengkap seluruh siswa yang aktif saat ini',
                sedang: exportingSiswaAktif,
                // Tanpa rupiah — tidak ada komponen yang perlu dipilih
                ekspor: (format: FormatEkspor) => { setFormatEkspor(format); void handleExportSiswaAktif(format) },
              },
              {
                icon: <GraduationCap size={22} color="#fff" />,
                title: 'Laporan alumni',
                subtitle: 'Data alumni per angkatan beserta status pelunasan',
                sedang: exportingAlumni,
                ekspor: (format: FormatEkspor) => mulaiUnduhan('alumni', 'Laporan alumni', format),
              },
              {
                icon: <BarChart2 size={22} color="#fff" />,
                title: 'Laporan keuangan tahunan',
                subtitle: 'Rekap pemasukan keseluruhan per tahun ajaran, siap audit',
                sedang: exportingKeuanganTahunan,
                ekspor: (format: FormatEkspor) => mulaiUnduhan('tahunan', 'Laporan keuangan tahunan', format),
              },
            ]).map((item, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '1rem 1.25rem', boxShadow: '0 0 10px rgba(39, 74, 156, 0.51)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Icon */}
                <div style={{ width: 55, height: 55, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{item.subtitle}</div>
                </div>

                {/* Buttons — PDF dan Excel memakai data yang sama (unduhTabel) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                    onClick={() => item.ekspor('pdf')}
                    disabled={item.sedang}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: item.sedang && formatEkspor === 'pdf' ? '#F1F5F9' : '#fff', border: '2px solid #1A2C4E', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#374151', cursor: item.sedang ? 'default' : 'pointer', fontFamily: 'inherit', opacity: item.sedang && formatEkspor !== 'pdf' ? 0.5 : 1 }}>
                    <FileText size={13} color="#64748B" /> {item.sedang && formatEkspor === 'pdf' ? 'Memproses...' : 'PDF'}
                  </button>
                  <button
                    onClick={() => item.ekspor('excel')}
                    disabled={item.sedang}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: item.sedang && formatEkspor === 'excel' ? '#FDE68A' : '#F5C518', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#1A1A1A', cursor: item.sedang ? 'default' : 'pointer', fontFamily: 'inherit', opacity: item.sedang && formatEkspor !== 'excel' ? 0.5 : 1 }}>
                    <FileSpreadsheet size={13} color="#1A1A1A" /> {item.sedang && formatEkspor === 'excel' ? 'Memproses...' : 'Excel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Notice Modal (pengganti alert() untuk hasil export) ── */}
      {exportNotice && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setExportNotice('')}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden', textAlign: 'center', padding: '2rem 1.75rem 1.5rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Database size={26} color="#94A3B8" />
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 6 }}>Tidak Ada Data</div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1.5rem' }}>{exportNotice}</div>
            <button
              onClick={() => setExportNotice('')}
              style={{ width: '100%', background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, padding: '0.7rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ── Pilih komponen sebelum unduh ── */}
      {mintaKomponen && (
        <ModalPilihKomponen
          judul={mintaKomponen.judul}
          format={mintaKomponen.format}
          opsi={opsiKomponen}
          awal={mintaKomponen.awal}
          onBatal={tutupPilihKomponen}
          onUnduh={unduhDenganKomponen}
        />
      )}

      {/* ── Pop up kop sekolah belum lengkap / gagal dimuat ── */}
      {pesanKop && <ModalKopBelumLengkap pesan={pesanKop} onTutup={tutupPesanKop} />}

    </div>
  )
}
