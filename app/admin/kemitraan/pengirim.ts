// Nomor pengirim WhatsApp bersama semua sekolah (wa_sender tanpa sekolah_id, lihat
// lib/pengingat/pembatas.ts → pilihSender), supaya admin tahu pesan benar-benar keluar.

/** null kalau nomor pengirim belum disiapkan */
export interface StatusPengirim {
  /** Nomor dengan awalan 62, tanpa tanda + */
  phone:       string
  provider:    'uji' | 'fonnte' | 'waba'
  status:      'aktif' | 'pause' | 'nonaktif'
  pauseReason: string | null
  /** FONNTE_TOKEN terisi di server (nilainya tidak pernah dikirim ke browser) */
  tokenAda:    boolean
}

/** "6282260400408" → "+62 822-6040-0408" */
export const formatNomor = (n: string) => {
  const lokal = n.replace(/^62/, '')
  return `+62 ${lokal.slice(0, 3)}-${lokal.slice(3, 7)}-${lokal.slice(7)}`
}

/** Apakah pesan benar-benar keluar, dan kalau tidak, kenapa */
export function bacaPengirim(p: StatusPengirim | null): { siap: boolean; teks: string } {
  if (!p) return { siap: false, teks: 'Nomor pengirim belum disiapkan di tabel wa_sender — pengingat tidak bisa diantrekan.' }
  if (p.status === 'nonaktif') return { siap: false, teks: 'Nomor pengirim dinonaktifkan — pengingat tidak bisa diantrekan.' }
  if (p.status === 'pause') return { siap: false, teks: `Pengiriman dihentikan sementara (circuit breaker)${p.pauseReason ? `: ${p.pauseReason}` : ''}. Buka lagi lewat SQL setelah device diperiksa.` }
  if (p.provider === 'uji') return { siap: false, teks: 'Masih mode uji — pesan hanya dicatat, tidak dikirim ke wali.' }
  if (p.provider === 'fonnte' && !p.tokenAda) return { siap: false, teks: 'FONNTE_TOKEN belum diisi di server — pesan akan gagal terkirim.' }
  return { siap: true, teks: 'Siap mengirim' }
}

export const namaProvider = (p: StatusPengirim['provider']) =>
  p === 'fonnte' ? 'Fonnte' : p === 'uji' ? 'Mode uji' : 'WABA'
