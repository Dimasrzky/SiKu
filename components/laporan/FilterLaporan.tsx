'use client'

import { DropdownFilter } from './DropdownFilter'
import { FilterPeriode } from './FilterPeriode'
import type { FilterLaporanState } from '@/lib/useFilterLaporan'

/**
 * Dropdown tahun ajaran + periode di dalam tombol "Filter Periode". Mengganti tahun ajaran
 * mengembalikan periode ke setahun penuh, karena bulan-bulan tahun ajaran lain tidak berlaku
 * lagi. Tombol × mengembalikan keduanya ke bawaan (tahun ajaran aktif, setahun penuh).
 */
export function FilterLaporan({ filter, activeTAId }: { filter: FilterLaporanState; activeTAId: string | null }) {
  const { taTerpilih, daftarTA, opsiPeriodeTA, selectedFilter, gantiFilter } = filter
  // Tautan yang membawa filter selain bawaan langsung memperlihatkan filternya
  const bukanBawaan = !!taTerpilih
    && (taTerpilih.id !== daftarTA[0]?.id || selectedFilter.value !== opsiPeriodeTA[0]?.value)

  return (
    <FilterPeriode terbukaAwal={bukanBawaan} onTutup={() => gantiFilter({ ta: null, periode: null })}>
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
    </FilterPeriode>
  )
}
