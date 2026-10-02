// Bentuk baris tabel antrean pengingat WhatsApp (wa_sender, reminder_job, wa_optout).
// Nilai tiap union harus sama persis dengan CHECK constraint kolomnya di database.

/** 'uji' tidak memanggil penyedia mana pun — pesan hanya dicatat, tidak dikirim */
export type ProviderWa = 'uji' | 'fonnte' | 'waba'

/** 'pause' = circuit breaker; antrean hanya jalan lagi setelah dibuka manual */
export type StatusSender = 'aktif' | 'pause' | 'nonaktif'

export type StatusJob = 'antre' | 'mengirim' | 'terkirim' | 'gagal' | 'dibatalkan'

export type SumberJob = 'otomatis' | 'manual'

/** 1 = otomatis (didahulukan), 2 = manual */
export type PrioritasJob = 1 | 2

/** Nomor/device pengirim — satu baris per nomor */
export interface WaSender {
  id:               string
  /** null = dipakai semua sekolah */
  sekolah_id:       string | null
  phone:            string
  provider:         ProviderWa
  status:           StatusSender
  pause_reason:     string | null
  paused_at:        string | null
  /** Hitungan harian; dinolkan saat tanggal WIB counter_reset_at berganti */
  sent_today:       number
  counter_reset_at: string | null
  /** Pesan sejak mini-istirahat terakhir */
  batch_count:      number
  fail_streak:      number
  last_jenjang:     string | null
  /** Paling cepat pesan berikutnya boleh dikirim — tempat jeda acak disimpan */
  next_send_at:     string
  /** Kunci worker: selama belum lewat, pemanggilan lain tidak boleh mengirim */
  locked_until:     string | null
  created_at:       string
  updated_at:       string
}

/** Satu pesan untuk satu siswa, dikirim ke nomor walinya */
export interface ReminderJob {
  id:                string
  wa_sender_id:      string
  sekolah_id:        string
  siswa_id:          string
  /** Tagihan yang tautannya dikirim; null kalau tagihannya sudah dihapus */
  tagihan_id:        string | null
  wali_phone:        string
  jenjang:           string
  source:            SumberJob
  /** Pengingat otomatis ke berapa hari sebelum jatuh tempo; null untuk manual */
  days_before:       number | null
  priority:          PrioritasJob
  status:            StatusJob
  cancel_reason:     string | null
  /** Teks final, dirender saat job dibuat */
  message:           string
  /** Total yang tertulis di pesan */
  total_tagihan:     number
  link_token:        string | null
  attempts:          number
  provider_response: unknown
  /** Bendahara yang menekan tombol; null untuk job otomatis */
  created_by:        string | null
  available_at:      string
  sent_at:           string | null
  created_at:        string
  updated_at:        string
}

/**
 * Tampilan tombol Ingatkan untuk satu siswa — sudah memperhitungkan job terakhirnya:
 * - nonaktif : belum ada tunggakan, atau nomor wali kosong/tidak sah
 * - ingatkan : boleh diklik
 * - mengirim : sudah di antrean ("Mengirim..."), tidak perlu diklik ulang
 * - terkirim : baru saja terkirim; kembali menjadi `ingatkan` setelah masa cooldown
 */
export type TampilanIngatkan = 'nonaktif' | 'ingatkan' | 'mengirim' | 'terkirim'

/** Isi `data` pada respons POST /api/reminders dan GET /api/reminders/status */
export interface HasilPengingat {
  /** false = sekolah belum memakai antrean; tombol Ingatkan tetap membuka wa.me */
  aktif:  boolean
  /** siswa_id → tampilan tombol */
  status: Record<string, TampilanIngatkan>
}

/** Nomor wali yang membalas STOP — berlaku untuk nomornya, bukan per sekolah */
export interface WaOptout {
  id:         string
  phone:      string
  sekolah_id: string | null
  created_at: string
  updated_at: string
}
