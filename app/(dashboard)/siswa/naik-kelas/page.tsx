'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ChevronsUp, Clock, GraduationCap, AlertTriangle, Users,
  Calendar, Upload, ArrowRight, X, CheckCircle2, Info, Search, Move,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const JENJANG_MAP: Record<string, string[]> = {
  'TK/PAUD': ['A', 'B', 'C'],
  'SD/MI':   ['1', '2', '3', '4', '5', '6'],
  'SMP/MTs': ['7', '8', '9'],
  'SMA/MA':  ['10', '11', '12'],
  'SMK':     ['10', '11', '12'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

function getInitials(nama: string): string {
  const parts = nama.trim().split(' ').filter(Boolean)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : nama.slice(0, 2).toUpperCase()
}

// Ekstrak identitas dari nama kelas: "10-INTERNASIONAL" dengan jenjang "10" → "INTERNASIONAL"
function getIdentitas(kelasNama: string, jenjang: string): string {
  const prefix = `${jenjang}-`
  return kelasNama.startsWith(prefix) ? kelasNama.slice(prefix.length) : kelasNama
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TahunAjaran {
  id: string; nama: string
  tanggal_selesai: string
  kenaikan_kelas_pada: string | null
}

interface KelasDB {
  id: string; nama: string; warna: string; jenjang: string
}

interface SiswaInfo { id: string; nama: string; nis: string | null }

interface KelasMapping {
  dari:        KelasDB
  ke:          KelasDB | null   // null = alumni
  jumlahSiswa: number
  siswaIds:    string[]
  siswa:       SiswaInfo[]
}

interface PemetaanGroup {
  fromJenjang: string
  toJenjang:   string | null
  kelas:       KelasMapping[]
  totalSiswa:  number
}

interface ReshuffleRow {
  nama:          string
  nis:           string
  dariNama:      string
  keNama:        string
  keterangan:    'Reshuffle' | 'Tinggal Kelas' | 'Lulus'
  dariKelasId?:  string
  keKelasId?:    string
  error?:        string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NaikKelasPage() {
  const fileRef = useRef<HTMLInputElement>(null)

  const [sekolahId,    setSekolahId]    = useState('')
  const [tahunAjaran,  setTahunAjaran]  = useState<TahunAjaran | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [pageState,    setPageState]    = useState<'state1' | 'state2'>('state1')

  // Validation popup
  const [missingKelas,        setMissingKelas]        = useState<string[]>([])
  const [showValidationPopup, setShowValidationPopup] = useState(false)

  // State 2
  const [allKelas,  setAllKelas]       = useState<KelasDB[]>([])
  const [totalAktif,  setTotalAktif]   = useState(0)
  const [menunggak,   setMenunggak]    = useState(0)
  const [akanAlumni,  setAkanAlumni]   = useState(0)
  const [maxJenjang,  setMaxJenjang]   = useState('')
  const [pemetaan,    setPemetaan]     = useState<PemetaanGroup[]>([])

  // Reshuffle
  const [reshuffleRows,      setReshuffleRows]      = useState<ReshuffleRow[]>([])
  const [showReshuffleTable, setShowReshuffleTable] = useState(false)
  const [showReshuffleModal,   setShowReshuffleModal]   = useState(false)
  const [pendingFile,          setPendingFile]          = useState<File | null>(null)
  const [isDragging,           setIsDragging]           = useState(false)
  const [reshuffleFileName,    setReshuffleFileName]    = useState('')
  const [reshuffleSearchQuery, setReshuffleSearchQuery] = useState('')
  const [showAllReshufflePopup,setShowAllReshufflePopup]= useState(false)
  const [showConfirmPopup,     setShowConfirmPopup]     = useState(false)
  const [uploadError,        setUploadError]        = useState('')
  const [uploadProcessing,   setUploadProcessing]   = useState(false)

  // Execute
  const [executing,    setExecuting]    = useState(false)
  const [executeDone,  setExecuteDone]  = useState(false)
  const [executeError, setExecuteError] = useState('')

  // ── Load profile + tahun ajaran aktif ──────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase
        .from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
      if (!p?.sekolah_id) return
      const sid = p.sekolah_id as string
      setSekolahId(sid)

      const { data: ta } = await supabase
        .from('tahun_ajaran')
        .select('id, nama, tanggal_selesai, kenaikan_kelas_pada')
        .eq('sekolah_id', sid)
        .eq('is_aktif', true)
        .maybeSingle()

      setTahunAjaran(ta as TahunAjaran | null)
      setLoading(false)
    }
    init()
  }, [])

  // ── Sisa hari ──────────────────────────────────────────────────────────────

  const sisaHari = useMemo(() => {
    if (!tahunAjaran?.tanggal_selesai) return null
    const selesai = new Date(tahunAjaran.tanggal_selesai)
    const today   = new Date()
    selesai.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0)
    return Math.ceil((selesai.getTime() - today.getTime()) / 86_400_000)
  }, [tahunAjaran])

  // Tahun ajaran dianggap selesai sejak hari tanggal_selesai itu sendiri (inklusif)
  const tahunAjaranSelesai = sisaHari !== null && sisaHari <= 0

  // Kenaikan kelas hanya boleh sekali per tahun ajaran
  const sudahNaikKelas = !!tahunAjaran?.kenaikan_kelas_pada

  const badgeLabel =
    sisaHari === null ? '—'
      : sisaHari > 0   ? `${sisaHari} hari lagi hingga tahun ajaran berakhir`
      : sisaHari === 0 ? 'Berakhir hari ini'
      : `Berakhir ${-sisaHari} hari lalu`

  // ── Handle "Jalankan lebih awal" ───────────────────────────────────────────

  const handleJalankanLebihAwal = async () => {
    if (!sekolahId) return

    // Ambil jenjang sekolah → tentukan urutan level dan level tertinggi (alumni)
    const { data: pengData } = await supabase
      .from('pengaturan').select('jenjang_sekolah').maybeSingle()
    const jenjangSekolah = (pengData as { jenjang_sekolah?: string } | null)?.jenjang_sekolah ?? 'SMP/MTs'
    const jenjangLevels  = JENJANG_MAP[jenjangSekolah] ?? JENJANG_MAP['SMP/MTs']
    const maxLevel       = jenjangLevels[jenjangLevels.length - 1]

    const { data: kelasData } = await supabase
      .from('kelas').select('id, nama, warna, jenjang').eq('sekolah_id', sekolahId)
    const kelasList    = (kelasData ?? []) as KelasDB[]
    const kelasNamaMap = new Map(kelasList.map(k => [k.nama.trim(), k]))

    // Validasi per kelas: setiap kelas NON-maxLevel harus punya target dengan identitas sama
    const missing: string[] = []
    for (const kelas of kelasList) {
      if (kelas.jenjang === maxLevel) continue  // kelas tertinggi → alumni, valid

      const currentIdx = jenjangLevels.indexOf(kelas.jenjang)
      if (currentIdx < 0 || currentIdx >= jenjangLevels.length - 1) continue

      const nextLevel  = jenjangLevels[currentIdx + 1]
      const identitas  = getIdentitas(kelas.nama, kelas.jenjang)
      const targetNama = `${nextLevel}-${identitas}`

      if (!kelasNamaMap.has(targetNama) && !missing.includes(targetNama)) {
        missing.push(targetNama)
      }
    }

    if (missing.length > 0) {
      setMissingKelas(missing)
      setShowValidationPopup(true)
      return
    }

    await loadState2(kelasList, jenjangLevels, maxLevel)
  }

  // ── Load State 2 data ──────────────────────────────────────────────────────

  const loadState2 = async (kelasList: KelasDB[], jenjangLevels: string[], maxLevel: string) => {
    setAllKelas(kelasList)
    setMaxJenjang(maxLevel)

    const kelasNamaMap = new Map(kelasList.map(k => [k.nama.trim(), k]))

    // Siswa aktif
    const { data: siswaData } = await supabase
      .from('siswa')
      .select('id, nama, nis, kelas_id')
      .eq('sekolah_id', sekolahId)
      .eq('status', 'aktif')
      .order('nama')
      .limit(2000)

    const siswaList = (siswaData ?? []) as { id: string; nama: string; nis: string | null; kelas_id: string }[]
    setTotalAktif(siswaList.length)

    // Menunggak: tagihan belum_bayar yang sudah lewat bulannya
    const now = new Date()
    const nowYear = now.getFullYear(); const nowMonth = now.getMonth() + 1
    const { data: tagihanData } = await supabase
      .from('tagihan')
      .select('siswa_id, bulan, tahun')
      .eq('sekolah_id', sekolahId)
      .eq('status', 'belum_bayar')
      .limit(5000)

    const menunggakIds = new Set(
      ((tagihanData ?? []) as { siswa_id: string; bulan: number; tahun: number }[])
        .filter(t => t.tahun < nowYear || (t.tahun === nowYear && t.bulan < nowMonth))
        .map(t => t.siswa_id)
    )
    setMenunggak(menunggakIds.size)

    // Kelompokkan siswa per kelas (dengan detail)
    const siswaByKelas = new Map<string, SiswaInfo[]>()
    for (const s of siswaList) {
      const list = siswaByKelas.get(s.kelas_id) ?? []
      list.push({ id: s.id, nama: s.nama, nis: s.nis })
      siswaByKelas.set(s.kelas_id, list)
    }

    // Bangun pemetaan berdasarkan jenjang column (bukan parse nama)
    const groupMap = new Map<string, PemetaanGroup>()
    let alumniCount = 0

    for (const kelas of kelasList) {
      const siswa    = siswaByKelas.get(kelas.id) ?? []
      const siswaIds = siswa.map(s => s.id)
      if (siswa.length === 0) continue

      if (kelas.jenjang === maxLevel) {
        // Kelas tertinggi → alumni
        alumniCount += siswa.length
        const key = `${kelas.jenjang}-alumni`
        if (!groupMap.has(key)) groupMap.set(key, { fromJenjang: kelas.jenjang, toJenjang: null, kelas: [], totalSiswa: 0 })
        const grp = groupMap.get(key)!
        grp.kelas.push({ dari: kelas, ke: null, jumlahSiswa: siswa.length, siswaIds, siswa })
        grp.totalSiswa += siswa.length
      } else {
        const currentIdx = jenjangLevels.indexOf(kelas.jenjang)
        const nextLevel  = currentIdx >= 0 ? jenjangLevels[currentIdx + 1] : null
        if (!nextLevel) continue

        const identitas   = getIdentitas(kelas.nama, kelas.jenjang)
        const targetNama  = `${nextLevel}-${identitas}`
        const targetKelas = kelasNamaMap.get(targetNama) ?? null

        const key = `${kelas.jenjang}-${nextLevel}`
        if (!groupMap.has(key)) groupMap.set(key, { fromJenjang: kelas.jenjang, toJenjang: nextLevel, kelas: [], totalSiswa: 0 })
        const grp = groupMap.get(key)!
        grp.kelas.push({ dari: kelas, ke: targetKelas, jumlahSiswa: siswa.length, siswaIds, siswa })
        grp.totalSiswa += siswa.length
      }
    }

    setAkanAlumni(alumniCount)
    setPemetaan(
      Array.from(groupMap.values())
        .sort((a, b) => jenjangLevels.indexOf(a.fromJenjang) - jenjangLevels.indexOf(b.fromJenjang))
    )
    setPageState('state2')
  }

  // ── Download template reshuffle ────────────────────────────────────────────

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Nama', 'NIS', 'Kelas Baru']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reshuffle')
    XLSX.writeFile(wb, 'template-reshuffle.xlsx')
  }

  // ── Proses file Excel reshuffle (3 kolom: Nama, NIS, Kelas Baru) ──────────

  const processReshuffleFile = async (file: File) => {
    setUploadError('')
    setUploadProcessing(true)

    try {
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

      const normalizeKelas = (s: string) => s.trim().toUpperCase().replace(/-/g, '').replace(/\s+/g, '')
      const kelasNamaMap = new Map(allKelas.map(k => [normalizeKelas(k.nama), k]))
      const kelasById    = new Map(allKelas.map(k => [k.id, k]))

      const { data: siswaData } = await supabase
        .from('siswa').select('id, nama, nis, kelas_id')
        .eq('sekolah_id', sekolahId).eq('status', 'aktif').limit(2000)

      const siswaByNis = new Map(
        ((siswaData ?? []) as { id: string; nama: string; nis: string | null; kelas_id: string }[])
          .filter(s => s.nis)
          .map(s => [s.nis!.trim(), s])
      )

      const parsed: ReshuffleRow[] = rows.map(row => {
        const nama      = String(row['Nama']      ?? row['nama']       ?? '').trim()
        const nis       = String(row['NIS']       ?? row['nis']        ?? '').trim()
        const kelasBaru = String(row['Kelas Baru'] ?? row['kelas_baru'] ?? row['Kelas baru'] ?? row['KELAS BARU'] ?? '').trim()

        const isAlumni = ['lulus', 'alumni', 'tamat', 'graduated'].includes(kelasBaru.toLowerCase())

        const siswa        = siswaByNis.get(nis)
        const targetKelas  = isAlumni ? undefined : kelasNamaMap.get(normalizeKelas(kelasBaru))
        const currentKelas = siswa ? kelasById.get(siswa.kelas_id) : undefined

        let error: string | undefined
        if (!siswa) error = `Siswa NIS "${nis}" tidak ditemukan`
        else if (!isAlumni && !targetKelas) error = `Kelas "${kelasBaru}" tidak ditemukan`

        const keterangan: 'Reshuffle' | 'Tinggal Kelas' | 'Lulus' = isAlumni
          ? 'Lulus'
          : currentKelas && targetKelas && currentKelas.id === targetKelas.id
            ? 'Tinggal Kelas'
            : 'Reshuffle'

        return {
          nama, nis,
          dariNama:    currentKelas?.nama ?? '—',
          keNama:      isAlumni ? 'Lulus' : kelasBaru,
          keterangan,
          dariKelasId: siswa?.kelas_id,
          keKelasId:   targetKelas?.id,
          error,
        }
      }).filter(r => r.nama || r.nis)

      if (parsed.length === 0) {
        setUploadError('File tidak berisi data. Pastikan header kolom: Nama, NIS, Kelas Baru')
        setUploadProcessing(false)
        return
      }

      setReshuffleFileName(file.name)
      setReshuffleRows(parsed)
      setShowReshuffleTable(true)
      setShowReshuffleModal(false)
      setPendingFile(null)
    } catch {
      setUploadError('Gagal membaca file. Pastikan format Excel/CSV benar.')
    }

    setUploadProcessing(false)
  }

  // ── Jalankan Kenaikan Kelas ────────────────────────────────────────────────

  const handleExecute = async () => {
    if (!tahunAjaran || !sekolahId) return
    setExecuting(true); setExecuteError('')

    try {
      // Bangun map siswaId → kelas tujuan dari pemetaan otomatis
      const siswaToKelas     = new Map<string, string | 'alumni'>()
      const alumniKelasNama  = new Map<string, string>() // siswaId → nama kelas terakhir

      for (const grp of pemetaan) {
        for (const m of grp.kelas) {
          for (const sid of m.siswaIds) {
            if (m.ke) {
              siswaToKelas.set(sid, m.ke.id)
            } else {
              siswaToKelas.set(sid, 'alumni')
              alumniKelasNama.set(sid, m.dari.nama)
            }
          }
        }
      }

      // Override dengan reshuffle
      if (showReshuffleTable && reshuffleRows.length > 0) {
        const { data: siswaData } = await supabase
          .from('siswa').select('id, nis').eq('sekolah_id', sekolahId).limit(2000)

        const siswaByNis = new Map(
          ((siswaData ?? []) as { id: string; nis: string | null }[])
            .filter(s => s.nis)
            .map(s => [s.nis!.trim(), s.id])
        )

        for (const row of reshuffleRows) {
          if (row.error) continue
          const siswaId = siswaByNis.get(row.nis.trim())
          if (!siswaId) continue

          if (row.keterangan === 'Lulus') {
            siswaToKelas.set(siswaId, 'alumni')
            alumniKelasNama.set(siswaId, row.dariNama)
          } else if (row.keterangan === 'Tinggal Kelas') {
            if (row.dariKelasId) siswaToKelas.set(siswaId, row.dariKelasId)
          } else {
            if (row.keKelasId) siswaToKelas.set(siswaId, row.keKelasId)
          }
        }
      }

      // Tahun lulus dari tanggal selesai tahun ajaran
      const tahunLulus = String(new Date(tahunAjaran.tanggal_selesai).getFullYear())

      // Batch update siswa naik kelas (per kelas tujuan)
      const byKelas = new Map<string, string[]>()
      for (const [siswaId, kelasId] of siswaToKelas) {
        if (kelasId === 'alumni') continue
        const list = byKelas.get(kelasId) ?? []
        list.push(siswaId)
        byKelas.set(kelasId, list)
      }

      for (const [kelasId, siswaIds] of byKelas) {
        const { error } = await supabase.from('siswa')
          .update({ kelas_id: kelasId })
          .eq('sekolah_id', sekolahId)
          .in('id', siswaIds)
        if (error) throw new Error(`Gagal update kelas: ${error.message}`)
      }

      // Update siswa → alumni (set status, kelas snapshot, tahun_lulus, clear kelas_id)
      const byKelasNamaAlumni = new Map<string, string[]>()
      for (const [siswaId, kelasNama] of alumniKelasNama) {
        const list = byKelasNamaAlumni.get(kelasNama) ?? []
        list.push(siswaId)
        byKelasNamaAlumni.set(kelasNama, list)
      }

      for (const [kelasNama, ids] of byKelasNamaAlumni) {
        const { error } = await supabase.from('siswa')
          .update({ status: 'alumni', jenis_alumni: 'lulus', kelas: kelasNama, tahun_lulus: tahunLulus, kelas_id: null })
          .eq('sekolah_id', sekolahId)
          .in('id', ids)
        if (error) throw new Error(`Gagal update alumni: ${error.message}`)
      }

      // Tandai kenaikan kelas sudah dijalankan. Tahun ajaran sengaja TIDAK diarsipkan
      // di sini — pengarsipan terjadi saat tahun ajaran baru diaktifkan, supaya sistem
      // tidak pernah berada dalam kondisi tanpa tahun ajaran aktif.
      const { error: taError } = await supabase.from('tahun_ajaran')
        .update({ kenaikan_kelas_pada: new Date().toISOString() })
        .eq('id', tahunAjaran.id)
      if (taError) throw new Error(`Gagal menandai kenaikan kelas: ${taError.message}`)

      setExecuteDone(true)
    } catch (err) {
      setExecuteError(`Terjadi kesalahan: ${(err as Error).message}`)
      console.error('[handleExecute]', err)
    } finally {
      setExecuting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-content">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '2px 3px 10px rgba(18, 47, 102, 0.54)' }}>
          <Image src="/icons/NaikKelas.png" width={33} height={30} alt="" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>
            Naik kelas
          </h1>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
            Proses kenaikan kelas siswa untuk tahun ajaran baru
          </p>
        </div>
      </div>

      {/* ── State 0 — Kenaikan kelas sudah pernah dijalankan ─────────────────── */}
      {pageState === 'state1' && sudahNaikKelas && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8F0', borderLeft: '28px solid #059669', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', minHeight: 280 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={30} color="#16A34A" />
          </div>
          <div style={{ textAlign: 'center', maxWidth: 460 }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0F172A', marginBottom: 6 }}>
              Kenaikan kelas sudah dijalankan
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: 1.6 }}>
              Proses kenaikan kelas untuk tahun ajaran <strong>{tahunAjaran?.nama ?? '—'}</strong> telah selesai
              pada <strong>{tahunAjaran ? formatTanggal(tahunAjaran.kenaikan_kelas_pada!) : '—'}</strong>.
              Langkah berikutnya: buat tahun ajaran baru agar periode ini pindah ke Riwayat
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.5rem' }}>
            <Link href="/siswa/alumni"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#059669', border: '1.5px solid #059669', borderRadius: 10, padding: '0.6rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
              <GraduationCap size={15} /> Lihat Halaman Alumni
            </Link>
            <Link href="/tagihan/tahun-ajaran"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1A2C4E', color: '#fff', borderRadius: 10, padding: '0.6rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
              <Calendar size={15} /> Buat Tahun Ajaran Baru
            </Link>
          </div>
        </div>
      )}

      {/* ── State 1 — Sebelum proses kenaikan dijalankan ─────────────────────── */}
      {pageState === 'state1' && !sudahNaikKelas && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8F0', borderLeft: '28px solid #1A2C4E', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', minHeight: 280 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: tahunAjaranSelesai ? '#F0FDF4' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {tahunAjaranSelesai
              ? <CheckCircle2 size={30} color="#16A34A" />
              : <Clock size={30} color="#94A3B8" />}
          </div>
          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0F172A', marginBottom: 6 }}>
              {tahunAjaranSelesai ? 'Tahun ajaran telah selesai' : 'Tahun ajaran belum selesai'}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: 1.6 }}>
              {tahunAjaranSelesai ? (
                <>
                  Tahun ajaran <strong>{tahunAjaran?.nama ?? '—'}</strong> telah berakhir pada{' '}
                  <strong>{tahunAjaran ? formatTanggal(tahunAjaran.tanggal_selesai) : '—'}</strong>.
                  Saatnya memproses kenaikan kelas untuk seluruh siswa
                </>
              ) : (
                <>
                  Proses kenaikan kelas baru bisa dijalankan setelah tahun ajaran{' '}
                  <strong>{tahunAjaran?.nama ?? '—'}</strong> berakhir pada{' '}
                  <strong>{tahunAjaran ? formatTanggal(tahunAjaran.tanggal_selesai) : '—'}</strong>
                </>
              )}
            </div>
          </div>

          {/* Badge + CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F8FAFC', border: `1.5px solid ${tahunAjaranSelesai ? '#1A2C4E' : '#E2E8F0'}`, borderRadius: 10, overflow: 'hidden', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1rem', borderRight: tahunAjaranSelesai ? 'none' : '1.5px solid #E2E8F0' }}>
              <Calendar size={15} color="#1A2C4E" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A2C4E', whiteSpace: 'nowrap' }}>
                {badgeLabel}
              </span>
            </div>
            <button
              onClick={handleJalankanLebihAwal}
              style={{ padding: '0.65rem 1rem', background: tahunAjaranSelesai ? '#1A2C4E' : 'transparent', border: 'none', fontSize: '0.85rem', fontWeight: 700, color: tahunAjaranSelesai ? '#fff' : '#1A2C4E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = tahunAjaranSelesai ? '#243D6A' : '#EFF6FF'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = tahunAjaranSelesai ? '#1A2C4E' : 'transparent'}
            >
              {tahunAjaranSelesai ? 'Mulai Proses Kenaikan Kelas' : 'Jalankan lebih awal'} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── State 2 — Proses kenaikan ─────────────────────────────────────────── */}
      {pageState === 'state2' && (
        <>
          {/* ── Layout default (tanpa reshuffle Excel) ──────────────────────── */}
          {!showReshuffleTable && (<>
            {/* Done state */}
            {executeDone && (
              <div style={{ background: '#fff', border: '1.5px solid #6EE7B7', borderRadius: 16, overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(5,150,105,0.1)' }}>
                {/* Green strip */}
                <div style={{ background: 'linear-gradient(135deg, #059669, #10B981)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle2 size={26} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff', lineHeight: 1.2 }}>Kenaikan kelas berhasil dijalankan!</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>Data siswa, status alumni, dan tahun ajaran telah diperbarui.</div>
                  </div>
                </div>
                {/* Stats + actions */}
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 32, height: 32, background: '#F0FDF4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GraduationCap size={16} color="#059669" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>Menjadi alumni</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#059669', lineHeight: 1 }}>{akanAlumni} siswa</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 32, height: 32, background: '#EFF6FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronsUp size={16} color="#2563EB" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>Naik kelas</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#2563EB', lineHeight: 1 }}>{totalAktif - akanAlumni} siswa</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <Link href="/siswa/alumni"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#059669', color: '#fff', borderRadius: 10, padding: '0.6rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
                      <GraduationCap size={15} /> Lihat Halaman Alumni
                    </Link>
                    <Link href="/tagihan/tahun-ajaran"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1A2C4E', color: '#fff', borderRadius: 10, padding: '0.6rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
                      <Calendar size={15} /> Atur Tahun Ajaran Baru
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Warning tunggakan */}
            {menunggak > 0 && !executeDone && (
              <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '0.875rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ width: 50, height: 50, borderRadius: 10, background: '#DE6666', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={32} color="#ffffff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A2C4E' }}>{menunggak} siswa masih memiliki tunggakan</div>
                  <div style={{ fontSize: '0.8rem', color: '#6F788A', marginTop: 2 }}>Sebaiknya selesaikan tunggakan sebelum menjalankan proses kenaikan kelas.</div>
                </div>
                <a href={`/tagihan/aktif?status=menunggak${maxJenjang ? `&jenjang=${encodeURIComponent(maxJenjang)}` : ''}`} style={{ background: '#F7DD7D', color: '#1A2C4E', border: 'none', borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}>Lihat Daftar</a>
              </div>
            )}

            {/* Kondisi siswa */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8F0', borderLeft: '28px solid #1A2C4E', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
                <div style={{ width: 48, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Image src="/icons/Lulus.png" width={25} height={24} alt="" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', lineHeight: 1.2 }}>Kondisi siswa saat ini</div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500, marginTop: 2 }}>Pastikan semua data sudah siap sebelum menjalankan kenaikan kelas</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
                <div style={{ background: '#ffffff', borderRadius: 12, padding: '1rem 1.1rem', boxShadow:'0 2px 10px #3244736e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Total siswa aktif</span>
                    <Users size={26} color="#1A2C4E" />
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{totalAktif}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6F788A', fontWeight: 600, marginTop: 4 }}>Akan diproses</div>
                </div>
                <div style={{ background: '#ffffff', borderRadius: 12, padding: '1rem 1.1rem', boxShadow:'0 2px 10px #3244736e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6F788A' }}>Menunggak</span>
                    <AlertTriangle size={26} color="#1A2C4E" />
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#DC2626', lineHeight: 1 }}>{menunggak}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6F788A', fontWeight: 600, marginTop: 4 }}>Siswa perlu diselesaikan</div>
                </div>
                <div style={{ background: '#ffffff', borderRadius: 12, padding: '1rem 1.1rem', boxShadow:'0 2px 10px #3244736e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6F788A' }}>Akan jadi alumni</span>
                    <GraduationCap size={26} color="#1A2C4E" />
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16A34A', lineHeight: 1 }}>{akanAlumni}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: 4 }}>
                    <span style={{ fontSize: '0.72rem', color: '#6F788A', fontWeight: 600 }}>Siswa kelas tertinggi akan lulus</span>
                    {maxJenjang && akanAlumni > 0 && (
                      <a href={`/siswa/daftar-siswa?jenjang=${encodeURIComponent(maxJenjang)}`}
                        style={{ background: '#16A34A', color: '#fff', borderRadius: 8, padding: '0.3rem 0.7rem', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Lihat Daftar
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Pemetaan otomatis */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>Pemetaan kelas</div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500, marginTop: 2 }}>Siswa naik satu tingkat dengan kelas yang sama</div>
                </div>
                <button
                  onClick={() => { setShowReshuffleModal(true); setUploadError('') }}
                  style={{ background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#243D6A'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#1A2C4E'}
                >
                  <Upload size={13} /> Ada reshuffle? Upload Excel
                </button>
              </div>
              <div style={{ border: '1px solid #F1F5F9', borderRadius: 10, overflow: 'hidden', maxHeight: 520, overflowY: 'auto' }}>
                {pemetaan.map((grp, gi) => (
                  <div key={gi} style={{ borderBottom: gi < pemetaan.length - 1 ? '2px solid #F1F5F9' : undefined }}>
                    {/* Group header */}
                    <div style={{ background: '#EEF4FF', padding: '0.7rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                      <Image src="/icons/IconLayer.png" width={18} height={18} alt="" />
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1A2C4E', flex: 1 }}>
                        {grp.toJenjang === null ? `Kelas ${grp.fromJenjang} → Alumni` : `Kelas ${grp.fromJenjang} → Kelas ${grp.toJenjang}`}
                      </span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>{grp.kelas.length} kelas · {grp.totalSiswa} siswa</span>
                    </div>
                    {/* Per-kelas rows with per-siswa detail */}
                    {grp.kelas.map((m, mi) => (
                      <div key={mi} style={{ borderBottom: mi < grp.kelas.length - 1 ? '1px solid #F1F5F9' : undefined }}>
                        {/* Kelas summary row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.8rem 1.1rem 0.5rem', background: '#FAFBFF' }}>
                          <span style={{ background: m.dari.warna + '22', color: m.dari.warna, borderRadius: 6, padding: '0.25rem 0.65rem', fontSize: '0.92rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{m.dari.nama}</span>
                          <ArrowRight size={16} color="#64748B" style={{ flexShrink: 0 }} />
                          {m.ke ? (
                            <span style={{ background: m.ke.warna + '22', color: m.ke.warna, borderRadius: 6, padding: '0.25rem 0.65rem', fontSize: '0.92rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{m.ke.nama}</span>
                          ) : (
                            <span style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 6, padding: '0.25rem 0.65rem', fontSize: '0.92rem', fontWeight: 700 }}>Alumni</span>
                          )}
                          <span style={{ fontSize: '0.88rem', color: '#64748B', fontWeight: 600, marginLeft: 'auto' }}>{m.jumlahSiswa} siswa</span>
                        </div>
                        {/* Per-siswa list */}
                        <div style={{ padding: '0 1.1rem 0.8rem 1.6rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {m.siswa.map(s => (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.4rem 0.65rem', borderRadius: 8, background: '#F8FAFC' }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.dari.warna, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                                {getInitials(s.nama)}
                              </div>
                              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0F172A', flex: 1 }}>{s.nama}</span>
                              {s.nis && <span style={{ fontSize: '0.82rem', color: '#64748B', fontFamily: 'monospace', fontWeight: 500 }}>{s.nis}</span>}
                              <ArrowRight size={13} color="#94A3B8" style={{ flexShrink: 0 }} />
                              {m.ke ? (
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: m.ke.warna }}>{m.ke.nama}</span>
                              ) : (
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>Alumni</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {executeError && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>{executeError}</div>
            )}
            {!executeDone && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowConfirmPopup(true)}
                  disabled={executing}
                  style={{ background: executing ? '#94A3B8' : '#F7DD7D', color: '#1A2C4E', border: 'none', borderRadius: 10, padding: '0.8rem 1.75rem', fontSize: '0.95rem', fontWeight: 800, cursor: executing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: executing ? 'none' : '0 4px 16px rgba(245,158,11,0.35)' }}
                  onMouseEnter={e => { if (!executing) (e.currentTarget as HTMLButtonElement).style.background = '#D97706' }}
                  onMouseLeave={e => { if (!executing) (e.currentTarget as HTMLButtonElement).style.background = '#F59E0B' }}
                >
                  {executing ? 'Memproses...' : <>Jalankan Kenaikan Kelas <ArrowRight size={16} /></>}
                </button>
              </div>
            )}
          </>)}

          {/* ── Layout preview reshuffle Excel ──────────────────────────────── */}
          {showReshuffleTable && (() => {
            const validRows    = reshuffleRows.filter(r => !r.error)
            const validCount   = validRows.length
            const searchLower  = reshuffleSearchQuery.toLowerCase()
            const filteredRows = reshuffleRows.filter(r =>
              r.nama.toLowerCase().includes(searchLower) || r.nis.includes(reshuffleSearchQuery)
            )

            const ReshuffleTableBody = ({ rows }: { rows: typeof reshuffleRows }) => (
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FAFBFF'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                  >
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.62rem', fontWeight: 800, color: '#fff' }}>{getInitials(row.nama)}</div>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>{row.nama}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>{row.nis}</td>
                    <td style={{ padding: '0.65rem 1rem' }}>
                      {row.error
                        ? <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>{row.dariNama}</span>
                        : <span style={{ background: '#EEF2FF', color: '#4F46E5', borderRadius: 6, padding: '0.2rem 0.55rem', fontSize: '0.78rem', fontWeight: 700 }}>{row.dariNama}</span>}
                    </td>
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ArrowRight size={13} color="#94A3B8" />
                        {row.error
                          ? <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>{row.keNama}</span>
                          : <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: 6, padding: '0.2rem 0.55rem', fontSize: '0.78rem', fontWeight: 700 }}>{row.keNama}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 1rem' }}>
                      {row.error
                        ? <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 20, padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>Error: {row.error}</span>
                        : row.keterangan === 'Lulus'
                          ? <span style={{ background: '#EDE9FE', color: '#6D28D9', borderRadius: 20, padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>Lulus</span>
                          : row.keterangan === 'Tinggal Kelas'
                            ? <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 20, padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>Tinggal Kelas</span>
                            : <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: 20, padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>Reshuffle</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            )

            return (<>
              {/* Done state reshuffle */}
              {executeDone && (
                <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 12, padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <CheckCircle2 size={20} color="#059669" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#065F46' }}>Kenaikan kelas berhasil dijalankan!</div>
                    <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: 1 }}>{akanAlumni} siswa → Alumni · {totalAktif - akanAlumni} siswa naik kelas</div>
                  </div>
                </div>
              )}

              {/* Header preview */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{ width: 48, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ChevronsUp size={22} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0F172A' }}>Preview kenaikan kelas</div>
                    <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 2 }}>Verifikasi sebelum menjalankan proses</div>
                  </div>
                </div>
                <button
                  onClick={() => { setShowReshuffleTable(false); setReshuffleRows([]); setReshuffleSearchQuery('') }}
                  style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <X size={13} /> Batalkan Reshuffle
                </button>
              </div>

              {/* File status banner */}
              <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '0.875rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
                <div style={{ width: 36, height: 36, background: '#16A34A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={18} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#065F46' }}>File Excel valid – {validCount} pengecualian terdeteksi</div>
                  <div style={{ fontSize: '0.76rem', color: '#059669', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {totalAktif} siswa mengikuti pemetaan default &bull; {reshuffleFileName}
                  </div>
                </div>
                <button
                  onClick={() => { setShowReshuffleModal(true); setUploadError('') }}
                  style={{ background: '#fff', color: '#16A34A', border: '1.5px solid #16A34A', borderRadius: 8, padding: '0.4rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  Ganti File
                </button>
              </div>

              {/* Perubahan dari Excel card */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>Perubahan dari Excel</span>
                    <span style={{ background: '#DBEAFE', color: '#1D4ED8', borderRadius: 20, padding: '0.15rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>{validCount} siswa</span>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={13} color="#94A3B8" style={{ position: 'absolute', left: 9 }} />
                    <input
                      placeholder="Cari nama siswa"
                      value={reshuffleSearchQuery}
                      onChange={e => setReshuffleSearchQuery(e.target.value)}
                      style={{ paddingLeft: 28, paddingRight: 10, paddingTop: '0.4rem', paddingBottom: '0.4rem', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: '0.8rem', outline: 'none', width: 180, fontFamily: 'inherit', color: '#0F172A' }}
                    />
                  </div>
                </div>

                <div style={{ border: '1px solid #F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                      <thead>
                        <tr style={{ background: '#1A2C4E' }}>
                          {(['Nama', 'NIS', 'Dari', 'Ke', 'Keterangan'] as const).map((h, i, arr) => (
                            <th key={h} style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : undefined }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <ReshuffleTableBody rows={filteredRows.slice(0, 6)} />
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                    Menampilkan {Math.min(6, filteredRows.length)} dari {filteredRows.length} perubahan
                  </span>
                  {filteredRows.length > 6 && (
                    <button
                      onClick={() => setShowAllReshufflePopup(true)}
                      style={{ background: 'none', border: 'none', color: '#16A34A', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      Lihat Semua <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Mengikuti pemetaan default card */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>Mengikuti pemetaan default</div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 2 }}>siswa naik satu tingkat dengan kelas yang sama</div>
                  <div style={{ marginTop: '0.65rem' }}>
                    <span style={{ background: '#F1F5F9', color: '#475569', borderRadius: 20, padding: '0.22rem 0.75rem', fontSize: '0.82rem', fontWeight: 700 }}>{totalAktif} siswa</span>
                  </div>
                </div>
                <Move size={32} color="#CBD5E1" style={{ flexShrink: 0 }} />
                <div style={{ flexShrink: 0 }}>
                  {!executeDone && executeError && (
                    <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.5rem' }}>{executeError}</div>
                  )}
                  {executeDone ? (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Link href="/siswa/alumni"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#059669', color: '#fff', borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>
                        <GraduationCap size={14} /> Lihat Alumni
                      </Link>
                      <Link href="/tagihan/tahun-ajaran"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1A2C4E', color: '#fff', borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>
                        <Calendar size={14} /> Tahun Ajaran Baru
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowConfirmPopup(true)}
                      disabled={executing}
                      style={{ background: executing ? '#94A3B8' : '#F59E0B', color: '#fff', border: 'none', borderRadius: 10, padding: '0.75rem 1.5rem', fontSize: '0.9rem', fontWeight: 800, cursor: executing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: executing ? 'none' : '0 4px 16px rgba(245,158,11,0.35)' }}
                      onMouseEnter={e => { if (!executing) (e.currentTarget as HTMLButtonElement).style.background = '#D97706' }}
                      onMouseLeave={e => { if (!executing) (e.currentTarget as HTMLButtonElement).style.background = '#F59E0B' }}
                    >
                      {executing ? 'Memproses...' : <>Jalankan Kenaikan Kelas <ArrowRight size={15} /></>}
                    </button>
                  )}
                </div>
              </div>

              {/* Popup Lihat Semua */}
              {showAllReshufflePopup && (
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                  onClick={() => setShowAllReshufflePopup(false)}
                >
                  <div
                    style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1.5px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>Semua perubahan dari Excel</span>
                        <span style={{ background: '#DBEAFE', color: '#1D4ED8', borderRadius: 20, padding: '0.15rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>{reshuffleRows.length} baris</span>
                      </div>
                      <button onClick={() => setShowAllReshufflePopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 }}>
                        <X size={20} />
                      </button>
                    </div>
                    <div style={{ overflowY: 'auto', padding: '0.75rem 1rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                        <thead>
                          <tr style={{ background: '#1A2C4E' }}>
                            {(['Nama', 'NIS', 'Dari', 'Ke', 'Keterangan'] as const).map((h, i, arr) => (
                              <th key={h} style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#fff', borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : undefined }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <ReshuffleTableBody rows={reshuffleRows} />
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>)
          })()}
        </>
      )}

      {/* ── Modal Import Excel Reshuffle ─────────────────────────────────────── */}
      {showReshuffleModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => { setShowReshuffleModal(false); setPendingFile(null); setUploadError('') }}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1.5px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>Import Excel reshuffle</div>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 500, marginTop: 2 }}>Data kelas baru akan menggantikan pemetaan default</div>
              </div>
              <button onClick={() => { setShowReshuffleModal(false); setPendingFile(null); setUploadError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* Inner card */}
              <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '1.25rem' }}>
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{ width: 48, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="white" fillOpacity="0.9"/>
                        <path d="M14 2L20 8H14V2Z" fill="white" fillOpacity="0.5"/>
                        <path d="M8 13H10.5L12 15.5L13.5 13H16L13.5 17L16 21H13.5L12 18.5L10.5 21H8L10.5 17L8 13Z" fill="#1A2C4E"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>Import via Excel</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500, marginTop: 2 }}>File Excel harus berisi kolom: <strong>NIS</strong>, <strong>Nama</strong> dan <strong>Kelas Baru</strong></div>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 10, padding: '0.5rem 0.875rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 16L7 11H10V4H14V11H17L12 16Z"/><path d="M5 20H19V18H5V20Z"/></svg>
                    Download Template
                  </button>
                </div>

                {/* Drag & drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault(); setIsDragging(false)
                    const file = e.dataTransfer.files[0]
                    if (file) { setPendingFile(file); setUploadError('') }
                  }}
                  onClick={() => fileRef.current?.click()}
                  style={{ border: `2px dashed ${isDragging ? '#3B82F6' : '#CBD5E1'}`, borderRadius: 10, padding: '2rem 1rem', textAlign: 'center', cursor: 'pointer', background: isDragging ? '#EFF6FF' : '#F8FAFC', transition: 'all 0.15s' }}
                >
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setUploadError('') } e.target.value = '' }} />
                  <Upload size={28} color={isDragging ? '#3B82F6' : '#94A3B8'} style={{ marginBottom: '0.5rem' }} />
                  {pendingFile ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', marginBottom: 2 }}>{pendingFile.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{(pendingFile.size / 1024).toFixed(1)} KB — klik untuk ganti file</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', marginBottom: 2 }}>Drag & drop file Excel</div>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>atau klik untuk pilih file</div>
                    </>
                  )}
                </div>
              </div>

              {uploadError && (
                <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.75rem' }}>
                  {uploadError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1.5px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => { setShowReshuffleModal(false); setPendingFile(null); setUploadError('') }}
                style={{ padding: '0.65rem 1.25rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', color: '#475569' }}
              >
                Batal
              </button>
              <button
                onClick={() => pendingFile && processReshuffleFile(pendingFile)}
                disabled={!pendingFile || uploadProcessing}
                style={{ padding: '0.65rem 1.25rem', borderRadius: 10, border: 'none', background: !pendingFile || uploadProcessing ? '#94A3B8' : '#1A2C4E', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: !pendingFile || uploadProcessing ? 'not-allowed' : 'pointer' }}
              >
                {uploadProcessing ? 'Memproses...' : 'Gunakan Data Ini'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Popup Validasi Kelas Tidak Ada ───────────────────────────────────── */}
      {showValidationPopup && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setShowValidationPopup(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#FEF3C7', padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #FDE68A' }}>
              <Info size={20} color="#D97706" />
              <span style={{ fontWeight: 800, color: '#92400E', fontSize: '0.95rem' }}>Kelas Tujuan Belum Ada</span>
              <button onClick={() => setShowValidationPopup(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: '#92400E' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1.25rem 1.4rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem', lineHeight: 1.6 }}>
                Beberapa kelas tujuan belum tersedia di sistem. Buat kelas berikut terlebih dahulu dan tambahkan minimal 1 siswa:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem', maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                {missingKelas.map(k => (
                  <div key={k} style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.45rem 0.75rem', fontSize: '0.85rem', fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', flexShrink: 0, display: 'inline-block' }} />
                    Kelas {k}
                  </div>
                ))}
              </div>
              <a
                href="/siswa/manajemen-kelas"
                style={{ display: 'block', width: '100%', background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}
              >
                Pergi ke Manajemen Kelas
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Popup Konfirmasi Jalankan ────────────────────────────────────────── */}
      {showConfirmPopup && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 32 }}
          onClick={() => setShowConfirmPopup(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header strip */}
            <div style={{ background: '#1A2C4E', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ChevronsUp size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>Konfirmasi Kenaikan Kelas</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Periksa ringkasan sebelum melanjutkan</div>
              </div>
              <button onClick={() => setShowConfirmPopup(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem' }}>
              {/* Stats */}
              <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', marginBottom: '1rem' }}>
                {[
                  { label: 'Total siswa akan diproses', value: `${totalAktif} siswa`, icon: <Users size={15} color="#64748B" /> },
                  { label: 'Akan jadi alumni',           value: `${akanAlumni} siswa`,  icon: <GraduationCap size={15} color="#16A34A" /> },
                  ...(showReshuffleTable ? [{ label: 'Menggunakan data reshuffle Excel', value: `${reshuffleRows.filter(r => !r.error).length} siswa`, icon: <Upload size={15} color="#3B82F6" /> }] : []),
                ].map((row, i) => (
                  <div key={i}>
                    {i > 0 && <div style={{ height: 1, background: '#F1F5F9' }} />}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>{row.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A' }}>{row.value}</span>
                        {row.icon}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Warning note */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '0.65rem 0.875rem', marginBottom: '1.25rem' }}>
                <AlertTriangle size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: '0.78rem', color: '#92400E', lineHeight: 1.55 }}>
                  Proses ini akan memperbarui kelas seluruh siswa dan mengakhiri tahun ajaran aktif. <strong>Tindakan ini tidak dapat dibatalkan.</strong>
                </span>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowConfirmPopup(false)}
                  style={{ padding: '0.65rem 1.5rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', color: '#475569', fontFamily: 'inherit' }}
                >
                  Batal
                </button>
                <button
                  onClick={() => { setShowConfirmPopup(false); handleExecute() }}
                  style={{ padding: '0.65rem 1.5rem', borderRadius: 10, border: 'none', background: '#F59E0B', color: '#fff', fontWeight: 800, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }}
                >
                  <ChevronsUp size={15} /> Ya, Jalankan Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
