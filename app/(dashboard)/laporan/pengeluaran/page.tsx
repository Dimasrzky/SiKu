'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, ImageIcon, Pencil, Plus, Scale, Tags, Trash2,
  TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ambilSemua } from '@/lib/ambilSemua'
import { formatRupiah } from '@/lib/formatLaporan'
import { tanggalWIB } from '@/lib/metrikLaporan'
import {
  KATEGORI_SELECT, PENGELUARAN_SELECT, awalBulanIso, bacaKunciBulan, bacaPengeluaran, bulanAwal, bulanBerikut,
  bulanDalamPeriode, bulanDari, bulanSama, hitungRingkasanKas, indeksBulan, kelompokkanPerKategori, kunciBulan,
  labelBulan, periodeTahunKalender, teksBesaran,
  type Bulan, type KategoriPengeluaran, type Pengeluaran, type PeriodeKas,
} from '@/lib/pengeluaran'
import { hapusFotoPengeluaran } from '@/lib/fotoPengeluaran'
import type { FormatEkspor } from '@/lib/eksporPengeluaran'
import { HeaderLaporan } from '@/components/laporan/HeaderLaporan'
import { DropdownFilter } from '@/components/laporan/DropdownFilter'
import {
  JUDUL_HALAMAN, KOLOM_KAS, KOLOM_RINCIAN, KOLOM_RINCIAN_KANAN, KartuKas, PilihanTab, SUBJUDUL_HALAMAN,
  sBarisKartu, sBingkaiPengeluaran, sTabel, sTd, sTdKaki, sTh, type TabPengeluaran,
} from '@/components/pengeluaran/BagianPengeluaran'
import { ModalPengeluaran } from '@/components/pengeluaran/ModalPengeluaran'
import { ModalKategori } from '@/components/pengeluaran/ModalKategori'
import { ModalFoto } from '@/components/pengeluaran/ModalFoto'
import { sTombolIkon, sTombolKedua } from '@/components/pengeluaran/gayaPengeluaran'
import { SkeletonPengeluaran } from '@/components/skeleton/SkeletonPengeluaran'

// Subfitur Pengeluaran (lib/fiturSekolah) — hanya terbuka untuk sekolah yang ditambahkan
// tim Equanusa; layout.tsx di folder ini menolak sekolah lain. Tab Rincian = laporan
// pengeluaran satu bulan per kategori; tab Ringkasan Kas = pemasukan SPP (pembayaran
// yang tercatat di SiKu, menurut tanggal bayar) dikurangi pengeluaran, per bulan.

interface TahunAjaranRaw { id: string; nama: string; tanggal_mulai: string; tanggal_selesai: string; is_aktif: boolean }
interface PembayaranKas  { tanggal_bayar: string; jumlah: number }

type Pemberitahuan = { jenis: 'sukses' | 'peringatan' | 'galat'; teks: string }

const WARNA_PEMBERITAHUAN: Record<Pemberitahuan['jenis'], { latar: string; teks: string }> = {
  sukses:     { latar: '#DCFCE7', teks: '#166534' },
  peringatan: { latar: '#FEF3C7', teks: '#92400E' },
  galat:      { latar: '#FEE2E2', teks: '#B91C1C' },
}

const formatTanggalPendek = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })

/** Rupiah bertanda: selisih negatif tampil merah */
const RupiahBertanda = ({ nilai }: { nilai: number }) => (
  <span style={{ color: nilai < 0 ? '#DC2626' : undefined }}>{formatRupiah(nilai)}</span>
)

const PengeluaranPage = () => {
  const [sekarang] = useState(() => new Date())

  const [sekolahId,     setSekolahId]     = useState('')
  const [namaSekolah,   setNamaSekolah]   = useState('')
  const [daftarPeriode, setDaftarPeriode] = useState<PeriodeKas[]>([])
  const [periodeId,     setPeriodeId]     = useState('')
  const [bulanPilihan,  setBulanPilihan]  = useState<Bulan | null>(null)
  const [tab,           setTab]           = useState<TabPengeluaran>('rincian')

  const [kategori,    setKategori]    = useState<KategoriPengeluaran[]>([])
  const [pengeluaran, setPengeluaran] = useState<Pengeluaran[]>([])
  const [pembayaran,  setPembayaran]  = useState<PembayaranKas[]>([])
  const [sudahDimuat, setSudahDimuat] = useState(false)
  const [memuat,      setMemuat]      = useState(false)
  const [muatUlang,   setMuatUlang]   = useState(0)

  const [modalIsi,      setModalIsi]      = useState<{ awal: Pengeluaran | null } | null>(null)
  const [modalKategori, setModalKategori] = useState(false)
  const [lihatFoto,     setLihatFoto]     = useState<Pengeluaran | null>(null)
  const [hapus,         setHapus]         = useState<Pengeluaran | null>(null)
  const [menghapus,     setMenghapus]     = useState(false)
  const [mengekspor,    setMengekspor]    = useState<FormatEkspor | null>(null)
  const [pemberitahuan, setPemberitahuan] = useState<Pemberitahuan | null>(null)

  const muatKategori = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('kategori_pengeluaran')
      .select(KATEGORI_SELECT)
      .eq('sekolah_id', id)
      .order('urutan')
      .limit(200)
    if (error) {
      setPemberitahuan({ jenis: 'galat', teks: 'Kategori pengeluaran gagal dimuat.' })
      return
    }
    setKategori((data ?? []) as KategoriPengeluaran[])
  }, [])

  // Sekolah, periode (tahun ajaran), dan kategori
  useEffect(() => {
    let batal = false
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profil } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
      const id = (profil as { sekolah_id: string | null } | null)?.sekolah_id
      if (!id || batal) return

      const [{ data: sekolah }, { data: taData }] = await Promise.all([
        supabase.from('sekolah').select('nama').eq('id', id).maybeSingle(),
        supabase.from('tahun_ajaran').select('id, nama, tanggal_mulai, tanggal_selesai, is_aktif')
          .eq('sekolah_id', id).order('tanggal_mulai', { ascending: false }).limit(10),
        muatKategori(id),
      ])
      if (batal) return

      const periode: PeriodeKas[] = ((taData ?? []) as TahunAjaranRaw[]).map(t => ({
        id: t.id, nama: t.nama, mulai: t.tanggal_mulai, selesai: t.tanggal_selesai, aktif: t.is_aktif,
      }))
      const daftar = periode.length > 0 ? periode : [periodeTahunKalender(sekarang)]
      setNamaSekolah((sekolah as { nama?: string } | null)?.nama ?? '')
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

  // Pengeluaran dan pembayaran seluruh periode — dipakai kedua tab
  useEffect(() => {
    if (!sekolahId || daftarBulan.length === 0) return
    let batal = false
    const muat = async () => {
      setMemuat(true)
      const dari   = awalBulanIso(daftarBulan[0])
      const sampai = awalBulanIso(bulanBerikut(daftarBulan[daftarBulan.length - 1]))
      const [keluarRes, masukRes] = await Promise.all([
        ambilSemua<Pengeluaran>((a, b) => supabase.from('pengeluaran').select(PENGELUARAN_SELECT)
          .eq('sekolah_id', sekolahId).gte('tanggal', dari).lt('tanggal', sampai).order('id').range(a, b)),
        ambilSemua<PembayaranKas>((a, b) => supabase.from('pembayaran').select('tanggal_bayar, jumlah')
          .eq('sekolah_id', sekolahId).gte('tanggal_bayar', dari).lt('tanggal_bayar', sampai).order('id').range(a, b)),
      ])
      if (batal) return
      if (keluarRes.error || masukRes.error) {
        console.error('[Pengeluaran] gagal memuat data:', keluarRes.error ?? masukRes.error)
        setPemberitahuan({ jenis: 'galat', teks: 'Data pengeluaran gagal dimuat. Muat ulang halaman.' })
      }
      setPengeluaran(keluarRes.data.map(bacaPengeluaran))
      setPembayaran(masukRes.data.map(p => ({ tanggal_bayar: p.tanggal_bayar, jumlah: Number(p.jumlah) })))
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

  // ── Rincian bulan terpilih ────────────────────────────────────────────────

  const pengeluaranBulan = useMemo(
    () => (bulanAktif ? pengeluaran.filter(p => bulanSama(bulanDari(p.tanggal), bulanAktif)) : []),
    [pengeluaran, bulanAktif],
  )
  const kelompok    = useMemo(() => kelompokkanPerKategori(kategori, pengeluaranBulan), [kategori, pengeluaranBulan])
  const keluarBulan = pengeluaranBulan.reduce((s, p) => s + p.jumlah, 0)
  const masukBulan  = useMemo(
    () => (bulanAktif ? pembayaran.filter(p => bulanSama(bulanDari(p.tanggal_bayar), bulanAktif)).reduce((s, p) => s + p.jumlah, 0) : 0),
    [pembayaran, bulanAktif],
  )

  // ── Ringkasan kas ─────────────────────────────────────────────────────────
  // Sampai bulan ini; bulan sesudahnya ikut hanya kalau sudah ada pengeluaran bertanggal di sana

  const barisKas = useMemo(() => {
    let akhir = indeksBulan(bulanDari(sekarang))
    for (const p of pengeluaran) akhir = Math.max(akhir, indeksBulan(bulanDari(p.tanggal)))
    return hitungRingkasanKas(daftarBulan.filter(b => indeksBulan(b) <= akhir), pembayaran, pengeluaran)
  }, [daftarBulan, pembayaran, pengeluaran, sekarang])
  const totalMasuk  = barisKas.reduce((s, b) => s + b.pemasukan, 0)
  const totalKeluar = barisKas.reduce((s, b) => s + b.pengeluaran, 0)
  const saldoAkhir  = barisKas.length > 0 ? barisKas[barisKas.length - 1].saldo : 0

  // ── Aksi ──────────────────────────────────────────────────────────────────

  const tanggalBaru = (): string => {
    if (!bulanAktif || bulanSama(bulanAktif, bulanDari(sekarang))) return tanggalWIB(sekarang)
    return `${bulanAktif.tahun}-${String(bulanAktif.bulan).padStart(2, '0')}-01`
  }

  const tersimpan = (tanggalIso: string, peringatan: string | null) => {
    setModalIsi(null)
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
    if (mengekspor) return
    setMengekspor(format)
    try {
      // Pustaka Excel/PDF baru dimuat saat dipakai
      const { unduhRincianPengeluaran, unduhRingkasanKas } = await import('@/lib/eksporPengeluaran')
      if (tab === 'rincian') {
        if (!bulanAktif) return
        unduhRincianPengeluaran({ format, namaSekolah, bulan: bulanAktif, kelompok })
      } else {
        unduhRingkasanKas({ format, namaSekolah, namaPeriode: periode?.nama ?? '', baris: barisKas })
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

  return (
    <div className="dashboard-content">
      <HeaderLaporan
        judul={JUDUL_HALAMAN}
        subjudul={SUBJUDUL_HALAMAN}
        kanan={(
          <>
            <DropdownFilter judul="Periode" nilai={periodeId} pilihan={pilihanPeriode} onPilih={v => { setPeriodeId(v); setBulanPilihan(null) }} />
            {tab === 'rincian' && bulanAktif && (
              <DropdownFilter judul="Bulan" nilai={kunciBulan(bulanAktif)} pilihan={pilihanBulan} onPilih={v => setBulanPilihan(bacaKunciBulan(v))} />
            )}
            <button
              onClick={() => (kategori.length === 0 ? setModalKategori(true) : setModalIsi({ awal: null }))}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              <Plus size={18} /> Tambah Pengeluaran
            </button>
          </>
        )}
      />

      {pemberitahuan && (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: WARNA_PEMBERITAHUAN[pemberitahuan.jenis].latar, color: WARNA_PEMBERITAHUAN[pemberitahuan.jenis].teks, borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.83rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          {pemberitahuan.jenis === 'sukses' ? <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span style={{ flex: 1 }}>{pemberitahuan.teks}</span>
          <button onClick={() => setPemberitahuan(null)} aria-label="Tutup pemberitahuan" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={15} />
          </button>
        </div>
      )}

      <div style={{ ...sBingkaiPengeluaran, opacity: memuat ? 0.6 : 1, transition: 'opacity 0.15s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <PilihanTab aktif={tab} onPilih={setTab} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {tab === 'rincian' && (
              <button onClick={() => setModalKategori(true)} style={sTombolKedua}><Tags size={14} /> Kelola Kategori</button>
            )}
            <button onClick={() => ekspor('pdf')} disabled={!!mengekspor}
              style={{ ...sTombolKedua, color: '#374151', opacity: mengekspor && mengekspor !== 'pdf' ? 0.5 : 1 }}>
              <FileText size={14} color="#64748B" /> {mengekspor === 'pdf' ? 'Memproses...' : 'PDF'}
            </button>
            <button onClick={() => ekspor('excel')} disabled={!!mengekspor}
              style={{ ...sTombolKedua, background: '#F5C518', border: '1.5px solid #F5C518', color: '#1A1A1A', opacity: mengekspor && mengekspor !== 'excel' ? 0.5 : 1 }}>
              <FileSpreadsheet size={14} color="#1A1A1A" /> {mengekspor === 'excel' ? 'Memproses...' : 'Excel'}
            </button>
          </div>
        </div>

        {tab === 'rincian' ? (
          <>
            <div style={sBarisKartu}>
              <KartuKas label="Pemasukan SPP" Ikon={TrendingUp} warna="#16A34A" latar="#DCFCE7"
                nilai={formatRupiah(masukBulan)} keterangan={`Pembayaran tercatat di SiKu, ${bulanAktif ? labelBulan(bulanAktif) : '-'}`} />
              <KartuKas label="Pengeluaran" Ikon={TrendingDown} warna="#DC2626" latar="#FEE2E2"
                nilai={formatRupiah(keluarBulan)} keterangan={`${pengeluaranBulan.length} catatan pengeluaran`} />
              <KartuKas label="Selisih" Ikon={Scale} warna="#1A2C4E" latar="#DCE9FF"
                nilai={<RupiahBertanda nilai={masukBulan - keluarBulan} />} keterangan="Pemasukan SPP dikurangi pengeluaran bulan ini" />
            </div>

            {kategori.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', border: '1.5px dashed #CBD5E1', borderRadius: 12 }}>
                <Wallet size={44} strokeWidth={1.3} color="#CBD5E1" style={{ marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Belum ada kategori pengeluaran</div>
                <div style={{ fontSize: '0.85rem', color: '#94A3B8', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 1rem' }}>
                  Buat kategori seperti ATK Kantor, Operasional, atau Konsumsi, lalu catat pengeluarannya.
                </div>
                <button onClick={() => setModalKategori(true)} style={sTombolKedua}><Tags size={14} /> Kelola Kategori</button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={sTabel}>
                  <thead>
                    <tr>{KOLOM_RINCIAN.map((k, i) => <th key={k} style={{ ...sTh, textAlign: KOLOM_RINCIAN_KANAN.has(i) ? 'right' : 'left' }}>{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {kelompok.map((k, i) => {
                      const tinggi = Math.max(k.baris.length, 1)
                      const sel = (
                        <>
                          <td rowSpan={tinggi} style={{ ...sTd, textAlign: 'center', fontWeight: 700, color: '#64748B', width: 44 }}>{i + 1}</td>
                          <td rowSpan={tinggi} style={{ ...sTd, fontWeight: 700, width: 150 }}>{k.kategori.nama}</td>
                        </>
                      )
                      if (k.baris.length === 0) {
                        return (
                          <tr key={k.kategori.id}>
                            {sel}
                            <td style={{ ...sTd, color: '#94A3B8', fontStyle: 'italic' }} colSpan={6}>Belum ada pengeluaran</td>
                          </tr>
                        )
                      }
                      return k.baris.map((b, j) => (
                        <tr key={b.id}>
                          {j === 0 && sel}
                          <td style={sTd}>
                            <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{b.keterangan}</div>
                            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 1 }}>{formatTanggalPendek(b.tanggal)}</div>
                          </td>
                          <td style={{ ...sTd, whiteSpace: 'nowrap' }}>{teksBesaran(b.volume, b.volume_satuan)}</td>
                          <td style={{ ...sTd, whiteSpace: 'nowrap' }}>{teksBesaran(b.kuantitas, b.kuantitas_satuan)}</td>
                          <td style={{ ...sTd, textAlign: 'right', whiteSpace: 'nowrap' }}>{b.biaya_satuan != null ? formatRupiah(b.biaya_satuan) : ''}</td>
                          <td style={{ ...sTd, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{formatRupiah(b.jumlah)}</td>
                          <td style={{ ...sTd, whiteSpace: 'nowrap', width: 116 }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {b.foto_path && (
                                <button onClick={() => setLihatFoto(b)} aria-label={`Lihat foto nota ${b.keterangan}`} title="Lihat foto nota" style={{ ...sTombolIkon, color: '#16A34A' }}>
                                  <ImageIcon size={14} />
                                </button>
                              )}
                              <button onClick={() => setModalIsi({ awal: b })} aria-label={`Ubah ${b.keterangan}`} title="Ubah" style={{ ...sTombolIkon, color: '#3C75B7' }}>
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setHapus(b)} aria-label={`Hapus ${b.keterangan}`} title="Hapus" style={{ ...sTombolIkon, color: '#DC2626' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} style={{ ...sTdKaki, textAlign: 'center' }}>Total</td>
                      <td style={{ ...sTdKaki, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRupiah(keluarBulan)}</td>
                      <td style={sTdKaki} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={sBarisKartu}>
              <KartuKas label="Total pemasukan SPP" Ikon={TrendingUp} warna="#16A34A" latar="#DCFCE7"
                nilai={formatRupiah(totalMasuk)} keterangan={`Periode ${periode?.nama ?? '-'}`} />
              <KartuKas label="Total pengeluaran" Ikon={TrendingDown} warna="#DC2626" latar="#FEE2E2"
                nilai={formatRupiah(totalKeluar)} keterangan={`Periode ${periode?.nama ?? '-'}`} />
              <KartuKas label="Saldo akhir" Ikon={Wallet} warna="#1A2C4E" latar="#DCE9FF"
                nilai={<RupiahBertanda nilai={saldoAkhir} />}
                keterangan={barisKas.length > 0 ? `Sampai ${labelBulan(barisKas[barisKas.length - 1])}` : 'Periode belum dimulai'} />
            </div>

            {barisKas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94A3B8', fontSize: '0.875rem' }}>
                Periode ini belum dimulai.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ ...sTabel, minWidth: 640 }}>
                  <thead>
                    <tr>{KOLOM_KAS.map((k, i) => <th key={k} style={{ ...sTh, textAlign: i === 0 ? 'left' : 'right' }}>{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {barisKas.map(b => (
                      <tr key={kunciBulan(b)}>
                        <td style={sTd}>
                          <button
                            onClick={() => { setBulanPilihan(b); setTab('rincian') }}
                            title="Lihat rincian pengeluaran bulan ini"
                            style={{ background: 'none', border: 'none', padding: 0, color: '#3C75B7', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            {labelBulan(b)}
                          </button>
                        </td>
                        <td style={{ ...sTd, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRupiah(b.pemasukan)}</td>
                        <td style={{ ...sTd, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRupiah(b.pengeluaran)}</td>
                        <td style={{ ...sTd, textAlign: 'right', whiteSpace: 'nowrap' }}><RupiahBertanda nilai={b.selisih} /></td>
                        <td style={{ ...sTd, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}><RupiahBertanda nilai={b.saldo} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={sTdKaki}>Total</td>
                      <td style={{ ...sTdKaki, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRupiah(totalMasuk)}</td>
                      <td style={{ ...sTdKaki, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRupiah(totalKeluar)}</td>
                      <td style={{ ...sTdKaki, textAlign: 'right', whiteSpace: 'nowrap' }}><RupiahBertanda nilai={totalMasuk - totalKeluar} /></td>
                      <td style={{ ...sTdKaki, textAlign: 'right', whiteSpace: 'nowrap' }}><RupiahBertanda nilai={saldoAkhir} /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div style={{ fontSize: '0.78rem', color: '#6F788A', lineHeight: 1.6 }}>
              Pemasukan dihitung dari pembayaran SPP yang tercatat di SiKu menurut tanggal bayar. Saldo kumulatif dimulai
              dari Rp 0 di awal periode, tanpa saldo kas sebelum memakai SiKu.
            </div>
          </>
        )}
      </div>

      {modalIsi && (
        <ModalPengeluaran
          sekolahId={sekolahId}
          kategori={kategori}
          awal={modalIsi.awal}
          tanggalAwal={tanggalBaru()}
          onTutup={() => setModalIsi(null)}
          onTersimpan={tersimpan}
          onKelolaKategori={() => setModalKategori(true)}
        />
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

      {hapus && (
        <div
          onClick={() => { if (!menghapus) setHapus(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            role="dialog" aria-modal="true" aria-labelledby="judul-hapus-pengeluaran"
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', padding: '1.5rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 48, height: 48, background: '#FEE2E2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Trash2 size={22} color="#DC2626" />
            </div>
            <div id="judul-hapus-pengeluaran" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 6 }}>Hapus pengeluaran?</div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              <strong style={{ color: '#0F172A' }}>{hapus.keterangan}</strong> ({formatRupiah(hapus.jumlah)}) dihapus
              {hapus.foto_path ? ' beserta foto notanya' : ''}. Tindakan ini tidak dapat dibatalkan.
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

export default PengeluaranPage
