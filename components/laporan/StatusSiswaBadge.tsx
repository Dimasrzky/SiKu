'use client'

import { AlertOctagon, AlertTriangle, CheckCircle2, MinusCircle, type LucideIcon } from 'lucide-react'
import type { StatusSiswa } from '@/lib/metrikLaporan'

/**
 * Label netral (draft: "label netral dipakai karena menyangkut data anak").
 * Warna status selalu disertai ikon dan teks — tidak pernah warna saja.
 */
export const STATUS_SISWA_UI: Record<StatusSiswa, { label: string; bg: string; color: string; solid: string; Ikon: LucideIcon }> = {
  tertunggak:      { label: 'Tertunggak',      bg: '#FEE2E2', color: '#B91C1C', solid: '#B91C1C', Ikon: AlertOctagon },
  perlu_perhatian: { label: 'Perlu perhatian', bg: '#FEF3C7', color: '#92400E', solid: '#F59E0B', Ikon: AlertTriangle },
  lancar:          { label: 'Lancar',          bg: '#DCFCE7', color: '#15803D', solid: '#16A34A', Ikon: CheckCircle2 },
  belum_dinilai:   { label: 'Belum dinilai',   bg: '#F1F5F9', color: '#475569', solid: '#94A3B8', Ikon: MinusCircle },
}

export function StatusSiswaBadge({ status }: { status: StatusSiswa }) {
  const ui = STATUS_SISWA_UI[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: ui.bg, color: ui.color, fontSize: '0.74rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      <ui.Ikon size={13} />
      {ui.label}
    </span>
  )
}
