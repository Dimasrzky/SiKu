'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { formatRupiah } from '@/lib/formatLaporan'
import { tautanFotoPengeluaran } from '@/lib/fotoPengeluaran'
import type { Pengeluaran } from '@/lib/pengeluaran'
import { sGalat, sIsi, sJudulKepala, sKepala, sKotak, sLatar, sSubjudulKepala, sTombolKedua, sTombolTutup } from './gayaPengeluaran'

/** Foto nota satu pengeluaran, lewat tautan sementara dari server */
export const ModalFoto = ({ pengeluaran, onTutup }: { pengeluaran: Pengeluaran; onTutup: () => void }) => {
  const [tautan, setTautan] = useState<string | null>(null)
  const [galat,  setGalat]  = useState('')

  useEffect(() => {
    let batal = false
    tautanFotoPengeluaran(pengeluaran.id).then(h => {
      if (batal) return
      if (h.error === null) setTautan(h.data)
      else setGalat(h.error)
    })
    return () => { batal = true }
  }, [pengeluaran.id])

  return (
    <div style={sLatar} onClick={onTutup}>
      <div role="dialog" aria-modal="true" aria-labelledby="judul-modal-foto" style={sKotak(560)} onClick={e => e.stopPropagation()}>
        <div style={sKepala}>
          <div style={{ minWidth: 0 }}>
            <div id="judul-modal-foto" style={{ ...sJudulKepala, overflowWrap: 'anywhere' }}>{pengeluaran.keterangan}</div>
            <div style={sSubjudulKepala}>Foto nota · {formatRupiah(pengeluaran.jumlah)}</div>
          </div>
          <button onClick={onTutup} aria-label="Tutup" style={sTombolTutup}><X size={16} /></button>
        </div>
        <div style={{ ...sIsi, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem' }}>
          {galat ? (
            <div style={{ ...sGalat, marginBottom: 0, alignSelf: 'stretch' }}>{galat}</div>
          ) : tautan ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tautan} alt={`Foto nota ${pengeluaran.keterangan}`} style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 10, border: '1px solid #E2E8F0' }} />
              <a href={tautan} target="_blank" rel="noopener noreferrer" style={{ ...sTombolKedua, textDecoration: 'none' }}>
                <ExternalLink size={14} /> Buka ukuran penuh
              </a>
            </>
          ) : (
            <div className="skeleton" style={{ width: '100%', height: 320, borderRadius: 10 }} aria-label="Memuat foto" />
          )}
        </div>
      </div>
    </div>
  )
}
