'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { Database, GraduationCap, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { hitungRingkasan, hitungPemasukan, nilaiSiswa, trenTagihanRealisasi, kategoriBulan } from '@/lib/metrikLaporan'
import { batasJatuhTempo } from '@/lib/statusTagihan'
import {
  BULAN_PENDEK, BULAN_PANJANG, formatRupiah as fmt, formatRingkas, formatPersen, labelMetode, formatWaktuWIB,
} from '@/lib/formatLaporan'
import { tautanPengingatTunggakan, tunggakanSiswa } from '@/lib/pengingatTunggakan'
import {
  ALASAN_TINDAK_LANJUT, URUTAN_ALASAN, MAKS_CATATAN, tabelBelumAda, type AlasanTindakLanjut,
} from '@/lib/catatanTindakLanjut'
import { useDataLaporan, type TagihanLaporan } from '@/lib/useDataLaporan'
import { useFilterLaporan } from '@/lib/useFilterLaporan'
import { usePengingat } from '@/lib/usePengingat'
import { TombolIngatkan } from '@/components/TombolIngatkan'
import { HeaderLaporan, type JejakLaporan } from '@/components/laporan/HeaderLaporan'
import { FilterLaporan } from '@/components/laporan/FilterLaporan'
import { KartuRingkasan } from '@/components/laporan/KartuRingkasan'
import { StatusSiswaBadge } from '@/components/laporan/StatusSiswaBadge'
import { KATEGORI_BULAN_UI, URUTAN_LEGENDA, LegendaBulan, detailSel } from '@/components/laporan/HeatmapSiswa'
import { sKartu, sBingkai, sJudulPanel, sSubjudulPanel } from '@/components/laporan/gayaLaporan'

// Level Siswa drill-down (Draft Pengembangan Fitur Laporan, Prioritas 2): ringkasan
// metrik, timeline 12 bulan, riwayat transaksi dan metode bayar, catatan tindak
// lanjut, dan pengingat. Riwayat mengikuti siswa, bukan kelas — tagihan 7-A tahun
// lalu dan 8-A tahun ini tampil berdampingan.
//
// Timeline memberi warna status per BULAN, bukan per komponen: pembayaran dicatat
// per tagihan, jadi tidak diketahui komponen mana yang sudah lunas. Baris komponen
// hanya memuat nominal yang ditagihkan.

interface SiswaDetail {
  id:           string
  nama:         string
  nis:          string | null
  nisn:         string | null
  status:       'aktif' | 'alumni'
  jenis_alumni: string | null
  tahun_lulus:  string | null
  /** Snapshot teks kelas terakhir — diisi untuk alumni */
  kelas:        string | null
  kelas_id:     string | null
  nama_wali:    string | null
  no_wa:        string | null
}

interface TransaksiDetail {
  id:            string
  tagihan_id:    string
  jumlah:        number
  metode:        string | null
  tanggal_bayar: string
  catatan:       string | null
}

interface CatatanRow {
  id:          string
  alasan:      AlasanTindakLanjut
  catatan:     string | null
  dibuat_oleh: string | null
  created_at:  string
}

const kunciBulan = (bulan: number, tahun: number) => `${tahun}-${bulan}`

// useSearchParams (lewat useFilterLaporan) wajib berada di bawah batas Suspense
export default function LaporanSiswaPage() {
  return (
    <Suspense fallback={
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Memuat data...</div>
      </div>
    }>
      <LaporanSiswaContent />
    </Suspense>
  )
}

function LaporanSiswaContent() {
  const { siswaId } = useParams<{ siswaId: string }>()

  const { sekolahId, loading, rows, kelas, activeTA, archivedTAs, sekarang, namaSekolah } = useDataLaporan({ siswaId })
  const filter = useFilterLaporan(activeTA, archivedTAs, sekarang)
  const { taTerpilih, taArsipTerpilih, selectedFilter, dalamPeriode, qsFilter } = filter

  const [siswa,           setSiswa]           = useState<SiswaDetail | null>(null)
  const [transaksi,       setTransaksi]       = useState<TransaksiDetail[]>([])
  const [catatan,         setCatatan]         = useState<CatatanRow[]>([])
  const [tabelCatatanAda, setTabelCatatanAda] = useState(true)
  const [userId,          setUserId]          = useState<string | null>(null)
  const [memuatDetail,    setMemuatDetail]    = useState(true)
  const [formAlasan,      setFormAlasan]      = useState<AlasanTindakLanjut>('lupa')
  const [formTeks,        setFormTeks]        = useState('')
  const [menyimpan,       setMenyimpan]       = useState(false)
  const [galatCatatan,    setGalatCatatan]    = useState('')
  const [pengingatDibuka, setPengingatDibuka] = useState(false)

  // ── Data khusus level siswa: profil, transaksi lengkap dengan metode, catatan
  useEffect(() => {
    if (!sekolahId) return
    let batal = false
    const muat = async () => {
      setMemuatDetail(true)
      const [{ data: { user } }, siswaRes, bayarRes, catatanRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('siswa')
          .select('id, nama, nis, nisn, status, jenis_alumni, tahun_lulus, kelas, kelas_id, nama_wali, no_wa')
          .eq('id', siswaId).eq('sekolah_id', sekolahId).maybeSingle(),
        supabase.from('pembayaran')
          .select('id, tagihan_id, jumlah, metode, tanggal_bayar, catatan')
          .eq('sekolah_id', sekolahId).eq('siswa_id', siswaId)
          .order('tanggal_bayar', { ascending: false }).limit(200),
        supabase.from('catatan_tindak_lanjut')
          .select('id, alasan, catatan, dibuat_oleh, created_at')
          .eq('sekolah_id', sekolahId).eq('siswa_id', siswaId)
          .order('created_at', { ascending: false }).limit(50),
      ])
      if (batal) return
      if (siswaRes.error) console.error('[Laporan Siswa] gagal memuat siswa:', siswaRes.error)
      if (bayarRes.error) console.error('[Laporan Siswa] gagal memuat transaksi:', bayarRes.error)
      if (catatanRes.error && !tabelBelumAda(catatanRes.error)) console.error('[Laporan Siswa] gagal memuat catatan:', catatanRes.error)

      setUserId(user?.id ?? null)
      setSiswa((siswaRes.data ?? null) as SiswaDetail | null)
      setTransaksi((bayarRes.data ?? []) as TransaksiDetail[])
      setTabelCatatanAda(!tabelBelumAda(catatanRes.error))
      setCatatan((catatanRes.data ?? []) as CatatanRow[])
      setMemuatDetail(false)
    }
    muat()
    return () => { batal = true }
  }, [sekolahId, siswaId])

  // ── Metrik: periode terpilih untuk kartu dan status, semua tagihan untuk pengingat
  const periodRows = useMemo(() => rows.filter(dalamPeriode), [rows, dalamPeriode])
  const ringkasan  = useMemo(() => hitungRingkasan(periodRows, sekarang), [periodRows, sekarang])
  const pemasukan  = useMemo(() => hitungPemasukan(periodRows), [periodRows])
  const penilaian  = useMemo(() => nilaiSiswa(periodRows, sekarang), [periodRows, sekarang])
  const semuaTunggakan = useMemo(() => tunggakanSiswa(rows, sekarang), [rows, sekarang])
  const totalSemuaTunggakan = semuaTunggakan.reduce((s, t) => s + Math.max(0, t.total_nominal - t.terbayar), 0)

  // Kelas pada periode terpilih = kelas di tagihan terbaru periode itu; tanpa
  // tagihan, pakai kelas siswa sekarang
  const kelasPeriodeId = useMemo(() => {
    const terbaru = [...periodRows].sort((a, b) => batasJatuhTempo(b).getTime() - batasJatuhTempo(a).getTime())[0]
    return terbaru?.kelas_id ?? siswa?.kelas_id ?? null
  }, [periodRows, siswa])
  const kelasPeriode = kelasPeriodeId ? kelas.get(kelasPeriodeId) : undefined

  // ── Timeline: 12 bulan yang sama dengan grafik tren (berakhir di akhir tahun
  //    ajaran terpilih, tidak melewati bulan ini)
  const akhirTA = taTerpilih?.tanggal_selesai ?? null
  const bulanTimeline = useMemo(
    () => trenTagihanRealisasi(rows, sekarang, akhirTA ? new Date(akhirTA) : sekarang).map(p => ({ bulan: p.bulan, tahun: p.tahun })),
    [rows, sekarang, akhirTA],
  )
  const tagihanPerBulan = useMemo(() => new Map(rows.map(t => [kunciBulan(t.bulan, t.tahun), t])), [rows])

  // Komponen dikelompokkan menurut nama — id komponen berganti tiap tahun ajaran
  const barisKomponen = useMemo(() => {
    const urutan: string[] = []
    const nominal = new Map<string, Map<string, number>>()
    for (const m of bulanTimeline) {
      const t = tagihanPerBulan.get(kunciBulan(m.bulan, m.tahun))
      if (!t) continue
      for (const item of t.tagihan_item) {
        const nama = item.komponen?.nama ?? item.nama_komponen
        if (!nominal.has(nama)) { nominal.set(nama, new Map()); urutan.push(nama) }
        const perBulan = nominal.get(nama)!
        const kunci = kunciBulan(m.bulan, m.tahun)
        perBulan.set(kunci, (perBulan.get(kunci) ?? 0) + item.nominal)
      }
    }
    return urutan.map(nama => ({ nama, perBulan: nominal.get(nama)! }))
  }, [bulanTimeline, tagihanPerBulan])

  const tagihanById = useMemo(() => new Map<string, TagihanLaporan>(rows.map(t => [t.id, t])), [rows])

  const ringkasMetode = useMemo(() => {
    const hitung = new Map<string, { jumlah: number; nominal: number }>()
    for (const p of transaksi) {
      const cur = hitung.get(labelMetode(p.metode)) ?? { jumlah: 0, nominal: 0 }
      cur.jumlah += 1
      cur.nominal += p.jumlah
      hitung.set(labelMetode(p.metode), cur)
    }
    return [...hitung].sort((a, b) => b[1].jumlah - a[1].jumlah)
  }, [transaksi])

  // ── Aksi
  const namaSiswa = siswa?.nama ?? rows[0]?.siswa?.nama ?? '—'
  const noWa      = siswa?.no_wa ?? null

  // Sekolah yang memakai antrean pengingat: klik hanya memasukkan pengingat ke antrean,
  // dan tampilan tombolnya datang dari server. Selain itu tombol membuka wa.me.
  const pengingat = usePengingat(semuaTunggakan.length > 0 && noWa ? [siswaId] : [])

  const kirimPengingat = () => {
    const tautan = tautanPengingatTunggakan({
      tagihan:   rows,
      sekarang,
      noWa,
      namaWali:  siswa?.nama_wali ?? '',
      namaSiswa,
      kelasNama: kelasPeriode?.nama ?? siswa?.kelas ?? '',
      namaSekolah,
      origin:    window.location.origin,
    })
    if (!tautan) return
    window.open(tautan, '_blank', 'noopener,noreferrer')
    setPengingatDibuka(true)
  }

  const simpanCatatan = async () => {
    if (!sekolahId) return
    setMenyimpan(true)
    setGalatCatatan('')
    const { data, error } = await supabase.from('catatan_tindak_lanjut')
      .insert({ sekolah_id: sekolahId, siswa_id: siswaId, alasan: formAlasan, catatan: formTeks.trim() || null })
      .select('id, alasan, catatan, dibuat_oleh, created_at')
      .single()
    setMenyimpan(false)
    if (error || !data) {
      setGalatCatatan(tabelBelumAda(error) ? 'Tabel catatan tindak lanjut belum dibuat.' : 'Catatan gagal disimpan. Coba lagi.')
      return
    }
    setCatatan(prev => [data as CatatanRow, ...prev])
    setFormTeks('')
  }

  const hapusCatatan = async (id: string) => {
    if (!window.confirm('Hapus catatan ini? Tindakan ini tidak bisa dibatalkan.')) return
    const { error } = await supabase.from('catatan_tindak_lanjut').delete().eq('id', id)
    if (error) { setGalatCatatan('Catatan gagal dihapus. Coba lagi.'); return }
    setCatatan(prev => prev.filter(c => c.id !== id))
  }

  // ── Penjelasan status dalam satu kalimat
  const penjelasanStatus = (() => {
    const { status, tunggakan, umurTertuaHari, ringkasan: r } = penilaian
    if (status === 'belum_dinilai') return 'Belum ada tagihan yang jatuh tempo pada periode ini.'
    if (status === 'lancar') return `Tepat waktu ${formatPersen(r.ketepatanWaktu)} (${r.jumlahTepatWaktu} dari ${r.jumlahDinilai} tagihan), tanpa tunggakan.`
    if (tunggakan.length > 0) return `${tunggakan.length} tagihan menunggak, yang tertua ${umurTertuaHari} hari · tepat waktu ${formatPersen(r.ketepatanWaktu)}.`
    return `Tepat waktu ${formatPersen(r.ketepatanWaktu)} (${r.jumlahTepatWaktu} dari ${r.jumlahDinilai} tagihan) — di bawah 90%, rata-rata telat ${Math.round(r.rataHariTelat ?? 0)} hari.`
  })()

  const jejak: JejakLaporan[] = [
    { label: 'Laporan', href: `/laporan${qsFilter}` },
    ...(kelasPeriode ? [
      { label: `Jenjang ${kelasPeriode.jenjang}`, href: `/laporan/jenjang/${encodeURIComponent(kelasPeriode.jenjang)}${qsFilter}` },
      { label: kelasPeriode.nama, href: `/laporan/kelas/${kelasPeriode.id}${qsFilter}` },
    ] : []),
    { label: namaSiswa },
  ]

  const keteranganSiswa = siswa
    ? siswa.status === 'alumni'
      ? `NIS ${siswa.nis ?? '—'} · Alumni${siswa.tahun_lulus ? ` ${siswa.tahun_lulus}` : ''}${siswa.kelas ? ` (${siswa.kelas})` : ''}`
      : `NIS ${siswa.nis ?? '—'} · Kelas ${siswa.kelas_id ? kelas.get(siswa.kelas_id)?.nama ?? '—' : '—'}`
    : `${selectedFilter.label} · ${selectedFilter.sublabel}`

  const sedangMemuat = loading || memuatDetail

  return (
    <div className="dashboard-content">
      <HeaderLaporan
        judul={namaSiswa}
        subjudul={keteranganSiswa}
        jejak={jejak}
        kanan={!loading && <FilterLaporan filter={filter} activeTAId={activeTA?.id ?? null} />}
      />

      {sedangMemuat ? (
        <div style={{ ...sBingkai, borderLeft: '28px solid #E2E8F0', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.875rem', minHeight: 220 }}>
          Memuat data...
        </div>
      ) : !siswa && rows.length === 0 ? (
        <div style={{ ...sBingkai, alignItems: 'center', justifyContent: 'center', minHeight: 300, textAlign: 'center' }}>
          <Database size={48} strokeWidth={1.2} color="#CBD5E1" />
          <div style={{ fontWeight: 700, color: '#0F172A' }}>Siswa tidak ditemukan</div>
          <Link href={`/laporan${qsFilter}`} style={{ fontSize: '0.85rem', color: '#3C75B7', fontWeight: 600 }}>Kembali ke laporan sekolah</Link>
        </div>
      ) : (
        <div style={sBingkai}>

          {/* Status + pengingat */}
          <div style={{ ...sKartu, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap', minWidth: 0 }}>
              <StatusSiswaBadge status={penilaian.status} />
              {siswa?.status === 'alumni' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EDE9FE', color: '#6D28D9', fontSize: '0.74rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                  <GraduationCap size={13} /> Alumni
                </span>
              )}
              <span style={{ fontSize: '0.85rem', color: '#374151' }}>{penjelasanStatus}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {semuaTunggakan.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#6F788A' }}>
                  Semua tunggakan: <strong style={{ color: '#B91C1C' }}>{fmt(totalSemuaTunggakan)}</strong> · {semuaTunggakan.length} bulan
                </span>
              )}
              {semuaTunggakan.length > 0 && (noWa ? (
                pengingat.aktif ? (
                  <TombolIngatkan varian="profil" tampilan={pengingat.tampilan(siswaId)}
                    onKlik={() => pengingat.ingatkan([siswaId])} />
                ) : (
                  // Selama belum diketahui sekolah ini memakai antrean atau wa.me, tombolnya
                  // tampil tetapi belum bisa diklik
                  <button onClick={kirimPengingat}
                    disabled={pengingat.aktif === null}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: pengingatDibuka ? '#BBF7D0' : '#DCFCE7', color: '#15803D', borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: pengingat.aktif === null ? 'progress' : 'pointer', fontFamily: 'inherit' }}>
                    <Image src="/icons/IconWA.png" width={16} height={16} alt="" />
                    {pengingatDibuka ? 'WhatsApp dibuka' : 'Ingatkan via WhatsApp'}
                  </button>
                )
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Tidak ada no. WA orang tua</span>
              ))}
            </div>
          </div>

          <KartuRingkasan ringkasan={ringkasan} pemasukan={pemasukan} />

          {/* Timeline 12 bulan */}
          <div style={sKartu}>
            <div style={sJudulPanel}>Timeline 12 bulan</div>
            <div style={sSubjudulPanel}>
              {taArsipTerpilih ? `12 bulan terakhir ${taTerpilih?.nama}` : '12 bulan terakhir'} · status dinilai per tagihan bulanan,
              karena pembayaran tidak dicatat per komponen · baris komponen berisi nominal yang ditagihkan
            </div>
            <LegendaBulan kategori={URUTAN_LEGENDA} />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0 0.75rem 0.35rem 0', color: '#64748B', fontWeight: 600, minWidth: 130 }} />
                    {bulanTimeline.map((m, i) => (
                      <th key={kunciBulan(m.bulan, m.tahun)} style={{ minWidth: 54, color: '#64748B', fontWeight: 600, paddingBottom: 4, lineHeight: 1.2 }}>
                        {BULAN_PENDEK[m.bulan]}
                        {(i === 0 || m.bulan === 1) && <div style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 500 }}>{m.tahun}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" style={{ textAlign: 'left', color: '#64748B', fontWeight: 600, paddingRight: '0.75rem' }}>Kelas</th>
                    {bulanTimeline.map(m => {
                      const t = tagihanPerBulan.get(kunciBulan(m.bulan, m.tahun))
                      return (
                        <td key={kunciBulan(m.bulan, m.tahun)} style={{ textAlign: 'center', color: '#475569' }}>
                          {t?.kelas_id ? kelas.get(t.kelas_id)?.nama ?? '—' : ''}
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <th scope="row" style={{ textAlign: 'left', color: '#0F172A', fontWeight: 700, paddingRight: '0.75rem' }}>Status</th>
                    {bulanTimeline.map(m => {
                      const kunci = kunciBulan(m.bulan, m.tahun)
                      const t = tagihanPerBulan.get(kunci)
                      if (!t) {
                        return <td key={kunci} title={`${BULAN_PANJANG[m.bulan]} ${m.tahun}: tidak ada tagihan`}
                          style={{ height: 26, background: '#F8FAFC', border: '1px solid #EEF2F6', borderRadius: 4 }} />
                      }
                      const kategori = kategoriBulan(t, sekarang)
                      const ui = KATEGORI_BULAN_UI[kategori]
                      return (
                        <td key={kunci} title={`${BULAN_PANJANG[m.bulan]} ${m.tahun}: ${ui.label} — ${detailSel(t, kategori, sekarang)}`}
                          style={{ height: 26, background: ui.warna, color: ui.tinta, borderRadius: 4, textAlign: 'center', fontWeight: 800 }}>
                          {ui.tanda}
                        </td>
                      )
                    })}
                  </tr>
                  {barisKomponen.map(k => (
                    <tr key={k.nama}>
                      <th scope="row" style={{ textAlign: 'left', color: '#475569', fontWeight: 500, paddingRight: '0.75rem', whiteSpace: 'nowrap' }}>{k.nama}</th>
                      {bulanTimeline.map(m => {
                        const nilai = k.perBulan.get(kunciBulan(m.bulan, m.tahun))
                        return (
                          <td key={kunciBulan(m.bulan, m.tahun)} style={{ textAlign: 'center', color: nilai ? '#0F172A' : '#CBD5E1' }}>
                            {nilai ? formatRingkas(nilai) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" style={{ textAlign: 'left', color: '#0F172A', fontWeight: 700, paddingRight: '0.75rem', borderTop: '1px solid #E2E8F0' }}>Total tagihan</th>
                    {bulanTimeline.map(m => {
                      const t = tagihanPerBulan.get(kunciBulan(m.bulan, m.tahun))
                      return <td key={kunciBulan(m.bulan, m.tahun)} style={{ textAlign: 'center', fontWeight: 700, borderTop: '1px solid #E2E8F0' }}>{t ? formatRingkas(t.total_nominal) : ''}</td>
                    })}
                  </tr>
                  <tr>
                    <th scope="row" style={{ textAlign: 'left', color: '#0F172A', fontWeight: 700, paddingRight: '0.75rem' }}>Terbayar</th>
                    {bulanTimeline.map(m => {
                      const t = tagihanPerBulan.get(kunciBulan(m.bulan, m.tahun))
                      return <td key={kunciBulan(m.bulan, m.tahun)} style={{ textAlign: 'center', color: '#15803D', fontWeight: 700 }}>{t ? formatRingkas(t.terbayar) : ''}</td>
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaksi + catatan tindak lanjut */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '1rem' }}>
            <div style={sKartu}>
              <div style={sJudulPanel}>Riwayat transaksi</div>
              <div style={sSubjudulPanel}>Semua pembayaran siswa ini, terbaru dulu · tidak mengikuti filter</div>
              {ringkasMetode.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.9rem' }}>
                  {ringkasMetode.map(([metode, v]) => (
                    <span key={metode} style={{ fontSize: '0.74rem', background: '#F1F5F9', color: '#334155', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
                      {metode} · {v.jumlah}× · Rp {formatRingkas(v.nominal)}
                    </span>
                  ))}
                </div>
              )}
              {transaksi.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center', padding: '1.5rem 0' }}>Belum ada pembayaran.</div>
              ) : (
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                    <thead>
                      <tr style={{ color: '#64748B', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.5rem 0.4rem 0', fontWeight: 600 }}>Tanggal</th>
                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Untuk</th>
                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Metode</th>
                        <th style={{ padding: '0.4rem 0', fontWeight: 600, textAlign: 'right' }}>Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transaksi.map(p => {
                        const t = tagihanById.get(p.tagihan_id)
                        return (
                          <tr key={p.id} style={{ borderTop: '1px solid #F1F5F9' }} title={p.catatan ?? undefined}>
                            <td style={{ padding: '0.45rem 0.5rem 0.45rem 0', color: '#374151', whiteSpace: 'nowrap' }}>{formatWaktuWIB(p.tanggal_bayar)}</td>
                            <td style={{ padding: '0.45rem 0.5rem', color: '#374151' }}>{t ? `${BULAN_PANJANG[t.bulan]} ${t.tahun}` : '—'}</td>
                            <td style={{ padding: '0.45rem 0.5rem', color: '#374151' }}>{labelMetode(p.metode)}</td>
                            <td style={{ padding: '0.45rem 0', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{fmt(p.jumlah)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={sKartu}>
              <div style={sJudulPanel}>Catatan tindak lanjut</div>
              <div style={sSubjudulPanel}>Alasan singkat keterlambatan · hanya terlihat oleh pengguna sekolah ini · tidak ikut ekspor</div>
              {!tabelCatatanAda ? (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 10, padding: '0.75rem 0.9rem', fontSize: '0.8rem', lineHeight: 1.5 }}>
                  Tabel catatan tindak lanjut belum dibuat di database. Jalankan SQL-nya di Supabase, lalu muat ulang halaman ini.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    <select value={formAlasan} onChange={e => setFormAlasan(e.target.value as AlasanTindakLanjut)}
                      aria-label="Alasan"
                      style={{ padding: '0.5rem 0.65rem', border: '1.5px solid #E2E8F0', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, color: '#0F172A', background: '#fff' }}>
                      {URUTAN_ALASAN.map(a => <option key={a} value={a}>{ALASAN_TINDAK_LANJUT[a]}</option>)}
                    </select>
                    <textarea value={formTeks} onChange={e => setFormTeks(e.target.value.slice(0, MAKS_CATATAN))}
                      placeholder="Catatan singkat, mis. orang tua janji melunasi setelah panen" rows={3}
                      aria-label="Catatan"
                      style={{ padding: '0.55rem 0.65rem', border: '1.5px solid #E2E8F0', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.82rem', resize: 'vertical' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{formTeks.length}/{MAKS_CATATAN}</span>
                      <button onClick={simpanCatatan} disabled={menyimpan}
                        style={{ background: menyimpan ? '#5B6B8C' : '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: menyimpan ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {menyimpan ? 'Menyimpan...' : 'Simpan catatan'}
                      </button>
                    </div>
                    {galatCatatan && <div style={{ fontSize: '0.78rem', color: '#B91C1C' }}>{galatCatatan}</div>}
                  </div>
                  {catatan.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center', padding: '0.75rem 0' }}>Belum ada catatan.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 280, overflowY: 'auto' }}>
                      {catatan.map(c => (
                        <div key={c.id} style={{ border: '1px solid #EEF2F6', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1A2C4E', background: '#EFF6FF', borderRadius: 20, padding: '2px 9px' }}>
                              {ALASAN_TINDAK_LANJUT[c.alasan] ?? c.alasan}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{formatWaktuWIB(c.created_at)}</span>
                              {c.dibuat_oleh === userId && (
                                <button onClick={() => hapusCatatan(c.id)} aria-label="Hapus catatan"
                                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#94A3B8', display: 'inline-flex' }}>
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </span>
                          </div>
                          {c.catatan && <div style={{ fontSize: '0.8rem', color: '#374151', marginTop: '0.4rem', lineHeight: 1.5 }}>{c.catatan}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
