import { supabase } from './supabase'
import { ambilSemua } from './ambilSemua'
import { periodeIndex, type PeriodeTahunAjaran } from './komponenTagihan'

// Nilai tagihan satu periode beserta uang yang sudah masuk — satu rumus untuk card
// "Total tagihan periode ini" di Tagihan Aktif dan "Tingkat Pelunasan" di Pembayaran,
// supaya "belum masuk" di kedua halaman tidak pernah berselisih.

export type BulanTahun = { bulan: number; tahun: number }

export interface RingkasanPeriode {
  /** Nilai seluruh tagihan periode yang sudah terbit — tunggakan sebelumnya + bulan ini */
  total: number
  /** Uang yang sudah masuk untuk tagihan itu — pembayaran per tagihan, dibatasi nilainya */
  masuk: number
  /** Bulan tagihan paling awal dan paling akhir yang ikut dihitung, untuk keterangan card */
  awal:  BulanTahun | null
  akhir: BulanTahun | null
}

export const RINGKASAN_PERIODE_KOSONG: RingkasanPeriode = { total: 0, masuk: 0, awal: null, akhir: null }

/**
 * Ringkasan nilai tagihan satu periode: tahun ajaran aktif sampai bulan berjalan —
 * rentang yang sama dengan kartu "Total Tunggakan Aktif" di dashboard. Tanpa tahun
 * ajaran aktif, seluruh tagihan yang sudah terbit ikut dihitung.
 *
 * Uang masuk = pembayaran per tagihan dibatasi nilai tagihannya, sama dengan kolom
 * Terbayar di Laporan, sehingga cicilan yang belum lunas pun ikut terhitung.
 */
export async function muatRingkasanPeriode(
  sid: string,
  ta: PeriodeTahunAjaran | null,
  bulan: number,
  tahun: number,
): Promise<RingkasanPeriode> {
  const mulai    = ta ? new Date(ta.tanggal_mulai) : null
  const selesai  = ta ? new Date(ta.tanggal_selesai) : null
  const idxMulai = mulai ? periodeIndex(mulai.getMonth() + 1, mulai.getFullYear()) : -Infinity
  const idxAkhir = Math.min(
    selesai ? periodeIndex(selesai.getMonth() + 1, selesai.getFullYear()) : Infinity,
    periodeIndex(bulan, tahun),
  )

  // Diambil bertahap — satu permintaan bisa diam-diam terpotong di batas baris PostgREST
  const [tagihanRes, bayarRes] = await Promise.all([
    ambilSemua<{ id: string; bulan: number; tahun: number; total_nominal: number }>((dari, sampai) => {
      let q = supabase.from('tagihan').select('id, bulan, tahun, total_nominal').eq('sekolah_id', sid).lte('tahun', tahun)
      if (mulai) q = q.gte('tahun', mulai.getFullYear())
      return q.order('id').range(dari, sampai)
    }),
    ambilSemua<{ tagihan_id: string; jumlah: number }>((dari, sampai) =>
      supabase.from('pembayaran').select('tagihan_id, jumlah').eq('sekolah_id', sid).order('id').range(dari, sampai)),
  ])
  if (tagihanRes.error) console.error('[Ringkasan periode] gagal memuat tagihan:', tagihanRes.error)
  if (bayarRes.error)   console.error('[Ringkasan periode] gagal memuat pembayaran:', bayarRes.error)

  const dibayar = new Map<string, number>()
  for (const p of bayarRes.data) dibayar.set(p.tagihan_id, (dibayar.get(p.tagihan_id) ?? 0) + p.jumlah)

  const ringkasan: RingkasanPeriode = { total: 0, masuk: 0, awal: null, akhir: null }
  for (const t of tagihanRes.data) {
    const idx = periodeIndex(t.bulan, t.tahun)
    if (idx < idxMulai || idx > idxAkhir) continue
    ringkasan.total += t.total_nominal
    ringkasan.masuk += Math.min(dibayar.get(t.id) ?? 0, t.total_nominal)
    if (!ringkasan.awal  || idx < periodeIndex(ringkasan.awal.bulan,  ringkasan.awal.tahun))  ringkasan.awal  = { bulan: t.bulan, tahun: t.tahun }
    if (!ringkasan.akhir || idx > periodeIndex(ringkasan.akhir.bulan, ringkasan.akhir.tahun)) ringkasan.akhir = { bulan: t.bulan, tahun: t.tahun }
  }
  return ringkasan
}
