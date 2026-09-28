'use client'

import { DropdownFilter } from './DropdownFilter'
import type { FilterLaporanState } from '@/lib/useFilterLaporan'

/**
 * Dropdown tahun ajaran + periode. Mengganti tahun ajaran mengembalikan periode ke
 * setahun penuh, karena bulan-bulan tahun ajaran lain tidak berlaku lagi.
 */
export function FilterLaporan({ filter, activeTAId }: { filter: FilterLaporanState; activeTAId: string | null }) {
  const { taTerpilih, daftarTA, opsiPeriodeTA, selectedFilter, gantiFilter } = filter
  return (
    <>
      {taTerpilih && (
        <DropdownFilter
          judul="Tahun ajaran"
          nilai={taTerpilih.id}
          pilihan={daftarTA.map(ta => ({ value: ta.id, label: ta.nama, sublabel: ta.id === activeTAId ? 'Aktif' : 'Arsip' }))}
          onPilih={id => gantiFilter({ ta: id, periode: null })}
        />
      )}
      <DropdownFilter
        judul="Periode"
        nilai={selectedFilter.value}
        pilihan={(taTerpilih ? opsiPeriodeTA : [selectedFilter]).map(o => ({ value: o.value, label: o.label }))}
        onPilih={nilai => gantiFilter({ periode: nilai })}
      />
    </>
  )
}
