// Catatan tindak lanjut di profil siswa (Draft Pengembangan Fitur Laporan, P2):
// alasan singkat kenapa siswa menunggak. Kelak menjadi bahan insight AI (SPK).
// Nilai kunci harus sama persis dengan CHECK constraint kolom
// catatan_tindak_lanjut.alasan di database.

export const ALASAN_TINDAK_LANJUT = {
  lupa:             'Lupa',
  kendala_ekonomi:  'Kendala ekonomi',
  sengketa_tagihan: 'Sengketa tagihan',
  pindah_sekolah:   'Pindah sekolah',
  lainnya:          'Lainnya',
} as const

export type AlasanTindakLanjut = keyof typeof ALASAN_TINDAK_LANJUT

export const URUTAN_ALASAN = Object.keys(ALASAN_TINDAK_LANJUT) as AlasanTindakLanjut[]

/** Batas panjang catatan — sama dengan CHECK constraint di database */
export const MAKS_CATATAN = 500

/** Tabel yang belum dibuat (SQL belum dijalankan) — ditampilkan sebagai petunjuk, bukan galat */
export const tabelBelumAda = (e: { code?: string; message?: string } | null): boolean =>
  !!e && (e.code === 'PGRST205' || e.code === '42P01' || (e.message ?? '').includes('Could not find the table'))
