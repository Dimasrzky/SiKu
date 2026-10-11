'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UnitBayar } from '@/lib/rincianKomponen'
import BayarStepper from './BayarStepper'
import TagihanReview from './TagihanReview'
import MetodePembayaran from './MetodePembayaran'
import TerimaKasihView from './TerimaKasihView'
import type { BeasiswaBadge, BlokTagihan, Pengajuan } from './page'

interface Rekening {
  bank:     string
  noRek:    string
  atasNama: string
}

interface Props {
  paymentToken:   string
  namaSiswa:      string
  nis:            string
  kelasNama:      string
  /** Bulan-bulan yang masih bersisa (lib/tagihanTertagih), terlama dulu */
  blok:           BlokTagihan[]
  /** Yang bisa dicentang, dalam urutan pembagian (lib/rincianKomponen) */
  units:          UnitBayar[]
  /** Tagihan di tautan ini sudah lunas — yang tersisa tinggal tunggakannya */
  lunasDiTautan:  { bulan: number; tahun: number } | null
  /** Tanggal rencana pelunasan cicilan yang boleh dipilih, 'YYYY-MM-DD' */
  rentangRencana: { awal: string; akhir: string }
  badges:         BeasiswaBadge[]
  rekening:       Rekening | null
  namaBendahara:  string
  noWaBendahara:  string
}

export default function BayarWizard({
  paymentToken, namaSiswa, nis, kelasNama, blok, units, lunasDiTautan, rentangRencana,
  badges, rekening, namaBendahara, noWaBendahara,
}: Props) {
  const router = useRouter()
  const [step, setStep]             = useState<1 | 2 | 3>(1)
  const [pengajuan, setPengajuan]   = useState<Pengajuan | null>(null)
  const [waktuKirim, setWaktuKirim] = useState('')

  return (
    <div>
      <BayarStepper step={step} />

      {step === 1 && (
        <TagihanReview
          namaSiswa={namaSiswa}
          nis={nis}
          kelasNama={kelasNama}
          blok={blok}
          units={units}
          lunasDiTautan={lunasDiTautan}
          rentangRencana={rentangRencana}
          badges={badges}
          awal={pengajuan}
          onLanjut={p => { setPengajuan(p); setStep(2) }}
        />
      )}

      {step === 2 && pengajuan && (
        <MetodePembayaran
          paymentToken={paymentToken}
          pengajuan={pengajuan}
          rekening={rekening}
          onBack={() => setStep(1)}
          onSubmitted={() => { setWaktuKirim(new Date().toISOString()); setStep(3) }}
        />
      )}

      {step === 3 && pengajuan && (
        <TerimaKasihView
          namaSiswa={namaSiswa}
          kelasNama={kelasNama}
          pengajuan={pengajuan}
          waktuKirim={waktuKirim}
          namaBendahara={namaBendahara}
          noWaBendahara={noWaBendahara}
          onLihatStatus={() => router.refresh()}
        />
      )}
    </div>
  )
}
