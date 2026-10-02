// Kabar untuk developer saat circuit breaker menghentikan antrean (bagian 7 spec:
// notifikasi ke developer, bukan ke bendahara). Khusus server.

const BATAS_MS = 8_000

/**
 * Kirim teks ke Telegram kalau TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID diisi; selalu
 * dicatat di log server. Tidak pernah melempar galat — gagal memberi kabar tidak boleh
 * menggagalkan penghentian antreannya.
 */
export async function beritahuDeveloper(
  isi: string,
  env: Record<string, string | undefined> = process.env,
  ambil: typeof fetch = fetch,
): Promise<void> {
  console.error(`[pengingat] ${isi}`)

  const token  = env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = env.TELEGRAM_CHAT_ID?.trim()
  if (!token || !chatId) return

  try {
    const res = await ambil(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text: isi }),
      signal:  AbortSignal.timeout(BATAS_MS),
    })
    if (!res.ok) console.error(`[pengingat] notifikasi Telegram ditolak (HTTP ${res.status})`)
  } catch {
    console.error('[pengingat] notifikasi Telegram gagal dikirim')
  }
}
