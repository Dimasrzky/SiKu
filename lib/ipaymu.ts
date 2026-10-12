import crypto from 'crypto'

const VA       = process.env.IPAYMU_VA!
const API_KEY  = process.env.IPAYMU_API_KEY!
const BASE_URL = process.env.IPAYMU_BASE_URL!

// iPaymu signature: HMAC-SHA256("POST:{VA}:{SHA256(rawBody)}:{API_KEY}", API_KEY)
function buildSignature(rawBody: string): string {
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex')
  const toSign   = `POST:${VA}:${bodyHash}:${API_KEY}`
  return crypto.createHmac('sha256', API_KEY).update(toSign).digest('hex')
}

function buildTimestamp(): string {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
}

async function postIpaymu(endpoint: string, body: object) {
  const url     = `${BASE_URL}${endpoint}`
  const rawBody = JSON.stringify(body)
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'va':           VA,
      'signature':    buildSignature(rawBody),
      'timestamp':    buildTimestamp(),
    },
    body: rawBody,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    console.error(`[iPaymu] Non-JSON (${res.status}) from ${endpoint}:`, text.slice(0, 300))
    throw new Error(`iPaymu ${res.status}: ${text.slice(0, 150)}`)
  }
}

// ── Parameter dasar untuk semua direct payment ────────────────────────────────

interface DirectPaymentBase {
  referenceId: string
  nominal:     number
  productName: string
  buyerName:   string
  buyerPhone:  string
  notifyUrl:   string
}

// ── QRIS ─────────────────────────────────────────────────────────────────────

export interface QrisResult {
  success: boolean
  trxId?:  string
  qrUrl?:  string
  error?:  string
}

export async function createQrisPayment(params: DirectPaymentBase): Promise<QrisResult> {
  try {
    const body = {
      name:           params.productName,
      nominal:        params.nominal,
      comments:       params.productName,
      referenceId:    params.referenceId,
      notifyUrl:      params.notifyUrl,
      paymentMethod:  'qris',
      paymentChannel: 'qris',
      buyerName:      params.buyerName,
      buyerEmail:     '',
      buyerPhone:     params.buyerPhone,
      expiredPayment: 24,
    }
    const json = await postIpaymu('/payment/direct', body)
    console.log('[iPaymu QRIS]', JSON.stringify(json))

    if (json.Status !== 200) {
      return { success: false, error: `iPaymu: ${json.Message ?? json.Status}` }
    }
    return {
      success: true,
      trxId:   json.Data?.TransactionId?.toString(),
      qrUrl:   json.Data?.QrUrl ?? json.Data?.QRUrl ?? json.Data?.Qr,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[iPaymu QRIS error]', msg)
    return { success: false, error: msg }
  }
}

// ── Virtual Account ───────────────────────────────────────────────────────────

export type VAChannel = 'bca' | 'bni' | 'bri' | 'mandiri' | 'cimb' | 'permata'

export const VA_BANKS: Record<VAChannel, string> = {
  bca:     'BCA',
  bni:     'BNI',
  bri:     'BRI',
  mandiri: 'Mandiri',
  cimb:    'CIMB Niaga',
  permata: 'Permata',
}

export interface VAResult {
  success:    boolean
  trxId?:     string
  paymentNo?: string
  bankName?:  string
  expired?:   string
  error?:     string
}

export async function createVAPayment(
  params: DirectPaymentBase & { channel: VAChannel }
): Promise<VAResult> {
  try {
    const body = {
      name:           params.productName,
      nominal:        params.nominal,
      comments:       params.productName,
      referenceId:    params.referenceId,
      notifyUrl:      params.notifyUrl,
      paymentMethod:  'va',
      paymentChannel: params.channel,
      buyerName:      params.buyerName,
      buyerEmail:     '',
      buyerPhone:     params.buyerPhone,
      expiredPayment: 24,
    }
    const json = await postIpaymu('/payment/direct', body)
    console.log('[iPaymu VA]', JSON.stringify(json))

    if (json.Status !== 200) {
      return { success: false, error: `iPaymu: ${json.Message ?? json.Status}` }
    }
    return {
      success:   true,
      trxId:     json.Data?.TransactionId?.toString(),
      paymentNo: json.Data?.PaymentNo,
      bankName:  json.Data?.PaymentName ?? VA_BANKS[params.channel],
      expired:   json.Data?.Expired,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[iPaymu VA error]', msg)
    return { success: false, error: msg }
  }
}

// ── Callback dari iPaymu ──────────────────────────────────────────────────────

export interface IpaymuCallbackPayload {
  trx_id:       string
  reference_id: string
  status:       string
  status_code:  string
  amount:       string
  fee?:         string
  channel?:     string
  buyer_name?:  string
  buyer_phone?: string
}

// Isi notifikasi tidak dipakai untuk menentukan status: route callback publik, jadi
// siapa pun bisa mengirim notifikasi palsu. Status ditanyakan langsung ke iPaymu.

/** Kode status transaksi iPaymu yang berarti uangnya sudah diterima: berhasil, berhasil belum settle, escrow */
const KODE_SUKSES = new Set([1, 6, 7])
/** Dibatalkan, refund, error, gagal */
const KODE_GAGAL  = new Set([2, 3, 4, 5])

export interface HasilCekTransaksi {
  /** null = iPaymu tidak bisa dihubungi atau jawabannya tidak terbaca; coba lagi nanti */
  status:      'sukses' | 'pending' | 'gagal' | 'kedaluwarsa' | null
  /** ReferenceId yang dicatat iPaymu untuk transaksi ini, kalau ikut dikirim */
  referenceId: string | null
  /** Nominal transaksi menurut iPaymu, kalau ikut dikirim */
  nominal:     number | null
}

/** Status transaksi menurut iPaymu sendiri, lewat permintaan yang ditandatangani API key kita */
export async function cekTransaksi(transactionId: string): Promise<HasilCekTransaksi> {
  try {
    const json = await postIpaymu('/transaction', { transactionId, account: VA })
    if (Number(json.Status) !== 200 || !json.Data) return { status: null, referenceId: null, nominal: null }

    const kode   = Number(json.Data.Status)
    const status = KODE_SUKSES.has(kode) ? 'sukses'
      : kode === -2           ? 'kedaluwarsa'
      : KODE_GAGAL.has(kode)  ? 'gagal'
      : 'pending'
    // Salah satu kolom nominal bisa berupa angka bersih sesudah fee, jadi yang dipakai
    // yang terbesar — nominal bruto transaksinya
    const angka = [json.Data.Amount, json.Data.SubTotal, json.Data.Total]
      .filter(v => v != null && v !== '')
      .map(Number)
      .filter(Number.isFinite)
    const referenceId = json.Data.ReferenceId != null ? String(json.Data.ReferenceId).trim() : ''
    return {
      status,
      referenceId: referenceId || null,
      nominal:     angka.length > 0 ? Math.max(...angka) : null,
    }
  } catch (err) {
    console.error('[iPaymu cek transaksi error]', err instanceof Error ? err.message : String(err))
    return { status: null, referenceId: null, nominal: null }
  }
}

export function resolveMetode(channel?: string): string {
  const ch = (channel ?? '').toLowerCase()
  if (ch.includes('qris'))                         return 'qris'
  // Virtual account = transfer bank; 'va' tidak diterima constraint pembayaran.metode
  if (ch.includes('va') || ch.includes('virtual')) return 'transfer'
  return 'qris'
}
