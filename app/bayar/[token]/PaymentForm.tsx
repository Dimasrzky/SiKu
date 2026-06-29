'use client'

import { useState } from 'react'

const formatRp = (n: number) => 'Rp ' + (isNaN(n) ? 0 : n).toLocaleString('id-ID')

interface Props {
  paymentToken:  string
  totalNominal:  number
  sisa:          number
  isFirstPayment: boolean
  namaSiswa:     string
  namaWali:      string
  kelasNama:     string
  periode:       string
  items:         { nama_komponen: string; nominal: number }[]
}

export default function PaymentForm({
  paymentToken, totalNominal, sisa, isFirstPayment,
  namaSiswa, kelasNama, periode, items,
}: Props) {
  const [jenis, setJenis]         = useState<'lunas' | 'cicilan'>('lunas')
  const [inputCicilan, setInput]  = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const nomCicilanRaw  = parseInt(inputCicilan.replace(/\D/g, '') || '0')
  const nominalBayar   = (!isFirstPayment || jenis === 'lunas') ? sisa : nomCicilanRaw

  const isValid = nominalBayar > 0 &&
    (jenis === 'lunas' || !isFirstPayment
      ? nominalBayar === sisa
      : nomCicilanRaw > 0 && nomCicilanRaw < sisa)

  const formatInput = (val: string) => {
    const digits = val.replace(/\D/g, '')
    return digits ? parseInt(digits).toLocaleString('id-ID') : ''
  }

  const handleSubmit = async () => {
    if (!isValid || loading) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/payment/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payment_token: paymentToken, nominal: nominalBayar, jenis }),
      })
      const data = await res.json()
      if (!res.ok || !data.paymentUrl) {
        setError(data.error ?? 'Terjadi kesalahan. Silakan coba lagi.')
        return
      }
      window.location.href = data.paymentUrl
    } catch {
      setError('Gagal menghubungi server. Periksa koneksi internet Anda.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px #0000000f' }}>

      {/* ── Header biru ─────────────────────────────────────── */}
      <div style={{ background: '#1A2C4E', padding: '1.5rem' }}>
        <div style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
          Tagihan Periode
        </div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>{periode}</div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#64748B', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nama Siswa</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{namaSiswa}</div>
          </div>
          <div>
            <div style={{ color: '#64748B', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Kelas</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{kelasNama}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.5rem' }}>

        {/* ── Rincian tagihan ───────────────────────────────── */}
        {items.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.72rem', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Rincian Tagihan
            </div>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#374151', padding: '5px 0', borderBottom: i < items.length - 1 ? '1px dashed #F1F5F9' : 'none' }}>
                <span>{item.nama_komponen}</span>
                <span style={{ fontWeight: 600 }}>{formatRp(item.nominal)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#1A2C4E', marginTop: 8, paddingTop: 8, borderTop: '2px solid #E2E8F0', fontSize: '0.9rem' }}>
              <span>Total Tagihan</span>
              <span>{formatRp(totalNominal)}</span>
            </div>
          </div>
        )}

        {/* ── Banner sisa (jika sudah ada cicilan sebelumnya) ── */}
        {!isFirstPayment && (
          <div style={{ background: '#FEF9C3', border: '1.5px solid #FDE047', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#713F12', fontWeight: 600 }}>Sisa Pembayaran</span>
            <span style={{ fontWeight: 800, color: '#713F12', fontSize: '1rem' }}>{formatRp(sisa)}</span>
          </div>
        )}

        {/* ── Pilih Lunas / Cicilan (hanya pembayaran pertama) ── */}
        {isFirstPayment && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.72rem', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Jenis Pembayaran
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['lunas', 'cicilan'] as const).map(j => (
                <button
                  key={j}
                  onClick={() => { setJenis(j); setInput('') }}
                  style={{
                    flex: 1, padding: '0.65rem', borderRadius: 10,
                    border:      `2px solid ${jenis === j ? '#1A2C4E' : '#E2E8F0'}`,
                    background:  jenis === j ? '#1A2C4E' : '#F8FAFC',
                    color:       jenis === j ? '#fff'    : '#64748B',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>
                  {j === 'lunas' ? 'Langsung Lunas' : 'Cicilan'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Nominal ──────────────────────────────────────── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.72rem', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            Nominal Pembayaran
          </div>

          {(!isFirstPayment || jenis === 'lunas') ? (
            <div style={{ background: '#F8FAFC', border: '2px solid #E2E8F0', borderRadius: 10, padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A2C4E' }}>{formatRp(sisa)}</span>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600, letterSpacing: 0.5, background: '#E2E8F0', borderRadius: 6, padding: '2px 8px' }}>TERKUNCI</span>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#1A2C4E', fontWeight: 700, fontSize: '0.9rem', pointerEvents: 'none' }}>Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputCicilan}
                  onChange={e => setInput(formatInput(e.target.value))}
                  placeholder="0"
                  style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.75rem', borderRadius: 10, border: '2px solid #E2E8F0', fontSize: '1rem', fontWeight: 700, color: '#1A2C4E', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 5 }}>
                Cicilan minimal Rp 1 · Maksimal {formatRp(sisa - 1)}
              </div>
            </>
          )}
        </div>

        {/* ── Error ────────────────────────────────────────── */}
        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* ── Tombol Bayar ─────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          style={{
            width:       '100%',
            padding:     '0.9rem',
            background:  isValid && !loading ? '#1A2C4E' : '#CBD5E1',
            color:       '#fff',
            borderRadius: 12,
            border:      'none',
            fontWeight:  800,
            fontSize:    '1rem',
            cursor:      isValid && !loading ? 'pointer' : 'not-allowed',
            fontFamily:  'inherit',
            transition:  'background 0.2s',
          }}>
          {loading ? 'Memproses...' : `Bayar ${formatRp(nominalBayar)}`}
        </button>

      </div>
    </div>
  )
}
