import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilSemua } from './ambilSemua'
import { rancangRincianSiswa, type KomponenTerbit } from './generateTagihan'
import type { PotonganBeasiswa } from './hitungUlangTagihan'
import {
  bangunRiwayatTagih, cakupanTagih, komponenDitagihkan, kunciRiwayat, periodeDariISO, periodeIndex,
  TA_PERIODE_SELECT, type PeriodeTahunAjaran, type RiwayatTagih,
} from './komponenTagihan'
import { bulanTahunWIB } from './pengingat/waktu'
import { tagihanBukti } from './rincianKomponen'
import {
  labelBulan, NOMINAL_MAKS, SUMBER_INPUT_MANUAL,
  type BulanTunggakanAwal, type DataTunggakanAwal, type HasilSimpanTunggakanAwal, type KomponenTunggakanAwal,
} from './tunggakanAwal'

// Tunggakan awal (lihat lib/tunggakanAwal) di sisi server: membaca bulan-bulan yang bisa
// diisi untuk satu siswa beserta usulan komponennya, dan menyimpan isiannya. Dipanggil
// /api/tagihan/tunggakan-awal dengan klien service role, jadi setiap query di sini dibatasi
// ke sekolah pemanggil (sekolah_id, atau siswa yang sudah dipastikan milik sekolah itu).
// Khusus server — jangan diimpor dari komponen 'use client'.

type Bulan = { bulan: number; tahun: number }

type ItemRaw = {
  id: string; komponen_id: string | null; nama_komponen: string; nominal: number; potongan: number
  komponen: { jenis: string; kelas_warna: string | null } | null
}
type KomponenEmbed = { nama: string; jenis: string; kelas_warna: string | null } | null
type TagihanRaw = {
  id: string; siswa_id: string; bulan: number; tahun: number; status: string; total_nominal: number
  sumber: string | null; tagihan_item: ItemRaw[]
}
type SiswaRaw = {
  id: string; nama: string; nis: string | null; kelas_id: string | null; status: string
  kelas: { nama: string; warna: string | null } | null
}
type PaketRaw = {
  paket_kelas: { kelas_id: string }[]
  paket_komponen: { komponen_id: string; nominal: number; komponen: KomponenEmbed }[]
}
type IndividuRaw = { komponen_id: string; nominal: number; komponen: KomponenEmbed }
type BeasiswaRaw = {
  beasiswa: { jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null; beasiswa_komponen: { komponen_id: string }[] } | null
}

/** Galat yang pesannya aman ditampilkan; rincian dari database hanya masuk log server */
class GalatTunggakan extends Error {
  status: number
  constructor(pesan: string, status = 500, sebab?: { code?: string; message?: string } | null) {
    super(pesan)
    this.status = status
    if (sebab) console.error(`[tunggakan-awal] ${pesan} — ${sebab.code ?? ''} ${sebab.message ?? ''}`)
  }
}

const PESAN_KOLOM = 'Database belum disiapkan untuk tunggakan awal (kolom tagihan.sumber belum ada).'

const kolomSumberBelumAda = (e: { code?: string; message?: string } | null): boolean =>
  !!e && (e.code === '42703' || e.code === 'PGRST204') && (e.message ?? '').includes('sumber')

/** Tabel yang belum tentu ada di semua skema — ketiadaannya bukan kegagalan */
const tabelTidakAda = (e: { code?: string; message?: string }): boolean =>
  e.code === 'PGRST205' || e.code === '42P01' || (e.message ?? '').includes('Could not find the table')

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const bacaUuid = (v: unknown): string | null => typeof v === 'string' && POLA_UUID.test(v) ? v.toLowerCase() : null

const kunciBulan = (b: Bulan): string => `${b.tahun}-${b.bulan}`
const dariPeriode = (p: number): Bulan => {
  const tahun = Math.floor((p - 1) / 12)
  return { bulan: p - tahun * 12, tahun }
}
const adalahManual = (t: TagihanRaw): boolean => t.sumber === SUMBER_INPUT_MANUAL
const jumlah = (daftar: { nominal: number }[]): number => daftar.reduce((s, k) => s + k.nominal, 0)

// ── Konteks satu siswa ───────────────────────────────────────────────────────

interface Konteks {
  sekolahId:    string
  siswa:        SiswaRaw
  ta:           PeriodeTahunAjaran & { nama: string }
  /** Bulan yang bisa diisi: awal tahun ajaran aktif sampai bulan lalu, terlama dulu */
  jendela:      Bulan[]
  /** Komponen paket kelas siswa; null kalau kelasnya belum masuk paket tahun ajaran aktif */
  paket:        KomponenTerbit[] | null
  individu:     KomponenTerbit[]
  beasiswa:     PotonganBeasiswa[]
  /** Tagihan siswa di dalam jendela, per kunciBulan */
  diJendela:    Map<string, TagihanRaw>
  /** Riwayat penagihan siswa tanpa tunggakan awal di jendela — isian itulah yang ditulis ulang */
  riwayatDasar: RiwayatTagih
  /** tagihan_id tunggakan awal → alasan tidak bisa diubah lagi */
  terkunci:     Map<string, string>
  /** komponen_id → warna komponen (komponen_tagihan.kelas_warna) */
  warna:        Map<string, string>
}

async function muatKonteks(db: SupabaseClient, sekolahId: string, siswaId: string): Promise<Konteks> {
  const [siswaRes, taRes] = await Promise.all([
    db.from('siswa')
      .select('id, nama, nis, kelas_id, status, kelas:kelas_id(nama, warna)')
      .eq('id', siswaId).eq('sekolah_id', sekolahId).maybeSingle(),
    db.from('tahun_ajaran')
      .select(`nama, ${TA_PERIODE_SELECT}`)
      .eq('sekolah_id', sekolahId).eq('is_aktif', true).maybeSingle(),
  ])
  if (siswaRes.error || taRes.error) throw new GalatTunggakan('Data siswa gagal dimuat.', 500, siswaRes.error ?? taRes.error)
  const siswa = siswaRes.data as unknown as SiswaRaw | null
  if (!siswa) throw new GalatTunggakan('Siswa tidak ditemukan.', 404)
  if (siswa.status !== 'aktif') throw new GalatTunggakan('Tunggakan awal hanya bisa diisi untuk siswa aktif.', 400)
  const ta = taRes.data as unknown as (PeriodeTahunAjaran & { nama: string }) | null
  if (!ta) throw new GalatTunggakan('Belum ada tahun ajaran aktif.', 400)

  // Sampai bulan lalu menurut kalender WIB: bulan berjalan diterbitkan SiKu sendiri
  const kini    = bulanTahunWIB(new Date())
  const mulai   = periodeDariISO(ta.tanggal_mulai)
  const akhir   = Math.min(periodeDariISO(ta.tanggal_selesai), periodeIndex(kini.bulan, kini.tahun) - 1)
  const jendela: Bulan[] = []
  for (let p = mulai; p <= akhir; p++) jendela.push(dariPeriode(p))
  const dalamJendela = new Set(jendela.map(kunciBulan))

  const hariIni = new Date().toISOString().split('T')[0]
  const [paketRes, individuRes, beasiswaRes, tagihanRes] = await Promise.all([
    db.from('paket')
      .select('paket_kelas(kelas_id), paket_komponen(komponen_id, nominal, komponen:komponen_id(nama, jenis, kelas_warna))')
      .eq('sekolah_id', sekolahId).eq('tahun_ajaran', ta.nama).limit(200),
    db.from('siswa_komponen_individu')
      .select('komponen_id, nominal, komponen:komponen_id(nama, jenis, kelas_warna)')
      .eq('siswa_id', siswa.id).limit(200),
    // Beasiswa yang berlaku hari ini, sama dengan penerbitan — hanya untuk usulan nominal
    db.from('beasiswa_siswa')
      .select('beasiswa:beasiswa_id(jenis_potongan, persen, nominal, beasiswa_komponen(komponen_id))')
      .eq('siswa_id', siswa.id)
      .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${hariIni}`)
      .limit(50),
    // Seluruh tagihan siswa: bahan keadaan tiap bulan dan riwayat komponen per semester /
    // sekali bayar. Diambil bertahap supaya tidak terpotong diam-diam.
    ambilSemua<TagihanRaw>((dari, sampai) => db.from('tagihan')
      .select('id, siswa_id, bulan, tahun, status, total_nominal, sumber, tagihan_item(id, komponen_id, nama_komponen, nominal, potongan, komponen:komponen_id(jenis, kelas_warna))')
      .eq('sekolah_id', sekolahId).eq('siswa_id', siswa.id)
      .order('id').range(dari, sampai)),
  ])
  if (kolomSumberBelumAda(tagihanRes.error)) throw new GalatTunggakan(PESAN_KOLOM, 500, tagihanRes.error)
  const galatMuat = paketRes.error ?? individuRes.error ?? beasiswaRes.error ?? tagihanRes.error
  if (galatMuat) throw new GalatTunggakan('Data tagihan siswa gagal dimuat.', 500, galatMuat)

  const paketKelas = ((paketRes.data ?? []) as unknown as PaketRaw[])
    .find(p => p.paket_kelas.some(pk => pk.kelas_id === siswa.kelas_id))

  // Warna tiap komponen, untuk chip dan kolom nominal di modal
  const warna = new Map<string, string>()
  const catatWarna = (id: string | null, w: string | null | undefined) => { if (id && w && !warna.has(id)) warna.set(id, w) }
  for (const pk of paketKelas?.paket_komponen ?? []) catatWarna(pk.komponen_id, pk.komponen?.kelas_warna)
  for (const r of (individuRes.data ?? []) as unknown as IndividuRaw[]) catatWarna(r.komponen_id, r.komponen?.kelas_warna)
  for (const t of tagihanRes.data) for (const i of t.tagihan_item ?? []) catatWarna(i.komponen_id, i.komponen?.kelas_warna)
  const paket = siswa.kelas_id && paketKelas
    ? paketKelas.paket_komponen.map(pk => ({
        komponen_id: pk.komponen_id, nominal: pk.nominal, nama: pk.komponen?.nama ?? '', jenis: pk.komponen?.jenis ?? '',
      }))
    : null

  const individu: KomponenTerbit[] = ((individuRes.data ?? []) as unknown as IndividuRaw[])
    .filter(r => r.komponen)
    .map(r => ({ komponen_id: r.komponen_id, nominal: r.nominal, nama: r.komponen?.nama ?? '', jenis: r.komponen?.jenis ?? '' }))

  const beasiswa: PotonganBeasiswa[] = ((beasiswaRes.data ?? []) as unknown as BeasiswaRaw[])
    .flatMap(r => r.beasiswa ? [{
      jenis_potongan: r.beasiswa.jenis_potongan, persen: r.beasiswa.persen, nominal: r.beasiswa.nominal,
      komponen_ids: new Set(r.beasiswa.beasiswa_komponen.map(bk => bk.komponen_id)),
    }] : [])

  const diJendela = new Map<string, TagihanRaw>()
  for (const t of tagihanRes.data) {
    const kunci = kunciBulan(t)
    if (dalamJendela.has(kunci) && !diJendela.has(kunci)) diJendela.set(kunci, t)
  }
  const manualDiJendela = new Set([...diJendela.values()].filter(adalahManual).map(t => t.id))
  const riwayatDasar = bangunRiwayatTagih(tagihanRes.data.filter(t => !manualDiJendela.has(t.id)))

  // Tunggakan awal yang sudah dibayar, sedang dibayar online, atau dikirimi bukti transfer
  // tidak boleh berubah lagi: nominalnya sudah menjadi dasar uang yang masuk
  const terkunci = new Map<string, string>()
  if (manualDiJendela.size > 0) {
    const ids = [...manualDiJendela]
    const [bayarRes, trxRes, buktiRes] = await Promise.all([
      db.from('pembayaran').select('tagihan_id').in('tagihan_id', ids).limit(1000),
      db.from('payment_gateway_trx').select('tagihan_id').in('tagihan_id', ids).limit(1000),
      ambilSemua<{ tagihan_id: string; pilihan: unknown }>((dari, sampai) => db.from('verifikasi_pembayaran')
        .select('id, tagihan_id, pilihan')
        .eq('sekolah_id', sekolahId).eq('siswa_id', siswa.id)
        .order('id').range(dari, sampai)),
    ])
    const galatKunci = bayarRes.error ?? buktiRes.error ?? (trxRes.error && !tabelTidakAda(trxRes.error) ? trxRes.error : null)
    if (galatKunci) throw new GalatTunggakan('Data pembayaran siswa gagal dimuat.', 500, galatKunci)

    for (const p of (bayarRes.data ?? []) as { tagihan_id: string }[]) terkunci.set(p.tagihan_id, 'Sudah ada pembayaran')
    for (const p of (trxRes.data ?? []) as { tagihan_id: string }[]) {
      if (!terkunci.has(p.tagihan_id)) terkunci.set(p.tagihan_id, 'Ada transaksi pembayaran online')
    }
    for (const v of buktiRes.data) {
      for (const id of tagihanBukti(v)) {
        if (manualDiJendela.has(id) && !terkunci.has(id)) terkunci.set(id, 'Ada bukti transfer dari wali')
      }
    }
  }

  return { sekolahId, siswa, ta, jendela, paket, individu, beasiswa, diJendela, riwayatDasar, terkunci, warna }
}

/** Kunci cakupan komponen per semester / sekali bayar pada bulan itu (lihat KomponenTunggakanAwal) */
function kunciCakupan(k: Konteks, komponenId: string, jenis: string, b: Bulan): string | null {
  const c = cakupanTagih(jenis, b.bulan, b.tahun, k.ta)
  return c.mode === 'sekali' ? `${komponenId}|${c.mulai}-${c.selesai}` : null
}

/**
 * Usulan komponen satu bulan — yang akan diterbitkan SiKu untuk bulan itu (rancangRincianSiswa)
 * dengan riwayat tanpa tunggakan awal, sesudah potongan beasiswa. Komponen per semester /
 * sekali bayar yang belum pernah ditagih muncul di setiap bulan cakupannya; yang memilih satu
 * bulan saja adalah bendahara, dan POST menolak kalau dipilih dua kali.
 */
function usulanKomponen(k: Konteks, b: Bulan): KomponenTunggakanAwal[] {
  if (!k.paket) return []
  const r = rancangRincianSiswa({
    siswaId: k.siswa.id, bulan: b.bulan, tahun: b.tahun,
    paket: k.paket, individu: k.individu, beasiswa: k.beasiswa, ta: k.ta, riwayat: k.riwayatDasar,
  })
  return r.komponen.map((kp, i) => ({
    komponen_id:  kp.komponen_id,
    nama:         kp.nama,
    jenis:        kp.jenis,
    warna:        k.warna.get(kp.komponen_id) ?? null,
    nominal:      Math.max(0, kp.nominal - r.potongan[i]),
    tersimpan:    false,
    kunciCakupan: kunciCakupan(k, kp.komponen_id, kp.jenis, b),
  }))
}

/** Rincian tunggakan awal yang tersimpan, per komponen (baris pertama tiap komponen) */
function itemTersimpan(t: TagihanRaw): Map<string, ItemRaw> {
  const hasil = new Map<string, ItemRaw>()
  for (const i of t.tagihan_item ?? []) {
    if (i.komponen_id && !hasil.has(i.komponen_id)) hasil.set(i.komponen_id, i)
  }
  return hasil
}

function susunBulan(k: Konteks, b: Bulan): BulanTunggakanAwal {
  const t = k.diJendela.get(kunciBulan(b))
  if (t && !adalahManual(t)) return { ...b, keadaan: 'sistem', tagihan_id: t.id, terkunci: null, komponen: [] }

  const usulan = usulanKomponen(k, b)
  if (!t) return { ...b, keadaan: 'kosong', tagihan_id: null, terkunci: null, komponen: usulan }

  // Yang tersimpan menggantikan usulannya; komponen tersimpan yang tidak ada di usulan
  // (mis. sudah dikeluarkan dari paket) tetap tampil supaya bisa diubah atau dihapus
  const tersimpan = itemTersimpan(t)
  const dariItem = (i: ItemRaw): KomponenTunggakanAwal => {
    const jenis = i.komponen?.jenis ?? ''
    return {
      komponen_id: i.komponen_id ?? '', nama: i.nama_komponen, jenis,
      warna: i.komponen?.kelas_warna ?? k.warna.get(i.komponen_id ?? '') ?? null,
      nominal: Math.max(0, i.nominal - i.potongan), tersimpan: true,
      kunciCakupan: kunciCakupan(k, i.komponen_id ?? '', jenis, b),
    }
  }
  const diUsulan = new Set(usulan.map(u => u.komponen_id))
  return {
    ...b, keadaan: 'manual', tagihan_id: t.id, terkunci: k.terkunci.get(t.id) ?? null,
    komponen: [
      ...usulan.map(u => { const i = tersimpan.get(u.komponen_id); return i ? dariItem(i) : u }),
      ...[...tersimpan.values()].filter(i => !diUsulan.has(i.komponen_id ?? '')).map(dariItem),
    ],
  }
}

function susunData(k: Konteks): DataTunggakanAwal {
  return {
    siswa: {
      id: k.siswa.id, nama: k.siswa.nama, nis: k.siswa.nis,
      kelas_nama: k.siswa.kelas?.nama ?? null, kelas_warna: k.siswa.kelas?.warna ?? null,
    },
    tahunAjaran: k.ta.nama,
    bulan:       k.jendela.map(b => susunBulan(k, b)),
    tanpaPaket:  k.paket === null,
  }
}

// ── Isian dari browser ───────────────────────────────────────────────────────

interface Isian {
  siswaId: string
  /** kunciBulan → komponen_id → nominal (> 0 saja) */
  bulan:   Map<string, { b: Bulan; komponen: Map<string, number> }>
}

function bacaIsian(body: unknown): Isian | string {
  if (!body || typeof body !== 'object') return 'Isian tidak valid.'
  const raw = body as { siswa_id?: unknown; bulan?: unknown }
  const siswaId = bacaUuid(raw.siswa_id)
  if (!siswaId) return 'Siswa tidak valid.'
  if (!Array.isArray(raw.bulan) || raw.bulan.length > 24) return 'Daftar bulan tidak valid.'

  const bulan: Isian['bulan'] = new Map()
  for (const item of raw.bulan as unknown[]) {
    if (!item || typeof item !== 'object') return 'Daftar bulan tidak valid.'
    const r = item as { bulan?: unknown; tahun?: unknown; komponen?: unknown }
    if (!Number.isInteger(r.bulan) || !Number.isInteger(r.tahun)) return 'Bulan tidak valid.'
    const b: Bulan = { bulan: r.bulan as number, tahun: r.tahun as number }
    if (b.bulan < 1 || b.bulan > 12 || b.tahun < 2000 || b.tahun > 2100) return 'Bulan tidak valid.'
    if (bulan.has(kunciBulan(b))) return `${labelBulan(b)} terkirim dua kali.`
    if (!Array.isArray(r.komponen) || r.komponen.length > 50) return `Komponen ${labelBulan(b)} tidak valid.`

    const komponen = new Map<string, number>()
    for (const kRaw of r.komponen as unknown[]) {
      const kv = (kRaw ?? {}) as { komponen_id?: unknown; nominal?: unknown }
      const id = bacaUuid(kv.komponen_id)
      if (!id) return `Komponen ${labelBulan(b)} tidak valid.`
      if (!Number.isInteger(kv.nominal) || (kv.nominal as number) < 0 || (kv.nominal as number) > NOMINAL_MAKS) {
        return `Nominal ${labelBulan(b)} harus angka bulat 0 sampai ${NOMINAL_MAKS.toLocaleString('id-ID')}.`
      }
      if (komponen.has(id)) return `Ada komponen ganda di ${labelBulan(b)}.`
      if ((kv.nominal as number) > 0) komponen.set(id, kv.nominal as number)
    }
    bulan.set(kunciBulan(b), { b, komponen })
  }
  return { siswaId, bulan }
}

// ── Penyimpanan ──────────────────────────────────────────────────────────────

type KomponenSimpan = { komponen_id: string; nama: string; nominal: number }
type Rencana =
  | { aksi: 'buat'; b: Bulan; komponen: KomponenSimpan[] }
  | { aksi: 'ubah'; b: Bulan; tagihan: TagihanRaw; komponen: KomponenSimpan[] }
  | { aksi: 'hapus'; b: Bulan; tagihan: TagihanRaw }

function tambahRiwayat(riwayat: RiwayatTagih, siswaId: string, b: Bulan, komponenIds: (string | null)[]) {
  const p = periodeIndex(b.bulan, b.tahun)
  for (const id of komponenIds) {
    if (!id) continue
    const kunci = kunciRiwayat(siswaId, id)
    riwayat.set(kunci, [...(riwayat.get(kunci) ?? []), p])
  }
}

/** Isian bulan itu sama persis dengan yang tersimpan */
function samaDenganTersimpan(t: TagihanRaw, komponen: Map<string, number>): boolean {
  const tersimpan = itemTersimpan(t)
  if (tersimpan.size !== komponen.size) return false
  return [...komponen].every(([id, nominal]) => {
    const i = tersimpan.get(id)
    return !!i && i.nominal - i.potongan === nominal
  })
}

/**
 * Dari keadaan sekarang dan isian, apa yang harus ditulis per bulan. Semua pemeriksaan
 * dilakukan di sini, sebelum ada yang ditulis — isian yang ditolak tidak menyisakan
 * perubahan separuh.
 */
async function susunRencana(db: SupabaseClient, k: Konteks, isian: Isian): Promise<Rencana[]> {
  const dalamJendela = new Set(k.jendela.map(kunciBulan))
  for (const { b } of isian.bulan.values()) {
    if (!dalamJendela.has(kunciBulan(b))) {
      throw new GalatTunggakan(`${labelBulan(b)} bukan bulan sebelumnya di tahun ajaran ${k.ta.nama}.`, 400)
    }
  }

  const rencana: Rencana[] = []
  // Diisi berurutan dari bulan terlama: komponen per semester / sekali bayar hanya boleh
  // sekali dalam cakupannya, termasuk di antara bulan-bulan isian ini sendiri
  const riwayat: RiwayatTagih = new Map([...k.riwayatDasar].map(([kunci, p]) => [kunci, [...p]]))

  for (const b of k.jendela) {
    const label = labelBulan(b)
    const t     = k.diJendela.get(kunciBulan(b))
    const minta = isian.bulan.get(kunciBulan(b))?.komponen ?? new Map<string, number>()

    if (t && !adalahManual(t)) {
      if (minta.size > 0) throw new GalatTunggakan(`${label} sudah ditagih SiKu, jadi tidak bisa diisi tunggakan awal.`, 409)
      continue // rinciannya sudah ada di riwayatDasar
    }

    const alasan = t ? k.terkunci.get(t.id) : undefined
    if (t && alasan) {
      // Bulan terkunci yang tidak dikirim dibiarkan; yang dikirim harus sama dengan isinya
      if (isian.bulan.has(kunciBulan(b)) && !samaDenganTersimpan(t, minta)) {
        throw new GalatTunggakan(`Tunggakan ${label} tidak bisa diubah lagi: ${alasan.toLowerCase()}.`, 409)
      }
      tambahRiwayat(riwayat, k.siswa.id, b, t.tagihan_item.map(i => i.komponen_id))
      continue
    }

    if (minta.size === 0) {
      if (t) rencana.push({ aksi: 'hapus', b, tagihan: t })
      continue
    }

    // Yang boleh diisi: usulan bulan itu, ditambah komponen yang sudah tersimpan di sana
    const boleh = new Map<string, { nama: string; jenis: string }>()
    for (const u of usulanKomponen(k, b)) boleh.set(u.komponen_id, { nama: u.nama, jenis: u.jenis })
    if (t) {
      for (const i of itemTersimpan(t).values()) {
        if (!boleh.has(i.komponen_id ?? '')) boleh.set(i.komponen_id ?? '', { nama: i.nama_komponen, jenis: i.komponen?.jenis ?? '' })
      }
    }

    const komponen: KomponenSimpan[] = [...minta].map(([id, nominal]) => {
      const info = boleh.get(id)
      if (!info) throw new GalatTunggakan(`Komponen di ${label} tidak dikenali. Buka ulang siswanya lalu coba lagi.`, 400)
      const sekali = info.jenis === 'per_semester' || info.jenis === 'sekali_bayar'
      if (sekali && !komponenDitagihkan(info.jenis, b.bulan, b.tahun, k.ta, k.siswa.id, id, riwayat)) {
        const cakupan = info.jenis === 'per_semester' ? 'semester' : 'tahun ajaran'
        throw new GalatTunggakan(`${info.nama} sudah ditagih di ${cakupan} ini, jadi tidak bisa ditagih lagi di ${label}.`, 400)
      }
      return { komponen_id: id, nama: info.nama, nominal }
    })
    tambahRiwayat(riwayat, k.siswa.id, b, komponen.map(c => c.komponen_id))

    if (!t) rencana.push({ aksi: 'buat', b, komponen })
    else if (!samaDenganTersimpan(t, minta) || t.total_nominal !== jumlah(komponen)) rencana.push({ aksi: 'ubah', b, tagihan: t, komponen })
  }

  // Tunggakan awal yang sudah dikirimi pengingat WhatsApp tidak dihapus: job pengingatnya
  // menunjuk tagihan itu
  const hapusIds = rencana.flatMap(r => r.aksi === 'hapus' ? [r.tagihan.id] : [])
  if (hapusIds.length > 0) {
    const { data, error } = await db.from('reminder_job').select('tagihan_id').in('tagihan_id', hapusIds).limit(100)
    if (error && !tabelTidakAda(error)) throw new GalatTunggakan('Data pengingat gagal dimuat.', 500, error)
    const dipakai = new Set(((data ?? []) as { tagihan_id: string }[]).map(j => j.tagihan_id))
    const kena = rencana.find(r => r.aksi === 'hapus' && dipakai.has(r.tagihan.id))
    if (kena) {
      throw new GalatTunggakan(`Tunggakan ${labelBulan(kena.b)} sudah dipakai pengingat WhatsApp, jadi tidak bisa dihapus. Nominalnya masih bisa diubah.`, 409)
    }
  }

  return rencana
}

async function buat(db: SupabaseClient, k: Konteks, b: Bulan, komponen: KomponenSimpan[]) {
  // kelas_id, tahun_ajaran_id, dan jatuh_tempo diisi trigger database tagihan_isi_snapshot,
  // sama dengan penerbitan biasa — jatuh temponya dari paket kelas, jadi langsung lewat tempo
  const { data, error } = await db.from('tagihan').insert({
    sekolah_id: k.sekolahId, siswa_id: k.siswa.id, bulan: b.bulan, tahun: b.tahun,
    total_nominal: jumlah(komponen), status: 'belum_bayar', sumber: SUMBER_INPUT_MANUAL,
  }).select('id').single()
  if (error) {
    if (error.code === '23505') throw new GalatTunggakan(`${labelBulan(b)} sudah punya tagihan. Buka ulang siswanya lalu coba lagi.`, 409)
    if (kolomSumberBelumAda(error)) throw new GalatTunggakan(PESAN_KOLOM, 500, error)
    throw new GalatTunggakan(`Tunggakan ${labelBulan(b)} gagal disimpan.`, 500, error)
  }
  const tagihanId = (data as { id: string }).id
  const { error: eItem } = await db.from('tagihan_item').insert(komponen.map(c => ({
    tagihan_id: tagihanId, komponen_id: c.komponen_id, nama_komponen: c.nama, nominal: c.nominal, potongan: 0,
  })))
  if (eItem) {
    // Tagihan tanpa rincian dibaca nol di seluruh hilir — lebih baik tidak ada sama sekali
    await db.from('tagihan').delete().eq('id', tagihanId).eq('sekolah_id', k.sekolahId)
    throw new GalatTunggakan(`Rincian tunggakan ${labelBulan(b)} gagal disimpan.`, 500, eItem)
  }
}

async function ubah(db: SupabaseClient, k: Konteks, b: Bulan, t: TagihanRaw, komponen: KomponenSimpan[]) {
  const tersimpan = itemTersimpan(t)
  const diminta   = new Set(komponen.map(c => c.komponen_id))
  // Baris tanpa komponen, baris kembar, dan komponen yang tidak diminta lagi dibuang
  const pertama   = new Set([...tersimpan.values()].map(i => i.id))
  const buang     = t.tagihan_item.filter(i => !pertama.has(i.id) || !diminta.has(i.komponen_id ?? '')).map(i => i.id)
  const sisip     = komponen.filter(c => !tersimpan.has(c.komponen_id))
  const perbarui  = komponen.flatMap(c => {
    const i = tersimpan.get(c.komponen_id)
    return i && (i.nominal !== c.nominal || i.potongan !== 0) ? [{ id: i.id, nominal: c.nominal }] : []
  })
  const gagal = (sebab: { code?: string; message?: string }) =>
    new GalatTunggakan(`Perubahan tunggakan ${labelBulan(b)} gagal disimpan. Buka ulang siswanya untuk memeriksa.`, 500, sebab)

  if (sisip.length > 0) {
    const { error } = await db.from('tagihan_item').insert(sisip.map(c => ({
      tagihan_id: t.id, komponen_id: c.komponen_id, nama_komponen: c.nama, nominal: c.nominal, potongan: 0,
    })))
    if (error) throw gagal(error)
  }
  for (const p of perbarui) {
    const { error } = await db.from('tagihan_item').update({ nominal: p.nominal, potongan: 0 }).eq('id', p.id).eq('tagihan_id', t.id)
    if (error) throw gagal(error)
  }
  if (buang.length > 0) {
    const { error } = await db.from('tagihan_item').delete().in('id', buang).eq('tagihan_id', t.id)
    if (error) throw gagal(error)
  }
  const { error } = await db.from('tagihan').update({ total_nominal: jumlah(komponen) })
    .eq('id', t.id).eq('sekolah_id', k.sekolahId).eq('sumber', SUMBER_INPUT_MANUAL)
  if (error) throw gagal(error)
}

async function hapus(db: SupabaseClient, k: Konteks, b: Bulan, t: TagihanRaw) {
  const { error: eItem } = await db.from('tagihan_item').delete().eq('tagihan_id', t.id)
  if (eItem) throw new GalatTunggakan(`Tunggakan ${labelBulan(b)} gagal dihapus.`, 500, eItem)
  const { error } = await db.from('tagihan').delete()
    .eq('id', t.id).eq('sekolah_id', k.sekolahId).eq('sumber', SUMBER_INPUT_MANUAL)
  if (error) {
    // Kembalikan rinciannya supaya tagihan yang tertinggal tidak terbaca Rp 0
    await db.from('tagihan_item').insert(t.tagihan_item.map(i => ({
      tagihan_id: t.id, komponen_id: i.komponen_id, nama_komponen: i.nama_komponen, nominal: i.nominal, potongan: i.potongan,
    })))
    throw new GalatTunggakan(`Tunggakan ${labelBulan(b)} gagal dihapus.`, 500, error)
  }
}

// ── Pintu masuk ──────────────────────────────────────────────────────────────

export type HasilServer<T> = { data: T; error: null } | { data: null; error: string; status: number }

function keHasil(e: unknown): { data: null; error: string; status: number } {
  if (e instanceof GalatTunggakan) return { data: null, error: e.message, status: e.status }
  console.error('[tunggakan-awal] galat tak terduga:', e)
  return { data: null, error: 'Terjadi kesalahan pada server.', status: 500 }
}

/** Bulan-bulan yang bisa diisi untuk satu siswa beserta usulan komponennya */
export async function bacaTunggakanAwal(
  db: SupabaseClient, sekolahId: string, siswaIdRaw: unknown,
): Promise<HasilServer<DataTunggakanAwal>> {
  const siswaId = bacaUuid(siswaIdRaw)
  if (!siswaId) return { data: null, error: 'Siswa tidak valid.', status: 400 }
  try {
    return { data: susunData(await muatKonteks(db, sekolahId, siswaId)), error: null }
  } catch (e) {
    return keHasil(e)
  }
}

/** Simpan isian tunggakan awal satu siswa (body = SimpanTunggakanAwal) */
export async function simpanTunggakanAwal(
  db: SupabaseClient, sekolahId: string, body: unknown,
): Promise<HasilServer<HasilSimpanTunggakanAwal>> {
  const isian = bacaIsian(body)
  if (typeof isian === 'string') return { data: null, error: isian, status: 400 }

  try {
    const k       = await muatKonteks(db, sekolahId, isian.siswaId)
    const rencana = await susunRencana(db, k, isian)

    const hasil: HasilSimpanTunggakanAwal = { dibuat: 0, diubah: 0, dihapus: 0 }
    for (const r of rencana) {
      try {
        if (r.aksi === 'buat')      { await buat(db, k, r.b, r.komponen);            hasil.dibuat++ }
        else if (r.aksi === 'ubah') { await ubah(db, k, r.b, r.tagihan, r.komponen); hasil.diubah++ }
        else                        { await hapus(db, k, r.b, r.tagihan);            hasil.dihapus++ }
      } catch (e) {
        // Bulan sebelumnya sudah tertulis — sampaikan, supaya bendahara tidak mengisinya dua kali
        const sudah = hasil.dibuat + hasil.diubah + hasil.dihapus
        if (e instanceof GalatTunggakan && sudah > 0) {
          throw new GalatTunggakan(`${e.message} Bulan lain yang sudah tersimpan tetap tersimpan.`, e.status)
        }
        throw e
      }
    }
    return { data: hasil, error: null }
  } catch (e) {
    return keHasil(e)
  }
}
