import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilPerPotong, ambilSemua } from './ambilSemua'
import { periodeIndex } from './komponenTagihan'
import { adalahTunggakan, type TagihanSisaDasar } from './metrikLaporan'
import { tanpaKewajiban } from './statusTagihan'

// Yang ditagih lewat satu tautan halaman bayar (/bayar/[token]) — satu-satunya rumus.
// Halaman bayar, unggah bukti, verifikasi, pesan pengingat (antrean dan wa.me), dan kolom
// Total di Tagihan Aktif memakainya, supaya wali dan sekolah selalu melihat angka yang
// sama (keputusan 3 Okt 2026).
//
// Tautan menunjuk satu tagihan, `sasaran`. Yang ditagih = sisa sasaran + sisa seluruh
// tunggakan dari bulan-bulan sebelumnya. Sisa = total_nominal (sesudah potongan beasiswa)
// dikurangi pembayaran — bukan jumlah tagihan_item, yang dicatat sebelum potongan.
// Tunggakan mengikuti adalahTunggakan, jadi sisa cicilan yang lewat jatuh tempo ikut.

export interface TagihanSisa extends TagihanSisaDasar {
  id: string
}

export const sisaTagihan = (t: Pick<TagihanSisa, 'total_nominal' | 'terbayar'>): number =>
  Math.max(0, t.total_nominal - t.terbayar)

/** Masih ada yang harus dibayar. Tagihan Rp 0 karena beasiswa penuh tidak pernah. */
export const masihBersisa = (t: TagihanSisa): boolean =>
  t.status !== 'lunas' && !tanpaKewajiban(t.total_nominal) && sisaTagihan(t) > 0

/** Tunggakan dari bulan-bulan sebelum `periode` (lihat periodeIndex) */
export const tunggakanSebelum = (t: TagihanSisa, periode: number, sekarang: Date): boolean =>
  periodeIndex(t.bulan, t.tahun) < periode && adalahTunggakan(t, sekarang)

const urutPeriode = (a: TagihanSisa, b: TagihanSisa) => periodeIndex(a.bulan, a.tahun) - periodeIndex(b.bulan, b.tahun)

/**
 * Tagihan yang ditautkan pengingat: yang terbaru dan masih bersisa, sudah jatuh tempo
 * atau belum — halaman bayarnya memuat seluruh tunggakan sebelumnya.
 */
export function tagihanTautan<T extends TagihanSisa>(tagihan: T[]): T | null {
  const bersisa = tagihan.filter(masihBersisa).sort(urutPeriode)
  return bersisa[bersisa.length - 1] ?? null
}

export interface Tertagih<T> {
  /** Baris sasaran sendiri, bersisa atau tidak; null kalau tidak ada di `tagihan` */
  sasaran: T | null
  /** Tunggakan sebelumnya, terlama dulu, lalu sasaran sendiri kalau masih bersisa */
  daftar:  T[]
  total:   number
}

/** `tagihan` = semua tagihan siswa itu yang belum lunas, sudah digabung dengan pembayarannya */
export function tagihanTertagih<T extends TagihanSisa>(
  tagihan: T[],
  sasaran: Pick<TagihanSisa, 'id' | 'bulan' | 'tahun'>,
  sekarang: Date,
): Tertagih<T> {
  const periode = periodeIndex(sasaran.bulan, sasaran.tahun)
  const sendiri = tagihan.find(t => t.id === sasaran.id) ?? null
  const lama    = tagihan.filter(t => t.id !== sasaran.id && tunggakanSebelum(t, periode, sekarang)).sort(urutPeriode)
  const daftar  = sendiri && masihBersisa(sendiri) ? [...lama, sendiri] : lama
  return { sasaran: sendiri, daftar, total: daftar.reduce((s, t) => s + sisaTagihan(t), 0) }
}

export interface BagianPembayaran<T> {
  tagihan: T
  jumlah:  number
  /** Bagian ini menutup sisa tagihannya */
  lunas:   boolean
}

/** Satu pembayaran gabungan dibagi ke `daftar`, terlama dulu. Kelebihan di atas sisanya tidak dibagi. */
export function bagiPembayaran<T extends TagihanSisa>(daftar: T[], jumlah: number): BagianPembayaran<T>[] {
  const hasil: BagianPembayaran<T>[] = []
  let uang = jumlah
  for (const t of [...daftar].sort(urutPeriode)) {
    if (uang <= 0) break
    const sisa = sisaTagihan(t)
    if (sisa <= 0) continue
    const bayar = Math.min(sisa, uang)
    hasil.push({ tagihan: t, jumlah: bayar, lunas: bayar >= sisa })
    uang -= bayar
  }
  return hasil
}

/**
 * Rincian satu tagihan yang jumlahnya sama dengan sisanya: komponen tagihan_item apa
 * adanya, lalu selisihnya dengan total_nominal (potongan beasiswa, atau komponen yang
 * tidak tercatat di rincian) dan pembayaran yang sudah masuk, masing-masing satu baris.
 */
export function rincianSisa<I extends { nama_komponen: string; nominal: number }>(
  items: I[],
  t: Pick<TagihanSisa, 'total_nominal' | 'terbayar'>,
  baris: (nama_komponen: string, nominal: number) => I,
): I[] {
  const selisih = t.total_nominal - items.reduce((s, i) => s + i.nominal, 0)
  return [
    ...items,
    ...(selisih !== 0 ? [baris(selisih < 0 ? 'Potongan beasiswa' : 'Komponen tambahan', selisih)] : []),
    ...(t.terbayar > 0 ? [baris('Sudah dibayar', -t.terbayar)] : []),
  ]
}

// ── Pembacaan dari database ──────────────────────────────────────────────────

export interface TagihanBayar extends TagihanSisa {
  tagihan_item: { nama_komponen: string; nominal: number; komponen: { kelas_warna: string | null } | null }[]
}

type TagihanBayarRaw = Omit<TagihanBayar, 'terbayar' | 'is_alumni'> & { siswa: { status: string | null } | null }

/**
 * Yang ditagih lewat tautan tagihan `sasaran`, dibaca dari database — dipakai halaman
 * bayar, unggah bukti, dan verifikasi. Lengkap atau gagal: daftar yang terpotong berarti
 * menagih, atau mencatat pembayaran, kurang dari yang seharusnya.
 */
export async function muatTertagih(
  db: SupabaseClient,
  sasaran: { id: string; siswa_id: string; sekolah_id: string; bulan: number; tahun: number },
  sekarang: Date,
): Promise<{ data: Tertagih<TagihanBayar> | null; error: string | null }> {
  const tagihanRes = await ambilSemua<TagihanBayarRaw>((dari, sampai) => db
    .from('tagihan')
    .select('id, bulan, tahun, jatuh_tempo, total_nominal, status, siswa:siswa_id(status), tagihan_item(nama_komponen, nominal, komponen:komponen_id(kelas_warna))')
    .eq('sekolah_id', sasaran.sekolah_id)
    .eq('siswa_id', sasaran.siswa_id)
    .neq('status', 'lunas')
    .order('id')
    .range(dari, sampai))
  if (tagihanRes.error) return { data: null, error: 'Data tagihan gagal dimuat.' }

  const pembayaranRes = await ambilPerPotong<{ tagihan_id: string; jumlah: number }>(tagihanRes.data.map(t => t.id), (ids, dari, sampai) => db
    .from('pembayaran')
    .select('id, tagihan_id, jumlah')
    .in('tagihan_id', ids)
    .order('id')
    .range(dari, sampai))
  if (pembayaranRes.error) return { data: null, error: 'Data pembayaran gagal dimuat.' }

  const terbayar = new Map<string, number>()
  for (const p of pembayaranRes.data) terbayar.set(p.tagihan_id, (terbayar.get(p.tagihan_id) ?? 0) + p.jumlah)

  const tagihan: TagihanBayar[] = tagihanRes.data.map(({ siswa, ...t }) => ({
    ...t,
    is_alumni: siswa?.status === 'alumni',
    terbayar:  terbayar.get(t.id) ?? 0,
  }))
  return { data: tagihanTertagih(tagihan, sasaran, sekarang), error: null }
}
