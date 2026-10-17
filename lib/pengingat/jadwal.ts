// Hari pengingat otomatis yang dinyalakan atau dimatikan tiap sekolah lewat toggle di
// Pengaturan. Satu kolom boolean per hari di tabel pengaturan — bukan satu array — supaya
// dua toggle yang diklik berdekatan tidak saling menimpa.
//
// Dipakai cron (lib/pengingat/otomatis), halaman Pengaturan, dan modal "Ingatkan orang
// tua". Tanpa impor server, jadi aman untuk komponen 'use client'.

export const HARI_PENGINGAT = [
  { kolom: 'pengingat_h7', hari: 7 },
  { kolom: 'pengingat_h3', hari: 3 },
  { kolom: 'pengingat_h1', hari: 1 },
] as const

export type KolomHariPengingat = (typeof HARI_PENGINGAT)[number]['kolom']

export type BarisJadwalPengingat = Partial<Record<KolomHariPengingat, boolean | null>>

export const SELECT_JADWAL_PENGINGAT = HARI_PENGINGAT.map(h => h.kolom).join(', ')

/** Kolom yang belum ada atau kosong dianggap menyala — perilaku sebelum togglenya disambungkan */
const menyala = (baris: BarisJadwalPengingat | null | undefined, kolom: KolomHariPengingat): boolean =>
  baris?.[kolom] !== false

/** Posisi toggle tiap hari */
export const saklarHari = (baris?: BarisJadwalPengingat | null): Record<KolomHariPengingat, boolean> =>
  Object.fromEntries(HARI_PENGINGAT.map(h => [h.kolom, menyala(baris, h.kolom)])) as Record<KolomHariPengingat, boolean>

/** Berapa hari sebelum jatuh tempo pengingat otomatis dikirim, terjauh dulu */
export const jadwalPengingat = (baris?: BarisJadwalPengingat | null): number[] =>
  HARI_PENGINGAT.filter(h => menyala(baris, h.kolom)).map(h => h.hari)

/** [7, 3, 1] → "H-7, H-3, dan H-1"; [7, 1] → "H-7 dan H-1" */
export function sebutHari(jadwal: number[]): string {
  const nama = jadwal.map(h => `H-${h}`)
  if (nama.length <= 2) return nama.join(' dan ')
  return `${nama.slice(0, -1).join(', ')}, dan ${nama[nama.length - 1]}`
}
