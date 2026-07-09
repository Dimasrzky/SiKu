import crypto from 'crypto'

const VA       = process.env.IPAYMU_VA!
const API_KEY  = process.env.IPAYMU_API_KEY!
const BASE_URL = process.env.IPAYMU_BASE_URL!

// iPaymu signature: HMAC-SHA256("POST:{VA}:{SHA256(body_lowercase)}:{API_KEY}", API_KEY)
function buildSignature(body: object): string {
  const bodyStr  = JSON.stringify(body).toLowerCase()
  const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex')
  const toSign   = `POST:${VA}:${bodyHash}:${API_KEY}`
  return crypto.createHmac('sha256', API_KEY).update(toSign).digest('hex')
}

function buildTimestamp(): string {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
}

async function postIpaymu(endpoint: string, body: object) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'va':           VA,
      'signature':    buildSignature(body),
      'timestamp':    buildTimestamp(),
    },
    body: JSON.stringify(body),
  })
  return res.json()
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
  success:  boolean
  trxId?:   string
  qrUrl?:   string   // URL gambar QR dari iPaymu
  error?:   string
}

export async function createQrisPayment(params: DirectPaymentBase): Promise<QrisResult> {
  try {
    const body = {
      name:        params.productName,
      nominal:     params.nominal,
      comments:    params.productName,
      referenceId: params.referenceId,
      notifyUrl:   params.notifyUrl,
      buyerName:   params.buyerName,
      buyerPhone:  params.buyerPhone,
    }
    const json = await postIpaymu('/payment/qris', body)
    if (json.Status !== 200) {
      return { success: false, error: json.Message ?? 'Gagal membuat QRIS.' }
    }
    return {
      success: true,
      trxId:   json.Data?.TransactionId?.toString(),
      qrUrl:   json.Data?.QRUrl ?? json.Data?.Qr,
    }
  } catch {
    return { success: false, error: 'Gagal menghubungi iPaymu.' }
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
  paymentNo?: string  // nomor VA
  bankName?:  string
  expired?:   string
  error?:     string
}

export async function createVAPayment(
  params: DirectPaymentBase & { channel: VAChannel }
): Promise<VAResult> {
  try {
    const body = {
      name:        params.productName,
      nominal:     params.nominal,
      comments:    params.productName,
      referenceId: params.referenceId,
      notifyUrl:   params.notifyUrl,
      channel:     params.channel,
      buyerName:   params.buyerName,
      buyerPhone:  params.buyerPhone,
    }
    const json = await postIpaymu('/payment/va', body)
    if (json.Status !== 200) {
      return { success: false, error: json.Message ?? 'Gagal membuat Virtual Account.' }
    }
    return {
      success:   true,
      trxId:     json.Data?.TransactionId?.toString(),
      paymentNo: json.Data?.PaymentNo,
      bankName:  json.Data?.PaymentName ?? VA_BANKS[params.channel],
      expired:   json.Data?.Expired,
    }
  } catch {
    return { success: false, error: 'Gagal menghubungi iPaymu.' }
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

export function isCallbackSuccess(p: IpaymuCallbackPayload): boolean {
  return p.status_code === '1' || p.status?.toLowerCase() === 'berhasil'
}

export function resolveMetode(channel?: string): string {
  const ch = (channel ?? '').toLowerCase()
  if (ch.includes('qris'))                         return 'qris'
  if (ch.includes('va') || ch.includes('virtual')) return 'va'
  return 'qris'
}
