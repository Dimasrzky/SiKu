'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  AlertTriangle, CheckCircle2, Database, FileSpreadsheet, FileText, Plus, Trash2, TrendingDown, TrendingUp, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ambilPerPotong, ambilSemua } from '@/lib/ambilSemua'
import { formatRupiah } from '@/lib/formatLaporan'
import { tanggalWIB } from '@/lib/metrikLaporan'
import { hitungSaldoKomponen, kunciKomponen, NAMA_LAINNYA, petaWarnaKomponen, WARNA_LAINNYA } from '@/lib/kasKomponen'
import { bagianPerPembayaran, susunRiwayatKas, type PembayaranKas, type TagihanKas } from '@/lib/riwayatKas'
import {
  KATEGORI_SELECT, PENGELUARAN_SELECT, PENGELUARAN_SELECT_SUMBER, awalBulanIso, bacaKunciBulan, bacaPengeluaran, bulanAwal,
  bulanBerikut, bulanDalamPeriode, bulanDari, bulanSama, kelompokkanPerKategori, kunciBulan, labelBulan, periodeTahunKalender,
  type Bulan, type KategoriPengeluaran, type Pengeluaran, type PeriodeKas,
} from '@/lib/pengeluaran'
import { hapusFotoPengeluaran } from '@/lib/fotoPengeluaran'
import type { FormatEkspor } from '@/lib/eksporPengeluaran'
import { useKopLaporan } from '@/lib/useKopLaporan'
import { ModalKopBelumLengkap } from '@/components/laporan/ModalKopBelumLengkap'
import { HeaderLaporan } from '@/components/laporan/HeaderLaporan'
import { DropdownFilter } from '@/components/laporan/DropdownFilter'
import { FilterPeriode } from '@/components/laporan/FilterPeriode'
import { sBingkai } from '@/components/laporan/gayaLaporan'
import {
  FONT_PENGELUARAN, JUDUL_HALAMAN, KartuKas, NAVY, PilihanTab, SUBJUDUL_HALAMAN, WARNA_KELUAR,
  sBarisKartu, sBingkaiPengeluaran, type TabPengeluaran,
} from '@/components/pengeluaran/BagianPengeluaran'
import { PanelSaldoKomponen } from '@/components/pengeluaran/PanelSaldoKomponen'
import { TabelRiwayatKas } from '@/components/pengeluaran/TabelRiwayatKas'
import { TabelDaftarPengeluaran } from '@/components/pengeluaran/TabelDaftarPengeluaran'
import { FormPengeluaran, type PilihanSumberDana } from '@/components/pengeluaran/FormPengeluaran'
import { ModalKategori } from '@/components/pengeluaran/ModalKategori'
import { ModalFoto } from '@/components/pengeluaran/ModalFoto'
import { SkeletonPengeluaran } from '@/components/skeleton/SkeletonPengeluaran'

// Subfitur Pengeluaran (lib/fiturSekolah) — hanya terbuka untuk sekolah yang ditambahkan
// tim Equanusa; layout.tsx di folder ini menolak sekolah lain.
//
// Sejak 27 Okt 2026 (mockup + keputusan user): setiap pengeluaran diambil dari satu atau
// lebih komponen tagihan (lib/kasKomponen). Sebelum ada pengeluaran sama sekali, halaman
// hanya berisi ajakan mencatat. Sesudahnya: tiga kartu bulan terpilih, lalu tab
// Ringkasan Kas (riwayat pemasukan + pengeluaran bulan itu, dan saldo per komponen
// sepanjang periode) atau Daftar Pengeluaran (tabel per jenis bulan itu).

interface TahunAjaranRaw { id: string; nama: string; tanggal_mulai: string; tanggal_selesai: string; is_aktif: boolean }
interface KomponenRaw    { id: string; nama: string; kelas_warna: string | null }
type TagihanRaw = {
  id: string; bulan: number; tahun: number
  tagihan_item: { id: string; nama_komponen: string; nominal: number; potongan: number | null }[] | null
}
type PengeluaranRaw = Parameters<typeof bacaPengeluaran>[0]

type Pemberitahuan = { jenis: 'sukses' | 'peringatan' | 'galat'; teks: string }

const WARNA_PEMBERITAHUAN: Record<Pemberitahuan['jenis'], { latar: string; teks: string }> = {
  sukses:     { latar: '#DCFCE7', teks: '#166534' },
  peringatan: { latar: '#FEF3C7', teks: '#92400E' },
  galat:      { latar: '#FEE2E2', teks: '#B91C1C' },
}

/** Tabel/relasi pengeluaran_sumber_dana belum dibuat — SQL 27 Okt 2026 belum dijalankan */
const sumberBelumAda = (e: { code?: string; message?: string }) =>
  ['PGRST200', 'PGRST205', '42P01'].includes(e.code ?? '') || (e.message ?? '').includes('pengeluaran_sumber_dana')

/** Rupiah bertanda: selisih negatif tampil merah */
const RupiahBertanda = ({ nilai }: { nilai: number }) => (
  <span style={{ color: nilai < 0 ? WARNA_KELUAR : undefined }}>{formatRupiah(nilai)}</span>
)

const PengeluaranPage = () => {
  const [sekarang] = useState(() => new Date())

  const [sekolahId,     setSekolahId]     = useState('')
  const [daftarPeriode, setDaftarPeriode] = useState<PeriodeKas[]>([])
  const [periodeId,     setPeriodeId]     = useState('')
  const [bulanPilihan,  setBulanPilihan]  = useState<Bulan | null>(null)
  const [tab,           setTab]           = useState<TabPengeluaran>('kas')

  const [kategori,    setKategori]    = useState<KategoriPengeluaran[]>([])
  const [komponen,    setKomponen]    = useState<KomponenRaw[]>([])
  const [pengeluaran, setPengeluaran] = useState<Pengeluaran[]>([])
  const [pembayaran,  setPembayaran]  = useState<PembayaranKas[]>([])
  const [tagihanPer,  setTagihanPer]  = useState<Map<string, TagihanKas>>(new Map())
  /** Sekolah ini pernah mencatat pengeluaran (periode mana pun) */
  const [adaPengeluaran, setAdaPengeluaran] = useState(true)
  /** Tabel sumber dana sudah dibuat di database */
  const [sumberSiap,  setSumberSiap]  = useState(true)
  const [sudahDimuat, setSudahDimuat] = useState(false)
  const [memuat,      setMemuat]      = useState(false)
  const [muatUlang,   setMuatUlang]   = useState(0)

  // Form Catat/Ubah Pengeluaran yang turun membuka di atas konten (bukan modal)
  const [formIsi,       setFormIsi]       = useState<{ awal: Pengeluaran | null; kunci: string } | null>(null)
  const [formTutup,     setFormTutup]     = useState(false)
  const formRef      = useRef<HTMLDivElement>(null)
  const tutupFormRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [modalKategori, setModalKategori] = useState(false)
  const [lihatFoto,     setLihatFoto]     = useState<Pengeluaran | null>(null)
  const [hapus,         setHapus]         = useState<Pengeluaran | null>(null)
  const [menghapus,     setMenghapus]     = useState(false)
  const [mengekspor,    setMengekspor]    = useState<FormatEkspor | null>(null)
  const [pemberitahuan, setPemberitahuan] = useState<Pemberitahuan | null>(null)
  // Setiap unduhan (PDF dan Excel) memeriksa kelengkapan kop sekolah lebih dulu
  const { siapkanKop, pesanKop, tutupPesanKop } = useKopLaporan(sekolahId)

  const muatKategori = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('kategori_pengeluaran')
      .select(KATEGORI_SELECT)
      .eq('sekolah_id', id)
      .order('urutan')
      .limit(200)
    if (error) {
      setPemberitahuan({ jenis: 'galat', teks: 'Jenis pengeluaran gagal dimuat.' })
      return
    }
    setKategori((data ?? []) as KategoriPengeluaran[])
  }, [])

  // Sekolah, periode (tahun ajaran), jenis pengeluaran, dan komponen tagihan
  useEffect(() => {
    let batal = false
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profil } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
      const id = (profil as { sekolah_id: string | null } | null)?.sekolah_id
      if (!id || batal) return

      const [{ data: taData }, , { data: komponenData }] = await Promise.all([
        supabase.from('tahun_ajaran').select('id, nama, tanggal_mulai, tanggal_selesai, is_aktif')
          .eq('sekolah_id', id).order('tanggal_mulai', { ascending: false }).limit(10),
        muatKategori(id),
        // Komponen terbaru dulu: namanya dipakai sebagai ejaan resmi, warnanya untuk chip
        supabase.from('komponen_tagihan').select('id, nama, kelas_warna')
          .eq('sekolah_id', id).order('created_at', { ascending: false }).limit(500),
      ])
      if (batal) return

      const periode: PeriodeKas[] = ((taData ?? []) as TahunAjaranRaw[]).map(t => ({
        id: t.id, nama: t.nama, mulai: t.tanggal_mulai, selesai: t.tanggal_selesai, aktif: t.is_aktif,
      }))
      const daftar = periode.length > 0 ? periode : [periodeTahunKalender(sekarang)]
      setKomponen((komponenData ?? []) as KomponenRaw[])
      setDaftarPeriode(daftar)
      setPeriodeId((daftar.find(p => p.aktif) ?? daftar[0]).id)
      setSekolahId(id)
    }
    init()
    return () => { batal = true }
  }, [muatKategori, sekarang])

  const periode     = daftarPeriode.find(p => p.id === periodeId) ?? null
  const daftarBulan = useMemo(() => (periode ? bulanDalamPeriode(periode) : []), [periode])
  const bulanAktif  = bulanPilihan && daftarBulan.some(b => bulanSama(b, bulanPilihan)) ? bulanPilihan : bulanAwal(daftarBulan, sekarang)

  // Pengeluaran (beserta sumber dananya), pembayaran, dan tagihan pembayaran itu sepanjang
  // periode — dipakai kedua tab dan saldo per komponen
  useEffect(() => {
    if (!sekolahId || daftarBulan.length === 0) return
    let batal = false
    const muat = async () => {
      setMemuat(true)
      const dari   = awalBulanIso(daftarBulan[0])
      const sampai = awalBulanIso(bulanBerikut(daftarBulan[daftarBulan.length - 1]))
      const ambilPengeluaran = (kolom: string) => ambilSemua<PengeluaranRaw>((a, b) => supabase.from('pengeluaran').select(kolom)
        .eq('sekolah_id', sekolahId).gte('tanggal', dari).lt('tanggal', sampai).order('id').range(a, b))

      const [keluarAwal, masukRes, adaRes] = await Promise.all([
        ambilPengeluaran(PENGELUARAN_SELECT_SUMBER),
        ambilSemua<PembayaranKas>((a, b) => supabase.from('pembayaran').select('id, tagihan_id, jumlah, alokasi, tanggal_bayar')
          .eq('sekolah_id', sekolahId).gte('tanggal_bayar', dari).lt('tanggal_bayar', sampai).order('id').range(a, b)),
        // Empty state hanya untuk sekolah yang belum pernah mencatat pengeluaran sama sekali
        supabase.from('pengeluaran').select('id').eq('sekolah_id', sekolahId).limit(1),
      ])
      // Sebelum SQL sumber dana dijalankan, pengeluaran tetap tampil — tanpa sumber dananya
      const siap      = !(keluarAwal.error && sumberBelumAda(keluarAwal.error))
      const keluarRes = siap ? keluarAwal : await ambilPengeluaran(PENGELUARAN_SELECT)

      // Rincian tagihan tiap pembayaran: dasar pembagian pemasukan per komponen
      const idTagihan  = [...new Set(masukRes.data.map(p => p.tagihan_id))]
      const tagihanRes = await ambilPerPotong<TagihanRaw>(idTagihan, (ids, a, b) => supabase.from('tagihan')
        .select('id, bulan, tahun, tagihan_item(id, nama_komponen, nominal, potongan)')
        .in('id', ids).order('id').range(a, b))
      if (batal) return

      const galat = keluarRes.error ?? masukRes.error ?? tagihanRes.error
      if (galat) {
        console.error('[Pengeluaran] gagal memuat data:', galat)
        setPemberitahuan({ jenis: 'galat', teks: 'Data pengeluaran gagal dimuat. Muat ulang halaman.' })
      }
      setPengeluaran(keluarRes.data.map(bacaPengeluaran))
      setPembayaran(masukRes.data.map(p => ({ ...p, jumlah: Number(p.jumlah) })))
      setTagihanPer(new Map(tagihanRes.data.map(t => [t.id, {
        id: t.id, bulan: t.bulan, tahun: t.tahun,
        items: (t.tagihan_item ?? []).map(i => ({ id: i.id, nama_komponen: i.nama_komponen, nominal: Number(i.nominal), potongan: Number(i.potongan ?? 0) })),
      }])))
      setSumberSiap(siap)
      // Gagal membaca dianggap "sudah ada": jangan menyembunyikan data di balik ajakan mencatat
      setAdaPengeluaran(adaRes.error ? true : (adaRes.data ?? []).length > 0)
      setSudahDimuat(true)
      setMemuat(false)
    }
    muat()
    return () => { batal = true }
  }, [sekolahId, daftarBulan, muatUlang])

  // Pemberitahuan sukses hilang sendiri
  useEffect(() => {
    if (pemberitahuan?.jenis !== 'sukses') return
    const t = setTimeout(() => setPemberitahuan(null), 4000)
    return () => clearTimeout(t)
  }, [pemberitahuan])

  // ── Kas per komponen (sepanjang periode) ──────────────────────────────────

  // Ejaan resmi, warna, dan id tiap komponen menurut namanya (yang terbaru menang)
  const infoKomponen = useMemo(() => {
    const nama = new Map<string, string>()
    const warnaTercatat = new Map<string, string>()
    const id = new Map<string, string>()
    for (const k of komponen) {
      const kunci = kunciKomponen(k.nama)
      if (!nama.has(kunci)) { nama.set(kunci, k.nama.trim()); id.set(kunci, k.id) }
      if (!warnaTercatat.has(kunci) && k.kelas_warna) warnaTercatat.set(kunci, k.kelas_warna)
    }
    return { nama, warnaTercatat, id }
  }, [komponen])

  const bagian = useMemo(() => bagianPerPembayaran(pembayaran, tagihanPer), [pembayaran, tagihanPer])
  const saldo  = useMemo(
    () => hitungSaldoKomponen([...bagian.values()].flat(), pengeluaran.flatMap(p => p.sumber_dana), infoKomponen.nama),
    [bagian, pengeluaran, infoKomponen],
  )
  const warna = useMemo(
    () => petaWarnaKomponen(infoKomponen.warnaTercatat, [...saldo.map(s => s.kunci), ...infoKomponen.nama.keys()]),
    [infoKomponen, saldo],
  )

  // Pilihan sumber dana di form: komponen yang punya kas dulu (pemasukan terbesar), lalu
  // komponen tagihan lain. "Lainnya" hanya kalau memang ada uangnya.
  const pilihanSumber = useMemo<PilihanSumberDana[]>(() => {
    const lainnya = kunciKomponen(NAMA_LAINNYA)
    const urutan = [
      ...saldo.filter(s => s.kunci !== lainnya || s.saldo !== 0).map(s => s.kunci),
      ...[...infoKomponen.nama.keys()].filter(k => !saldo.some(s => s.kunci === k)),
    ]
    const saldoPer = new Map(saldo.map(s => [s.kunci, s]))
    return urutan.map(kunci => ({
      kunci,
      nama:        infoKomponen.nama.get(kunci) ?? saldoPer.get(kunci)?.nama ?? kunci,
      komponen_id: infoKomponen.id.get(kunci) ?? null,
      warna:       warna.get(kunci) ?? WARNA_LAINNYA,
      sisa:        saldoPer.get(kunci)?.saldo ?? 0,
    }))
  }, [saldo, infoKomponen, warna])

  // ── Bulan terpilih ────────────────────────────────────────────────────────

  const pengeluaranBulan = useMemo(
    () => (bulanAktif ? pengeluaran.filter(p => bulanSama(bulanDari(p.tanggal), bulanAktif)) : []),
    [pengeluaran, bulanAktif],
  )
  const pembayaranBulan = useMemo(
    () => (bulanAktif ? pembayaran.filter(p => bulanSama(bulanDari(p.tanggal_bayar), bulanAktif)) : []),
    [pembayaran, bulanAktif],
  )
  const masukBulan  = pembayaranBulan.reduce((s, p) => s + p.jumlah, 0)
  const keluarBulan = pengeluaranBulan.reduce((s, p) => s + p.jumlah, 0)
  const kelompok    = useMemo(() => kelompokkanPerKategori(kategori, pengeluaranBulan), [kategori, pengeluaranBulan])
  const riwayat     = useMemo(() => susunRiwayatKas({
    pembayaran: pembayaranBulan, tagihanPer, bagian, pengeluaran: pengeluaranBulan,
    namaKategori: new Map(kategori.map(k => [k.id, k.nama])),
  }), [pembayaranBulan, tagihanPer, bagian, pengeluaranBulan, kategori])
  const judulBulan = bulanAktif ? labelBulan(bulanAktif) : '-'

  // ── Aksi ──────────────────────────────────────────────────────────────────

  const tanggalBaru = (): string => {
    if (!bulanAktif || bulanSama(bulanAktif, bulanDari(sekarang))) return tanggalWIB(sekarang)
    return `${bulanAktif.tahun}-${String(bulanAktif.bulan).padStart(2, '0')}-01`
  }

  // Durasi lipatan form: sama dengan transisi tinggi dan animasi pg-naik
  const DURASI_FORM = 360

  const bukaForm = (awal: Pengeluaran | null) => {
    if (tutupFormRef.current) { clearTimeout(tutupFormRef.current); tutupFormRef.current = null }
    setFormTutup(false)
    setFormIsi({ awal, kunci: awal?.id ?? 'baru' })
    // Dibuka dari tabel di bawah: gulir ke form-nya
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const tutupForm = () => {
    setFormTutup(true)
    if (tutupFormRef.current) clearTimeout(tutupFormRef.current)
    tutupFormRef.current = setTimeout(() => {
      setFormIsi(null)
      setFormTutup(false)
      tutupFormRef.current = null
    }, DURASI_FORM)
  }

  useEffect(() => () => { if (tutupFormRef.current) clearTimeout(tutupFormRef.current) }, [])

  const tersimpan = (tanggalIso: string, peringatan: string | null) => {
    tutupForm()
    setAdaPengeluaran(true)
    const bulan = bulanDari(tanggalIso)
    const diPeriode = daftarBulan.some(b => bulanSama(b, bulan))
    if (diPeriode) setBulanPilihan(bulan)
    setPemberitahuan(
      peringatan ? { jenis: 'peringatan', teks: peringatan }
      : diPeriode ? { jenis: 'sukses', teks: 'Pengeluaran tersimpan.' }
      : { jenis: 'peringatan', teks: `Pengeluaran tersimpan di ${labelBulan(bulan)}, di luar periode ${periode?.nama ?? ''}. Pilih periode lain untuk melihatnya.` },
    )
    setMuatUlang(n => n + 1)
  }

  const konfirmasiHapus = async () => {
    if (!hapus || menghapus) return
    setMenghapus(true)
    try {
      // Foto lebih dulu: sesudah barisnya terhapus, foto tidak bisa lagi dilacak lewat route-nya
      if (hapus.foto_path) {
        const h = await hapusFotoPengeluaran(hapus.id)
        if (h.error !== null) console.error('[Pengeluaran] foto nota gagal dihapus:', h.error)
      }
      // Sumber dananya ikut terhapus (foreign key ON DELETE CASCADE)
      const { error } = await supabase.from('pengeluaran').delete().eq('id', hapus.id).eq('sekolah_id', sekolahId)
      if (error) {
        setPemberitahuan({ jenis: 'galat', teks: 'Pengeluaran gagal dihapus. Coba lagi.' })
        return
      }
      setHapus(null)
      setPemberitahuan({ jenis: 'sukses', teks: 'Pengeluaran dihapus.' })
      setMuatUlang(n => n + 1)
    } finally {
      setMenghapus(false)
    }
  }

  const ekspor = async (format: FormatEkspor) => {
    if (mengekspor || !bulanAktif) return
    setMengekspor(format)
    try {
      const kop = await siapkanKop(format)
      if (!kop) return
      // Pustaka Excel/PDF baru dimuat saat dipakai
      const { unduhDaftarPengeluaran, unduhRingkasanKas } = await import('@/lib/eksporPengeluaran')
      if (tab === 'daftar') {
        await unduhDaftarPengeluaran({ format, kop, bulan: bulanAktif, kelompok })
      } else {
        await unduhRingkasanKas({
          format, kop, namaPeriode: periode?.nama ?? '', bulan: bulanAktif,
          masuk: masukBulan, keluar: keluarBulan, saldo, riwayat,
        })
      }
    } catch (e) {
      console.error('[Pengeluaran] gagal membuat unduhan:', e)
      setPemberitahuan({ jenis: 'galat', teks: 'Unduhan gagal dibuat. Coba lagi.' })
    } finally {
      setMengekspor(null)
    }
  }

  if (!sudahDimuat) return <SkeletonPengeluaran />

  const pilihanPeriode = daftarPeriode.map(p => ({ value: p.id, label: p.nama, sublabel: p.aktif ? 'Aktif' : undefined }))
  const pilihanBulan   = daftarBulan.map(b => ({ value: kunciBulan(b), label: labelBulan(b) }))
  // Bawaan yang dipulihkan tombol × di Filter Periode — sama dengan saat halaman dibuka
  const periodeBawaan  = (daftarPeriode.find(p => p.aktif) ?? daftarPeriode[0])?.id ?? ''

  return (
    <div className="dashboard-content">
      <HeaderLaporan
        judul={JUDUL_HALAMAN}
        subjudul={SUBJUDUL_HALAMAN}
        ikon={<Image src="/icons/Outcome.png" width={30} height={30} alt="" />}
        kanan={(
          <>
            <FilterPeriode onTutup={() => { setPeriodeId(periodeBawaan); setBulanPilihan(null) }}>
              <DropdownFilter judul="Periode" nilai={periodeId} pilihan={pilihanPeriode} onPilih={v => { setPeriodeId(v); setBulanPilihan(null) }} />
              {bulanAktif && (
                <DropdownFilter judul="Bulan" nilai={kunciBulan(bulanAktif)} pilihan={pilihanBulan} onPilih={v => setBulanPilihan(bacaKunciBulan(v))} />
              )}
            </FilterPeriode>
            <button
              onClick={() => bukaForm(null)}
              className="fp-tekan fp-tombol"
              style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, background: NAVY, color: '#fff', border: 'none', borderRadius: 9, padding: '0 1.15rem', fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer', fontFamily: FONT_PENGELUARAN, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}
            >
              <Plus size={18} /> Catat Pengeluaran
            </button>
          </>
        )}
      />

      {!sumberSiap && (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: WARNA_PEMBERITAHUAN.peringatan.latar, color: WARNA_PEMBERITAHUAN.peringatan.teks, borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.83rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Database belum disiapkan untuk sumber dana pengeluaran. Pengeluaran baru belum bisa dicatat sampai SQL-nya dijalankan.</span>
        </div>
      )}

      {pemberitahuan && (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: WARNA_PEMBERITAHUAN[pemberitahuan.jenis].latar, color: WARNA_PEMBERITAHUAN[pemberitahuan.jenis].teks, borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.83rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          {pemberitahuan.jenis === 'sukses' ? <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span style={{ flex: 1 }}>{pemberitahuan.teks}</span>
          <button onClick={() => setPemberitahuan(null)} aria-label="Tutup pemberitahuan" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Form Catat/Ubah: tingginya membuka dari 0 (baris grid 0fr → 1fr), kartunya turun
          memudar; ditutup kebalikannya — sama dengan form di halaman Komponen Tagihan ── */}
      <div ref={formRef} style={{
        display: 'grid', gridTemplateRows: formIsi && !formTutup ? '1fr' : '0fr',
        transition: `grid-template-rows ${DURASI_FORM}ms cubic-bezier(0.4, 0, 0.2, 1)`, scrollMarginTop: 16,
      }}>
        {/* Padding samping/atas supaya bayangan kartu tidak terpotong overflow */}
        <div style={{
          minHeight: 0, overflow: 'hidden', margin: '0 -14px', padding: '0 14px',
          paddingTop: formIsi && !formTutup ? 4 : 0, paddingBottom: formIsi && !formTutup ? '1.5rem' : 0,
          transition: `padding ${DURASI_FORM}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}>
          {formIsi && (
            <FormPengeluaran
              key={formIsi.kunci}
              sekolahId={sekolahId}
              kategori={kategori}
              pilihanSumber={pilihanSumber}
              awal={formIsi.awal}
              tanggalAwal={tanggalBaru()}
              menutup={formTutup}
              onTutup={tutupForm}
              onTersimpan={tersimpan}
              onKelolaKategori={() => setModalKategori(true)}
            />
          )}
        </div>
      </div>

      {!adaPengeluaran ? (
        // ── Belum pernah ada pengeluaran ──
        <div className="pg-masuk" style={{ ...sBingkai, minHeight: 300, alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 0, fontFamily: FONT_PENGELUARAN, letterSpacing: '-0.01em' }}>
          <Database size={52} strokeWidth={1.3} color="#C4CBD6" fill="#E9EDF2" />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#4B5563', marginTop: '1rem' }}>Belum ada pengeluaran bulan ini</div>
          <div style={{ fontSize: '0.8rem', color: '#9CA3AF', maxWidth: 300, lineHeight: 1.55, marginTop: '0.35rem' }}>
            Catat pengeluaran pertama sekolah untuk mulai melacak arus kas.
          </div>
        </div>
      ) : (
        <>
          <div style={{ ...sBingkaiPengeluaran, opacity: memuat ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <PilihanTab aktif={tab} onPilih={setTab} />
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => ekspor('pdf')} disabled={!!mengekspor} className="fp-tekan"
                  style={{ ...sTombolUnduh, background: '#fff', border: `1.5px solid ${NAVY}`, opacity: mengekspor && mengekspor !== 'pdf' ? 0.5 : 1 }}>
                  <FileText size={13} /> {mengekspor === 'pdf' ? 'Memproses...' : 'PDF'}
                </button>
                <button onClick={() => ekspor('excel')} disabled={!!mengekspor} className="fp-tekan"
                  style={{ ...sTombolUnduh, background: '#F7DE7C', border: '1.5px solid #F7DE7C', opacity: mengekspor && mengekspor !== 'excel' ? 0.5 : 1 }}>
                  <FileSpreadsheet size={13} /> {mengekspor === 'excel' ? 'Memproses...' : 'Excel'}
                </button>
              </div>
            </div>

            <div style={sBarisKartu}>
              <KartuKas label="Pemasukan" Ikon={TrendingUp} warnaIkon={NAVY}
                nilai={formatRupiah(masukBulan)} keterangan={`Pembayaran tercatat, ${judulBulan}`} />
              <KartuKas label="Pengeluaran" Ikon={TrendingDown} warnaIkon="#E57373" warnaNilai="#E57373"
                nilai={formatRupiah(keluarBulan)} keterangan={`${pengeluaranBulan.length} catatan pengeluaran`} />
              <KartuKas label="Selisih" Ikon={FileText} warnaIkon={NAVY}
                nilai={<RupiahBertanda nilai={masukBulan - keluarBulan} />} keterangan="Pemasukan dikurangi pengeluaran" />
            </div>
          </div>

          <div key={tab} className="pg-masuk" style={{ marginTop: '1.5rem', opacity: memuat ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            {tab === 'kas' ? (
              <div className="pg-kas-grid">
                <TabelRiwayatKas key={bulanAktif ? kunciBulan(bulanAktif) : '-'} baris={riwayat} warna={warna} labelBulan={judulBulan} />
                <PanelSaldoKomponen baris={saldo} warna={warna} namaPeriode={periode?.nama ?? '-'} />
              </div>
            ) : (
              <TabelDaftarPengeluaran kelompok={kelompok} warna={warna} labelBulan={judulBulan}
                onUbah={p => bukaForm(p)} onHapus={setHapus} onFoto={setLihatFoto} />
            )}
          </div>
        </>
      )}

      {modalKategori && (
        <ModalKategori
          sekolahId={sekolahId}
          kategori={kategori}
          onTutup={() => setModalKategori(false)}
          onBerubah={() => muatKategori(sekolahId)}
        />
      )}

      {lihatFoto && <ModalFoto pengeluaran={lihatFoto} onTutup={() => setLihatFoto(null)} />}

      {pesanKop && <ModalKopBelumLengkap pesan={pesanKop} onTutup={tutupPesanKop} />}

      {hapus && (
        <div
          onClick={() => { if (!menghapus) setHapus(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            role="dialog" aria-modal="true" aria-labelledby="judul-hapus-pengeluaran" className="pg-muncul"
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', padding: '1.5rem', fontFamily: FONT_PENGELUARAN }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 48, height: 48, background: '#FEE2E2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Trash2 size={22} color="#DC2626" />
            </div>
            <div id="judul-hapus-pengeluaran" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 6 }}>Hapus pengeluaran?</div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              <strong style={{ color: '#0F172A' }}>{hapus.keterangan}</strong> ({formatRupiah(hapus.jumlah)}) dihapus
              {hapus.foto_path ? ' beserta foto notanya' : ''}, dan uangnya kembali ke saldo komponen sumbernya. Tindakan ini tidak dapat dibatalkan.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setHapus(null)} disabled={menghapus}
                style={{ flex: 1, padding: '0.65rem', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: menghapus ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                Batal
              </button>
              <button onClick={konfirmasiHapus} disabled={menghapus}
                style={{ flex: 1, padding: '0.65rem', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: menghapus ? 'default' : 'pointer', opacity: menghapus ? 0.7 : 1, fontFamily: 'inherit' }}>
                {menghapus ? 'Menghapus...' : 'Ya, hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTombolUnduh: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 0.85rem', borderRadius: 6,
  color: NAVY, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', fontFamily: FONT_PENGELUARAN, whiteSpace: 'nowrap',
}

export default PengeluaranPage
