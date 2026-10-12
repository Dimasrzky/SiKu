import crypto from 'crypto'

// Session admin verifikasi pembayaran — terpisah dari Supabase Auth,
// karena kredensialnya hardcode di .env (bukan user Supabase).
export const ADMIN_SESSION_COOKIE = 'siku_admin_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 jam

let peringatanKunci = false

/**
 * Kunci tanda tangan sesi. ADMIN_SESSION_SECRET (acak, minimal 32 karakter) dipisah dari
 * password, supaya cookie sesi tidak bisa dipakai menebak password admin. Selama belum
 * diisi, password tetap dipakai agar login tidak terkunci saat rilis.
 */
function kunciSesi(): string {
  const rahasia = process.env.ADMIN_SESSION_SECRET?.trim()
  if (rahasia && rahasia.length >= 32) return rahasia
  if (!peringatanKunci) {
    peringatanKunci = true
    console.warn('[admin-auth] ADMIN_SESSION_SECRET belum diisi (minimal 32 karakter); sesi admin masih ditandatangani dengan password')
  }
  return process.env.ADMIN_PASSWORD ?? ''
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', kunciSesi()).update(payload).digest('hex')
}

export function createAdminSessionToken(): string {
  const payload = String(Date.now() + SESSION_TTL_MS)
  return `${payload}.${sign(payload)}`
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

  const expected = sign(payload)
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false

  const exp = Number(payload)
  return Number.isFinite(exp) && Date.now() < exp
}

export function checkAdminCredentials(email: string, password: string): boolean {
  const adminEmail    = process.env.ADMIN_EMAIL ?? ''
  const adminPassword = process.env.ADMIN_PASSWORD ?? ''
  if (!adminEmail || !adminPassword) return false

  const emailBuf     = Buffer.from(email)
  const adminEmailBuf = Buffer.from(adminEmail)
  const passBuf       = Buffer.from(password)
  const adminPassBuf  = Buffer.from(adminPassword)

  const emailMatch = emailBuf.length === adminEmailBuf.length && crypto.timingSafeEqual(emailBuf, adminEmailBuf)
  const passMatch  = passBuf.length === adminPassBuf.length && crypto.timingSafeEqual(passBuf, adminPassBuf)

  return emailMatch && passMatch
}
