'use client'

import { useState, useMemo, Suspense } from 'react'
import Image from 'next/image'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BarChart2, Database, AlertTriangle, Download, Receipt, Users, GraduationCap, FileSpreadsheet, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { STATUS_TAGIHAN, statusEfektif, lewatJatuhTempo, batasJatuhTempo, tanpaKewajiban, type StatusTagihan, type WaktuTagihan } from '@/lib/statusTagihan'
import {
  hitungRingkasan, hitungPemasukan, umurTunggakan, trenTagihanRealisasi, adalahTunggakan,
  komposisiStatusSiswa, hitungSiswaLunas, jumlahSiswaTertunggak,
} from '@/lib/metrikLaporan'
import { BULAN_PANJANG as BULAN_NAMES_FULL, formatRupiah as fmt, formatPersen as fmtPersen } from '@/lib/formatLaporan'
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

// Font bawaan jsPDF (helvetica) tidak menjamin tanda pisah en/em — kode PDF lama di
// halaman ini pun sengaja memakai "-" biasa
const teksPdf = (s: string) => s.replace(/[–—]/g, '-')

function getFinalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20
}

type FormatEkspor = 'excel' | 'pdf'

interface TabelEkspor {
  format:       FormatEkspor
  /** Tanpa ekstensi — .xlsx / .pdf ditambahkan sesuai format */
  namaFile:     string
  namaSheet:    string
  /** Judul dan keterangan cakupan di kop PDF */
  judul:        string
  keterangan:   string
  namaSekolah:  string
  headers:      string[]
  baris:        (string | number)[][]
  /** Lebar kolom Excel (wch) */
  lebarKolom:   number[]
  /** Indeks kolom Rupiah: angka mentah di Excel, "Rp …" rata kanan dan dijumlah di PDF */
  kolomRupiah?: number[]
}

/**
 * Tulis satu tabel laporan sebagai Excel atau PDF dari baris yang SAMA, supaya isi
 * kedua format tidak mungkin berselisih. PDF: kop sekolah, lanskap otomatis untuk
 * tabel lebar, baris total untuk kolom Rupiah, dan nomor halaman.
 */
function unduhTabel(t: TabelEkspor): void {
  if (t.format === 'excel') {
    const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.baris])
    ws['!cols'] = t.lebarKolom.map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, t.namaSheet)
    XLSX.writeFile(wb, `${t.namaFile}.xlsx`)
    return
  }

  const doc = new jsPDF({ orientation: t.headers.length > 8 ? 'landscape' : 'portrait' })
  const lebarHalaman  = doc.internal.pageSize.getWidth()
  const tinggiHalaman = doc.internal.pageSize.getHeight()
  const navy: [number, number, number] = [26, 44, 78]
  const kini = new Date()

  let y = 16
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text(teksPdf(t.namaSekolah || 'Sekolah'), lebarHalaman / 2, y, { align: 'center' })
  y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  doc.text(teksPdf(t.judul), lebarHalaman / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(9); doc.setTextColor(100)
  doc.text(teksPdf(t.keterangan), lebarHalaman / 2, y, { align: 'center' })
  y += 5
  doc.text(
    `Dibuat pada ${kini.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}, ${kini.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
    lebarHalaman / 2, y, { align: 'center' },
  )
  doc.setTextColor(0)
  y += 6

  const rupiah = new Set(t.kolomRupiah ?? [])
  const kanan  = { halign: 'right' as const }
  const body   = t.baris.map(b => b.map((sel, i) => (
    rupiah.has(i) && typeof sel === 'number' ? { content: fmt(sel), styles: kanan } : teksPdf(String(sel))
  )))

  // Baris total: label "Total" membentang sampai kolom Rupiah pertama
  const pertamaRp = rupiah.size > 0 ? Math.min(...rupiah) : -1
  const foot = pertamaRp > 0
    ? [[
        { content: 'Total', colSpan: pertamaRp },
        ...t.headers.slice(pertamaRp).map((_, j) => {
          const i = pertamaRp + j
          if (!rupiah.has(i)) return ''
          const jumlah = t.baris.reduce((s, b) => s + (typeof b[i] === 'number' ? (b[i] as number) : 0), 0)
          return { content: fmt(jumlah), styles: kanan }
        }),
      ]]
    : undefined

  autoTable(doc, {
    startY:     y,
    head:       [t.headers],
    body,
    foot,
    showFoot:   'lastPage',
    theme:      'grid',
    headStyles: { fillColor: navy, fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles:     { fontSize: 8, cellPadding: 1.5 },
    margin:     { left: 10, right: 10 },
  })

  const jumlahHalaman = doc.getNumberOfPages()
  for (let p = 1; p <= jumlahHalaman; p++) {
    doc.setPage(p)
    doc.setFontSize(8); doc.setTextColor(120)
    doc.text(`Halaman ${p} dari ${jumlahHalaman}`, lebarHalaman - 10, tinggiHalaman - 8, { align: 'right' })
  }
  doc.save(`${t.namaFile}.pdf`)
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

interface ExportTagihanNested {
  id:           string
  bulan:        number
  tahun:        number
  siswa:        { nama: string; nis: string | null; nisn: string | null; kelas: { id: string; nama: string } | null } | null
  tagihan_item: { komponen_id: string | null; nama_komponen: string; komponen: { jenis: string } | null }[]
}
interface PembayaranExportRaw {
  id:             string
  jumlah:         number
  metode:         string
  tanggal_bayar:  string
  gateway_trx_id: string | null
  tagihan_id:     string
}
interface VerifikasiExportRaw {
  id:               string
  nominal_diajukan: number
  created_at:       string
  tagihan:          ExportTagihanNested | null
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
  tagihan_item:  { komponen_id: string | null; nama_komponen: string; komponen: { jenis: string } | null }[]
}
interface ExportRow {
  tanggal:         string
  nisn:            string
  nama:            string
  kelas:           string
  jenisPembayaran: string
  metode:          string
  nominal:         number
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
  const { sekolahId, namaSekolah, loading, rows: metrikRows, kelas, activeTA, archivedTAs, sekarang } = useDataLaporan()
  const filter = useFilterLaporan(activeTA, archivedTAs, sekarang)
  const { taTerpilih, selectedFilter, dalamPeriode, qsFilter } = filter

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
  // berjudul "Jumlah Tagihan"
  const komposisiTagihan = useMemo(() => {
    // Aturan sama persis dengan halaman tagihan aktif, termasuk pengecualian alumni
    const jumlah: Record<StatusTagihan, number> = { lunas: 0, cicilan: 0, belum_bayar: 0, menunggak: 0 }
    for (const t of periodTagihan) {
      jumlah[statusEfektif(t.status, lewatJatuhTempo(t, sekarang), t.is_alumni, t.total_nominal)] += 1
    }
    const { lunas, cicilan, belum_bayar: belumBayar, menunggak } = jumlah
    return [
      { label: STATUS_TAGIHAN.lunas.label,       value: lunas,      color: STATUS_TAGIHAN.lunas.solid       },
      { label: STATUS_TAGIHAN.cicilan.label,     value: cicilan,    color: STATUS_TAGIHAN.cicilan.solid     },
      { label: STATUS_TAGIHAN.belum_bayar.label, value: belumBayar, color: STATUS_TAGIHAN.belum_bayar.solid },
      { label: STATUS_TAGIHAN.menunggak.label,   value: menunggak,  color: STATUS_TAGIHAN.menunggak.solid   },
    ]
  }, [periodTagihan, sekarang])

  // Rumus yang sama dengan kartu tingkat pelunasan (Rupiah, hanya tagihan jatuh
  // tempo), dikelompokkan menurut kelas saat tagihan dibuat — bukan kelas siswa
  // sekarang, yang sudah bergeser setelah naik kelas. Tagihan tanpa snapshot kelas
  // (tahun ajaran sebelum kolom itu ada) hanya ikut di angka sekolah.
  const jenjangData = useMemo<(JenjangRingkas & { jenjang: string; terbayar: number; nilai: number })[]>(() => {
    const perJenjang = new Map<string, typeof periodTagihan>()
    for (const t of periodTagihan) {
      const jenjang = t.kelas_id ? kelas.get(t.kelas_id)?.jenjang : undefined
      if (!jenjang) continue
      const daftar = perJenjang.get(jenjang)
      if (daftar) daftar.push(t)
      else perJenjang.set(jenjang, [t])
    }
    return Array.from(perJenjang.entries())
      .map(([kode, rows]) => {
        const r     = hitungRingkasan(rows, sekarang)
        const siswa = hitungSiswaLunas(rows, sekarang)
        return {
          kode,
          jenjang:      `Jenjang ${kode}`,
          pct:          r.tingkatPelunasan,
          terbayar:     r.terbayarJatuhTempo,
          nilai:        r.nilaiJatuhTempo,
          tunggakan:    r.tunggakanBerjalan,
          siswaLunas:   siswa.lunas,
          siswaDinilai: siswa.dinilai,
        }
      })
      .sort((a, b) => a.kode.localeCompare(b.kode, 'id', { numeric: true }))
  }, [periodTagihan, kelas, sekarang])

  const komponenData = useMemo<(KomponenBelum & { jumlah: number })[]>(() => {
    // Dikelompokkan per komponen_id dan diberi label nama hidup dari master komponen,
    // bukan snapshot nama_komponen. Kalau memakai snapshot, komponen yang di-rename
    // pecah jadi dua baris (nama lama dari tagihan lama, nama baru dari tagihan baru).
    // Komponen yang sudah dihapus tidak punya komponen_id lagi — jatuh ke snapshot.
    // `jumlah` = tagihan (dipakai PDF), `siswa` = siswa berbeda (dipakai kartu).
    const byKomponen = new Map<string, { nama: string; jumlah: number; total: number; siswa: Set<string> }>()
    for (const t of periodTagihan) {
      if (t.status === 'lunas' || tanpaKewajiban(t.total_nominal)) continue
      for (const item of t.tagihan_item) {
        const kunci = item.komponen_id ?? `nama:${item.nama_komponen}`
        const nama  = item.komponen?.nama ?? item.nama_komponen
        const cur   = byKomponen.get(kunci) ?? { nama, jumlah: 0, total: 0, siswa: new Set<string>() }
        cur.nama    = nama
        cur.jumlah += 1
        cur.total  += item.nominal
        cur.siswa.add(t.siswa_id)
        byKomponen.set(kunci, cur)
      }
    }
    // Diurutkan berdasarkan nilai rupiah, bukan jumlah tagihan: setiap tagihan yang
    // belum lunas memuat komponen yang sama, jadi jumlahnya selalu seri dan urutannya
    // jatuh ke urutan penyisipan Map. Nilai rupiah juga yang ditonjolkan di kartu.
    return Array.from(byKomponen.values())
      .map(v => ({ nama: v.nama, jumlah: v.jumlah, total: v.total, siswa: v.siswa.size }))
      .sort((a, b) => b.total - a.total || b.jumlah - a.jumlah)
      .slice(0, 4)
  }, [periodTagihan])

  const hasData = periodTagihan.length > 0

  // ── Export Laporan Transaksi (Excel / PDF) ───────────────────────────────

  const handleExportTransaksi = async (format: FormatEkspor) => {
    if (!selectedFilter || !sekolahId) return

    const sortedMonths = [...selectedFilter.months].sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan)
    const first = sortedMonths[0]
    const last  = sortedMonths[sortedMonths.length - 1]
    if (!first || !last) {
      setExportNotice('Tidak ada transaksi pada periode ini.')
      return
    }
    // Rentang berdasarkan tanggal transaksi aktual (tanggal_bayar / created_at), bukan bulan tagihan —
    // supaya pembayaran yang terjadi di periode ini tetap masuk walau melunasi tagihan bulan lain.
    const startIso = new Date(first.tahun, first.bulan - 1, 1).toISOString()
    const endIso   = new Date(last.tahun, last.bulan, 1).toISOString()

    setExportingTransaksi(true)
    try {
      const NESTED_SELECT = 'id, bulan, tahun, siswa:siswa_id(nama, nis, nisn, kelas:kelas_id(id, nama)), tagihan_item(komponen_id, nama_komponen, komponen:komponen_id(jenis))'

      // pembayaran.tagihan_id tidak terdaftar sebagai foreign key di PostgREST schema cache,
      // jadi tagihan tidak bisa di-embed langsung di sini — harus di-fetch terpisah lalu digabung manual
      // (pola yang sama dipakai di pembayaran/page.tsx).
      const [{ data: pembData, error: pembErr }, { data: verifData, error: verifErr }, paketByKelas] = await Promise.all([
        supabase
          .from('pembayaran')
          .select('id, jumlah, metode, tanggal_bayar, gateway_trx_id, tagihan_id')
          .eq('sekolah_id', sekolahId)
          .gte('tanggal_bayar', startIso)
          .lt('tanggal_bayar', endIso)
          .order('tanggal_bayar', { ascending: true })
          .limit(5000),
        supabase
          .from('verifikasi_pembayaran')
          .select(`id, nominal_diajukan, created_at, tagihan:tagihan_id(${NESTED_SELECT})`)
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

      const rows: ExportRow[] = []

      for (const p of pembList) {
        const tagihan = tagihanMap.get(p.tagihan_id)
        if (!tagihan) continue
        rows.push({
          tanggal:         p.tanggal_bayar,
          nisn:            nisnOrNis(tagihan.siswa),
          nama:            tagihan.siswa?.nama ?? '-',
          kelas:           tagihan.siswa?.kelas?.nama ?? '-',
          jenisPembayaran: resolveJenisLabel(tagihan.tagihan_item, tagihan.bulan, tagihan.tahun, tagihan.siswa?.kelas?.id ?? null, paketByKelas),
          metode:          metodeLabel(p.metode),
          nominal:         p.jumlah,
          biayaAdmin:      p.gateway_trx_id ? (feeMap.get(p.gateway_trx_id) ?? 0) : 0,
          status:          'Berhasil',
        })
      }

      for (const v of verifList) {
        if (!v.tagihan) continue
        rows.push({
          tanggal:         v.created_at,
          nisn:            nisnOrNis(v.tagihan.siswa),
          nama:            v.tagihan.siswa?.nama ?? '-',
          kelas:           v.tagihan.siswa?.kelas?.nama ?? '-',
          jenisPembayaran: resolveJenisLabel(v.tagihan.tagihan_item, v.tagihan.bulan, v.tagihan.tahun, v.tagihan.siswa?.kelas?.id ?? null, paketByKelas),
          metode:          'Transfer Manual',
          nominal:         v.nominal_diajukan,
          biayaAdmin:      0,
          status:          'Menunggu Verifikasi',
        })
      }

      if (rows.length === 0) {
        setExportNotice('Tidak ada transaksi pada periode ini.')
        return
      }

      rows.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())

      const periodeLabel = `${selectedFilter.label}_${selectedFilter.sublabel}`.replace(/\s+/g, '_')
      unduhTabel({
        format,
        namaFile:    `Laporan_Transaksi_${periodeLabel}`,
        namaSheet:   'Laporan Transaksi',
        judul:       'Laporan Transaksi',
        keterangan:  `Periode: ${selectedFilter.label} - ${selectedFilter.sublabel} (menurut tanggal transaksi)`,
        namaSekolah,
        headers:     ['No', 'Tanggal Transaksi', 'ID Transaksi', 'NISN', 'Nama Siswa', 'Kelas', 'Jenis Pembayaran', 'Metode', 'Nominal', 'Biaya Admin', 'Total Bayar', 'Status'],
        baris:       rows.map((r, i) => [
          i + 1,
          formatTanggalExcel(r.tanggal),
          generateIdTransaksi(r.tanggal, i + 1),
          r.nisn,
          r.nama,
          r.kelas,
          r.jenisPembayaran,
          r.metode,
          r.nominal,
          r.biayaAdmin,
          r.nominal + r.biayaAdmin,
          r.status,
        ]),
        lebarKolom:  [5, 16, 16, 14, 24, 10, 26, 16, 14, 12, 14, 18],
        kolomRupiah: [8, 9, 10],
      })
    } finally {
      setExportingTransaksi(false)
    }
  }

  // ── Export Laporan Tunggakan (Excel / PDF) ────────────────────────────────
  // Selalu semua tunggakan outstanding sampai hari ini — tidak terikat filter periode dropdown,
  // karena tunggakan bersifat akumulatif (piutang lintas bulan), bukan snapshot satu periode.
  // Isinya sama persis dengan kartu Umur tunggakan: predikat adalahTunggakan yang sama.

  const handleExportTunggakan = async (format: FormatEkspor) => {
    if (!sekolahId) return

    const tunggakanRows     = metrikRows.filter(t => adalahTunggakan(t, sekarang))
    const tunggakanIds      = tunggakanRows.map(t => t.id)
    const terbayarPerTagihan = new Map(tunggakanRows.map(t => [t.id, t.terbayar]))

    if (tunggakanIds.length === 0) {
      setExportNotice('Tidak ada tunggakan saat ini.')
      return
    }

    setExportingTunggakan(true)
    try {
      const [{ data: tagihanData, error }, paketByKelas] = await Promise.all([
        supabase
          .from('tagihan')
          .select('id, bulan, tahun, status, total_nominal, jatuh_tempo, siswa:siswa_id(nama, nis, nisn, kelas:kelas_id(id, nama)),tagihan_item(komponen_id, nama_komponen, komponen:komponen_id(jenis))')
          .in('id', tunggakanIds)
          .limit(5000),
        buildPaketByKelasMap(sekolahId),
      ])

      if (error) console.error('[Export Laporan Tunggakan] gagal memuat tagihan:', error)

      const detailList = (tagihanData ?? []) as unknown as TunggakanTagihanRaw[]

      const rows = detailList
        .map(t => ({
          nisn:       nisnOrNis(t.siswa),
          nama:       t.siswa?.nama ?? '-',
          kelas:      t.siswa?.kelas?.nama ?? '-',
          jenis:      resolveJenisLabel(t.tagihan_item, t.bulan, t.tahun, t.siswa?.kelas?.id ?? null, paketByKelas),
          periode:    `${BULAN_NAMES_FULL[t.bulan]} ${t.tahun}`,
          nominal:    t.total_nominal - (terbayarPerTagihan.get(t.id) ?? 0),
          jatuhTempo: getJatuhTempoTanggal(t),
          status:     t.status === 'cicilan' ? 'Cicilan' : 'Belum Bayar',
          bulan:      t.bulan,
          tahun:      t.tahun,
        }))
        .sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan || a.nama.localeCompare(b.nama, 'id'))

      if (rows.length === 0) {
        setExportNotice('Tidak ada tunggakan saat ini.')
        return
      }

      unduhTabel({
        format,
        namaFile:    `Laporan_Tunggakan_${formatDateLocal(now)}`,
        namaSheet:   'Laporan Tunggakan',
        judul:       'Laporan Tunggakan',
        keterangan:  `Semua tunggakan yang sudah lewat jatuh tempo per ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        namaSekolah,
        headers:     ['No', 'NISN', 'Nama Siswa', 'Kelas', 'Jenis Tunggakan', 'Bulan/Periode', 'Nominal Tunggakan', 'Jatuh Tempo', 'Status'],
        baris:       rows.map((r, i) => [i + 1, r.nisn, r.nama, r.kelas, r.jenis, r.periode, r.nominal, r.jatuhTempo, r.status]),
        lebarKolom:  [5, 14, 24, 10, 32, 16, 18, 14, 14],
        kolomRupiah: [6],
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

      unduhTabel({
        format,
        namaFile:    `Laporan_Siswa_Aktif_${formatDateLocal(now)}`,
        namaSheet:   'Siswa Aktif',
        judul:       'Laporan Data Siswa Aktif',
        keterangan:  `Data per ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · termasuk siswa pindah/keluar (Nonaktif)`,
        namaSekolah,
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

  const handleExportAlumni = async (format: FormatEkspor) => {
    if (!sekolahId) return

    setExportingAlumni(true)
    try {
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

      const rows = alumniList
        .map(a => {
          const totalTagihan  = totalTagihanMap.get(a.id) ?? 0
          const totalBayar    = totalBayarMap.get(a.id) ?? 0
          const sisa          = totalTagihan - totalBayar
          const tahunLulusNum = a.tahun_lulus ? parseInt(a.tahun_lulus, 10) : null
          const angkatan      = tahunLulusNum ? String(tahunLulusNum - jenjangLevels.length) : '-'
          return {
            nisn:       nisnOrNis(a),
            nama:       a.nama,
            angkatan,
            tahunLulus: a.tahun_lulus ?? '-',
            totalTagihan,
            totalBayar,
            sisa,
            status: sisa === 0 ? 'Lunas' : 'Belum Lunas',
          }
        })
        .sort((a, b) => a.tahunLulus.localeCompare(b.tahunLulus) || a.nama.localeCompare(b.nama, 'id'))

      unduhTabel({
        format,
        namaFile:    `Laporan_Alumni_${formatDateLocal(now)}`,
        namaSheet:   'Laporan Alumni',
        judul:       'Laporan Alumni',
        keterangan:  'Seluruh alumni yang lulus · total dari semua tagihan sejak masuk hingga lulus',
        namaSekolah,
        headers:     ['No', 'NISN', 'Nama Siswa', 'Angkatan', 'Tahun Lulus', 'Total Tagihan', 'Total Terbayar', 'Sisa Tunggakan', 'Status Pelunasan'],
        baris:       rows.map((r, i) => [i + 1, r.nisn, r.nama, r.angkatan, r.tahunLulus, r.totalTagihan, r.totalBayar, r.sisa, r.status]),
        lebarKolom:  [5, 14, 24, 10, 12, 16, 16, 16, 16],
        kolomRupiah: [5, 6, 7],
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

  const handleExportKeuanganTahunan = async (format: FormatEkspor) => {
    if (!sekolahId) return

    setExportingKeuanganTahunan(true)
    try {
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

      const rows = taList.map(ta => {
        const monthSet = new Set(monthsInRange(ta.tanggal_mulai, ta.tanggal_selesai).map(m => periodKey(m.bulan, m.tahun)))
        const tagihanTA = tagihanList.filter(t => monthSet.has(periodKey(t.bulan, t.tahun)))
        const tagihanIds = new Set(tagihanTA.map(t => t.id))

        const totalTarget    = tagihanTA.reduce((s, t) => s + t.total_nominal, 0)
        const totalRealisasi = tagihanTA.reduce((s, t) => s + (paidMap.get(t.id) ?? 0), 0)
        const jumlahTransaksi = pembList.filter(p => tagihanIds.has(p.tagihan_id)).length

        return {
          tahunAjaran:    ta.nama,
          totalTarget,
          totalRealisasi,
          totalTunggakan: totalTarget - totalRealisasi,
          jumlahTransaksi,
          statusAudit:    ta.is_aktif ? 'Berjalan' : 'Terverifikasi',
        }
      })

      unduhTabel({
        format,
        namaFile:    `Laporan_Keuangan_Tahunan_${formatDateLocal(now)}`,
        namaSheet:   'Keuangan Tahunan',
        judul:       'Laporan Keuangan Tahunan',
        keterangan:  'Semua tahun ajaran · target = tagihan yang terbit, realisasi = yang sudah dibayar',
        namaSekolah,
        headers:     ['No', 'Tahun Ajaran', 'Total Target', 'Total Realisasi', 'Total Tunggakan', 'Jumlah Transaksi', 'Status Audit'],
        baris:       rows.map((r, i) => [i + 1, r.tahunAjaran, r.totalTarget, r.totalRealisasi, r.totalTunggakan, r.jumlahTransaksi, r.statusAudit]),
        lebarKolom:  [5, 14, 16, 16, 16, 16, 14],
        kolomRupiah: [2, 3, 4],
      })
    } finally {
      setExportingKeuanganTahunan(false)
    }
  }

  // ── Generate Laporan Utama (PDF) ───────────────────────────────────────────
  // Merangkum seluruh blok "Ringkasan periode ini" yang tampil di layar (kartu metrik,
  // komposisi status, tagihan vs realisasi, umur tunggakan, pelunasan per jenjang,
  // komponen belum dibayar) jadi satu dokumen PDF sesuai periode di dropdown atas.

  const handleGenerateLaporanUtama = async () => {
    if (!selectedFilter || !sekolahId) return
    if (!hasData) {
      setExportNotice('Tidak ada data pada periode ini untuk digenerate.')
      return
    }

    setGeneratingUtama(true)
    try {
      const { data: sekolahData } = await supabase.from('sekolah').select('nama').eq('id', sekolahId).maybeSingle()
      const namaSekolah = (sekolahData as { nama?: string } | null)?.nama ?? 'Sekolah'

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const navy: [number, number, number] = [26, 44, 78]
      let y = 18

      doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
      doc.text(namaSekolah, pageWidth / 2, y, { align: 'center' })
      y += 7
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
      doc.text('Laporan Utama', pageWidth / 2, y, { align: 'center' })
      y += 6
      doc.setFontSize(9); doc.setTextColor(100)
      doc.text(`Periode: ${selectedFilter.label} - ${selectedFilter.sublabel}`, pageWidth / 2, y, { align: 'center' })
      y += 5
      doc.text(
        `Dibuat pada ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}, ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        pageWidth / 2, y, { align: 'center' }
      )
      doc.setTextColor(0)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [['Ringkasan', 'Nilai']],
        body: [
          ['Total Pemasukan', fmt(pemasukan.total)],
          ['Dari Transaksi', `${pemasukan.transaksi} transaksi`],
          ['Tingkat Pelunasan (tagihan jatuh tempo)', ringkasan.tingkatPelunasan === null
            ? 'Belum ada tagihan jatuh tempo'
            : `${fmtPersen(ringkasan.tingkatPelunasan)} (${fmt(ringkasan.terbayarJatuhTempo)} dari ${fmt(ringkasan.nilaiJatuhTempo)})`],
          ['Ketepatan Waktu', ringkasan.ketepatanWaktu === null
            ? 'Belum ada tagihan jatuh tempo'
            : `${fmtPersen(ringkasan.ketepatanWaktu)} (${ringkasan.jumlahTepatWaktu} dari ${ringkasan.jumlahDinilai} tagihan)`],
          ['Rata-rata Keterlambatan', ringkasan.rataHariTelat === null
            ? 'Tidak ada yang telat'
            : `${Math.round(ringkasan.rataHariTelat)} hari (${ringkasan.jumlahTelat} tagihan lunas telat)`],
          ['Tunggakan (lewat jatuh tempo)', `${fmt(ringkasan.tunggakanBerjalan)} (${ringkasan.siswaMenunggak} siswa)`],
          ['Akan Masuk (belum jatuh tempo)', fmt(ringkasan.akanMasuk)],
        ],
        theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
      })
      y = getFinalY(doc) + 10

      doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
      doc.text('Komposisi Status Pembayaran', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        head: [['Status', 'Jumlah Tagihan']],
        body: komposisiTagihan.map(d => [d.label, String(d.value)]),
        theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
      })
      y = getFinalY(doc) + 10

      if (y > 250) { doc.addPage(); y = 18 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
      doc.text('Tagihan vs Realisasi per Bulan Jatuh Tempo (12 Bulan Terakhir)', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        // Tagihan tiap bulan sudah digabung dengan tunggakan bulan sebelumnya; kolom
        // "Termasuk Tunggakan" memperlihatkan porsinya supaya tidak dijumlahkan antarbulan
        head: [['Bulan', 'Tagihan', 'Termasuk Tunggakan', 'Terbayar', 'Pelunasan']],
        body: tren.map(t => [
          `${BULAN_NAMES_FULL[t.bulan]} ${t.tahun}${t.berjalan ? ' (berjalan)' : ''}`,
          fmt(t.tagihan),
          t.tunggakanLama > 0 ? fmt(t.tunggakanLama) : '-',
          fmt(t.terbayar),
          t.tagihan > 0 ? `${Math.round((t.terbayar / t.tagihan) * 100)}%` : '-',
        ]),
        theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
      })
      y = getFinalY(doc) + 10

      if (y > 250) { doc.addPage(); y = 18 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
      doc.text('Umur Tunggakan (semua tunggakan per hari ini)', 14, y)
      y += 4
      autoTable(doc, {
        startY: y,
        // Tiap rentang sudah digabung dengan tunggakan yang lebih lama; kolom "Termasuk
        // Lebih Lama" memperlihatkan porsinya supaya nominal tidak dijumlahkan antarbaris
        head: [['Umur', 'Nominal', 'Termasuk Lebih Lama', 'Jumlah Siswa', 'Jumlah Tagihan']],
        body: umur.map(k => [
          teksPdf(k.label), fmt(k.nominal), k.lebihLama > 0 ? fmt(k.lebihLama) : '-',
          String(k.jumlahSiswa), String(k.jumlahTagihan),
        ]),
        theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
      })
      y = getFinalY(doc) + 10

      if (jenjangData.length > 0) {
        if (y > 250) { doc.addPage(); y = 18 }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
        doc.text('Pelunasan per Jenjang (tagihan jatuh tempo)', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Jenjang', 'Tingkat Pelunasan', 'Terbayar', 'Nilai Jatuh Tempo']],
          body: jenjangData.map(j => [j.jenjang, teksPdf(fmtPersen(j.pct)), fmt(j.terbayar), fmt(j.nilai)]),
          theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
        })
        y = getFinalY(doc) + 10
      }

      if (komponenData.length > 0) {
        if (y > 250) { doc.addPage(); y = 18 }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
        doc.text('Komponen Paling Banyak Belum Dibayar', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Komponen', 'Jumlah Tagihan', 'Total Nominal']],
          body: komponenData.map(k => [k.nama, String(k.jumlah), fmt(k.total)]),
          theme: 'grid', headStyles: { fillColor: navy }, styles: { fontSize: 9 },
        })
      }

      const periodeLabel = `${selectedFilter.label}_${selectedFilter.sublabel}`.replace(/\s+/g, '_')
      doc.save(`Laporan_Utama_${periodeLabel}.pdf`)
    } finally {
      setGeneratingUtama(false)
    }
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
              onClick={handleGenerateLaporanUtama}
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
                ekspor: handleExportTransaksi,
              },
              {
                icon: <AlertTriangle size={22} color="#fff" />,
                title: 'Laporan tunggakan',
                subtitle: 'Daftar siswa yang masih memiliki tunggakan',
                sedang: exportingTunggakan,
                ekspor: handleExportTunggakan,
              },
              {
                icon: <Users size={22} color="#fff" />,
                title: 'Laporan data siswa aktif',
                subtitle: 'Data lengkap seluruh siswa yang aktif saat ini',
                sedang: exportingSiswaAktif,
                ekspor: handleExportSiswaAktif,
              },
              {
                icon: <GraduationCap size={22} color="#fff" />,
                title: 'Laporan alumni',
                subtitle: 'Data alumni per angkatan beserta status pelunasan',
                sedang: exportingAlumni,
                ekspor: handleExportAlumni,
              },
              {
                icon: <BarChart2 size={22} color="#fff" />,
                title: 'Laporan keuangan tahunan',
                subtitle: 'Rekap pemasukan keseluruhan per tahun ajaran, siap audit',
                sedang: exportingKeuanganTahunan,
                ekspor: handleExportKeuanganTahunan,
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
                    onClick={() => { setFormatEkspor('pdf'); void item.ekspor('pdf') }}
                    disabled={item.sedang}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: item.sedang && formatEkspor === 'pdf' ? '#F1F5F9' : '#fff', border: '2px solid #1A2C4E', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#374151', cursor: item.sedang ? 'default' : 'pointer', fontFamily: 'inherit', opacity: item.sedang && formatEkspor !== 'pdf' ? 0.5 : 1 }}>
                    <FileText size={13} color="#64748B" /> {item.sedang && formatEkspor === 'pdf' ? 'Memproses...' : 'PDF'}
                  </button>
                  <button
                    onClick={() => { setFormatEkspor('excel'); void item.ekspor('excel') }}
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

    </div>
  )
}
