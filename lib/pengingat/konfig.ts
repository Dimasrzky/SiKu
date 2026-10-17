// Angka pengiriman pengingat WhatsApp — bagian "Konfigurasi default" di Spesifikasi
// Antrean Pengingat WhatsApp (30 Sep 2026). Nilai bawaannya titik awal yang konservatif;
// tiap angka bisa diganti lewat env tanpa mengubah kode. Satu-satunya tempat angka ini ditulis.
//
// Tiga hal sengaja berbeda dari spec, mengikuti keputusan 1 Okt 2026:
// - pengingat otomatis dikirim H-7, H-3, dan H-1 (spec: pada hari jatuh tempo). Harinya
//   dinyalakan tiap sekolah di Pengaturan (lib/pengingat/jadwal.ts), bukan lewat env
// - cooldown 2 hari kalender per siswa (spec: 3 hari per wali), supaya H-3 → H-1 lolos
// - batas bulanan dihitung per siswa, karena satu pesan sekarang untuk satu siswa
//
// Hanya untuk server (route handler). Env tanpa NEXT_PUBLIC_ kosong di browser, jadi
// komponen 'use client' yang mengimpornya akan selalu mendapat nilai bawaan.

export interface RentangMenit {
  /** Menit sejak 00.00 WIB */
  mulai:   number
  selesai: number
}

export interface KonfigPengingat {
  /** SEND_WINDOW — pesan hanya dikirim di dalam rentang ini */
  jendelaKirim:         RentangMenit
  /** SEND_DAYS — 1 = Senin … 7 = Minggu */
  hariKirim:            number[]
  /** PAUSE_FRIDAY — jeda Jumatan; null = tidak dipakai */
  jedaJumat:            RentangMenit | null
  /** DELAY_MIN / DELAY_MAX — jeda acak antar pesan, detik */
  delayMinDetik:        number
  delayMaksDetik:       number
  /** BATCH_SIZE — jumlah pesan sebelum mini-istirahat */
  ukuranBatch:          number
  /** REST_MIN / REST_MAX — mini-istirahat, detik */
  istirahatMinDetik:    number
  istirahatMaksDetik:   number
  /** JENJANG_GAP_MIN / JENJANG_GAP_MAX — jeda antar jenjang, detik */
  jedaJenjangMinDetik:  number
  jedaJenjangMaksDetik: number
  /** MAX_PER_DAY — pesan per nomor pengirim per hari */
  maksPerHari:          number
  /** COOLDOWN_DAYS — hari kalender WIB per siswa: dikirim tanggal 7, boleh lagi tanggal 9 */
  cooldownHari:         number
  /** MAX_PER_MONTH — pesan per siswa per bulan kalender, termasuk yang otomatis */
  maksPerBulan:         number
  /** Pesan per nomor tujuan per hari — pengaman kalau satu nomor dipakai banyak siswa */
  maksPerNomorPerHari:  number
  /** MAX_FAIL_STREAK — gagal beruntun yang memicu circuit breaker */
  maksGagalBeruntun:    number
}

export const KONFIG_PENGINGAT_BAWAAN: KonfigPengingat = {
  jendelaKirim:         { mulai: 8 * 60, selesai: 17 * 60 },
  hariKirim:            [1, 2, 3, 4, 5],
  jedaJumat:            { mulai: 11 * 60 + 30, selesai: 13 * 60 },
  delayMinDetik:        40,
  delayMaksDetik:       120,
  ukuranBatch:          10,
  istirahatMinDetik:    3 * 60,
  istirahatMaksDetik:   6 * 60,
  jedaJenjangMinDetik:  15 * 60,
  jedaJenjangMaksDetik: 25 * 60,
  maksPerHari:          150,
  cooldownHari:         2,
  maksPerBulan:         4,
  maksPerNomorPerHari:  5,
  maksGagalBeruntun:    3,
}

type Env = Record<string, string | undefined>

/** Bilangan bulat ≥ `min`; selain itu undefined */
function bilangan(nilai: string | undefined, min: number): number | undefined {
  if (!nilai?.trim()) return undefined
  const n = Number(nilai.trim())
  return Number.isInteger(n) && n >= min ? n : undefined
}

/** "08:00-17:00" → menit sejak 00.00; undefined kalau formatnya salah atau mulai ≥ selesai */
function rentangJam(nilai: string | undefined): RentangMenit | undefined {
  // Tanda hubung biasa maupun en dash — tabel di spec memakai en dash
  const cocok = nilai?.trim().match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/)
  if (!cocok) return undefined
  const [jamA, menitA, jamB, menitB] = cocok.slice(1).map(Number)
  if (menitA > 59 || menitB > 59) return undefined
  const mulai   = jamA * 60 + menitA
  const selesai = jamB * 60 + menitB
  return mulai < selesai && selesai <= 24 * 60 ? { mulai, selesai } : undefined
}

/** "1,2,3,4,5" → bilangan bulat unik dalam [min, maks]; undefined kalau ada yang tidak sah */
function daftarBilangan(nilai: string | undefined, min: number, maks: number): number[] | undefined {
  if (!nilai?.trim()) return undefined
  const angka = nilai.split(',').map(s => (s.trim() ? Number(s.trim()) : NaN))
  if (angka.some(n => !Number.isInteger(n) || n < min || n > maks)) return undefined
  return [...new Set(angka)]
}

/**
 * Baca konfigurasi dari env. Nilai yang kosong memakai bawaan; nilai yang terisi tetapi
 * tidak sah dicatat di log server lalu bawaannya yang dipakai — salah ketik di env tidak
 * boleh diam-diam mengubah kecepatan kirim.
 *
 * Satuan env sama dengan tabel di spec: PENGINGAT_DELAY_* dalam detik, PENGINGAT_REST_*
 * dan PENGINGAT_JENJANG_GAP_* dalam menit.
 */
export function bacaKonfigPengingat(env: Env): KonfigPengingat {
  const B = KONFIG_PENGINGAT_BAWAAN

  const baca = <T>(nama: string, urai: (nilai: string | undefined) => T | undefined): T | undefined => {
    const hasil = urai(env[nama])
    if (hasil === undefined && env[nama]?.trim()) {
      console.warn(`[pengingat] ${nama} tidak sah, memakai nilai bawaan`)
    }
    return hasil
  }
  const angka = (nama: string, min: number) => baca(nama, v => bilangan(v, min))

  // `kali` mengubah satuan env ke detik. Min yang melebihi maks membatalkan keduanya.
  const pasangan = (
    namaMin: string, namaMaks: string, min: number, kali: number, bawaanMin: number, bawaanMaks: number,
  ): [number, number] => {
    const a = angka(namaMin, min)
    const b = angka(namaMaks, min)
    const hasil: [number, number] = [a === undefined ? bawaanMin : a * kali, b === undefined ? bawaanMaks : b * kali]
    if (hasil[0] <= hasil[1]) return hasil
    console.warn(`[pengingat] ${namaMin} lebih besar dari ${namaMaks}, memakai nilai bawaan`)
    return [bawaanMin, bawaanMaks]
  }

  const [delayMinDetik, delayMaksDetik] =
    pasangan('PENGINGAT_DELAY_MIN', 'PENGINGAT_DELAY_MAX', 1, 1, B.delayMinDetik, B.delayMaksDetik)
  const [istirahatMinDetik, istirahatMaksDetik] =
    pasangan('PENGINGAT_REST_MIN', 'PENGINGAT_REST_MAX', 1, 60, B.istirahatMinDetik, B.istirahatMaksDetik)
  const [jedaJenjangMinDetik, jedaJenjangMaksDetik] =
    pasangan('PENGINGAT_JENJANG_GAP_MIN', 'PENGINGAT_JENJANG_GAP_MAX', 0, 60, B.jedaJenjangMinDetik, B.jedaJenjangMaksDetik)

  // "off" mematikan jeda Jumatan
  const jedaJumat = env.PENGINGAT_PAUSE_FRIDAY?.trim().toLowerCase() === 'off'
    ? null
    : baca('PENGINGAT_PAUSE_FRIDAY', rentangJam) ?? B.jedaJumat

  return {
    jendelaKirim:        baca('PENGINGAT_SEND_WINDOW', rentangJam) ?? B.jendelaKirim,
    hariKirim:           baca('PENGINGAT_SEND_DAYS', v => daftarBilangan(v, 1, 7))?.sort((a, b) => a - b) ?? B.hariKirim,
    jedaJumat,
    delayMinDetik,
    delayMaksDetik,
    ukuranBatch:         angka('PENGINGAT_BATCH_SIZE', 1) ?? B.ukuranBatch,
    istirahatMinDetik,
    istirahatMaksDetik,
    jedaJenjangMinDetik,
    jedaJenjangMaksDetik,
    maksPerHari:         angka('PENGINGAT_MAX_PER_DAY', 1) ?? B.maksPerHari,
    cooldownHari:        angka('PENGINGAT_COOLDOWN_DAYS', 0) ?? B.cooldownHari,
    maksPerBulan:        angka('PENGINGAT_MAX_PER_MONTH', 1) ?? B.maksPerBulan,
    maksPerNomorPerHari: angka('PENGINGAT_MAX_PER_NUMBER_PER_DAY', 1) ?? B.maksPerNomorPerHari,
    maksGagalBeruntun:   angka('PENGINGAT_MAX_FAIL_STREAK', 1) ?? B.maksGagalBeruntun,
  }
}

export const KONFIG_PENGINGAT: KonfigPengingat = bacaKonfigPengingat(process.env)
