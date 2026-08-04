'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BayarStepper from './BayarStepper'
import TagihanReview from './TagihanReview'
import MetodePembayaran from './MetodePembayaran'
import TerimaKasihView from './TerimaKasihView'
import type { BeasiswaBadge, TagihanItem, TunggakanItem } from './page'

interface Rekening {
  bank:     string
  noRek:    string
  atasNama: string
}

interface Props {
  paymentToken:   string
  totalNominal:   number
  sisa:           number
  namaSiswa:      string
  nis:            string
  kelasNama:      string
  items:          TagihanItem[]
  tunggakan:      TunggakanItem[]
  badges:         BeasiswaBadge[]
  rekening:       Rekening | null
  namaBendahara:  string
  noWaBendahara:  string
}

export default function BayarWizard({
  paymentToken, totalNominal, sisa,
  namaSiswa, nis, kelasNama, items, tunggakan, badges, rekening, namaBendahara, noWaBendahara,
}: Props) {
  const router = useRouter()
  const [step, setStep]           = useState<1 | 2 | 3>(1)
  const [waktuKirim, setWaktuKirim] = useState('')

  return (
    <div>
      <BayarStepper step={step} />

      {step === 1 && (
        <TagihanReview
          namaSiswa={namaSiswa}
          nis={nis}
          kelasNama={kelasNama}
          items={items}
          tunggakan={tunggakan}
          totalNominal={totalNominal}
          badges={badges}
          onLanjut={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <MetodePembayaran
          paymentToken={paymentToken}
          totalNominal={sisa}
          rekening={rekening}
          onBack={() => setStep(1)}
          onSubmitted={() => { setWaktuKirim(new Date().toISOString()); setStep(3) }}
        />
      )}

      {step === 3 && (
        <TerimaKasihView
          namaSiswa={namaSiswa}
          kelasNama={kelasNama}
          totalNominal={sisa}
          waktuKirim={waktuKirim}
          namaBendahara={namaBendahara}
          noWaBendahara={noWaBendahara}
          onLihatStatus={() => router.refresh()}
        />
      )}
    </div>
  )
}
