'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Zap, AlertTriangle } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { buildWaLink } from '@/lib/templates/waTagihan'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const formatRp = (n: number) =>
  'Rp ' + n.toLocaleString('id-ID')

// ── Interfaces ────────────────────────────────────────────────────────────────

interface SiswaTagihanRow {
  tagihan_id:    string
  siswa_id:      string
  nama:          string
  kelas_nama:    string
  kelas_jenjang: string
  total_nominal: number
  status:        'belum_bayar' | 'lunas' | 'sebagian'
  no_wa:         string
  nama_wali:     string
}

// Raw Supabase response types
type KelasNestedRaw    = { id: string; nama: string; jenjang: string }
type SiswaNestedRaw    = { id: string; nama: string; no_wa: string | null; nama_wali: string | null; kelas: KelasNestedRaw | null }
type TagihanRawRow     = { id: string; total_nominal: number; status: string; siswa: SiswaNestedRaw | null }
type PaketTotalRaw     = { paket_kelas: { kelas_id: string }[]; paket_komponen: { komponen_id: string; nominal: number }[] }
type PaketKomponenRaw  = { komponen_id: string; nominal: number; komponen: { nama: string; jenis: string } | null }
type PaketKelasRaw     = { kelas_id: string }
type PaketForGenerate  = { id: string; paket_kelas: PaketKelasRaw[]; paket_komponen: PaketKomponenRaw[] }
type SiswaForGenerate  = { id: string; nama: string; kelas_id: string }
type ExistingTagRow    = { siswa_id: string }
type BeasiswaSiswaRaw  = { siswa_id: string; beasiswa: { jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null; beasiswa_komponen: { komponen_id: string }[] } | null }
type IndividuSiswaRaw  = { siswa_id: string; komponen_id: string; nominal: number; komponen: { nama: string; jenis: string } | null }

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  belum_bayar: { label: 'Belum Bayar', bg: '#FEE2E2', color: '#DC2626' },
  lunas:       { label: 'Lunas',       bg: '#D1FAE5', color: '#065F46' },
  sebagian:    { label: 'Sebagian',    bg: '#FEF3C7', color: '#D97706' },
} as const

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TagihanAktifPage() {
  const router = useRouter()

  const now = new Date()
  const [loading,           setLoading]           = useState(true)
  const [generating,        setGenerating]        = useState(false)
  const [sekolahId,         setSekolahId]         = useState('')
  const [activeTahunAjaran, setActiveTahunAjaran] = useState('')
  const [hasPaket,          setHasPaket]          = useState(false)
  const [selectedBulan,     setSelectedBulan]     = useState(now.getMonth() + 1)
  const [selectedTahun,     setSelectedTahun]     = useState(now.getFullYear())
  const [filterStatus,      setFilterStatus]      = useState('Semua')
  const [searchQuery,       setSearchQuery]       = useState('')
  const [tagihanList,       setTagihanList]       = useState<SiswaTagihanRow[]>([])
  const [generateError,          setGenerateError]          = useState('')
  const [namaSekolah,            setNamaSekolah]            = useState('')
  const [showPaketKurangPopup,   setShowPaketKurangPopup]   = useState(false)
  const [showKelasKosongPopup,   setShowKelasKosongPopup]   = useState(false)

  // ── Load tagihan ────────────────────────────────────────────────────────────

  const loadTagihan = useCallback(async (sid: string, bulan: number, tahun: number) => {
    const isSemesterMonth = bulan === 1 || bulan === 7

    const [{ data: tagihanData }, { data: paketData }] = await Promise.all([
      supabase
        .from('tagihan')
        .select('id, total_nominal, status, siswa:siswa_id(id, nama, no_wa, nama_wali, kelas:kelas_id(id, nama, jenjang))')
        .eq('sekolah_id', sid)
        .eq('bulan', bulan)
        .eq('tahun', tahun)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('paket')
        .select('paket_kelas(kelas_id), paket_komponen(komponen_id, nominal)')
        .eq('sekolah_id', sid),
    ])

    // kelas_id → total paket & map(komponen_id → nominal) untuk pencocokan beasiswa
    const kelasTotal = new Map<string, number>()
    const kelasKomps = new Map<string, Map<string, number>>()
    for (const p of ((paketData ?? []) as unknown as PaketTotalRaw[])) {
      const total      = p.paket_komponen.reduce((s, k) => s + k.nominal, 0)
      const kompNomMap = new Map(p.paket_komponen.map(k => [k.komponen_id, k.nominal]))
      for (const pk of p.paket_kelas) {
        kelasTotal.set(pk.kelas_id, total)
        kelasKomps.set(pk.kelas_id, kompNomMap)
      }
    }

    const rows     = (tagihanData ?? []) as unknown as TagihanRawRow[]
    const siswaIds = rows.map(r => r.siswa?.id).filter(Boolean) as string[]

    // Per-siswa: fetch beasiswa aktif + komponen individu
    const today = new Date().toISOString().split('T')[0]
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

    // siswa_id → beasiswa aktif list
    const siswaBeasiswaMap = new Map<string, { jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null; komponen_ids: Set<string> }[]>()
    for (const row of ((bsData ?? []) as unknown as BeasiswaSiswaRaw[])) {
      if (!row.beasiswa) continue
      const list = siswaBeasiswaMap.get(row.siswa_id) ?? []
      list.push({
        jenis_potongan: row.beasiswa.jenis_potongan,
        persen:         row.beasiswa.persen,
        nominal:        row.beasiswa.nominal,
        komponen_ids:   new Set(row.beasiswa.beasiswa_komponen.map(bk => bk.komponen_id)),
      })
      siswaBeasiswaMap.set(row.siswa_id, list)
    }

    // siswa_id → individu list
    type IndividuEntry = { jenis: string; nominal: number }
    const siswaIndividuMap = new Map<string, IndividuEntry[]>()
    for (const row of ((individuData ?? []) as unknown as IndividuSiswaRaw[])) {
      if (!row.komponen) continue
      const list = siswaIndividuMap.get(row.siswa_id) ?? []
      list.push({ jenis: row.komponen.jenis, nominal: row.nominal })
      siswaIndividuMap.set(row.siswa_id, list)
    }

    // Hitung total yang benar per siswa
    const siswaCorrectTotal = new Map<string, number>()
    for (const r of rows) {
      const siswaId   = r.siswa?.id ?? ''
      const kelasId   = r.siswa?.kelas?.id ?? ''
      const paketBase = kelasTotal.get(kelasId) ?? 0
      const kompNomMap = kelasKomps.get(kelasId)

      // Individu: rutin selalu, semester hanya jan/jul, sekali_bayar skip (sudah fix saat generate)
      const individuTotal = (siswaIndividuMap.get(siswaId) ?? [])
        .filter(k => k.jenis === 'rutin_bulanan' || (k.jenis === 'per_semester' && isSemesterMonth))
        .reduce((s, k) => s + k.nominal, 0)

      // Beasiswa: hanya berlaku pada komponen paket, tidak menyentuh individu
      let deduction = 0
      if (kompNomMap) {
        for (const bs of (siswaBeasiswaMap.get(siswaId) ?? [])) {
          for (const kid of bs.komponen_ids) {
            const kNominal = kompNomMap.get(kid)
            if (kNominal === undefined) continue
            deduction += bs.jenis_potongan === 'persen'
              ? Math.round(kNominal * (bs.persen ?? 0) / 100)
              : (bs.nominal ?? 0)
          }
        }
      }

      siswaCorrectTotal.set(siswaId, Math.max(0, paketBase + individuTotal - deduction))
    }

    // Update DB untuk tagihan yang totalnya berbeda
    const toUpdate = rows.flatMap(r => {
      const siswaId = r.siswa?.id ?? ''
      const correct = siswaCorrectTotal.get(siswaId)
      return correct !== undefined && correct !== r.total_nominal ? [{ id: r.id, total: correct }] : []
    })
    if (toUpdate.length > 0) {
      await Promise.all(toUpdate.map(({ id, total }) =>
        supabase.from('tagihan').update({ total_nominal: total }).eq('id', id)
      ))
    }

    setTagihanList(rows.map(r => {
      const siswaId = r.siswa?.id ?? ''
      return {
        tagihan_id:    r.id,
        siswa_id:      siswaId,
        nama:          r.siswa?.nama ?? '—',
        kelas_nama:    r.siswa?.kelas?.nama ?? '—',
        kelas_jenjang: r.siswa?.kelas?.jenjang ?? '',
        total_nominal: siswaCorrectTotal.get(siswaId) ?? r.total_nominal,
        status:        (r.status as SiswaTagihanRow['status']) ?? 'belum_bayar',
        no_wa:         r.siswa?.no_wa ?? '',
        nama_wali:     r.siswa?.nama_wali ?? '',
      }
    }))
  }, [])

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      const { data: profile } = await supabase
        .from('profiles').select('sekolah_id').eq('id', user.id).single()
      const sid = (profile as { sekolah_id: string } | null)?.sekolah_id ?? ''
      if (!sid) return
      setSekolahId(sid)

      const { data: taData } = await supabase
        .from('tahun_ajaran').select('nama').eq('is_aktif', true).maybeSingle()
      const tahun = (taData as { nama: string } | null)?.nama ?? ''
      setActiveTahunAjaran(tahun)

      const [{ data: paketCheck }, { data: sekolahData }] = await Promise.all([
        supabase.from('paket').select('id').eq('sekolah_id', sid).eq('tahun_ajaran', tahun).limit(1),
        supabase.from('sekolah').select('nama').eq('id', sid).maybeSingle(),
      ])
      setHasPaket((paketCheck ?? []).length > 0)
      setNamaSekolah((sekolahData as { nama?: string } | null)?.nama || '')

      await loadTagihan(sid, now.getMonth() + 1, now.getFullYear())
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload saat filter bulan/tahun berubah
  useEffect(() => {
    if (!sekolahId) return
    ;(async () => { await loadTagihan(sekolahId, selectedBulan, selectedTahun) })()
  }, [sekolahId, selectedBulan, selectedTahun, loadTagihan])

  // ── Generate tagihan ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerateError('')
    try {
      // 1. Ambil semua paket aktif + kelas + komponen
      const { data: paketData, error: e1 } = await supabase
        .from('paket')
        .select('id, paket_kelas(kelas_id), paket_komponen(komponen_id, nominal, komponen:komponen_id(nama, jenis))')
        .eq('sekolah_id', sekolahId)
        .eq('tahun_ajaran', activeTahunAjaran)
      if (e1 || !paketData) throw new Error(`Gagal memuat data paket: ${e1?.message ?? 'tidak ada data'}`)

      // 2. Map: kelas_id → komponen list
      const kelasToKomponen = new Map<string, { komponen_id: string; nominal: number; nama: string; jenis: string }[]>()
      for (const p of (paketData as unknown as PaketForGenerate[])) {
        const komps = p.paket_komponen.map(pk => ({
          komponen_id: pk.komponen_id,
          nominal:     pk.nominal,
          nama:        pk.komponen?.nama ?? '',
          jenis:       pk.komponen?.jenis ?? '',
        }))
        for (const pk of p.paket_kelas) {
          kelasToKomponen.set(pk.kelas_id, komps)
        }
      }

      // 2b. Cek apakah semua kelas sudah punya paket
      const { data: allKelasData } = await supabase
        .from('kelas').select('id').eq('sekolah_id', sekolahId)
      const missingKelas = (allKelasData ?? []).filter((k: { id: string }) => !kelasToKomponen.has(k.id))
      if (missingKelas.length > 0) {
        setShowPaketKurangPopup(true)
        setGenerating(false)
        return
      }

      // 3. Ambil semua siswa aktif dengan kelas
      const { data: siswaData, error: e2 } = await supabase
        .from('siswa')
        .select('id, nama, kelas_id')
        .eq('sekolah_id', sekolahId)
        .eq('status', 'aktif')
        .limit(1000)
      if (e2 || !siswaData) throw new Error(`Gagal memuat data siswa: ${e2?.message ?? 'tidak ada data'}`)

      // 3b. Cek kelas yang sudah dipaketkan tapi belum ada siswanya
      const siswaPorKelas = new Set((siswaData as SiswaForGenerate[]).map(s => s.kelas_id))
      const kelasKosong = [...kelasToKomponen.keys()].filter(kid => !siswaPorKelas.has(kid))
      if (kelasKosong.length > 0) {
        setShowKelasKosongPopup(true)
        setGenerating(false)
        return
      }

      // 3c. Fetch beasiswa aktif + komponen individu untuk semua siswa (parallel)
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

      // Map: siswa_id → beasiswa aktif
      const siswaBeasiswaMap = new Map<string, { jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null; komponen_ids: Set<string> }[]>()
      for (const row of ((bsData ?? []) as unknown as BeasiswaSiswaRaw[])) {
        if (!row.beasiswa) continue
        const list = siswaBeasiswaMap.get(row.siswa_id) ?? []
        list.push({
          jenis_potongan: row.beasiswa.jenis_potongan,
          persen:         row.beasiswa.persen,
          nominal:        row.beasiswa.nominal,
          komponen_ids:   new Set(row.beasiswa.beasiswa_komponen.map(bk => bk.komponen_id)),
        })
        siswaBeasiswaMap.set(row.siswa_id, list)
      }

      // Map: siswa_id → komponen individu
      const siswaIndividuMap = new Map<string, { komponen_id: string; nama: string; jenis: string; nominal: number }[]>()
      for (const row of ((individuData ?? []) as unknown as IndividuSiswaRaw[])) {
        if (!row.komponen) continue
        const list = siswaIndividuMap.get(row.siswa_id) ?? []
        list.push({ komponen_id: row.komponen_id, nama: row.komponen.nama, jenis: row.komponen.jenis, nominal: row.nominal })
        siswaIndividuMap.set(row.siswa_id, list)
      }

      // 4. Tagihan yang sudah ada bulan ini (skip jika sudah ada)
      const { data: existingData } = await supabase
        .from('tagihan').select('siswa_id')
        .eq('sekolah_id', sekolahId)
        .eq('bulan', selectedBulan).eq('tahun', selectedTahun)
      const existingIds = new Set(((existingData ?? []) as ExistingTagRow[]).map(t => t.siswa_id))

      // 5. Siswa yang pernah punya tagihan sebelumnya (untuk sekali_bayar)
      const { data: prevData } = await supabase
        .from('tagihan').select('siswa_id')
        .eq('sekolah_id', sekolahId)
        .neq('bulan', selectedBulan)
      const siswaWithHistory = new Set(((prevData ?? []) as ExistingTagRow[]).map(t => t.siswa_id))

      const isSemesterMonth = selectedBulan === 1 || selectedBulan === 7

      // 6. Build tagihan records
      const toInsert: { sekolah_id: string; siswa_id: string; bulan: number; tahun: number; total_nominal: number; status: string }[] = []
      const itemsByTempId: { komponen_id: string; nama_komponen: string; nominal: number; siswa_id: string }[] = []

      for (const siswa of (siswaData as SiswaForGenerate[])) {
        if (existingIds.has(siswa.id)) continue
        const komps = kelasToKomponen.get(siswa.kelas_id)
        if (!komps || komps.length === 0) continue

        const filtered = komps.filter(k => {
          if (k.jenis === 'rutin_bulanan') return true
          if (k.jenis === 'per_semester')  return isSemesterMonth
          if (k.jenis === 'sekali_bayar')  return !siswaWithHistory.has(siswa.id)
          return false
        })

        // Komponen individu — ikut aturan jenis yang sama
        const individu = (siswaIndividuMap.get(siswa.id) ?? []).filter(k => {
          if (k.jenis === 'rutin_bulanan') return true
          if (k.jenis === 'per_semester')  return isSemesterMonth
          if (k.jenis === 'sekali_bayar')  return !siswaWithHistory.has(siswa.id)
          return false
        })

        const allKomps = [...filtered, ...individu]
        if (allKomps.length === 0) continue

        // Potongan beasiswa — hanya berlaku jika komponen-nya masuk tagihan bulan ini
        const tagihanKompIds = new Set(allKomps.map(k => k.komponen_id))
        let totalPotongan = 0
        for (const bs of (siswaBeasiswaMap.get(siswa.id) ?? [])) {
          for (const kid of bs.komponen_ids) {
            if (!tagihanKompIds.has(kid)) continue
            const komp = allKomps.find(k => k.komponen_id === kid)
            if (!komp) continue
            if (bs.jenis_potongan === 'persen') {
              totalPotongan += Math.round(komp.nominal * (bs.persen ?? 0) / 100)
            } else {
              totalPotongan += bs.nominal ?? 0
            }
          }
        }

        const total = Math.max(0, allKomps.reduce((s, k) => s + k.nominal, 0) - totalPotongan)

        toInsert.push({
          sekolah_id:    sekolahId,
          siswa_id:      siswa.id,
          bulan:         selectedBulan,
          tahun:         selectedTahun,
          total_nominal: total,
          status:        'belum_bayar',
        })
        for (const k of allKomps) {
          itemsByTempId.push({ komponen_id: k.komponen_id, nama_komponen: k.nama, nominal: k.nominal, siswa_id: siswa.id })
        }
      }

      if (toInsert.length === 0) {
        setGenerateError('Semua siswa sudah memiliki tagihan untuk bulan ini.')
        return
      }

      // 7. Insert tagihan
      const { data: inserted, error: e3 } = await supabase
        .from('tagihan').insert(toInsert).select('id, siswa_id')
      if (e3 || !inserted) throw new Error(`Gagal menyimpan tagihan: ${e3?.message ?? 'tidak ada response'}`)

      // 8. Insert tagihan_item
      const siswaToTagihanId = new Map(((inserted) as { id: string; siswa_id: string }[]).map(t => [t.siswa_id, t.id]))
      const tagItems = itemsByTempId
        .map(item => ({ tagihan_id: siswaToTagihanId.get(item.siswa_id) ?? '', komponen_id: item.komponen_id, nama_komponen: item.nama_komponen, nominal: item.nominal }))
        .filter(i => i.tagihan_id)
      if (tagItems.length > 0) {
        await supabase.from('tagihan_item').insert(tagItems)
      }

      await loadTagihan(sekolahId, selectedBulan, selectedTahun)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setGenerating(false)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const filtered = tagihanList.filter(t => {
    const matchStatus = filterStatus === 'Semua' || t.status === filterStatus
    const matchSearch = !searchQuery || t.nama.toLowerCase().includes(searchQuery.toLowerCase()) || t.kelas_nama.toLowerCase().includes(searchQuery.toLowerCase())
    return matchStatus && matchSearch
  })

  const totalNominal  = tagihanList.reduce((s, t) => s + t.total_nominal, 0)
  const countLunas    = tagihanList.filter(t => t.status === 'lunas').length
  const countBelum    = tagihanList.filter(t => t.status === 'belum_bayar').length

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-content">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Tagihan Aktif</h1>
          <p className="dashboard-subtitle">
            {activeTahunAjaran ? `Tahun Ajaran ${activeTahunAjaran}` : 'Kelola tagihan siswa per bulan'}
          </p>
        </div>
      </div>

      {/* ── No paket state ──────────────────────────────────────────────────── */}
      {!hasPaket ? (
        <div style={{ ...sCard, textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
            Paket komponen per kelas belum dikonfigurasi
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Tagihan siswa baru bisa di-generate setelah paket per kelas selesai dibuat.
          </div>
          <button
            onClick={() => router.push('/tagihan/paket-kelas')}
            style={{ background: '#F7DD7D', color: '#1A2C4E', border: 'none', borderRadius: 10, padding: '0.65rem 1.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 2px rgba(18,47,102,0.2)' }}>
            Konfigurasi Paket Per Kelas
          </button>
        </div>
      ) : (
        <>
          {/* ── Filter bar ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Pilih bulan */}
            <select value={selectedBulan} onChange={e => setSelectedBulan(Number(e.target.value))}
              style={{ ...sSelect }}>
              {BULAN_NAMES.slice(1).map((nama, i) => (
                <option key={i + 1} value={i + 1}>{nama}</option>
              ))}
            </select>

            {/* Pilih tahun */}
            <select value={selectedTahun} onChange={e => setSelectedTahun(Number(e.target.value))}
              style={{ ...sSelect }}>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Filter status */}
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ ...sSelect }}>
              <option value="Semua">Semua Status</option>
              <option value="belum_bayar">Belum Bayar</option>
              <option value="sebagian">Sebagian</option>
              <option value="lunas">Lunas</option>
            </select>

            {/* Search */}
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                placeholder="Cari nama / kelas..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ ...sInput, paddingLeft: '2.25rem', width: 240 }}
              />
            </div>
          </div>

          {/* ── Summary cards ───────────────────────────────────────────────── */}
          {tagihanList.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Total Siswa',    value: tagihanList.length,      sub: 'Memiliki tagihan bulan ini',    border: 'var(--navy)' },
                { label: 'Total Nominal',  value: formatRp(totalNominal),  sub: 'Seluruh tagihan bulan ini',     border: '#2563EB'     },
                { label: 'Sudah Lunas',    value: countLunas,              sub: `dari ${tagihanList.length} siswa`,  border: '#16A34A' },
                { label: 'Belum Bayar',    value: countBelum,              sub: `dari ${tagihanList.length} siswa`,  border: '#DC2626' },
              ].map(card => (
                <div key={card.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', borderLeft: `4px solid ${card.border}` }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.35rem', textTransform: 'uppercase' }}>{card.label}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1.2 }}>{card.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{card.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Generate prompt ──────────────────────────────────────────────── */}
          {tagihanList.length === 0 && (
            <div style={{ ...sCard, display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap size={24} color="#2563EB" />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>
                  Tagihan {BULAN_NAMES[selectedBulan]} {selectedTahun} belum di-generate
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Klik tombol untuk membuat tagihan otomatis berdasarkan paket per kelas yang sudah dikonfigurasi.
                </div>
                {generateError && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#DC2626', fontWeight: 600 }}>{generateError}</div>
                )}
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{ background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, padding: '0.7rem 1.5rem', fontWeight: 700, fontSize: '0.875rem', cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: generating ? 0.7 : 1, flexShrink: 0 }}>
                {generating ? 'Membuat tagihan...' : `Generate Tagihan ${BULAN_NAMES[selectedBulan]}`}
              </button>
            </div>
          )}

          {/* ── Table ────────────────────────────────────────────────────────── */}
          {tagihanList.length > 0 && (
            <div style={{ ...sCard, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      <th style={{ ...sTh, width: 40 }}>#</th>
                      <th style={sTh}>Nama Lengkap</th>
                      <th style={sTh}>Kelas</th>
                      <th style={{ ...sTh, textAlign: 'right' }}>Total Tagihan</th>
                      <th style={{ ...sTh, textAlign: 'center' }}>Status</th>
                      <th style={{ ...sTh, textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                          Tidak ada tagihan yang sesuai filter
                        </td>
                      </tr>
                    ) : filtered.map((t, idx) => {
                      const badge   = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.belum_bayar
                      const hasWa   = !!t.no_wa
                      return (
                        <tr key={t.tagihan_id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>

                          <td style={{ ...sTd, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{idx + 1}</td>

                          <td style={sTd}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#3730A3', flexShrink: 0 }}>
                                {t.nama.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{t.nama}</span>
                            </div>
                          </td>

                          <td style={sTd}>
                            <span style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                              {t.kelas_nama}
                            </span>
                          </td>

                          <td style={{ ...sTd, textAlign: 'right', fontWeight: 700, color: 'var(--navy-dark)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatRp(t.total_nominal)}
                          </td>

                          <td style={{ ...sTd, textAlign: 'center' }}>
                            <span style={{ background: badge.bg, color: badge.color, fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                              {badge.label}
                            </span>
                          </td>

                          <td style={{ ...sTd, textAlign: 'center' }}>
                            {hasWa ? (
                              <a
                                href={buildWaLink(t.no_wa, { namaWali: t.nama_wali, namaSiswa: t.nama, kelasNama: t.kelas_nama, totalNominal: t.total_nominal, bulan: selectedBulan, tahun: selectedTahun, namaSekolah })}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#DCFCE7', color: '#15803D', borderRadius: 8, padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>
                                <Image src='/icons/IconWA.png' width={18} height={18} alt='WhatsApp'/>
                                Kirim Pengingat
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 500 }}>No WA kosong</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer count */}
              <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #E2E8F0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Menampilkan {filtered.length} dari {tagihanList.length} siswa
              </div>
            </div>
          )}
        </>
      )}
      {/* ── Popup: paket belum lengkap ───────────────────────────────────────── */}
      {showPaketKurangPopup && (
        <>
          <style>{`
            @keyframes popupBackdropIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes popupCardIn     { from { opacity: 0; transform: scale(0.88) translateY(24px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          `}</style>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,47,102,0.38)', backdropFilter: 'blur(3px)', animation: 'popupBackdropIn 0.22s ease' }}
            onClick={() => setShowPaketKurangPopup(false)}>
            <div
              style={{ background: '#fff', borderRadius: 18, padding: '2rem 2rem 1.75rem', maxWidth: 420, width: '90%', boxShadow: '0 24px 64px rgba(18,47,102,0.26)', animation: 'popupCardIn 0.32s cubic-bezier(0.22,1,0.36,1)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: '#FEF3C7', borderRadius: 10, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={21} color="#D97706" strokeWidth={2.5} />
                </div>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A2C4E' }}>Paket Belum Lengkap</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 500, lineHeight: 1.65, marginBottom: '1.5rem', paddingLeft: '0.1rem' }}>
                Paket per kelas untuk beberapa kelas belum dibuat.<br />Segera buat semua paket kelas terlebih dahulu!
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowPaketKurangPopup(false)}
                  style={{ padding: '0.6rem 1.2rem', borderRadius: 10, border: '2px solid #E5E7EB', background: '#fff', color: '#6F788A', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s' }}>
                  Tutup
                </button>
                <button onClick={() => { setShowPaketKurangPopup(false); router.push('/tagihan/paket-kelas') }}
                  style={{ padding: '0.6rem 1.4rem', borderRadius: 10, border: 'none', background: '#F7DD7D', color: '#1A2C4E', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 2px rgba(18,47,102,0.2)', transition: 'opacity 0.15s' }}>
                  Buat Paket Kelas
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Popup: kelas sudah dipaketkan tapi belum ada siswa ───────────────── */}
      {showKelasKosongPopup && (
        <>
          <style>{`
            @keyframes popupBackdropIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes popupCardIn     { from { opacity: 0; transform: scale(0.88) translateY(24px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          `}</style>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,47,102,0.38)', backdropFilter: 'blur(3px)', animation: 'popupBackdropIn 0.22s ease' }}
            onClick={() => setShowKelasKosongPopup(false)}>
            <div
              style={{ background: '#fff', borderRadius: 18, padding: '2rem 2rem 1.75rem', maxWidth: 420, width: '90%', boxShadow: '0 24px 64px rgba(18,47,102,0.26)', animation: 'popupCardIn 0.32s cubic-bezier(0.22,1,0.36,1)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: '#FEE2E2', borderRadius: 10, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={21} color="#DC2626" strokeWidth={2.5} />
                </div>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A2C4E' }}>Kelas Belum Ada Siswa</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 500, lineHeight: 1.65, marginBottom: '1.5rem' }}>
                Beberapa kelas yang sudah dipaketkan belum memiliki siswa.<br />Segera isi data siswa terlebih dahulu!
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowKelasKosongPopup(false)}
                  style={{ padding: '0.6rem 1.2rem', borderRadius: 10, border: '2px solid #E5E7EB', background: '#fff', color: '#6F788A', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s' }}>
                  Tutup
                </button>
                <button onClick={() => { setShowKelasKosongPopup(false); router.push('/siswa') }}
                  style={{ padding: '0.6rem 1.4rem', borderRadius: 10, border: 'none', background: '#F7DD7D', color: '#1A2C4E', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 2px rgba(18,47,102,0.2)', transition: 'opacity 0.15s' }}>
                  Isi Data Siswa
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sCard: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.25rem 1.5rem',
  marginBottom: '1rem',
}

const sSelect: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  color: 'var(--text-dark)',
  outline: 'none',
  background: '#fff',
  cursor: 'pointer',
  appearance: 'auto',
}

const sInput: React.CSSProperties = {
  padding: '0.45rem 0.85rem',
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  color: 'var(--text-dark)',
  outline: 'none',
  background: '#fff',
}

const sTh: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

const sTd: React.CSSProperties = {
  padding: '0.875rem 1rem',
  verticalAlign: 'middle',
}
