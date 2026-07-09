'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

const formatRp = (n: number) => 'Rp ' + (isNaN(n) || n < 0 ? 0 : n).toLocaleString('id-ID')
const formatInput = (val: string) => {
  const digits = val.replace(/\D/g, '')
  return digits ? parseInt(digits).toLocaleString('id-ID') : ''
}

// ── Metode pembayaran ─────────────────────────────────────────────────────────

type Method = 'qris' | 'bca' | 'bni' | 'bri' | 'mandiri' | 'cimb' | 'permata'

interface MethodOption {
  id:    Method
  label: string
  desc:  string
  color: string
}

const METHODS: MethodOption[] = [
  { id: 'qris',    label: 'QRIS',    desc: 'Semua e-wallet & m-banking',  color: '#DC2626' },
  { id: 'bca',     label: 'BCA',     desc: 'Virtual Account BCA',         color: '#005BAB' },
  { id: 'bni',     label: 'BNI',     desc: 'Virtual Account BNI',         color: '#F47920' },
  { id: 'bri',     label: 'BRI',     desc: 'Virtual Account BRI',         color: '#003DA5' },
  { id: 'mandiri', label: 'Mandiri', desc: 'Virtual Account Mandiri',     color: '#003087' },
  { id: 'cimb',    label: 'CIMB',    desc: 'Virtual Account CIMB Niaga',  color: '#C8102E' },
]

// ── Result dari API ───────────────────────────────────────────────────────────

type PaymentResult =
  | { type: 'qris'; qrUrl: string;   trxId: string }
  | { type: 'va';   paymentNo: string; bankName: string; expired?: string; trxId: string }

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  paymentToken:   string
  totalNominal:   number
  sisa:           number
  isFirstPayment: boolean
  namaSiswa:      string
  kelasNama:      string
  periode:        string
  items:          { nama_komponen: string; nominal: number }[]
}

// ── Komponen utama ────────────────────────────────────────────────────────────

export default function PaymentForm({
  paymentToken, totalNominal, sisa, isFirstPayment,
  namaSiswa, kelasNama, periode, items,
}: Props) {
  const [jenis, setJenis]           = useState<'lunas' | 'cicilan'>('lunas')
  const [inputCicilan, setInput]    = useState('')
  const [method, setMethod]         = useState<Method | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [result, setResult]         = useState<PaymentResult | null>(null)
  const [statusPaid, setStatusPaid] = useState(false)
  const [copied, setCopied]         = useState(false)

  // Derived: true selama result ada tapi belum dikonfirmasi lunas
  const polling = result !== null && !statusPaid

  const nomCicilanRaw = parseInt(inputCicilan.replace(/\D/g, '') || '0')
  const nominalBayar  = (!isFirstPayment || jenis === 'lunas') ? sisa : nomCicilanRaw

  const isValid = method !== null && nominalBayar > 0 &&
    (jenis === 'lunas' || !isFirstPayment
      ? nominalBayar === sisa
      : nomCicilanRaw > 0 && nomCicilanRaw < sisa)

  // ── Polling status setelah pembayaran dibuat ──────────────────────────────

  const checkStatus = useCallback(async () => {
    const res  = await fetch(`/api/payment/status?token=${paymentToken}`)
    const data = await res.json()
    if (data.status === 'lunas') {
      setStatusPaid(true)
    }
  }, [paymentToken])

  useEffect(() => {
    if (!result || statusPaid) return
    const id = setInterval(checkStatus, 5000)
    return () => clearInterval(id)
  }, [result, statusPaid, checkStatus])

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!isValid || loading) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/payment/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payment_token: paymentToken, nominal: nominalBayar, jenis, method }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Terjadi kesalahan. Silakan coba lagi.')
        return
      }
      setResult(data as PaymentResult)
    } catch {
      setError('Gagal menghubungi server. Periksa koneksi internet Anda.')
    } finally {
      setLoading(false)
    }
  }

  const copyVA = (no: string) => {
    navigator.clipboard.writeText(no)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Tampilan jika sudah lunas ─────────────────────────────────────────────

  if (statusPaid) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px #0000000f' }}>
        <div style={{ background: '#1A2C4E', padding: '1.25rem 1.5rem', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700 }}>
          STATUS PEMBAYARAN
        </div>
        <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, background: '#D1FAE5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2.5rem' }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A2C4E', marginBottom: 8 }}>Pembayaran Dikonfirmasi!</div>
          <div style={{ color: '#64748B', fontSize: '0.875rem' }}>
            Tagihan <strong>{namaSiswa}</strong> telah lunas. Terima kasih.
          </div>
        </div>
      </div>
    )
  }

  // ── Tampilan hasil: QRIS ──────────────────────────────────────────────────

  if (result?.type === 'qris') {
    return (
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px #0000000f' }}>
        <div style={{ background: '#1A2C4E', padding: '1.25rem 1.5rem' }}>
          <div style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Bayar dengan QRIS</div>
          <div style={{ color: '#fff', fontWeight: 800, marginTop: 4 }}>{namaSiswa} · {periode}</div>
        </div>
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          {result.qrUrl ? (
            <Image
              src={result.qrUrl}
              alt="QR Code Pembayaran"
              width={220}
              height={220}
              unoptimized
              style={{ borderRadius: 12, border: '2px solid #E2E8F0', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ width: 220, height: 220, borderRadius: 12, border: '2px dashed #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', color: '#94A3B8', fontSize: '0.85rem' }}>
              QR tidak tersedia
            </div>
          )}

          <div style={{ margin: '1.25rem 0 0.75rem', fontWeight: 800, fontSize: '1.3rem', color: '#1A2C4E' }}>
            {formatRp(nominalBayar)}
          </div>

          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '0.9rem', fontSize: '0.8rem', color: '#64748B', lineHeight: 1.7, textAlign: 'left', marginBottom: '1.25rem' }}>
            <strong style={{ color: '#374151' }}>Cara bayar:</strong><br />
            1. Buka aplikasi m-banking atau e-wallet Anda<br />
            2. Pilih menu <strong>Scan QR</strong><br />
            3. Arahkan kamera ke QR Code di atas<br />
            4. Konfirmasi pembayaran
          </div>

          <StatusIndicator polling={polling} />
        </div>
      </div>
    )
  }

  // ── Tampilan hasil: Virtual Account ──────────────────────────────────────

  if (result?.type === 'va') {
    return (
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px #0000000f' }}>
        <div style={{ background: '#1A2C4E', padding: '1.25rem 1.5rem' }}>
          <div style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Virtual Account {result.bankName}</div>
          <div style={{ color: '#fff', fontWeight: 800, marginTop: 4 }}>{namaSiswa} · {periode}</div>
        </div>
        <div style={{ padding: '1.5rem' }}>

          <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              Nomor Virtual Account
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: '1.35rem', color: '#1A2C4E', letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>
                {result.paymentNo}
              </span>
              <button
                onClick={() => copyVA(result.paymentNo)}
                style={{ padding: '0.4rem 0.85rem', background: copied ? '#D1FAE5' : '#EFF6FF', color: copied ? '#065F46' : '#1D4ED8', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {copied ? '✓ Disalin' : 'Salin'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '0.75rem 1rem', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10 }}>
            <span style={{ fontSize: '0.85rem', color: '#92400E', fontWeight: 600 }}>Total Transfer</span>
            <span style={{ fontWeight: 800, color: '#92400E' }}>{formatRp(nominalBayar)}</span>
          </div>

          {result.expired && (
            <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '1rem', textAlign: 'center' }}>
              Berlaku hingga: <strong style={{ color: '#64748B' }}>{result.expired}</strong>
            </div>
          )}

          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '0.9rem', fontSize: '0.8rem', color: '#64748B', lineHeight: 1.7, marginBottom: '1.25rem' }}>
            <strong style={{ color: '#374151' }}>Cara bayar:</strong><br />
            1. Buka aplikasi m-banking <strong>{result.bankName}</strong><br />
            2. Pilih menu <strong>Transfer → Virtual Account</strong><br />
            3. Masukkan nomor VA di atas<br />
            4. Pastikan nominal <strong>tepat {formatRp(nominalBayar)}</strong><br />
            5. Konfirmasi transaksi
          </div>

          <StatusIndicator polling={polling} />
        </div>
      </div>
    )
  }

  // ── Form utama: pilih nominal + metode ───────────────────────────────────

  return (
    <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px #0000000f' }}>

      {/* Header */}
      <div style={{ background: '#1A2C4E', padding: '1.5rem' }}>
        <div style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Tagihan Periode</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem' }}>{periode}</div>
        <div style={{ marginTop: '0.85rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#64748B', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nama Siswa</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{namaSiswa}</div>
          </div>
          <div>
            <div style={{ color: '#64748B', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Kelas</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{kelasNama}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem' }}>

        {/* Rincian */}
        {items.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.7rem', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Rincian Tagihan</div>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: '#374151', padding: '4px 0', borderBottom: i < items.length - 1 ? '1px dashed #F1F5F9' : 'none' }}>
                <span>{item.nama_komponen}</span>
                <span style={{ fontWeight: 600 }}>{formatRp(item.nominal)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#1A2C4E', marginTop: 8, paddingTop: 8, borderTop: '2px solid #E2E8F0', fontSize: '0.88rem' }}>
              <span>Total Tagihan</span>
              <span>{formatRp(totalNominal)}</span>
            </div>
          </div>
        )}

        {/* Sisa jika ada cicilan sebelumnya */}
        {!isFirstPayment && (
          <div style={{ background: '#FEF9C3', border: '1.5px solid #FDE047', borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.83rem', color: '#713F12', fontWeight: 600 }}>Sisa Pembayaran</span>
            <span style={{ fontWeight: 800, color: '#713F12' }}>{formatRp(sisa)}</span>
          </div>
        )}

        {/* Jenis pembayaran */}
        {isFirstPayment && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.7rem', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Jenis Pembayaran</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['lunas', 'cicilan'] as const).map(j => (
                <button key={j} onClick={() => { setJenis(j); setInput('') }}
                  style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: `2px solid ${jenis === j ? '#1A2C4E' : '#E2E8F0'}`, background: jenis === j ? '#1A2C4E' : '#F8FAFC', color: jenis === j ? '#fff' : '#64748B', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {j === 'lunas' ? 'Langsung Lunas' : 'Cicilan'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nominal */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.7rem', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Nominal Pembayaran</div>
          {(!isFirstPayment || jenis === 'lunas') ? (
            <div style={{ background: '#F8FAFC', border: '2px solid #E2E8F0', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A2C4E' }}>{formatRp(sisa)}</span>
              <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 600, background: '#E2E8F0', borderRadius: 6, padding: '2px 7px' }}>TERKUNCI</span>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#1A2C4E', fontWeight: 700, pointerEvents: 'none' }}>Rp</span>
                <input type="text" inputMode="numeric" value={inputCicilan}
                  onChange={e => setInput(formatInput(e.target.value))} placeholder="0"
                  style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: 10, border: '2px solid #E2E8F0', fontSize: '1rem', fontWeight: 700, color: '#1A2C4E', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: 4 }}>Maksimal {formatRp(sisa - 1)}</div>
            </>
          )}
        </div>

        {/* Pilih Metode */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.7rem', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Metode Pembayaran</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {METHODS.map(m => (
              <button key={m.id} onClick={() => setMethod(m.id)}
                style={{
                  padding: '0.65rem 0.4rem',
                  borderRadius: 10,
                  border: `2px solid ${method === m.id ? m.color : '#E2E8F0'}`,
                  background: method === m.id ? m.color + '12' : '#F8FAFC',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}>
                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: method === m.id ? m.color : '#1A2C4E' }}>{m.label}</div>
                <div style={{ fontSize: '0.62rem', color: '#94A3B8', marginTop: 2, lineHeight: 1.3 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.83rem', marginBottom: '1rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* Tombol bayar */}
        <button onClick={handleSubmit} disabled={!isValid || loading}
          style={{ width: '100%', padding: '0.9rem', background: isValid && !loading ? '#1A2C4E' : '#CBD5E1', color: '#fff', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: '1rem', cursor: isValid && !loading ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          {loading ? 'Memproses...' : `Bayar ${nominalBayar > 0 ? formatRp(nominalBayar) : ''}`}
        </button>

      </div>
    </div>
  )
}

// ── Komponen indikator status polling ────────────────────────────────────────

function StatusIndicator({ polling }: { polling: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.75rem', background: '#F8FAFC', borderRadius: 10, fontSize: '0.78rem', color: '#64748B' }}>
      {polling
        ? '⏳ Menunggu konfirmasi pembayaran...'
        : 'Segarkan halaman jika status belum berubah setelah membayar.'}
    </div>
  )
}
