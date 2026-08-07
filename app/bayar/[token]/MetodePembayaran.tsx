'use client'

import { useEffect, useRef, useState } from 'react'
import { Wallet, Building2, CreditCard, QrCode, UploadCloud } from 'lucide-react'

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

interface Rekening {
  bank:      string
  noRek:     string
  atasNama:  string
}

interface Props {
  paymentToken: string
  totalNominal: number
  rekening:     Rekening | null
  onBack:       () => void
  onSubmitted:  () => void
}

const SOON_BADGE_BG = '#DC832C'

export default function MetodePembayaran({ paymentToken, totalNominal, rekening, onBack, onSubmitted }: Props) {
  const [file, setFile]               = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [dragOver, setDragOver]       = useState(false)
  const [copied, setCopied]           = useState(false)
  const [copiedNominal, setCopiedNominal] = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  const acceptFile = (f: File | null) => {
    if (!f) return
    if (!['image/jpeg', 'image/png'].includes(f.type)) {
      setError('Format file harus JPG atau PNG.')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Ukuran file maksimal 5MB.')
      return
    }
    setError('')
    setFile(f)
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(f)
    })
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files?.[0] ?? null)
  }

  const copyNoRek = () => {
    if (!rekening) return
    navigator.clipboard.writeText(rekening.noRek)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Angka polos tanpa "Rp"/titik ribuan agar bisa langsung ditempel ke kolom nominal m-banking
  const copyNominal = () => {
    navigator.clipboard.writeText(String(totalNominal))
    setCopiedNominal(true)
    setTimeout(() => setCopiedNominal(false), 2000)
  }

  const handleSubmit = async () => {
    if (!file || loading) return
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('payment_token', paymentToken)
      formData.append('bukti', file)
      const res  = await fetch('/api/bayar/konfirmasi', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Terjadi kesalahan. Silakan coba lagi.')
        return
      }
      onSubmitted()
    } catch {
      setError('Gagal menghubungi server. Periksa koneksi internet Anda.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 10px #21396B' }}>

        {/* Card header */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '2px solid #C1C6CF' }}>
          <div style={{ width: 50, height: 50, background: '#FEF3C7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={25} color="#D97706" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A2C4E' }}>Metode Pembayaran</div>
            <div style={{ fontSize: '0.8rem',fontWeight: 600, color: '#6F788A', marginTop: 1 }}>Total: {formatRp(totalNominal)}</div>
          </div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>

          {/* Pilihan metode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.25rem' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', border: '2px solid #1A2C4E', background: '#EFF6FF', borderRadius: 12 }}>
              <div style={{ width: 38, height: 38, background: '#1A2C4E', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={18} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0F172A' }}>Transfer Bank</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 1 }}>Kirim ke rekening sekolah lalu upload bukti</div>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
              </div>
            </div>

            {[
              { icon: CreditCard, title: 'Virtual Account', desc: 'Nomor rekening unik per transaksi' },
              { icon: QrCode,     title: 'Qris',             desc: 'Bayar dari semua e-wallet & mobile banking' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', border: '2px solid #E2E8F0', background: '#F8FAFC', borderRadius: 12, opacity: 0.75 }}>
                <div style={{ width: 38, height: 38, background: '#E2E8F0', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color="#94A3B8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#94A3B8' }}>{title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#B0B9C6', marginTop: 1 }}>{desc}</div>
                </div>
                <span style={{ background: SOON_BADGE_BG, color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  Segera Hadir
                </span>
              </div>
            ))}
          </div>

          {/* Rekening tujuan transfer */}
          <div style={{ border: '2px solid #BABFC7', borderRadius: 12, padding: '1rem 1.1rem', marginBottom: '1.25rem', boxShadow: '0 2px 8px #4353766d' }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1A2C4E', marginBottom: 10 }}>Rekening Tujuan Transfer</div>

            <RekeningRow label="Bank" value={rekening?.bank ?? '-'} />
            <RekeningRow
              label="Nomor rekening"
              value={rekening ? (rekening.noRek) : '-'}
              action={rekening && (
                <button onClick={copyNoRek} style={{ padding: '0.1rem 0.65rem', background: copied ? '#D1FAE5' : '#EFF6FF', color: copied ? '#065F46' : '#1D4ED8', border: '2px solid #A3CDFE', borderRadius: 7, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {copied ? 'Disalin' : 'Salin'}
                </button>
              )}
            />
            <RekeningRow label="Atas nama" value={rekening?.atasNama ?? '-'} />
            <RekeningRow
              label="Nominal transfer"
              value={formatRp(totalNominal)}
              bold last
              action={(
                <button onClick={copyNominal} style={{ padding: '0.1rem 0.65rem', background: copiedNominal ? '#D1FAE5' : '#EFF6FF', color: copiedNominal ? '#065F46' : '#1D4ED8', border: '2px solid #A3CDFE', borderRadius: 7, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {copiedNominal ? 'Disalin' : 'Salin'}
                </button>
              )}
            />
          </div>

          {/* Upload bukti transfer */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#1A2C4E', marginBottom: 8 }}>Upload bukti transfer</div>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? '#1A2C4E' : '#CBD5E1'}`,
                background: dragOver ? '#EFF6FF' : '#F8FAFC',
                borderRadius: 12, padding: '1.75rem 1rem', textAlign: 'center', cursor: 'pointer',
              }}
            >
              <input
                ref={inputRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }}
                onChange={e => acceptFile(e.target.files?.[0] ?? null)}
              />
              {file && previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Pratinjau bukti transfer"
                    style={{ width: '100%', maxWidth: 220, aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 10, border: '1.5px solid #E2E8F0', margin: '0 auto 0.6rem', display: 'block' }}
                  />
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>Klik untuk ganti foto</div>
                </>
              ) : (
                <>
                  <UploadCloud size={28} color="#94A3B8" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12 auto' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>Klik atau drop untuk upload foto bukti</div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>JPG atau PNG maksimal 5MB</div>
                </>
              )}
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.65rem 1rem', fontSize: '0.83rem', marginBottom: '1rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onBack} disabled={loading} style={{ flex: 1, padding: '0.85rem', background: '#fff', color: '#1A2C4E', border: '2px solid #E2E8F0', borderRadius: 12, fontWeight: 800, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              Kembali
            </button>
            <button onClick={handleSubmit} disabled={!file || loading} style={{ flex: 2, padding: '0.85rem', background: (!file || loading) ? '#CBD5E1' : '#1A2C4E', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.95rem', cursor: (!file || loading) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Mengirim...' : 'Konfirmasi Bayar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RekeningRow({ label, value, action, bold, last }: { label: string; value: string; action?: React.ReactNode; bold?: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0.55rem 0', borderBottom: last ? 'none' : '1px dashed #F1F5F9' }}>
      <span style={{ fontSize: 'clamp(0.68rem, 2.4vw, 0.8rem)', color: '#64748B', fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{
          fontSize: bold ? 'clamp(0.8rem, 2.8vw, 0.95rem)' : 'clamp(0.7rem, 2.6vw, 0.85rem)',
          color: '#0F172A', fontWeight: bold ? 800 : 700,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right',
        }}>
          {value}
        </span>
        {action}
      </span>
    </div>
  )
}
