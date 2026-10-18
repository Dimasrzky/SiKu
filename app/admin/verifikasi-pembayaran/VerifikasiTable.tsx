'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ShieldCheck, ImageOff, CheckCircle2, X } from 'lucide-react'
import KepalaAdmin from '../KepalaAdmin'

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

/** Isian rupiah: hanya angka, dengan titik ribuan */
const formatRibuan = (val: string) => {
  const digits = val.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13)
  return digits ? Number(digits).toLocaleString('id-ID') : ''
}

/** Komponen yang ditampilkan langsung di tabel; sisanya diringkas "+N lainnya" */
const MAKS_PILIHAN_TAMPIL = 3

export interface VerifikasiItem {
  id:              string
  namaSiswa:       string
  nis:             string
  nominalDiajukan: number
  /** Jumlah sisa komponen yang dipilih wali saat bukti dikirim */
  totalDipilih:    number
  jenis:           'lunas' | 'cicilan'
  /** Kosong untuk bukti dari sebelum fitur pilih komponen: semua yang ditagih di tautan */
  pilihan:         { label: string; sisa: number }[]
  /** Rencana pelunasan sisa cicilan, sudah diformat */
  rencana:         string | null
  catatanWali:     string | null
  buktiUrl:        string | null
}

interface Props {
  items:       VerifikasiItem[]
  namaSekolah: string
}

export default function VerifikasiTable({ items, namaSekolah }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId]   = useState<string | null>(null)
  const [galat, setGalat]           = useState<{ id: string; pesan: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [setujui, setSetujui]       = useState<VerifikasiItem | null>(null)
  const [nominalIsian, setNominal]  = useState('')

  const bukaSetujui = (it: VerifikasiItem) => {
    setGalat(null)
    setNominal(it.nominalDiajukan.toLocaleString('id-ID'))
    setSetujui(it)
  }

  const nominal = Number(nominalIsian.replace(/\D/g, '') || '0')

  const handleSetujui = async (it: VerifikasiItem) => {
    if (loadingId || nominal <= 0) return
    setLoadingId(it.id)
    setGalat(null)
    try {
      const res = await fetch(`/api/admin/verifikasi/${it.id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nominal }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null
        setGalat({ id: it.id, pesan: data?.error ?? 'Gagal memproses, coba lagi.' })
        return
      }
      setSetujui(null)
      router.refresh()
    } catch {
      setGalat({ id: it.id, pesan: 'Gagal menghubungi server. Coba lagi.' })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
      <div>
        <KepalaAdmin Ikon={ShieldCheck} judul={namaSekolah} subjudul="Konfirmasi bukti transfer yang dikirim orang tua" />

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
                    {(['No', 'Nama Lengkap Siswa', 'NIS', 'Pembayaran', 'Bukti Transfer', 'Aksi'] as const).map(h => (
                      <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const cicilan = it.jenis === 'cicilan'
                    const lainnya = it.pilihan.length - MAKS_PILIHAN_TAMPIL
                    return (
                      <tr key={it.id} style={{ borderBottom: '1px solid #F8FAFC', verticalAlign: 'top' }}>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: '#64748B', fontWeight: 600 }}>{idx + 1}</td>

                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{it.namaSiswa}</td>

                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: '#475569' }}>{it.nis}</td>

                        <td style={{ padding: '0.75rem 1rem', maxWidth: 360 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap' }}>{formatRp(it.nominalDiajukan)}</span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, borderRadius: 20, padding: '2px 8px', background: cicilan ? '#DBEAFE' : '#DCFCE7', color: cicilan ? '#1D4ED8' : '#15803D' }}>
                              {cicilan ? 'Cicilan' : 'Lunas'}
                            </span>
                          </div>
                          {cicilan && (
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginTop: 2 }}>
                              dari {formatRp(it.totalDipilih)} dipilih &middot; sisa {formatRp(it.totalDipilih - it.nominalDiajukan)}
                            </div>
                          )}
                          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 4, lineHeight: 1.45 }}>
                            {it.pilihan.length === 0
                              ? 'Semua yang ditagih di tautan, termasuk tunggakan'
                              : <>Untuk: {it.pilihan.slice(0, MAKS_PILIHAN_TAMPIL).map(p => p.label).join(', ')}{lainnya > 0 && ` +${lainnya} lainnya`}</>}
                          </div>
                          {it.rencana && (
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B45309', marginTop: 2 }}>Rencana lunas: {it.rencana}</div>
                          )}
                          {it.catatanWali && (
                            <div style={{ fontSize: '0.72rem', color: '#475569', fontStyle: 'italic', marginTop: 2 }}>&ldquo;{it.catatanWali}&rdquo;</div>
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
                          <button
                            onClick={() => bukaSetujui(it)}
                            disabled={loadingId === it.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.4rem 0.75rem', background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: loadingId === it.id ? 'default' : 'pointer', opacity: loadingId === it.id ? 0.6 : 1 }}
                          >
                            <CheckCircle2 size={13} /> Setujui
                          </button>
                        </td>
                      </tr>
                    )
                  })}
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

      {setujui && (
        <div
          onClick={() => !loadingId && setSetujui(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            role="dialog" aria-modal="true" aria-labelledby="judul-setujui"
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', padding: '1.5rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 48, height: 48, background: '#D1FAE5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <CheckCircle2 size={24} color="#059669" />
            </div>

            <div id="judul-setujui" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 6 }}>
              Setujui pembayaran
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6, marginBottom: '1rem' }}>
              Pembayaran <strong style={{ color: '#0F172A' }}>{setujui.namaSiswa}</strong>
              {setujui.jenis === 'cicilan' ? ' (cicilan)' : ''} dicatat untuk komponen yang dipilih wali.
              Ubah nominalnya kalau angka di bukti transfer berbeda. Tindakan ini tidak dapat dibatalkan.
            </div>

            <label htmlFor="nominal-setujui" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
              Nominal yang dicatat
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#64748B', fontWeight: 700 }}>Rp</span>
              <input id="nominal-setujui" type="text" inputMode="numeric" autoComplete="off"
                value={nominalIsian} onChange={e => setNominal(formatRibuan(e.target.value))}
                style={{ width: '100%', paddingLeft: 36, paddingRight: 10, paddingTop: '0.6rem', paddingBottom: '0.6rem', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box', outline: 'none', background: '#F8FAFC' }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4, marginBottom: '1rem' }}>
              Diajukan wali {formatRp(setujui.nominalDiajukan)}
              {setujui.nominalDiajukan !== setujui.totalDipilih && <> dari {formatRp(setujui.totalDipilih)} yang dipilih</>}
            </div>

            {galat?.id === setujui.id && (
              <div style={{ fontSize: '0.78rem', color: '#DC2626', marginBottom: '1rem' }}>{galat.pesan}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setSetujui(null)}
                disabled={loadingId === setujui.id}
                style={{ flex: 1, padding: '0.65rem', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: loadingId ? 'default' : 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={() => handleSetujui(setujui)}
                disabled={loadingId === setujui.id || nominal <= 0}
                style={{ flex: 1, padding: '0.65rem', background: '#1A2C4E', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: loadingId || nominal <= 0 ? 'default' : 'pointer', opacity: loadingId === setujui.id || nominal <= 0 ? 0.7 : 1 }}
              >
                {loadingId === setujui.id ? 'Memproses...' : `Ya, catat ${formatRp(nominal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
