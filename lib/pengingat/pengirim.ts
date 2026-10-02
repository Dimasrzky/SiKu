import type { ProviderWa } from './tipe'

// Pengirim pesan WhatsApp. Worker hanya mengenal interface MessageSender, jadi pindah dari
// Fonnte ke WhatsApp Business API cukup menambah satu implementasi (bagian 12 spec).
// Khusus server — token penyedia tidak boleh sampai ke browser.

export interface HasilKirim {
  /** true = diterima penyedia. Untuk Fonnte artinya masuk antreannya, belum tentu sampai ke wali. */
  ok:      boolean
  alasan:  string | null
  /** Respons mentah penyedia, disimpan di reminder_job.provider_response */
  respons: unknown
}

/**
 * - terhubung       : boleh mengirim
 * - terputus        : penyedia menjawab jelas bahwa device/token tidak bisa dipakai
 * - tidak_diketahui : penyedia tidak bisa dihubungi atau jawabannya tidak terbaca
 */
export type KeadaanDevice = 'terhubung' | 'terputus' | 'tidak_diketahui'

export interface StatusDevice {
  keadaan: KeadaanDevice
  alasan:  string | null
  respons: unknown
}

export interface MessageSender {
  /** Satu pesan ke satu nomor (format 62xxx) — tidak pernah banyak tujuan dalam satu request */
  kirim(nomor: string, pesan: string): Promise<HasilKirim>
  cekDevice(): Promise<StatusDevice>
}

// ── Fonnte ───────────────────────────────────────────────────────────────────
// Endpoint dan bentuk respons dari docs.fonnte.com (dicek 1 Okt 2026):
// - POST /send   → { status: true, detail, id, process, target } | { status: false, reason }
// - POST /device → { status: true, device_status: 'connect' | 'disconnect', quota, ... }

const FONNTE_URL     = 'https://api.fonnte.com'
const BATAS_KIRIM_MS = 10_000
const BATAS_CEK_MS   = 8_000

type Ambil = typeof fetch

/** Panggil Fonnte dan baca JSON-nya. `json` null berarti tidak terjangkau atau jawabannya bukan JSON. */
async function panggilFonnte(
  ambil: Ambil, jalur: string, token: string, batasMs: number, isi?: FormData,
): Promise<{ json: Record<string, unknown> | null; galat: string | null }> {
  try {
    const res  = await ambil(`${FONNTE_URL}${jalur}`, {
      method:  'POST',
      headers: { Authorization: token },
      body:    isi,
      signal:  AbortSignal.timeout(batasMs),
    })
    const mentah = await res.text()
    try {
      const json = JSON.parse(mentah) as unknown
      if (json && typeof json === 'object' && !Array.isArray(json)) return { json: json as Record<string, unknown>, galat: null }
    } catch { /* bukan JSON — ditangani di bawah */ }
    return { json: null, galat: `Fonnte menjawab HTTP ${res.status} dengan isi yang tidak terbaca` }
  } catch (e) {
    const batasLewat = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
    return { json: null, galat: batasLewat ? `Fonnte tidak menjawab dalam ${batasMs / 1000} detik` : 'Fonnte tidak bisa dihubungi' }
  }
}

const teks = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function fonnteSender(token: string, ambil: Ambil = fetch): MessageSender {
  return {
    async kirim(nomor, pesan) {
      // Hanya target dan message. Parameter delay/schedule bawaan Fonnte sengaja tidak
      // dipakai — jeda antar pesan sepenuhnya diatur worker.
      const isi = new FormData()
      isi.append('target', nomor)
      isi.append('message', pesan)

      const { json, galat } = await panggilFonnte(ambil, '/send', token, BATAS_KIRIM_MS, isi)
      if (!json) return { ok: false, alasan: galat, respons: { galat } }
      if (json.status === true) return { ok: true, alasan: null, respons: json }
      return { ok: false, alasan: teks(json.reason) ?? teks(json.detail) ?? 'Fonnte menolak pesan tanpa alasan', respons: json }
    },

    async cekDevice() {
      const { json, galat } = await panggilFonnte(ambil, '/device', token, BATAS_CEK_MS)
      if (!json) return { keadaan: 'tidak_diketahui', alasan: galat, respons: { galat } }
      if (json.status !== true) {
        return { keadaan: 'terputus', alasan: teks(json.reason) ?? 'Fonnte menolak token device', respons: json }
      }
      if (json.device_status === 'connect') return { keadaan: 'terhubung', alasan: null, respons: json }
      return { keadaan: 'terputus', alasan: 'device terputus', respons: json }
    },
  }
}

// ── Uji ──────────────────────────────────────────────────────────────────────

/**
 * Pengirim untuk mencoba antrean tanpa mengirim apa pun (wa_sender.provider = 'uji').
 * Job tetap ditandai terkirim, jadi cooldown dan batas bulanannya ikut berjalan.
 */
export function ujiSender(): MessageSender {
  return {
    async kirim() {
      return { ok: true, alasan: null, respons: { uji: true, catatan: 'Pengirim uji: pesan tidak benar-benar dikirim.' } }
    },
    async cekDevice() {
      return { keadaan: 'terhubung', alasan: null, respons: { uji: true } }
    },
  }
}

/** Pengirim untuk sebuah wa_sender.provider, atau alasan kenapa belum bisa dipakai */
export function buatPengirim(
  provider: ProviderWa, env: Record<string, string | undefined> = process.env,
): MessageSender | { galat: string } {
  if (provider === 'uji') return ujiSender()
  if (provider === 'fonnte') {
    const token = env.FONNTE_TOKEN?.trim()
    return token ? fonnteSender(token) : { galat: 'FONNTE_TOKEN belum diisi' }
  }
  return { galat: `Pengirim "${provider}" belum tersedia` }
}
