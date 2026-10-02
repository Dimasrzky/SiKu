import type { KonfigPengingat } from './konfig'

// Batas waktu kalender WIB untuk aturan pengingat (cooldown, batas harian, batas
// bulanan) dan jendela kirim. Semuanya dihitung per tanggal WIB, bukan per 24 jam: pesan
// yang dikirim tanggal 7 pukul 16.00 dan pukul 08.00 sama-sama "dikirim tanggal 7".

// WIB = UTC+7 sepanjang tahun (tanpa daylight saving), jadi selisihnya tetap
const SELISIH_WIB_MS = 7 * 60 * 60 * 1000

/** Hari (1 = Senin … 7 = Minggu) dan menit sejak 00.00, menurut jam WIB */
export function hariDanMenitWIB(d: Date): { hari: number; menit: number } {
  const w = new Date(d.getTime() + SELISIH_WIB_MS)
  return { hari: w.getUTCDay() === 0 ? 7 : w.getUTCDay(), menit: w.getUTCHours() * 60 + w.getUTCMinutes() }
}

const HARI_JUMAT = 5

/**
 * Boleh mengirim sekarang? Hanya pada hari kirim, di dalam jendela kirim (batas akhir
 * tidak ikut: 17.00 tepat sudah di luar), dan di luar jeda Jumatan.
 */
export function dalamJendelaKirim(d: Date, konfig: KonfigPengingat): boolean {
  const { hari, menit } = hariDanMenitWIB(d)
  if (!konfig.hariKirim.includes(hari)) return false
  if (menit < konfig.jendelaKirim.mulai || menit >= konfig.jendelaKirim.selesai) return false
  const jeda = konfig.jedaJumat
  return !(hari === HARI_JUMAT && jeda && menit >= jeda.mulai && menit < jeda.selesai)
}

/**
 * Waktu paling cepat pengiriman boleh berjalan: `d` sendiri kalau sekarang sudah di dalam
 * jendela, selain itu pembukaan berikutnya — awal jendela pada hari kirim berikutnya,
 * atau akhir jeda Jumatan.
 */
export function bukaBerikutnya(d: Date, konfig: KonfigPengingat): Date {
  if (dalamJendelaKirim(d, konfig)) return d
  // Paling jauh tujuh hari ke depan: hari kirim berikutnya pasti ada di dalamnya
  for (let geser = 0; geser <= 7; geser++) {
    const awalHari = awalHariWIB(d, geser).getTime()
    const calon = [konfig.jendelaKirim.mulai, ...(konfig.jedaJumat ? [konfig.jedaJumat.selesai] : [])]
      .map(menit => new Date(awalHari + menit * 60_000))
      .filter(c => c.getTime() > d.getTime() && dalamJendelaKirim(c, konfig))
      .sort((a, b) => a.getTime() - b.getTime())
    if (calon.length > 0) return calon[0]
  }
  return d
}

/** Dua waktu jatuh pada tanggal WIB yang sama */
export const samaTanggalWIB = (a: Date, b: Date): boolean => awalHariWIB(a).getTime() === awalHariWIB(b).getTime()

/** Pukul 00.00 WIB pada tanggal `d`, digeser `geserHari` hari kalender */
export function awalHariWIB(d: Date, geserHari = 0): Date {
  const w = new Date(d.getTime() + SELISIH_WIB_MS)
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() + geserHari) - SELISIH_WIB_MS)
}

/** Pukul 00.00 WIB tanggal 1 pada bulan `d` */
export function awalBulanWIB(d: Date): Date {
  const w = new Date(d.getTime() + SELISIH_WIB_MS)
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), 1) - SELISIH_WIB_MS)
}

/** Bulan (1–12) dan tahun kalender menurut tanggal WIB */
export function bulanTahunWIB(d: Date): { bulan: number; tahun: number } {
  const w = new Date(d.getTime() + SELISIH_WIB_MS)
  return { bulan: w.getUTCMonth() + 1, tahun: w.getUTCFullYear() }
}

/**
 * Awal masa cooldown: pesan yang terkirim pada atau sesudah waktu ini masih menahan
 * pengingat berikutnya. Cooldown 2 hari berarti hari ini dan kemarin — dikirim
 * tanggal 7, boleh lagi tanggal 9.
 */
export const awalCooldownWIB = (sekarang: Date, cooldownHari: number): Date =>
  awalHariWIB(sekarang, 1 - cooldownHari)
