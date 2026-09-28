import { useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { BULAN_PANJANG } from './formatLaporan'
import type { TahunAjaranLaporan } from './useDataLaporan'

// Filter tahun ajaran + periode laporan, disimpan di URL (?ta=&periode=) supaya
// pilihan bisa dibagikan sebagai tautan dan ikut terbawa ke setiap level
// drill-down. Pemakainya wajib berada di bawah <Suspense> (useSearchParams).

export interface FilterOption {
  label:    string
  sublabel: string
  value:    string
  months:   { bulan: number; tahun: number }[]
}

export function monthsInRange(startIso: string, endIso: string): { bulan: number; tahun: number }[] {
  const start = new Date(startIso)
  const end   = new Date(endIso)
  const out: { bulan: number; tahun: number }[] = []
  let y = start.getFullYear()
  let m = start.getMonth() + 1
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth() + 1)) {
    out.push({ bulan: m, tahun: y })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

/**
 * Pilihan periode di dalam satu tahun ajaran. Nilainya yang disimpan di URL
 * (`?periode=`): 'tahun' | 'ganjil' | 'genap' | 'YYYY-MM'. Bulan yang belum datang
 * belum punya tagihan, jadi tidak ditawarkan; bulan terbaru ditaruh paling atas.
 */
export function opsiPeriode(ta: TahunAjaranLaporan, sekarang: Date): FilterOption[] {
  const semuaBulan = monthsInRange(ta.tanggal_mulai, ta.tanggal_selesai)
  const bulanIni   = sekarang.getFullYear() * 12 + sekarang.getMonth() + 1
  const sudahLewat = semuaBulan.filter(m => m.tahun * 12 + m.bulan <= bulanIni)
  return [
    { value: 'tahun',  label: 'Setahun penuh',   sublabel: ta.nama, months: semuaBulan },
    { value: 'ganjil', label: 'Semester ganjil', sublabel: ta.nama, months: monthsInRange(ta.semester_ganjil_mulai, ta.semester_ganjil_selesai) },
    { value: 'genap',  label: 'Semester genap',  sublabel: ta.nama, months: monthsInRange(ta.semester_genap_mulai, ta.semester_genap_selesai) },
    ...[...sudahLewat].reverse().map(m => ({
      value:    `${m.tahun}-${String(m.bulan).padStart(2, '0')}`,
      label:    `${BULAN_PANJANG[m.bulan]} ${m.tahun}`,
      sublabel: ta.nama,
      months:   [m],
    })),
  ]
}

const periodKey = (bulan: number, tahun: number) => `${tahun}-${bulan}`

export function useFilterLaporan(activeTA: TahunAjaranLaporan | null, archivedTAs: TahunAjaranLaporan[], sekarang: Date) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  // Nilai yang tidak dikenal jatuh ke bawaan: tahun ajaran aktif, setahun penuh —
  // dengan "bulan ini", sebelum jatuh tempo belum ada tagihan yang bisa dinilai
  // sehingga pelunasan dan ketepatan waktu hanya "—".
  const daftarTA   = useMemo(() => [...(activeTA ? [activeTA] : []), ...archivedTAs], [activeTA, archivedTAs])
  const taTerpilih = daftarTA.find(ta => ta.id === searchParams.get('ta')) ?? daftarTA[0] ?? null
  const taArsipTerpilih = !!taTerpilih && taTerpilih.id !== activeTA?.id

  const opsiPeriodeTA = useMemo(() => (taTerpilih ? opsiPeriode(taTerpilih, sekarang) : []), [taTerpilih, sekarang])

  // Sekolah tanpa tahun ajaran sama sekali belum bisa membuat tagihan — cukup bulan ini
  const bulanIniSaja = useMemo<FilterOption>(() => {
    const bulan = sekarang.getMonth() + 1
    const tahun = sekarang.getFullYear()
    return { value: 'bulan-ini', label: 'Bulan ini', sublabel: `${BULAN_PANJANG[bulan]} ${tahun}`, months: [{ bulan, tahun }] }
  }, [sekarang])

  const selectedFilter: FilterOption = taTerpilih
    ? opsiPeriodeTA.find(o => o.value === searchParams.get('periode')) ?? opsiPeriodeTA[0]
    : bulanIniSaja

  /** Saring baris apa pun yang punya bulan/tahun ke periode terpilih */
  const dalamPeriode = useMemo(() => {
    const bulanSet = new Set(selectedFilter.months.map(m => periodKey(m.bulan, m.tahun)))
    return (t: { bulan: number; tahun: number }) => bulanSet.has(periodKey(t.bulan, t.tahun))
  }, [selectedFilter])

  const gantiFilter = (ubah: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [kunci, nilai] of Object.entries(ubah)) {
      if (nilai === null) params.delete(kunci)
      else params.set(kunci, nilai)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  /** Query string filter saat ini, untuk tautan ke level lain — "?ta=…&periode=…" atau "" */
  const qsFilter = useMemo(() => {
    const params = new URLSearchParams()
    for (const kunci of ['ta', 'periode']) {
      const nilai = searchParams.get(kunci)
      if (nilai) params.set(kunci, nilai)
    }
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }, [searchParams])

  return { daftarTA, taTerpilih, taArsipTerpilih, opsiPeriodeTA, selectedFilter, dalamPeriode, gantiFilter, qsFilter }
}

export type FilterLaporanState = ReturnType<typeof useFilterLaporan>
