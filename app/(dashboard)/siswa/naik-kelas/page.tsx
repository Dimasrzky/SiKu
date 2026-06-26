'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ChevronsUp, Clock, GraduationCap, AlertTriangle, Users,
  Calendar, Upload, ArrowRight, X, CheckCircle2, Info,
} from 'lucide-react'
import Image from 'next/image'
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
}

interface KelasDB {
  id: string; nama: string; warna: string; jenjang: string
}

interface KelasMapping {
  dari:        KelasDB
  ke:          KelasDB | null   // null = alumni
  jumlahSiswa: number
  siswaIds:    string[]
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
  keterangan:    'Reshuffle' | 'Tinggal Kelas'
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
  const [pemetaan,    setPemetaan]     = useState<PemetaanGroup[]>([])

  // Reshuffle
  const [reshuffleRows,      setReshuffleRows]      = useState<ReshuffleRow[]>([])
  const [showReshuffleTable, setShowReshuffleTable] = useState(false)
  const [showReshuffleModal, setShowReshuffleModal] = useState(false)
  const [pendingFile,        setPendingFile]        = useState<File | null>(null)
  const [isDragging,         setIsDragging]         = useState(false)
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
        .select('id, nama, tanggal_selesai')
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

    const kelasNamaMap = new Map(kelasList.map(k => [k.nama.trim(), k]))

    // Siswa aktif
    const { data: siswaData } = await supabase
      .from('siswa')
      .select('id, kelas_id')
      .eq('sekolah_id', sekolahId)
      .eq('status', 'aktif')
      .limit(2000)

    const siswaList = (siswaData ?? []) as { id: string; kelas_id: string }[]
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

    // Kelompokkan siswa per kelas
    const siswaByKelas = new Map<string, string[]>()
    for (const s of siswaList) {
      const list = siswaByKelas.get(s.kelas_id) ?? []
      list.push(s.id)
      siswaByKelas.set(s.kelas_id, list)
    }

    // Bangun pemetaan berdasarkan jenjang column (bukan parse nama)
    const groupMap = new Map<string, PemetaanGroup>()
    let alumniCount = 0

    for (const kelas of kelasList) {
      const siswaIds = siswaByKelas.get(kelas.id) ?? []
      if (siswaIds.length === 0) continue

      if (kelas.jenjang === maxLevel) {
        // Kelas tertinggi → alumni
        alumniCount += siswaIds.length
        const key = `${kelas.jenjang}-alumni`
        if (!groupMap.has(key)) groupMap.set(key, { fromJenjang: kelas.jenjang, toJenjang: null, kelas: [], totalSiswa: 0 })
        const grp = groupMap.get(key)!
        grp.kelas.push({ dari: kelas, ke: null, jumlahSiswa: siswaIds.length, siswaIds })
        grp.totalSiswa += siswaIds.length
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
        grp.kelas.push({ dari: kelas, ke: targetKelas, jumlahSiswa: siswaIds.length, siswaIds })
        grp.totalSiswa += siswaIds.length
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

      const kelasNamaMap = new Map(allKelas.map(k => [k.nama.trim().toUpperCase(), k]))
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

        const siswa        = siswaByNis.get(nis)
        const targetKelas  = kelasNamaMap.get(kelasBaru.toUpperCase())
        const currentKelas = siswa ? kelasById.get(siswa.kelas_id) : undefined

        let error: string | undefined
        if (!siswa)        error = `Siswa NIS "${nis}" tidak ditemukan`
        else if (!targetKelas) error = `Kelas "${kelasBaru}" tidak ditemukan`

        const keterangan: 'Reshuffle' | 'Tinggal Kelas' =
          currentKelas && targetKelas && currentKelas.id === targetKelas.id
            ? 'Tinggal Kelas'
            : 'Reshuffle'

        return {
          nama, nis,
          dariNama:    currentKelas?.nama ?? '—',
          keNama:      kelasBaru,
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
      const siswaToKelas = new Map<string, string | 'alumni'>()

      for (const grp of pemetaan) {
        for (const m of grp.kelas) {
          for (const sid of m.siswaIds) {
            siswaToKelas.set(sid, m.ke ? m.ke.id : 'alumni')
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

          if (row.keterangan === 'Tinggal Kelas') {
            // Tetap di kelas yang sama — ambil kelas asal
            if (row.dariKelasId) siswaToKelas.set(siswaId, row.dariKelasId)
          } else {
            // Reshuffle — pindah ke kelas tujuan
            if (row.keKelasId) siswaToKelas.set(siswaId, row.keKelasId)
          }
        }
      }

      // Update siswa naik kelas
      const siswaAktif   = [...siswaToKelas.entries()].filter(([, v]) => v !== 'alumni')
      const siswaAlumni  = [...siswaToKelas.entries()].filter(([, v]) => v === 'alumni')

      // Batch update siswa naik kelas (per kelas tujuan)
      const byKelas = new Map<string, string[]>()
      for (const [siswaId, kelasId] of siswaAktif) {
        const list = byKelas.get(kelasId as string) ?? []
        list.push(siswaId)
        byKelas.set(kelasId as string, list)
      }

      for (const [kelasId, siswaIds] of byKelas) {
        await supabase.from('siswa').update({ kelas_id: kelasId }).in('id', siswaIds)
      }

      // Update siswa → alumni
      if (siswaAlumni.length > 0) {
        const alumniIds = siswaAlumni.map(([id]) => id)
        await supabase.from('siswa').update({ status: 'alumni' }).in('id', alumniIds)
      }

      // Arsip tahun ajaran
      await supabase.from('tahun_ajaran')
        .update({ is_aktif: false })
        .eq('id', tahunAjaran.id)

      setExecuteDone(true)
    } catch (err) {
      setExecuteError('Terjadi kesalahan saat menjalankan proses. Coba lagi.')
      console.error(err)
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
        <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18,47,102,0.31)' }}>
          <ChevronsUp size={30} color="#ffffff" />
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

      {/* ── State 1 — Tahun ajaran belum selesai ─────────────────────────────── */}
      {pageState === 'state1' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8F0', borderLeft: '28px solid #1A2C4E', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', minHeight: 280 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={30} color="#94A3B8" />
          </div>
          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0F172A', marginBottom: 6 }}>
              Tahun ajaran belum selesai
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: 1.6 }}>
              Proses kenaikan kelas baru bisa dijalankan setelah tahun ajaran{' '}
              <strong>{tahunAjaran?.nama ?? '—'}</strong> berakhir pada{' '}
              <strong>{tahunAjaran ? formatTanggal(tahunAjaran.tanggal_selesai) : '—'}</strong>
            </div>
          </div>

          {/* Badge + CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1rem', borderRight: '1.5px solid #E2E8F0' }}>
              <Calendar size={15} color="#1A2C4E" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A2C4E', whiteSpace: 'nowrap' }}>
                {sisaHari === null ? '—' : sisaHari <= 0 ? 'Tahun ajaran telah berakhir' : `${sisaHari} hari lagi hingga tahun ajaran berakhir`}
              </span>
            </div>
            <button
              onClick={handleJalankanLebihAwal}
              style={{ padding: '0.65rem 1rem', background: 'transparent', border: 'none', fontSize: '0.85rem', fontWeight: 700, color: '#1A2C4E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
            >
              Jalankan lebih awal <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── State 2 — Proses kenaikan ─────────────────────────────────────────── */}
      {pageState === 'state2' && (
        <>
          {/* Done state */}
          {executeDone && (
            <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <CheckCircle2 size={22} color="#059669" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#065F46' }}>Kenaikan kelas berhasil dijalankan!</div>
                <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: 2 }}>Data siswa, status alumni, dan tahun ajaran telah diperbarui.</div>
              </div>
            </div>
          )}

          {/* Warning tunggakan */}
          {menunggak > 0 && !executeDone && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '0.875rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} color="#DC2626" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#991B1B' }}>
                  {menunggak} siswa masih memiliki tunggakan
                </div>
                <div style={{ fontSize: '0.8rem', color: '#B91C1C', marginTop: 2 }}>
                  Sebaiknya selesaikan tunggakan sebelum menjalankan proses kenaikan kelas.
                </div>
              </div>
              <a href="/tagihan/aktif" style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Lihat Daftar
              </a>
            </div>
          )}

          {/* Kondisi siswa — wrapper card */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8F0', borderLeft: '28px solid #1A2C4E', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 48, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <GraduationCap size={22} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', lineHeight: 1.2 }}>Kondisi siswa saat ini</div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500, marginTop: 2 }}>Pastikan semua data sudah siap sebelum menjalankan kenaikan kelas</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
              {/* Total siswa aktif */}
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '1rem 1.1rem', border: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Total siswa aktif</span>
                  <Users size={18} color="#94A3B8" />
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{totalAktif}</div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600, marginTop: 4 }}>Akan diproses</div>
              </div>

              {/* Menunggak */}
              <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '1rem 1.1rem', border: '1px solid #FECACA' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#B91C1C' }}>Menunggak</span>
                  <AlertTriangle size={18} color="#DC2626" />
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#DC2626', lineHeight: 1 }}>{menunggak}</div>
                <div style={{ fontSize: '0.72rem', color: '#B91C1C', fontWeight: 600, marginTop: 4 }}>Siswa perlu diselesaikan</div>
              </div>

              {/* Akan jadi alumni */}
              <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '1rem 1.1rem', border: '1px solid #BBF7D0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#065F46' }}>Akan jadi alumni</span>
                  <GraduationCap size={18} color="#16A34A" />
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16A34A', lineHeight: 1 }}>{akanAlumni}</div>
                <div style={{ fontSize: '0.72rem', color: '#065F46', fontWeight: 600, marginTop: 4 }}>
                  Siswa kelas tertinggi akan lulus
                </div>
              </div>
            </div>
          </div>

          {/* Pemetaan kelas */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>Pemetaan kelas</div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500, marginTop: 2 }}>
                  {showReshuffleTable ? 'Pemetaan dengan data reshuffle dari Excel' : 'Siswa naik satu tingkat dengan kelas yang sama'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {showReshuffleTable && (
                  <button
                    onClick={() => { setShowReshuffleTable(false); setReshuffleRows([]) }}
                    style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <X size={13} /> Hapus Reshuffle
                  </button>
                )}
                <button
                  onClick={() => { setShowReshuffleModal(true); setUploadError('') }}
                  style={{ background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#243D6A'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#1A2C4E'}
                >
                  <Upload size={13} /> Ada reshuffle? Upload Excel
                </button>
              </div>
            </div>

            {uploadError && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.875rem' }}>
                {uploadError}
              </div>
            )}

            {/* Tabel reshuffle */}
            {showReshuffleTable ? (
              <div style={{ border: '1px solid #F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', padding: '0 1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                    <thead>
                      <tr style={{ background: '#1A2C4E' }}>
                        {(['Nama', 'NIS', 'Dari', 'Ke', 'Keterangan'] as const).map((h, i, arr) => (
                          <th key={h} style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : undefined }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reshuffleRows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FAFBFF'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                        >
                          <td style={{ padding: '0.7rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.62rem', fontWeight: 800, color: '#fff' }}>
                                {getInitials(row.nama)}
                              </div>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>{row.nama}</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.7rem 1rem', fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>{row.nis}</td>
                          <td style={{ padding: '0.7rem 1rem' }}>
                            {row.error ? (
                              <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>{row.dariNama}</span>
                            ) : (
                              <span style={{ background: '#EEF2FF', color: '#4F46E5', borderRadius: 6, padding: '0.2rem 0.55rem', fontSize: '0.78rem', fontWeight: 700 }}>{row.dariNama}</span>
                            )}
                          </td>
                          <td style={{ padding: '0.7rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <ArrowRight size={13} color="#94A3B8" />
                              {row.error ? (
                                <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>{row.keNama}</span>
                              ) : (
                                <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: 6, padding: '0.2rem 0.55rem', fontSize: '0.78rem', fontWeight: 700 }}>{row.keNama}</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.7rem 1rem' }}>
                            {row.error ? (
                              <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 20, padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>Error: {row.error}</span>
                            ) : row.keterangan === 'Tinggal Kelas' ? (
                              <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 20, padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>Tinggal Kelas</span>
                            ) : (
                              <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: 20, padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>Reshuffle</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Pemetaan otomatis */
              <div style={{ border: '1px solid #F1F5F9', borderRadius: 10, overflow: 'hidden', maxHeight: 420, overflowY: 'auto' }}>
                {pemetaan.map((grp, gi) => (
                  <div key={gi}>
                    {/* Group header — sama persis dengan manajemen kelas */}
                    <div style={{ background: '#A3CDFE', width: '94%', borderRadius: 6, marginLeft: 20, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Image src="/icons/IconLayer.png" width={16} height={16} alt="" />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2C4E', position: 'relative', right: '37%' }}>
                        {grp.toJenjang === null
                          ? `Kelas ${grp.fromJenjang} → Alumni`
                          : `Kelas ${grp.fromJenjang} → Kelas ${grp.toJenjang}`}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A2C4E', opacity: 0.75 }}>
                        {grp.kelas.length} kelas · {grp.totalSiswa} siswa
                      </span>
                    </div>

                    {/* Individual kelas rows */}
                    {grp.kelas.map((m, mi) => (
                      <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.65rem 1rem', borderBottom: mi < grp.kelas.length - 1 ? '1px solid #F8FAFC' : undefined }}>
                        <span style={{ background: m.dari.warna + '22', color: m.dari.warna, borderRadius: 6, padding: '0.2rem 0.55rem', fontSize: '0.8rem', fontWeight: 700, minWidth: 36, textAlign: 'center' }}>
                          {m.dari.nama}
                        </span>
                        <span style={{ background: m.dari.warna + '22', color: m.dari.warna, borderRadius: 20, padding: '0.2rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {m.dari.nama} · {m.jumlahSiswa} siswa
                        </span>
                        <ArrowRight size={14} color="#94A3B8" style={{ flexShrink: 0 }} />
                        {m.ke ? (
                          <span style={{ background: m.ke.warna + '22', color: m.ke.warna, borderRadius: 20, padding: '0.2rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {m.ke.nama} · {m.jumlahSiswa} siswa
                          </span>
                        ) : (
                          <span style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 20, padding: '0.2rem 0.75rem', fontSize: '0.75rem', fontWeight: 600 }}>
                            Alumni ({m.jumlahSiswa} siswa)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ padding: '0.6rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, background: '#FAFAFA', borderTop: '1px solid #F1F5F9' }}>
                  ↓ Scroll untuk lihat semua kelas
                </div>
              </div>
            )}
          </div>

          {/* Execute error */}
          {executeError && (
            <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
              {executeError}
            </div>
          )}

          {/* Tombol jalankan */}
          {!executeDone && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleExecute}
                disabled={executing}
                style={{ background: executing ? '#94A3B8' : '#F59E0B', color: '#fff', border: 'none', borderRadius: 10, padding: '0.8rem 1.75rem', fontSize: '0.95rem', fontWeight: 800, cursor: executing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: executing ? 'none' : '0 4px 16px rgba(245,158,11,0.35)' }}
                onMouseEnter={e => { if (!executing) (e.currentTarget as HTMLButtonElement).style.background = '#D97706' }}
                onMouseLeave={e => { if (!executing) (e.currentTarget as HTMLButtonElement).style.background = '#F59E0B' }}
              >
                {executing ? 'Memproses...' : <>Jalankan Kenaikan Kelas <ArrowRight size={16} /></>}
              </button>
            </div>
          )}
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

    </div>
  )
}
