import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { ambilStatusPengingat, mintaPengingat, type StatusPengingat } from './pengingatKlien'
import type { TampilanIngatkan } from './pengingat/tipe'

// Tombol "Ingatkan" di Dashboard, Tagihan Aktif, dan Laporan. Sekolah yang saklar
// antreannya menyala: klik hanya memasukkan pengingat ke antrean, dan tampilan tombol
// (Ingatkan / Mengirim… / Terkirim) datang dari server. Sekolah lain: `aktif` false, dan
// halaman tetap membuka wa.me seperti sebelumnya.
// Hanya untuk komponen 'use client'.

/**
 * Tampilan tombol satu siswa. Selain empat keadaan dari server:
 * - memuat : keadaannya belum diketahui (halaman baru dibuka)
 * - gagal  : permintaan terakhir tidak sampai ke server; boleh diklik lagi
 */
export type TampilanTombol = TampilanIngatkan | 'memuat' | 'gagal'

export interface Pengingat {
  /** null = belum diketahui; false = sekolah belum memakai antrean, tombol membuka wa.me */
  aktif:    boolean | null
  /** Hanya bermakna selama `aktif` true */
  tampilan: (siswaId: string) => TampilanTombol
  /** Masukkan pengingat ke antrean. Siswa yang tombolnya bukan "Ingatkan" dilewati. */
  ingatkan: (siswaIds: string[]) => Promise<void>
  /** Sisa hari cooldown siswa yang `terkirim` (untuk label "H-2"/"H-1"); 0 kalau tidak diketahui */
  sisaCooldown: (siswaId: string) => number
  /** true selama 3 detik sesudah "Mengirim…" berganti "Terkirim" di halaman ini */
  baruTerkirim: (siswaId: string) => boolean
}

// Spec: tampilan diperiksa ulang tiap 10–15 detik selama masih ada yang "Mengirim…"
const SELANG_POLLING_MS   = 12_000
const LAMA_TANDA_GAGAL_MS = 5_000
const LAMA_TANDA_TERKIRIM_MS = 3_000

const tokenSesi = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

const tanpa = (himpunan: ReadonlySet<string>, ids: string[]): ReadonlySet<string> => {
  const hasil = new Set(himpunan)
  for (const id of ids) hasil.delete(id)
  return hasil
}

/** `siswaIds` = siswa yang tombolnya sedang tampil di halaman (boleh berubah-ubah) */
export function usePengingat(siswaIds: string[]): Pengingat {
  const [aktif,   setAktif]   = useState<boolean | null>(null)
  const [status,  setStatus]  = useState<StatusPengingat>({})
  const [diminta, setDiminta] = useState<ReadonlySet<string>>(() => new Set())
  const [gagal,   setGagal]   = useState<ReadonlySet<string>>(() => new Set())
  const [sisa,    setSisa]    = useState<Record<string, number>>({})
  const [baru,    setBaru]    = useState<ReadonlySet<string>>(() => new Set())

  // Salinan status untuk dibaca dari callback tanpa membuatnya ikut berganti tiap status berubah
  const statusRef = useRef<StatusPengingat>({})
  const hidupRef  = useRef(true)
  useEffect(() => {
    hidupRef.current = true
    return () => { hidupRef.current = false }
  }, [])

  const catat = useCallback((statusBaru: StatusPengingat, sisaBaru: Record<string, number> = {}) => {
    if (!hidupRef.current) return
    // "Mengirim…" yang berganti "Terkirim" selagi halaman terbuka: tanda terkirim sebentar
    const barusan = Object.keys(statusBaru)
      .filter(id => statusRef.current[id] === 'mengirim' && statusBaru[id] === 'terkirim')
    statusRef.current = { ...statusRef.current, ...statusBaru }
    setStatus(statusRef.current)
    setSisa(s => ({ ...s, ...sisaBaru }))
    if (barusan.length > 0) {
      setBaru(b => new Set([...b, ...barusan]))
      setTimeout(() => { if (hidupRef.current) setBaru(b => tanpa(b, barusan)) }, LAMA_TANDA_TERKIRIM_MS)
    }
  }, [])

  // Identitas array berganti tiap render, isinya jarang — efek di bawah mengikuti isinya
  const kunci = useMemo(() => [...new Set(siswaIds)].sort().join(','), [siswaIds])

  // ── Tampilan awal untuk siswa yang belum diketahui ──────────────────────────
  useEffect(() => {
    if (aktif === false || !kunci) return
    const belumTahu = kunci.split(',').filter(id => !(id in statusRef.current))
    if (belumTahu.length === 0) return

    let batal = false
    const muat = async () => {
      const token = await tokenSesi()
      const hasil = token ? await ambilStatusPengingat(belumTahu, token) : null
      if (batal || !hidupRef.current) return
      // Antrean tidak bisa ditanya (sesi habis, tabelnya belum dibuat, server galat): jangan
      // biarkan tombolnya mati — kembali ke wa.me, cara yang selalu tersedia
      if (!hasil || hasil.error !== null) {
        // Dicatat supaya bisa dibedakan dari "sekolah ini memang belum memakai antrean"
        console.warn(`[pengingat] antrean tidak bisa ditanya, tombol memakai wa.me: ${hasil?.error ?? 'sesi login tidak ditemukan'}`)
        setAktif(a => a ?? false)
        return
      }
      setAktif(hasil.data.aktif)
      if (hasil.data.aktif) catat(hasil.data.status, hasil.data.sisaCooldown)
    }
    muat()
    return () => { batal = true }
  }, [kunci, aktif, catat])

  // ── Selama ada yang "Mengirim…", tanyakan lagi berkala ──────────────────────
  const adaMengirim = useMemo(
    () => kunci !== '' && kunci.split(',').some(id => status[id] === 'mengirim'),
    [kunci, status],
  )
  useEffect(() => {
    if (!aktif || !adaMengirim) return
    const selang = setInterval(async () => {
      const ids = kunci.split(',').filter(id => statusRef.current[id] === 'mengirim')
      if (ids.length === 0) return
      const token = await tokenSesi()
      if (!token) return
      const hasil = await ambilStatusPengingat(ids, token)
      if (hasil.error === null && hasil.data.aktif) catat(hasil.data.status, hasil.data.sisaCooldown)
    }, SELANG_POLLING_MS)
    return () => clearInterval(selang)
  }, [aktif, adaMengirim, kunci, catat])

  const ingatkan = useCallback(async (ids: string[]) => {
    const sasaran = [...new Set(ids)].filter(id => statusRef.current[id] === 'ingatkan')
    if (sasaran.length === 0) return

    setDiminta(d => new Set([...d, ...sasaran]))
    setGagal(g => tanpa(g, sasaran))
    const token = await tokenSesi()
    const hasil = token ? await mintaPengingat(sasaran, token) : null
    if (!hidupRef.current) return
    setDiminta(d => tanpa(d, sasaran))

    if (!hasil || hasil.error !== null) {
      setGagal(g => new Set([...g, ...sasaran]))
      setTimeout(() => { if (hidupRef.current) setGagal(g => tanpa(g, sasaran)) }, LAMA_TANDA_GAGAL_MS)
      return
    }
    // Saklar sekolah dimatikan sesudah halaman dibuka: tombol kembali membuka wa.me
    if (!hasil.data.aktif) { setAktif(false); return }
    catat(hasil.data.status, hasil.data.sisaCooldown)
  }, [catat])

  const tampilan = useCallback((siswaId: string): TampilanTombol => {
    if (diminta.has(siswaId)) return 'mengirim'
    if (gagal.has(siswaId)) return 'gagal'
    return status[siswaId] ?? 'memuat'
  }, [diminta, gagal, status])

  const sisaCooldown = useCallback((siswaId: string) => sisa[siswaId] ?? 0, [sisa])
  const baruTerkirim = useCallback((siswaId: string) => baru.has(siswaId), [baru])

  return { aktif, tampilan, ingatkan, sisaCooldown, baruTerkirim }
}
