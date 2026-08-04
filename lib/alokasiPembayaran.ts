import type { SupabaseClient } from '@supabase/supabase-js'

// Satu pembayaran dari orang tua bisa menutup beberapa tagihan sekaligus — tagihan
// bulan berjalan beserta tunggakan periode sebelumnya. Uangnya dibagi mulai dari
// periode terlama supaya tunggakan lama tertutup lebih dulu.

export interface AlokasiBaris {
  tagihan_id: string
  jumlah:     number
}

interface TagihanSisa {
  id:            string
  bulan:         number
  tahun:         number
  total_nominal: number
  sisa:          number
}

/** Tagihan siswa yang belum lunas beserta sisanya, terurut dari periode terlama. */
export async function tagihanBelumLunas(
  db: SupabaseClient,
  sekolahId: string,
  siswaId: string,
): Promise<TagihanSisa[]> {
  const { data: tagihanRows } = await db
    .from('tagihan')
    .select('id, bulan, tahun, total_nominal')
    .eq('sekolah_id', sekolahId)
    .eq('siswa_id', siswaId)
    .neq('status', 'lunas')
    .limit(200)

  const rows = (tagihanRows ?? []) as { id: string; bulan: number; tahun: number; total_nominal: number }[]
  if (rows.length === 0) return []

  const { data: bayarRows } = await db
    .from('pembayaran')
    .select('tagihan_id, jumlah')
    .in('tagihan_id', rows.map(r => r.id))

  const dibayar = new Map<string, number>()
  for (const p of ((bayarRows ?? []) as { tagihan_id: string; jumlah: number }[])) {
    dibayar.set(p.tagihan_id, (dibayar.get(p.tagihan_id) ?? 0) + p.jumlah)
  }

  return rows
    .map(r => ({ ...r, sisa: r.total_nominal - (dibayar.get(r.id) ?? 0) }))
    .filter(r => r.sisa > 0)
    .sort((a, b) => (a.tahun * 12 + a.bulan) - (b.tahun * 12 + b.bulan))
}

/**
 * Bagi satu nominal pembayaran ke tagihan-tagihan yang belum lunas, terlama dulu.
 * Kelebihan bayar dibebankan ke tagihan terakhir supaya uangnya tidak hilang dari
 * pembukuan — bendahara bisa menyesuaikannya belakangan.
 */
export function bagiKeTagihan(daftar: TagihanSisa[], jumlah: number): AlokasiBaris[] {
  const alokasi: AlokasiBaris[] = []
  let sisaUang = jumlah

  for (const t of daftar) {
    if (sisaUang <= 0) break
    const porsi = Math.min(sisaUang, t.sisa)
    alokasi.push({ tagihan_id: t.id, jumlah: porsi })
    sisaUang -= porsi
  }

  if (sisaUang > 0 && alokasi.length > 0) {
    alokasi[alokasi.length - 1].jumlah += sisaUang
  }
  return alokasi
}
