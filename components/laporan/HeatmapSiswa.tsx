'use client'

import { useState } from 'react'
import { BULAN_PENDEK, BULAN_PANJANG, formatRupiah as fmt } from '@/lib/formatLaporan'
import { formatJatuhTempo, batasJatuhTempo } from '@/lib/statusTagihan'
import { kategoriBulan, selisihHari, type KategoriBulan, type TagihanMetrik } from '@/lib/metrikLaporan'

// Warna diuji dengan validator palet dataviz (semua pasangan, permukaan terang).
// Hijau–kuning berada di pita 6–8 untuk protanopia, yang hanya sah dengan penanda
// kedua — karena itu setiap sel juga membawa tanda (✓ ! ½ ✕), bukan warna saja.
// Abu-abu "belum jatuh tempo" sengaja netral: artinya "belum ada apa-apa".
export const KATEGORI_BULAN_UI: Record<KategoriBulan, { label: string; warna: string; tanda: string; tinta: string }> = {
  tepat_waktu:       { label: 'Tepat waktu',              warna: '#16A34A', tanda: '✓', tinta: '#FFFFFF' },
  telat:             { label: 'Telat',                    warna: '#F59E0B', tanda: '!', tinta: '#422006' },
  cicilan:           { label: 'Cicilan',                  warna: '#2563EB', tanda: '½', tinta: '#FFFFFF' },
  belum_bayar:       { label: 'Belum bayar',              warna: '#B91C1C', tanda: '✕', tinta: '#FFFFFF' },
  belum_jatuh_tempo: { label: 'Belum jatuh tempo',        warna: '#CBD5E1', tanda: '',  tinta: '#334155' },
  tanpa_kewajiban:   { label: 'Tanpa tagihan (beasiswa)', warna: '#DCFCE7', tanda: '–', tinta: '#15803D' },
}

export const URUTAN_LEGENDA: KategoriBulan[] = ['tepat_waktu', 'telat', 'cicilan', 'belum_bayar', 'belum_jatuh_tempo']

/** Legenda kategori bulan — warna selalu berpasangan dengan tanda */
export function LegendaBulan({ kategori }: { kategori: KategoriBulan[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', fontSize: '0.75rem', color: '#475569', marginBottom: '0.9rem' }}>
      {kategori.map(k => {
        const ui = KATEGORI_BULAN_UI[k]
        return (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: ui.warna, color: ui.tinta, fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{ui.tanda}</span>
            {ui.label}
          </span>
        )
      })}
    </div>
  )
}

export interface BarisHeatmap {
  siswaId:  string
  nama:     string
  nis:      string | null
  /** Tagihan siswa per bulan, kunci `${tahun}-${bulan}` */
  perBulan: Map<string, TagihanMetrik>
}

const kunciBulan = (bulan: number, tahun: number) => `${tahun}-${bulan}`

const tanggalWIBPendek = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

/** Kalimat detail satu sel — dipakai baris keterangan, atribut title, dan timeline siswa. */
export function detailSel(t: TagihanMetrik, kategori: KategoriBulan, sekarang: Date): string {
  const jt   = batasJatuhTempo(t)
  const sisa = Math.max(0, t.total_nominal - t.terbayar)
  switch (kategori) {
    case 'tepat_waktu':
      return t.bayar_terakhir ? `Lunas ${tanggalWIBPendek(t.bayar_terakhir)}, tepat waktu · ${fmt(t.total_nominal)}` : `Lunas · ${fmt(t.total_nominal)}`
    case 'telat':
      return `Lunas ${tanggalWIBPendek(t.bayar_terakhir!)}, telat ${selisihHari(jt, new Date(t.bayar_terakhir!))} hari · ${fmt(t.total_nominal)}`
    case 'cicilan': {
      const lewat = selisihHari(jt, sekarang)
      return `Terbayar ${fmt(t.terbayar)} dari ${fmt(t.total_nominal)}, sisa ${fmt(sisa)} · ${lewat > 0 ? `lewat jatuh tempo ${lewat} hari` : `jatuh tempo ${formatJatuhTempo(t)}`}`
    }
    case 'belum_bayar':
      return `Belum dibayar ${fmt(sisa)}, lewat jatuh tempo ${Math.max(0, selisihHari(jt, sekarang))} hari`
    case 'belum_jatuh_tempo':
      return `${fmt(t.total_nominal)}, jatuh tempo ${formatJatuhTempo(t)}`
    case 'tanpa_kewajiban':
      return 'Tidak ada yang perlu dibayar (beasiswa penuh)'
  }
}

/**
 * Visual utama level Kelas: satu baris per siswa, satu kolom per bulan. Siswa
 * dengan pola kronis langsung terlihat sebagai deretan sel merah/kuning.
 * Versi tabelnya adalah daftar siswa di bawah heatmap.
 */
export function HeatmapSiswa({ baris, bulan, sekarang }: {
  baris:    BarisHeatmap[]
  bulan:    { bulan: number; tahun: number }[]
  sekarang: Date
}) {
  const [sorot, setSorot] = useState<{ siswa: string; bulan: string } | null>(null)

  if (baris.length === 0 || bulan.length === 0) {
    return <div style={{ fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center', padding: '2rem 0' }}>Belum ada tagihan pada periode ini.</div>
  }

  const adaBeasiswa = baris.some(b => [...b.perBulan.values()].some(t => kategoriBulan(t, sekarang) === 'tanpa_kewajiban'))
  const legenda     = adaBeasiswa ? [...URUTAN_LEGENDA, 'tanpa_kewajiban' as const] : URUTAN_LEGENDA

  let keterangan = 'Arahkan kursor ke sebuah sel untuk melihat rinciannya.'
  if (sorot) {
    const b = baris.find(x => x.siswaId === sorot.siswa)
    const t = b?.perBulan.get(sorot.bulan)
    const [tahun, bln] = sorot.bulan.split('-').map(Number)
    keterangan = `${b?.nama ?? ''} · ${BULAN_PANJANG[bln]} ${tahun} — ${t ? detailSel(t, kategoriBulan(t, sekarang), sekarang) : 'Tidak ada tagihan'}`
  }

  const SEL = 30
  return (
    <div>
      <LegendaBulan kategori={legenda} />

      <div style={{ overflowX: 'auto', paddingBottom: 4 }} onMouseLeave={() => setSorot(null)}>
        <div style={{ display: 'grid', gridTemplateColumns: `minmax(150px, 200px) repeat(${bulan.length}, ${SEL}px)`, gap: 2, alignItems: 'center', width: 'max-content' }}>
          {/* Kepala kolom bulan */}
          <div />
          {bulan.map((m, i) => (
            <div key={kunciBulan(m.bulan, m.tahun)} style={{ fontSize: 10.5, color: '#64748B', textAlign: 'center', lineHeight: 1.2, paddingBottom: 4 }}>
              {BULAN_PENDEK[m.bulan]}
              {(i === 0 || m.bulan === 1) && <div style={{ fontSize: 9, color: '#94A3B8' }}>{m.tahun}</div>}
            </div>
          ))}

          {baris.map(b => (
            <div key={b.siswaId} style={{ display: 'contents' }}>
              <div style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }} title={b.nama}>
                {b.nama}
              </div>
              {bulan.map(m => {
                const kunci = kunciBulan(m.bulan, m.tahun)
                const t     = b.perBulan.get(kunci)
                const aktif = sorot?.siswa === b.siswaId && sorot.bulan === kunci
                if (!t) {
                  return (
                    <div key={kunci} title={`${b.nama} · ${BULAN_PANJANG[m.bulan]} ${m.tahun}: tidak ada tagihan`}
                      onMouseEnter={() => setSorot({ siswa: b.siswaId, bulan: kunci })}
                      style={{ width: SEL, height: 26, borderRadius: 4, background: '#F8FAFC', border: '1px solid #EEF2F6', boxSizing: 'border-box', outline: aktif ? '2px solid #0F172A' : 'none', outlineOffset: 1 }} />
                  )
                }
                const kategori = kategoriBulan(t, sekarang)
                const ui = KATEGORI_BULAN_UI[kategori]
                return (
                  <div key={kunci}
                    title={`${b.nama} · ${BULAN_PANJANG[m.bulan]} ${m.tahun}: ${ui.label} — ${detailSel(t, kategori, sekarang)}`}
                    onMouseEnter={() => setSorot({ siswa: b.siswaId, bulan: kunci })}
                    style={{ width: SEL, height: 26, borderRadius: 4, background: ui.warna, color: ui.tinta, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', outline: aktif ? '2px solid #0F172A' : 'none', outlineOffset: 1 }}>
                    {ui.tanda}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div aria-live="polite" style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: sorot ? '#0F172A' : '#94A3B8', minHeight: '1.2em' }}>
        {keterangan}
      </div>
    </div>
  )
}
