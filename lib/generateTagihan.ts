import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilPerPotong, ambilSemua } from './ambilSemua'
import { komponenDitagihkan, bangunRiwayatTagih, TA_PERIODE_SELECT, type PeriodeTahunAjaran } from './komponenTagihan'
import { gabungKomponenSiswa, potonganPerKomponen, type PotonganBeasiswa } from './hitungUlangTagihan'

// Penerbitan tagihan bulanan: satu tagihan per siswa aktif yang belum punya tagihan pada
// bulan itu, lengkap dengan rincian komponen, komponen individu, dan potongan beasiswanya.
// Tagihan yang sudah ada tidak pernah diubah.
//
// Penerbitannya per kelas: siswa di kelas yang belum masuk paket tahun ajaran itu
// dilewati, kelas lain tetap ditagih. Sekolah yang baru menyerahkan sebagian kelas, atau
// sedang menambah kelas sendiri, tidak boleh tertahan seluruhnya karena satu kelas yang
// belum lengkap. Siswa yang terlewat disebut di pemberitahuan (lib/statusPenerbitan).
//
// Dipakai bersama oleh halaman Tagihan Aktif (klien browser, tunduk pada RLS) dan cron
// pengingat (server, service role) — karena itu klien database-nya diterima sebagai
// parameter. Service role melewati RLS, jadi setiap query di sini harus tetap dibatasi
// ke satu sekolah: lewat sekolah_id, atau lewat daftar siswa sekolah itu.

type PaketKomponenRaw  = { komponen_id: string; nominal: number; komponen: { nama: string; jenis: string } | null }
type PaketKelasRaw     = { kelas_id: string }
type PaketForGenerate  = { id: string; paket_kelas: PaketKelasRaw[]; paket_komponen: PaketKomponenRaw[] }
type SiswaForGenerate  = { id: string; nama: string; kelas_id: string }
type ExistingTagRow    = { siswa_id: string }
type BeasiswaSiswaRaw  = { siswa_id: string; beasiswa: { jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null; beasiswa_komponen: { komponen_id: string }[] } | null }
type IndividuSiswaRaw  = { siswa_id: string; komponen_id: string; nominal: number; komponen: { nama: string; jenis: string } | null }
type RiwayatRow        = { siswa_id: string; bulan: number; tahun: number; tagihan_item: { komponen_id: string | null }[] }

/**
 * Kelas yang belum masuk paket mana pun pada tahun ajaran itu — siswanya dilewati
 * runGenerate. Diekspor supaya pemberitahuan "tagihan belum terbit" (lib/statusPenerbitan)
 * memakai aturan yang sama, bukan salinannya.
 */
export const kelasTanpaPaket = <K extends { id: string }>(
  semuaKelas: K[], kelasBerpaket: { has(id: string): boolean },
): K[] => semuaKelas.filter(k => !kelasBerpaket.has(k.id))

export async function runGenerate(
  db: SupabaseClient, sid: string, tahunAjaran: string, bulan: number, tahun: number,
): Promise<{ success: boolean; error?: string }> {
  const { data: paketData, error: e1 } = await db
    .from('paket')
    .select('id, paket_kelas(kelas_id), paket_komponen(komponen_id, nominal, komponen:komponen_id(nama, jenis))')
    .eq('sekolah_id', sid)
    .eq('tahun_ajaran', tahunAjaran)
  if (e1 || !paketData) return { success: false, error: 'Gagal memuat data paket.' }

  const kelasToKomponen = new Map<string, { komponen_id: string; nominal: number; nama: string; jenis: string }[]>()
  for (const p of (paketData as unknown as PaketForGenerate[])) {
    const komps = p.paket_komponen.map(pk => ({
      komponen_id: pk.komponen_id, nominal: pk.nominal,
      nama: pk.komponen?.nama ?? '', jenis: pk.komponen?.jenis ?? '',
    }))
    for (const pk of p.paket_kelas) kelasToKomponen.set(pk.kelas_id, komps)
  }

  const { data: siswaData, error: e2 } = await db
    .from('siswa').select('id, nama, kelas_id').eq('sekolah_id', sid).eq('status', 'aktif').limit(1000)
  if (e2 || !siswaData) return { success: false, error: 'Gagal memuat data siswa.' }

  const siswaIds = (siswaData as SiswaForGenerate[]).map(s => s.id)
  const today    = new Date().toISOString().split('T')[0]
  // Daftar siswa dipecah per potongan: satu sekolah beberapa ratus siswa sudah membuat URL
  // permintaannya terlalu panjang, dan sejak galat tidak lagi diabaikan itu berarti
  // tagihan tidak terbit sama sekali
  const [{ data: bsData, error: eBeasiswa }, { data: individuData, error: eIndividu }] = await Promise.all([
    ambilPerPotong<BeasiswaSiswaRaw>(siswaIds, (ids, dari, sampai) => db
      .from('beasiswa_siswa')
      .select('siswa_id, beasiswa:beasiswa_id(jenis_potongan, persen, nominal, beasiswa_komponen(komponen_id))')
      .in('siswa_id', ids)
      .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${today}`)
      .order('id').range(dari, sampai)),
    ambilPerPotong<IndividuSiswaRaw>(siswaIds, (ids, dari, sampai) => db
      .from('siswa_komponen_individu')
      .select('siswa_id, komponen_id, nominal, komponen:komponen_id(nama, jenis)')
      .in('siswa_id', ids)
      .order('id').range(dari, sampai)),
  ])
  // Tanpa daftar ini tagihan terbit tanpa potongan beasiswa / tanpa komponen individu
  if (eBeasiswa) return { success: false, error: 'Gagal memuat data beasiswa.' }
  if (eIndividu) return { success: false, error: 'Gagal memuat data komponen individu.' }

  const siswaBeasiswaMap = new Map<string, PotonganBeasiswa[]>()
  for (const row of bsData) {
    if (!row.beasiswa) continue
    const list = siswaBeasiswaMap.get(row.siswa_id) ?? []
    list.push({ jenis_potongan: row.beasiswa.jenis_potongan, persen: row.beasiswa.persen, nominal: row.beasiswa.nominal, komponen_ids: new Set(row.beasiswa.beasiswa_komponen.map(bk => bk.komponen_id)) })
    siswaBeasiswaMap.set(row.siswa_id, list)
  }

  const siswaIndividuMap = new Map<string, { komponen_id: string; nama: string; jenis: string; nominal: number }[]>()
  for (const row of individuData) {
    if (!row.komponen) continue
    const list = siswaIndividuMap.get(row.siswa_id) ?? []
    list.push({ komponen_id: row.komponen_id, nama: row.komponen.nama, jenis: row.komponen.jenis, nominal: row.nominal })
    siswaIndividuMap.set(row.siswa_id, list)
  }

  const { data: existingData, error: eAda } = await db
    .from('tagihan').select('siswa_id').eq('sekolah_id', sid).eq('bulan', bulan).eq('tahun', tahun)
  if (eAda) return { success: false, error: 'Gagal memuat tagihan bulan ini.' }
  const existingIds = new Set(((existingData ?? []) as ExistingTagRow[]).map(t => t.siswa_id))

  // Riwayat penagihan per siswa per komponen — dasar aturan "sekali per semester"
  // dan "sekali per tahun ajaran". Diambil dari tagihan_item, bukan sekadar
  // "siswa punya tagihan di bulan lain".
  const [riwayatRes, { data: taPeriode, error: eTa }] = await Promise.all([
    // Diambil bertahap sampai habis: satu permintaan terpotong diam-diam di batas baris
    // PostgREST, dan riwayat yang tidak lengkap membuat komponen sekali-per-semester atau
    // sekali-per-tahun-ajaran ditagihkan lagi
    ambilSemua<RiwayatRow>((dari, sampai) => db
      .from('tagihan')
      .select('siswa_id, bulan, tahun, tagihan_item(komponen_id)')
      .eq('sekolah_id', sid)
      .order('id').range(dari, sampai)),
    db
      .from('tahun_ajaran').select(TA_PERIODE_SELECT).eq('sekolah_id', sid).eq('is_aktif', true).maybeSingle(),
  ])
  // Riwayat yang gagal dimuat tidak boleh dianggap kosong — itu sama saja dengan
  // menagihkan ulang semua komponen sekali-bayar
  if (riwayatRes.error) return { success: false, error: 'Gagal memuat riwayat tagihan.' }
  // Tanpa periode tahun ajaran, komponen per semester dan sekali bayar dilewati
  // diam-diam. Sekolah yang memang belum punya tahun ajaran aktif (data kosong, tanpa
  // galat) tetap lanjut seperti sebelumnya.
  if (eTa) return { success: false, error: 'Gagal memuat tahun ajaran aktif.' }

  const riwayat = bangunRiwayatTagih(riwayatRes.data)
  const ta = (taPeriode ?? null) as PeriodeTahunAjaran | null

  const toInsert: { sekolah_id: string; siswa_id: string; bulan: number; tahun: number; total_nominal: number; status: string }[] = []
  const itemsByTempId: { komponen_id: string; nama_komponen: string; nominal: number; potongan: number; siswa_id: string }[] = []

  for (const siswa of (siswaData as SiswaForGenerate[])) {
    if (existingIds.has(siswa.id)) continue
    // Kelas yang belum berpaket dilewati tanpa menahan kelas lain
    const komps = kelasToKomponen.get(siswa.kelas_id)
    if (!komps || komps.length === 0) continue

    const bolehTagih = (k: { jenis: string; komponen_id: string }) =>
      komponenDitagihkan(k.jenis, bulan, tahun, ta, siswa.id, k.komponen_id, riwayat)

    // Komponen individu yang juga ada di paket mengganti nominal paketnya, bukan ditambahkan
    const allKomps = gabungKomponenSiswa(komps, siswaIndividuMap.get(siswa.id) ?? []).filter(bolehTagih)
    if (allKomps.length === 0) continue

    // Potongan juga dicatat per komponen, supaya wali bisa membayar komponen satu per satu
    // dengan harga sesudah beasiswa
    const potongan = potonganPerKomponen(allKomps, siswaBeasiswaMap.get(siswa.id) ?? [])

    const total = Math.max(0, allKomps.reduce((s, k) => s + k.nominal, 0) - potongan.total)
    // kelas_id, tahun_ajaran_id, dan jatuh_tempo sengaja tidak dikirim — trigger
    // database tagihan_isi_snapshot mengisinya dari siswa, rentang tahun ajaran,
    // dan tanggal jatuh tempo paket kelasnya
    toInsert.push({ sekolah_id: sid, siswa_id: siswa.id, bulan, tahun, total_nominal: total, status: 'belum_bayar' })
    allKomps.forEach((k, i) => itemsByTempId.push({
      komponen_id: k.komponen_id, nama_komponen: k.nama, nominal: k.nominal, potongan: potongan.perKomponen[i], siswa_id: siswa.id,
    }))
  }

  if (toInsert.length === 0) return { success: true }

  const { data: inserted, error: e3 } = await db.from('tagihan').insert(toInsert).select('id, siswa_id')
  if (e3) {
    // 23505 = unique violation: tagihan sudah ada dari concurrent call sebelumnya, anggap sukses
    if (e3.code === '23505') return { success: true }
    return { success: false, error: 'Gagal menyimpan tagihan.' }
  }
  if (!inserted) return { success: false, error: 'Gagal menyimpan tagihan.' }

  const siswaToTagihanId = new Map(((inserted) as { id: string; siswa_id: string }[]).map(t => [t.siswa_id, t.id]))
  const tagItems = itemsByTempId
    .map(item => ({ tagihan_id: siswaToTagihanId.get(item.siswa_id) ?? '', komponen_id: item.komponen_id, nama_komponen: item.nama_komponen, nominal: item.nominal, potongan: item.potongan }))
    .filter(i => i.tagihan_id)
  if (tagItems.length > 0) {
    const { error: e4 } = await db.from('tagihan_item').insert(tagItems)
    // Tagihan tanpa rincian dibaca nol oleh seluruh hilir (total tabel, modal
    // detail, halaman bayar, laporan). Lebih baik kegagalannya terlihat
    // daripada diam-diam menerbitkan tagihan Rp 0.
    if (e4) return { success: false, error: 'Tagihan tersimpan, tetapi rincian komponennya gagal dibuat.' }
  }

  return { success: true }
}
