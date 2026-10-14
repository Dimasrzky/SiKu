'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Angka yang bergerak halus menuju `target` (requestAnimationFrame, melambat di akhir).
 * Dipakai mockup dasbor di halaman login. `lompat` = langsung ke target tanpa animasi.
 */
export const useAngkaBergerak = (target: number, durasiMs: number, lompat = false): number => {
  const [nilai, setNilai] = useState(target)
  const nilaiRef = useRef(target)

  useEffect(() => {
    const awal = nilaiRef.current
    if (awal === target) return

    let mulai: number | null = null
    let id = 0
    const langkah = (waktu: number) => {
      if (mulai === null) mulai = waktu
      const p = lompat ? 1 : Math.min(1, (waktu - mulai) / durasiMs)
      const v = awal + (target - awal) * (1 - Math.pow(1 - p, 3))
      nilaiRef.current = v
      setNilai(v)
      if (p < 1) id = requestAnimationFrame(langkah)
    }
    id = requestAnimationFrame(langkah)
    return () => cancelAnimationFrame(id)
  }, [target, durasiMs, lompat])

  return nilai
}
