import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { selisihHari } from './metrikLaporan'

// Pengingat manual lewat wa.me, untuk sekolah yang belum memakai antrean. Jalur ini tidak
// tercatat di server, jadi waktu klik disimpan di localStorage browser ini (keputusan
// 3 Okt 2026) supaya tombolnya mengikuti cooldown yang sama dengan antrean: diklik
// tanggal 7 → "H-2", tanggal 8 → "H-1", tanggal 9 kembali "Ingatkan". Selama cooldown
// tombolnya terkunci. Catatannya tidak terlihat dari browser atau perangkat lain.
// Hanya untuk komponen 'use client'.

const KUNCI    = 'siku_pengingat_manual'
// Sama dengan cooldownHari bawaan antrean (lib/pengingat/konfig.ts, keputusan 1 Okt 2026).
// Tidak diimpor dari sana: modul itu membaca process.env saat dimuat dan khusus server.
const COOLDOWN = 2

/** siswa_id → waktu klik (ISO) */
type Catatan = Record<string, string>

// Dipakai kalau localStorage tidak bisa diakses (mode privat, diblokir): catatan bertahan
// sampai halaman ditutup
let cadangan = ''
const pendengar = new Set<() => void>()

const bacaMentah = (): string => {
  try { return localStorage.getItem(KUNCI) ?? cadangan } catch { return cadangan }
}

const urai = (mentah: string): Catatan => {
  try {
    const isi: unknown = JSON.parse(mentah || '{}')
    if (!isi || typeof isi !== 'object' || Array.isArray(isi)) return {}
    return Object.fromEntries(
      Object.entries(isi).filter((e): e is [string, string] => typeof e[1] === 'string'),
    )
  } catch {
    return {}
  }
}

/** Sisa hari kalender WIB sebelum boleh diingatkan lagi; 0 = sudah boleh */
const sisaHari = (waktuKlik: string | undefined, sekarang: Date): number => {
  if (!waktuKlik) return 0
  const klik = new Date(waktuKlik)
  if (Number.isNaN(klik.getTime())) return 0
  return Math.max(0, COOLDOWN - selisihHari(klik, sekarang))
}

const langganan = (ubah: () => void) => {
  pendengar.add(ubah)
  // Klik di tab lain ikut memperbarui tab ini
  window.addEventListener('storage', ubah)
  return () => {
    pendengar.delete(ubah)
    window.removeEventListener('storage', ubah)
  }
}

export interface PengingatManual {
  /** Sisa hari sebelum siswa ini boleh diingatkan lagi lewat wa.me; 0 = boleh */
  sisaCooldown: (siswaId: string) => number
  /** Catat bahwa siswa ini baru saja diingatkan lewat wa.me */
  catat: (siswaId: string) => void
}

/** `sekarang` = jam halaman, supaya "H-2" berganti "H-1" tanpa refresh saat tanggal berganti */
export function usePengingatManual(sekarang: Date): PengingatManual {
  const mentah  = useSyncExternalStore(langganan, bacaMentah, () => '')
  const catatan = useMemo(() => urai(mentah), [mentah])

  const sisaCooldown = useCallback(
    (siswaId: string) => sisaHari(catatan[siswaId], sekarang),
    [catatan, sekarang],
  )

  const catat = useCallback((siswaId: string) => {
    const kini = new Date()
    // Catatan yang cooldown-nya sudah lewat dibuang supaya isinya tidak menumpuk
    const masihBerlaku = Object.fromEntries(
      Object.entries(urai(bacaMentah())).filter(([, waktu]) => sisaHari(waktu, kini) > 0),
    )
    const baru = JSON.stringify({ ...masihBerlaku, [siswaId]: kini.toISOString() })
    cadangan = baru
    try { localStorage.setItem(KUNCI, baru) } catch { /* tetap ada di cadangan */ }
    pendengar.forEach(ubah => ubah())
  }, [])

  return { sisaCooldown, catat }
}
