'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CircleCheck, ImageOff, X } from 'lucide-react'
import ModalAdmin from '../ModalAdmin'

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

/** Isian rupiah: hanya angka, dengan titik ribuan */
const formatRibuan = (val: string) => {
  const digits = val.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13)
  return digits ? Number(digits).toLocaleString('id-ID') : ''
}

/** Komponen yang ditampilkan langsung di tabel; sisanya diringkas "+N lainnya" */
const MAKS_PILIHAN_TAMPIL = 3

const KOLOM = ['No', 'Nama Lengkap Siswa', 'NIS', 'Pembayaran', 'Bukti Transfer', 'Aksi'] as const

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

export default function VerifikasiTable({ items }: { items: VerifikasiItem[] }) {
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

  const memproses = !!setujui && loadingId === setujui.id

  return (
    <>
      <section className="admin-panel">
        {items.length === 0 ? (
          <div className="admin-kosong admin-kosong--tunggal">Belum ada bukti transfer yang menunggu verifikasi.</div>
        ) : (
          <div className="admin-tabel-gulir" style={{ borderTop: 'none' }}>
            <table className="admin-tabel admin-tabel--atas" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  {KOLOM.map(h => <th key={h} className={h === 'Aksi' ? 'kanan' : undefined}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const cicilan = it.jenis === 'cicilan'
                  const lainnya = it.pilihan.length - MAKS_PILIHAN_TAMPIL
                  return (
                    <tr key={it.id}>
                      <td className="admin-no">{idx + 1}</td>

                      <td className="admin-sel-utama">{it.namaSiswa}</td>

                      <td>{it.nis}</td>

                      <td style={{ maxWidth: 360 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span className="admin-sel-utama" style={{ fontSize: '0.88rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                            {formatRp(it.nominalDiajukan)}
                          </span>
                          <span className={`admin-label ${cicilan ? 'admin-label--biru' : 'admin-label--hijau'}`}>
                            {cicilan ? 'Cicilan' : 'Lunas'}
                          </span>
                        </div>
                        {cicilan && (
                          <div className="admin-sel-sub" style={{ fontWeight: 600, color: '#475569' }}>
                            dari {formatRp(it.totalDipilih)} dipilih &middot; sisa {formatRp(it.totalDipilih - it.nominalDiajukan)}
                          </div>
                        )}
                        <div className="admin-sel-sub" style={{ marginTop: 4 }}>
                          {it.pilihan.length === 0
                            ? 'Semua yang ditagih di tautan, termasuk tunggakan'
                            : <>Untuk: {it.pilihan.slice(0, MAKS_PILIHAN_TAMPIL).map(p => p.label).join(', ')}{lainnya > 0 && ` +${lainnya} lainnya`}</>}
                        </div>
                        {it.rencana && (
                          <div className="admin-sel-sub" style={{ fontWeight: 700, color: '#B45309' }}>Rencana lunas: {it.rencana}</div>
                        )}
                        {it.catatanWali && (
                          <div className="admin-sel-sub" style={{ fontStyle: 'italic', color: '#475569' }}>&ldquo;{it.catatanWali}&rdquo;</div>
                        )}
                      </td>

                      <td>
                        {it.buktiUrl ? (
                          <button type="button" className="admin-bukti" onClick={() => setPreviewUrl(it.buktiUrl)} aria-label={`Lihat bukti transfer ${it.namaSiswa}`}>
                            <Image src={it.buktiUrl} alt="Bukti transfer" width={52} height={52} unoptimized />
                          </button>
                        ) : (
                          <div className="admin-bukti-kosong"><ImageOff size={18} /></div>
                        )}
                      </td>

                      <td>
                        <div className="admin-sel-aksi">
                          <button
                            type="button"
                            className="admin-tombol admin-tombol--utama admin-tombol--kecil"
                            onClick={() => bukaSetujui(it)}
                            disabled={loadingId === it.id}
                          >
                            <CircleCheck size={14} /> Setujui
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {previewUrl && (
        <div className="admin-modal-tirai" onMouseDown={e => { if (e.target === e.currentTarget) setPreviewUrl(null) }}>
          <div className="admin-pratinjau">
            <button type="button" className="admin-modal-tutup" onClick={() => setPreviewUrl(null)} aria-label="Tutup">
              <X size={16} />
            </button>
            <Image src={previewUrl} alt="Bukti transfer" width={480} height={480} unoptimized />
          </div>
        </div>
      )}

      {setujui && (
        <ModalAdmin
          judul="Setujui pembayaran"
          nada="sukses"
          ikon={<CircleCheck size={22} />}
          lebar={420}
          sibuk={memproses}
          onTutup={() => setSetujui(null)}
          kaki={<>
            <button type="button" className="admin-tombol admin-tombol--garis" onClick={() => setSetujui(null)} disabled={memproses}>
              Batal
            </button>
            <button
              type="button"
              className="admin-tombol admin-tombol--utama"
              onClick={() => handleSetujui(setujui)}
              disabled={memproses || nominal <= 0}
            >
              {memproses ? 'Memproses...' : `Ya, catat ${formatRp(nominal)}`}
            </button>
          </>}
        >
          <p>
            Pembayaran <strong>{setujui.namaSiswa}</strong>
            {setujui.jenis === 'cicilan' ? ' (cicilan)' : ''} dicatat untuk komponen yang dipilih wali.
            Ubah nominalnya kalau angka di bukti transfer berbeda. Tindakan ini tidak dapat dibatalkan.
          </p>

          <label htmlFor="nominal-setujui" className="admin-label-isian">Nominal yang dicatat</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '0.88rem', color: '#64748B', fontWeight: 700 }}>Rp</span>
            <input
              id="nominal-setujui"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="admin-isian admin-isian--rupiah"
              value={nominalIsian}
              onChange={e => setNominal(formatRibuan(e.target.value))}
            />
          </div>
          <div className="admin-sel-sub" style={{ marginTop: 6 }}>
            Diajukan wali {formatRp(setujui.nominalDiajukan)}
            {setujui.nominalDiajukan !== setujui.totalDipilih && <> dari {formatRp(setujui.totalDipilih)} yang dipilih</>}
          </div>

          {galat?.id === setujui.id && <div className="admin-galat">{galat.pesan}</div>}
        </ModalAdmin>
      )}
    </>
  )
}
