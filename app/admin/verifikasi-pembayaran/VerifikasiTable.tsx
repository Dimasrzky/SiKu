'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ShieldCheck, ImageOff, CheckCircle2, X, ArrowLeft } from 'lucide-react'

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

export interface VerifikasiItem {
  id:              string
  namaSiswa:       string
  nis:             string
  nominalTagihan:  number
  nominalDiajukan: number
  buktiUrl:        string | null
}

interface Props {
  items:       VerifikasiItem[]
  namaSekolah: string
}

export default function VerifikasiTable({ items, namaSekolah }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId]     = useState<string | null>(null)
  const [errorId, setErrorId]         = useState<string | null>(null)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [confirmAksi, setConfirmAksi] = useState<{ item: VerifikasiItem; aksi: 'lunas' | 'cicilan' } | null>(null)

  const handleAksi = async (id: string, aksi: 'lunas' | 'cicilan') => {
    if (loadingId) return
    setLoadingId(id)
    setErrorId(null)
    try {
      const res = await fetch(`/api/admin/verifikasi/${id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ aksi }),
      })
      if (!res.ok) {
        setErrorId(id)
        return
      }
      setConfirmAksi(null)
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <Link href="/admin/verifikasi-pembayaran" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: '0.83rem', fontWeight: 700, textDecoration: 'none', marginBottom: '1rem' }}>
          <ArrowLeft size={15} /> Kembali ke daftar sekolah
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{ width: 48, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1A2C4E', margin: 0 }}>{namaSekolah}</h1>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.15rem 0 0' }}>
                Konfirmasi bukti transfer yang dikirim orang tua
              </p>
            </div>
          </div>
        </div>

        {/* Table card */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {items.length === 0 ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.9rem' }}>
              Belum ada bukti transfer yang menunggu verifikasi.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#1A2C4E' }}>
                    {(['No', 'Nama Lengkap Siswa', 'NIS', 'Nominal Tagihan', 'Bukti Transfer', 'Aksi'] as const).map(h => (
                      <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: '#64748B', fontWeight: 600 }}>{idx + 1}</td>

                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{it.namaSiswa}</td>

                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: '#475569' }}>{it.nis}</td>

                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{formatRp(it.nominalTagihan)}</div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#D97706' }}>Diajukan: {formatRp(it.nominalDiajukan)}</div>
                        {/* Halaman bayar menagih tagihan ini beserta tunggakan sebelumnya,
                            dan verifikasi membagi transfernya ke tagihan-tagihan itu */}
                        {it.nominalDiajukan > it.nominalTagihan && (
                          <div style={{ fontSize: '0.68rem', color: '#64748B' }}>termasuk tunggakan sebelumnya</div>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        {it.buktiUrl ? (
                          <button
                            onClick={() => setPreviewUrl(it.buktiUrl)}
                            style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', lineHeight: 0 }}
                          >
                            <Image
                              src={it.buktiUrl}
                              alt="Bukti transfer"
                              width={52}
                              height={52}
                              unoptimized
                              style={{ objectFit: 'cover', borderRadius: 8, border: '1.5px solid #E2E8F0' }}
                            />
                          </button>
                        ) : (
                          <div style={{ width: 52, height: 52, borderRadius: 8, border: '1.5px dashed #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1' }}>
                            <ImageOff size={18} />
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setConfirmAksi({ item: it, aksi: 'lunas' })}
                            disabled={loadingId === it.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.4rem 0.75rem', background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: loadingId === it.id ? 'default' : 'pointer', opacity: loadingId === it.id ? 0.6 : 1 }}
                          >
                            <CheckCircle2 size={13} /> Lunas
                          </button>
                          <button
                            onClick={() => setConfirmAksi({ item: it, aksi: 'cicilan' })}
                            disabled={loadingId === it.id}
                            style={{ padding: '0.4rem 0.75rem', background: '#fff', color: '#1A2C4E', border: '1.5px solid #1A2C4E', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: loadingId === it.id ? 'default' : 'pointer', opacity: loadingId === it.id ? 0.6 : 1 }}
                          >
                            Cicilan
                          </button>
                        </div>
                        {errorId === it.id && (
                          <div style={{ fontSize: '0.7rem', color: '#DC2626', marginTop: 4 }}>Gagal memproses, coba lagi.</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div style={{ position: 'relative', maxWidth: 'min(90vw, 480px)', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              style={{ position: 'absolute', top: -14, right: -14, width: 32, height: 32, borderRadius: '50%', background: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1A2C4E' }}
            >
              <X size={16} />
            </button>
            <Image
              src={previewUrl}
              alt="Bukti transfer"
              width={480}
              height={480}
              unoptimized
              style={{ width: '100%', height: 'auto', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, background: '#fff' }}
            />
          </div>
        </div>
      )}

      {confirmAksi && (
        <div
          onClick={() => !loadingId && setConfirmAksi(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', padding: '1.5rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 48, height: 48, background: confirmAksi.aksi === 'lunas' ? '#D1FAE5' : '#EFF6FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <CheckCircle2 size={24} color={confirmAksi.aksi === 'lunas' ? '#059669' : '#1D4ED8'} />
            </div>

            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 6 }}>
              Konfirmasi {confirmAksi.aksi === 'lunas' ? 'Lunas' : 'Cicilan'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              Anda yakin ingin menandai pembayaran <strong style={{ color: '#0F172A' }}>{confirmAksi.item.namaSiswa}</strong> sebesar{' '}
              <strong style={{ color: '#0F172A' }}>{formatRp(confirmAksi.item.nominalDiajukan)}</strong> sebagai{' '}
              <strong>{confirmAksi.aksi === 'lunas' ? 'Lunas' : 'Cicilan'}</strong>? Tindakan ini tidak dapat dibatalkan.
            </div>

            {errorId === confirmAksi.item.id && (
              <div style={{ fontSize: '0.78rem', color: '#DC2626', marginBottom: '1rem' }}>Gagal memproses, coba lagi.</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmAksi(null)}
                disabled={loadingId === confirmAksi.item.id}
                style={{ flex: 1, padding: '0.65rem', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: loadingId ? 'default' : 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={() => handleAksi(confirmAksi.item.id, confirmAksi.aksi)}
                disabled={loadingId === confirmAksi.item.id}
                style={{ flex: 1, padding: '0.65rem', background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: loadingId ? 'default' : 'pointer', opacity: loadingId === confirmAksi.item.id ? 0.7 : 1 }}
              >
                {loadingId === confirmAksi.item.id ? 'Memproses...' : 'Ya, Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
