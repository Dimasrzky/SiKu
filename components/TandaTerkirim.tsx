'use client'

import Image from 'next/image'
import type { Pengingat } from '@/lib/usePengingat'
import type { PengingatManual } from '@/lib/usePengingatManual'

// Pengganti tombol "Ingatkan" sesudah pengingat terkirim (keputusan 3 Okt 2026): ikon
// Terkirim selama 3 detik, lalu hitung mundur cooldown "H-2" / "H-1" yang tidak bisa
// diklik. Berlaku untuk sekolah yang memakai antrean (sisa hari dari server) maupun
// wa.me (dicatat di browser lewat lib/usePengingatManual).

/** 'ikon' = baru saja terkirim; angka = sisa hari cooldown */
export type Tanda = 'ikon' | number

/**
 * Tanda untuk satu siswa, atau null kalau tombol Ingatkan biasa yang tampil.
 * `baruWaMe` = tombol wa.me siswa ini baru diklik (masih dalam 3 detik pertama).
 */
export function tandaKirim(pengingat: Pengingat, manual: PengingatManual, siswaId: string, baruWaMe: boolean): Tanda | null {
  if (pengingat.aktif) {
    if (pengingat.tampilan(siswaId) !== 'terkirim') return null
    return pengingat.baruTerkirim(siswaId) ? 'ikon' : pengingat.sisaCooldown(siswaId) || null
  }
  return baruWaMe ? 'ikon' : manual.sisaCooldown(siswaId) || null
}

interface Props {
  tanda: Tanda
  /** Baris tabel yang rapat (Tagihan Aktif) — ikon Terkirim lebih kecil */
  kecil?: boolean
}

export const TandaTerkirim = ({ tanda, kecil = false }: Props) => {
  if (tanda === 'ikon') {
    return (
      <Image src="/icons/Terkirim.png" width={kecil ? 20 : 26} height={kecil ? 22 : 29}
        alt="Terkirim" title="Pengingat terkirim" />
    )
  }
  return (
    <span
      title={`Pengingat sudah dikirim. Bisa diingatkan lagi ${tanda === 1 ? 'besok' : `${tanda} hari lagi`}.`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: '#BB8848', color: '#fff', borderRadius: 6,
        padding: '0.35rem 0.6rem 0.35rem 0.45rem',
        fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap',
        boxShadow: '0 3px 4px rgba(0, 0, 0, 0.25)', cursor: 'default',
      }}>
      <Image src="/icons/IconWaktu.png" width={13} height={13} alt="" />
      H-{tanda}
    </span>
  )
}
