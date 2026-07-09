import crypto from 'crypto'

const VA      = '0000001256640452'
const API_KEY = 'SANDBOX0891A255-457D-42A1-8E79-010A1A5073E4'
const BASE_URL = 'https://sandbox.ipaymu.com/api/v2'

const body = {
  name:           'Test Tagihan',
  nominal:        10000,
  comments:       'Test',
  referenceId:    'TEST-001',
  notifyUrl:      'https://app.pakaisiku.id/api/payment/callback',
  paymentMethod:  'va',
  paymentChannel: 'bni',
  buyerName:      'Test Buyer',
  buyerEmail:     'test@example.com',
  buyerPhone:     '081234567890',
  expiredPayment: 24,
}

const rawBody   = JSON.stringify(body)
const lowerBody = rawBody.toLowerCase()
const ts        = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)

function sig(str) {
  const h = crypto.createHash('sha256').update(str).digest('hex')
  const s = `POST:${VA}:${h}:${API_KEY}`
  return { hash: h, toSign: s, sig: crypto.createHmac('sha256', API_KEY).update(s).digest('hex') }
}

const m1 = sig(rawBody)
const m2 = sig(lowerBody)

console.log('=== Method 1: hash original body ===')
console.log('bodyHash :', m1.hash)
console.log('toSign   :', m1.toSign.slice(0, 60) + '...')
console.log('signature:', m1.sig)

console.log('\n=== Method 2: hash lowercased body ===')
console.log('bodyHash :', m2.hash)
console.log('toSign   :', m2.toSign.slice(0, 60) + '...')
console.log('signature:', m2.sig)

console.log('\n=== Sending request (Method 2 — lowercase) ===')
console.log('timestamp:', ts)
console.log('body sent:', rawBody.slice(0, 100))

const res = await fetch(BASE_URL + '/payment/direct', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'va':           VA,
    'signature':    m2.sig,
    'timestamp':    ts,
  },
  body: rawBody,
})

const text = await res.text()
console.log('\n=== Response ===')
console.log('status:', res.status)
console.log('body  :', text.slice(0, 500))
