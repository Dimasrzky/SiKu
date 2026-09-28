import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { ambilSemua } from './ambilSemua'
import { gabungPembayaran, type KolomPembayaran } from './metrikLaporan'

// Data bersama halaman laporan di semua level drill-down. Tiap level hanya
// menyaring baris yang sama — rumusnya ada di lib/metrikLaporan, bukan di sini.
// Hanya untuk komponen 'use client'.

export interface TahunAjaranLaporan {
  id:                      string
  nama:                    string
  tanggal_mulai:           string
  tanggal_selesai:         string
  semester_ganjil_mulai:   string
  semester_ganjil_selesai: string
  semester_genap_mulai:    string
  semester_genap_selesai:  string
}

export interface TagihanItemLaporan {
  komponen_id:   string | null
  nama_komponen: string
  nominal:       number
  /** Nama hidup dari master komponen — null kalau komponennya sudah dihapus */
  komponen:      { nama: string } | null
}

export interface SiswaLaporan {
  status:    string | null
  nama:      string
  nis:       string | null
  no_wa:     string | null
  nama_wali: string | null
}

interface TagihanRawLaporan {
  id:            string
  siswa_id:      string
  /** Snapshot kelas saat tagihan dibuat — jenjang dan kelas dibaca dari sini,
   *  bukan dari kelas siswa sekarang yang sudah bergeser setelah naik kelas */
  kelas_id:      string | null
  total_nominal: number
  status:        'lunas' | 'belum_bayar' | 'cicilan'
  bulan:         number
  tahun:         number
  jatuh_tempo:   string | null
  payment_token: string | null
  siswa:         SiswaLaporan | null
  tagihan_item:  TagihanItemLaporan[]
}

export type TagihanLaporan = TagihanRawLaporan & { is_alumni: boolean } & KolomPembayaran

export interface KelasLaporan { id: string; nama: string; jenjang: string; warna: string | null }

interface PembayaranRaw { tagihan_id: string; jumlah: number; tanggal_bayar: string }

const TA_SELECT = 'id, nama, tanggal_mulai, tanggal_selesai, semester_ganjil_mulai, semester_ganjil_selesai, semester_genap_mulai, semester_genap_selesai'

/**
 * `siswaId` membatasi tagihan dan pembayaran ke satu siswa (level Siswa) — rumus
 * dan bentuk barisnya tetap sama, hanya jumlah data yang diambil lebih kecil.
 */
export function useDataLaporan(opsi: { siswaId?: string } = {}) {
  const { siswaId } = opsi
  const [sekolahId,     setSekolahId]     = useState('')
  const [namaSekolah,   setNamaSekolah]   = useState('')
  const [loading,       setLoading]       = useState(true)
  const [tagihanRaw,    setTagihanRaw]    = useState<TagihanRawLaporan[]>([])
  const [pembayaranRaw, setPembayaranRaw] = useState<PembayaranRaw[]>([])
  const [kelas,         setKelas]         = useState<Map<string, KelasLaporan>>(new Map())
  const [activeTA,      setActiveTA]      = useState<TahunAjaranLaporan | null>(null)
  const [archivedTAs,   setArchivedTAs]   = useState<TahunAjaranLaporan[]>([])
  // Satu titik waktu untuk semua metrik di halaman, supaya kartu, grafik, dan
  // ekspor yang dihitung di render berbeda tidak berselisih di pergantian hari
  const [sekarang] = useState(() => new Date())

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
      if (p?.sekolah_id) setSekolahId(p.sekolah_id as string)
    }
    init()
  }, [])

  useEffect(() => {
    if (!sekolahId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)

      // Tagihan dan pembayaran diambil bertahap sampai habis — .limit() tunggal bisa
      // diam-diam terpotong di batas Max rows PostgREST dan membuat semua metrik salah
      const [tagihanRes, pembRes, { data: kelasData }, { data: sekolahData }, { data: taAktif }, { data: taArsip }] = await Promise.all([
        ambilSemua<TagihanRawLaporan>((dari, sampai) => {
          let q = supabase.from('tagihan')
            .select('id, siswa_id, kelas_id, total_nominal, status, bulan, tahun, jatuh_tempo, payment_token, siswa:siswa_id(status, nama, nis, no_wa, nama_wali), tagihan_item(komponen_id, nama_komponen, nominal, komponen:komponen_id(nama))')
            .eq('sekolah_id', sekolahId)
          if (siswaId) q = q.eq('siswa_id', siswaId)
          return q.order('id').range(dari, sampai)
        }),
        ambilSemua<PembayaranRaw>((dari, sampai) => {
          let q = supabase.from('pembayaran')
            .select('tagihan_id, jumlah, tanggal_bayar')
            .eq('sekolah_id', sekolahId)
          if (siswaId) q = q.eq('siswa_id', siswaId)
          return q.order('id').range(dari, sampai)
        }),
        supabase.from('kelas').select('id, nama, jenjang, warna').eq('sekolah_id', sekolahId).limit(500),
        supabase.from('sekolah').select('nama').eq('id', sekolahId).maybeSingle(),
        supabase.from('tahun_ajaran').select(TA_SELECT).eq('sekolah_id', sekolahId).eq('is_aktif', true).maybeSingle(),
        supabase.from('tahun_ajaran').select(TA_SELECT).eq('sekolah_id', sekolahId).eq('is_aktif', false)
          .order('tanggal_mulai', { ascending: false }).limit(5),
      ])

      if (tagihanRes.error) console.error('[Laporan] gagal memuat tagihan:', tagihanRes.error)
      if (pembRes.error)    console.error('[Laporan] gagal memuat pembayaran:', pembRes.error)

      if (cancelled) return
      setTagihanRaw(tagihanRes.data)
      setPembayaranRaw(pembRes.data)
      setKelas(new Map(((kelasData ?? []) as KelasLaporan[]).map(k => [k.id, k])))
      setNamaSekolah((sekolahData as { nama?: string } | null)?.nama ?? '')
      setActiveTA((taAktif ?? null) as TahunAjaranLaporan | null)
      setArchivedTAs((taArsip ?? []) as TahunAjaranLaporan[])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [sekolahId, siswaId])

  // Tagihan + total pembayaran + tanggal bayar terakhir
  const rows = useMemo<TagihanLaporan[]>(
    () => gabungPembayaran(tagihanRaw.map(t => ({ ...t, is_alumni: t.siswa?.status === 'alumni' })), pembayaranRaw),
    [tagihanRaw, pembayaranRaw],
  )

  return { sekolahId, namaSekolah, loading, rows, kelas, activeTA, archivedTAs, sekarang }
}
