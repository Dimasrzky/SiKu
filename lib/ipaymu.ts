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

export interface CreatePaymentParams {
  referenceId:  string
  nominal:      number
  productName:  string
  buyerName:    string
  buyerPhone:   string
  returnUrl:    string
  cancelUrl:    string
  notifyUrl:    string
}

export interface CreatePaymentResult {
  success:     boolean
  paymentUrl?: string
  trxId?:      string
  error?:      string
}

export async function createIpaymuPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
  const body = {
    product:     [params.productName],
    qty:         [1],
    price:       [params.nominal],
    description: [params.productName],
    returnUrl:   params.returnUrl,
    cancelUrl:   params.cancelUrl,
    notifyUrl:   params.notifyUrl,
    referenceId: params.referenceId,
    buyerName:   params.buyerName,
    buyerPhone:  params.buyerPhone,
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}/payment`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'va':           VA,
        'signature':    buildSignature(body),
        'timestamp':    buildTimestamp(),
      },
      body: JSON.stringify(body),
    })
  } catch {
    return { success: false, error: 'Gagal menghubungi iPaymu. Periksa koneksi server.' }
  }

  const json = await res.json()

  if (!res.ok || json.Status !== 200) {
    return { success: false, error: json.Message ?? 'Gagal membuat transaksi iPaymu.' }
  }

  return {
    success:    true,
    paymentUrl: json.Data?.PaymentUrl,
    trxId:      json.Data?.TransactionId?.toString(),
  }
}

// Payload yang dikirim iPaymu ke notifyUrl
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
  if (ch.includes('qris'))                      return 'qris'
  if (ch.includes('va') || ch.includes('virtual')) return 'va'
  return 'qris'
}
