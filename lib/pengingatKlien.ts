import type { HasilPengingat, TampilanIngatkan } from './pengingat/tipe'

// Sisi klien antrean pengingat WhatsApp: memanggil /api/reminders dan
// /api/reminders/status. Tidak memuat aturan apa pun — siapa yang boleh diingatkan dan
// apa tampilan tombolnya sepenuhnya diputuskan server. Dipakai lib/usePengingat.

export type StatusPengingat = Record<string, TampilanIngatkan>

export type HasilKlien = { data: HasilPengingat; error: null } | { data: null; error: string }

// Sama dengan batas di kedua route
const MAKS_STATUS = 100
const MAKS_ANTRE  = 500
const BATAS_MS    = 15_000

type Ambil = typeof fetch

const potong = <T>(daftar: T[], ukuran: number): T[][] => {
  const hasil: T[][] = []
  for (let i = 0; i < daftar.length; i += ukuran) hasil.push(daftar.slice(i, i + ukuran))
  return hasil
}

async function panggil(ambil: Ambil, jalur: string, token: string, init: RequestInit = {}): Promise<HasilKlien> {
  try {
    const res = await ambil(jalur, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(BATAS_MS),
    })
    const isi = await res.json().catch(() => null) as { data?: HasilPengingat | null; error?: string | null } | null
    if (!res.ok || !isi?.data) return { data: null, error: isi?.error || 'Pengingat gagal diproses.' }
    return { data: isi.data, error: null }
  } catch {
    return { data: null, error: 'Tidak dapat terhubung ke server.' }
  }
}

const gabung = (hasil: HasilPengingat[]): HasilPengingat => ({
  aktif:  hasil.every(h => h.aktif),
  status: Object.assign({}, ...hasil.map(h => h.status)) as StatusPengingat,
})

/**
 * Tampilan tombol Ingatkan untuk `siswaIds`. Tanpa id hanya menjawab apakah sekolah ini
 * sudah memakai antrean. Daftar panjang dikirim per 100 id; potongan pertama dikirim
 * sendiri dulu — kalau sekolahnya belum memakai antrean, sisanya tidak perlu ditanyakan.
 */
export async function ambilStatusPengingat(siswaIds: string[], token: string, ambil: Ambil = fetch): Promise<HasilKlien> {
  const tanya = (ids: string[]) =>
    panggil(ambil, `/api/reminders/status${ids.length ? `?siswa_ids=${ids.join(',')}` : ''}`, token)

  const [pertama, ...sisa] = potong([...new Set(siswaIds)], MAKS_STATUS)
  const awal = await tanya(pertama ?? [])
  if (awal.error !== null || !awal.data.aktif || sisa.length === 0) return awal

  const lain = await Promise.all(sisa.map(tanya))
  const galat = lain.find(h => h.error !== null)
  if (galat) return galat
  return { data: gabung([awal.data, ...lain.map(h => h.data as HasilPengingat)]), error: null }
}

/**
 * Masukkan pengingat ke antrean. Tidak ada pesan yang langsung terkirim: balasannya
 * tampilan tombol terbaru tiap siswa — "mengirim" untuk yang masuk antrean, dan tetap
 * "ingatkan" untuk yang ditahan aturan (mis. wali berhenti berlangganan).
 */
export async function mintaPengingat(siswaIds: string[], token: string, ambil: Ambil = fetch): Promise<HasilKlien> {
  const hasil: HasilPengingat[] = []
  for (const ids of potong([...new Set(siswaIds)], MAKS_ANTRE)) {
    const h = await panggil(ambil, '/api/reminders', token, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ siswa_ids: ids }),
    })
    if (h.error !== null) return h
    hasil.push(h.data)
    if (!h.data.aktif) break
  }
  if (hasil.length === 0) return { data: null, error: 'Tidak ada siswa yang dipilih.' }
  return { data: gabung(hasil), error: null }
}
