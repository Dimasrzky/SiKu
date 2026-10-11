import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilPerPotong, ambilSemua } from './ambilSemua'
import { periodeIndex } from './komponenTagihan'
import { adalahTunggakan, type TagihanSisaDasar } from './metrikLaporan'
import { rincianKomponen, tagihanBukti, type RincianKomponen } from './rincianKomponen'
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
// Dari daftar itu wali boleh memilih komponen mana yang dibayar dulu, dan mencicilnya
// (lib/rincianKomponen, keputusan 11 Okt 2026).

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

// Pembagian satu pembayaran ke tagihan-tagihan ini (terlama dulu, per komponen kalau
// rinciannya utuh) ada di lib/rincianKomponen: bagiKeTagihan.

/**
 * Rincian satu tagihan yang jumlahnya sama dengan sisanya: komponen tagihan_item apa
 * adanya, lalu selisihnya dengan total_nominal (potongan beasiswa, atau komponen yang
 * tidak tercatat di rincian) dan pembayaran yang sudah masuk, masing-masing satu baris.
 */
export function rincianSisa<I extends { nama_komponen: string; nominal: number }>(
  items: I[],
  t: Pick<TagihanSisa, 'total_nominal' | 'terbayar'>,
  baris: (nama_komponen: string, nominal: number, jenis: 'potongan' | 'tambahan' | 'dibayar') => I,
): I[] {
  const selisih = t.total_nominal - items.reduce((s, i) => s + i.nominal, 0)
  return [
    ...items,
    ...(selisih !== 0 ? [selisih < 0 ? baris('Potongan beasiswa', selisih, 'potongan') : baris('Komponen tambahan', selisih, 'tambahan')] : []),
    ...(t.terbayar > 0 ? [baris('Sudah dibayar', -t.terbayar, 'dibayar')] : []),
  ]
}

// ── Pembacaan dari database ──────────────────────────────────────────────────

export interface ItemBayar {
  id:            string
  nama_komponen: string
  nominal:       number
  potongan:      number
  komponen:      { kelas_warna: string | null } | null
}

export interface TagihanBayar extends TagihanSisa {
  tagihan_item: ItemBayar[]
  /** Komponen beserta sisanya; perKomponen = false berarti tagihan ini dibayar utuh */
  rincian:      RincianKomponen<ItemBayar>
}

type TagihanBayarRaw = Omit<TagihanBayar, 'terbayar' | 'is_alumni' | 'rincian'> & { siswa: { status: string | null } | null }

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
    .select('id, bulan, tahun, jatuh_tempo, total_nominal, status, siswa:siswa_id(status), tagihan_item(id, nama_komponen, nominal, potongan, komponen:komponen_id(kelas_warna))')
    .eq('sekolah_id', sasaran.sekolah_id)
    .eq('siswa_id', sasaran.siswa_id)
    .neq('status', 'lunas')
    .order('id')
    .range(dari, sampai))
  if (tagihanRes.error) return { data: null, error: 'Data tagihan gagal dimuat.' }

  type PembayaranRow = { tagihan_id: string; jumlah: number; alokasi: unknown }
  const pembayaranRes = await ambilPerPotong<PembayaranRow>(tagihanRes.data.map(t => t.id), (ids, dari, sampai) => db
    .from('pembayaran')
    .select('id, tagihan_id, jumlah, alokasi')
    .in('tagihan_id', ids)
    .order('id')
    .range(dari, sampai))
  if (pembayaranRes.error) return { data: null, error: 'Data pembayaran gagal dimuat.' }

  const pembayaran = new Map<string, PembayaranRow[]>()
  for (const p of pembayaranRes.data) pembayaran.set(p.tagihan_id, [...(pembayaran.get(p.tagihan_id) ?? []), p])

  const tagihan: TagihanBayar[] = tagihanRes.data.map(({ siswa, ...t }) => {
    const bayar = pembayaran.get(t.id) ?? []
    return {
      ...t,
      is_alumni: siswa?.status === 'alumni',
      terbayar:  bayar.reduce((s, p) => s + p.jumlah, 0),
      rincian:   rincianKomponen(t.total_nominal, t.tagihan_item ?? [], bayar),
    }
  })
  return { data: tagihanTertagih(tagihan, sasaran, sekarang), error: null }
}

export interface BuktiMenunggu {
  id:               string
  tagihan_id:       string
  nominal_diajukan: number
  created_at:       string
  jenis:            string
  total_dipilih:    number | null
  rencana_lunas:    string | null
}

/**
 * Bukti transfer siswa ini yang masih menunggu verifikasi untuk tagihan yang belum lunas.
 * Selama ada, halaman bayar terkunci dan bukti baru ditolak — lewat tautan mana pun,
 * karena bukti yang dikirim lewat tautan bulan ini juga bisa memuat komponen tunggakan,
 * dan komponen yang sama tidak boleh dibayar dua kali. Sama dengan aturan pengingat
 * (2 Okt 2026): bukti yang tagihannya sudah lunas semua tidak dihitung.
 */
export async function muatBuktiMenunggu(
  db: SupabaseClient,
  siswa: { siswa_id: string; sekolah_id: string },
): Promise<{ data: BuktiMenunggu | null; error: string | null }> {
  type VerifikasiRow = BuktiMenunggu & { pilihan: unknown }
  const [verifikasiRes, belumLunasRes] = await Promise.all([
    db.from('verifikasi_pembayaran')
      .select('id, tagihan_id, nominal_diajukan, created_at, jenis, total_dipilih, rencana_lunas, pilihan')
      .eq('sekolah_id', siswa.sekolah_id)
      .eq('siswa_id', siswa.siswa_id)
      .eq('status', 'menunggu')
      .order('created_at', { ascending: false })
      .limit(20),
    ambilSemua<{ id: string }>((dari, sampai) => db
      .from('tagihan')
      .select('id')
      .eq('sekolah_id', siswa.sekolah_id)
      .eq('siswa_id', siswa.siswa_id)
      .neq('status', 'lunas')
      .order('id')
      .range(dari, sampai)),
  ])
  if (verifikasiRes.error || belumLunasRes.error) return { data: null, error: 'Data bukti transfer gagal dimuat.' }

  const belumLunas = new Set(belumLunasRes.data.map(t => t.id))
  const aktif = ((verifikasiRes.data ?? []) as VerifikasiRow[]).find(v => tagihanBukti(v).some(id => belumLunas.has(id)))
  if (!aktif) return { data: null, error: null }

  return {
    data: {
      id:               aktif.id,
      tagihan_id:       aktif.tagihan_id,
      nominal_diajukan: Number(aktif.nominal_diajukan),
      created_at:       aktif.created_at,
      jenis:            aktif.jenis,
      total_dipilih:    aktif.total_dipilih,
      rencana_lunas:    aktif.rencana_lunas,
    },
    error: null,
  }
}
