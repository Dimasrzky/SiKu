import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilSemua } from '../ambilSemua'
import { runGenerate } from '../generateTagihan'
import { selisihHari } from '../metrikLaporan'
import { jadwalPengingat, SELECT_JADWAL_PENGINGAT, type BarisJadwalPengingat } from './jadwal'
import { KONFIG_PENGINGAT, type KonfigPengingat } from './konfig'
import { ringkasOtomatis } from './kelayakan'
import { lolosPembatas, muatPembatas, pilihSender, sisipkanJob } from './pembatas'
import { dalamCooldown, muatPenilaian, type PenilaianSiswa } from './penilaian'
import { muatKonteksPesan, susunIsiJob, type IsiJob } from './pesan'
import { awalHariWIB, bulanTahunWIB } from './waktu'

// Pengingat otomatis: tiap pagi, tagihan yang jatuh tempo 7, 3, atau 1 hari lagi
// dibuatkan job prioritas 1 (keputusan 1 Okt 2026 — spec aslinya mengingatkan pada hari
// jatuh tempo). Hari mana yang dipakai dinyalakan tiap sekolah lewat toggle di Pengaturan
// (lib/pengingat/jadwal). Hanya untuk sekolah yang saklarnya menyala dan kemitraannya
// sudah dikonfirmasi, dan kelas yang dipilih di modal "Ingatkan orang tua". Tidak ada
// pesan yang dikirim dari sini.
//
// Sebelum menilai, tagihan bulan berjalan diterbitkan lebih dulu dengan fungsi yang sama
// dengan halaman Tagihan Aktif — tanpa itu pengingat bergantung pada admin membuka
// halaman tersebut. Hanya bulan berjalan: tagihan bulan depan tidak diterbitkan lebih awal.
//
// Khusus server (service role). Jangan diimpor dari komponen 'use client'.

interface JobOtomatisBaru extends IsiJob {
  wa_sender_id: string
  sekolah_id:   string
  siswa_id:     string
  wali_phone:   string
  source:       'otomatis'
  days_before:  number
  priority:     1
  available_at: string
}

export interface LaporanOtomatis {
  sekolahId: string
  /** Job pengingat yang dibuat pagi ini */
  dibuat:    number
  /** Tagihan yang jatuh tempo pada hari pengingat sekolah ini tetapi tidak dibuatkan job */
  dilewati:  number
  /** Pembuatan job gagal untuk sekolah ini; sekolah lain tetap diproses */
  galat?:    string
  /**
   * Alasan tagihan bulan berjalan tidak diterbitkan pagi ini (mis. belum ada tahun ajaran
   * aktif, atau datanya gagal dimuat). Kelas tanpa paket bukan alasan: kelasnya saja yang
   * dilewati. Pengingat untuk tagihan yang sudah ada tetap dibuat.
   */
  tidakTerbit?: string
}

export interface OpsiOtomatis {
  /** Alamat aplikasi tanpa garis miring di akhir, untuk tautan halaman bayar */
  origin:    string
  sekarang?: Date
  konfig?:   KonfigPengingat
  /** Penerbit tagihan bulan berjalan — hanya diganti saat pengujian */
  terbitkan?: typeof runGenerate
}

/** Kolom pengaturan yang SQL-nya belum dijalankan — dianggap "belum pernah diatur" */
const kolomBelumAda = (e: { code?: string; message?: string } | null): boolean =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /pengingat_(kelas_ids|h\d)/.test(e.message ?? ''))

interface SekolahPenerima {
  sekolah_id: string
  /** null = semua kelas */
  kelas:      Set<string> | null
  /** Hari sebelum jatuh tempo yang dinyalakan sekolah; kosong = tanpa pengingat otomatis */
  jadwal:     number[]
}

async function sekolahPenerima(db: SupabaseClient): Promise<{ data: SekolahPenerima[] | null; error: string | null }> {
  type Baris = { sekolah_id: string; pengingat_kelas_ids?: string[] | null } & BarisJadwalPengingat
  type Hasil = { data: unknown; error: { code?: string; message?: string } | null }
  const pilih = async (kolom: string): Promise<Hasil> =>
    await db.from('pengaturan').select(kolom).eq('pengingat_wa_aktif', true).limit(1000)

  // Kolom terbaru dilepas lebih dulu selama SQL-nya belum dijalankan. Yang tidak terbaca
  // memakai bawaannya — semua kelas, semua hari — sama dengan perilaku sebelum kolomnya ada.
  let { data, error } = await pilih(`sekolah_id, pengingat_kelas_ids, ${SELECT_JADWAL_PENGINGAT}`)
  if (error && kolomBelumAda(error)) ({ data, error } = await pilih('sekolah_id, pengingat_kelas_ids'))
  if (error && kolomBelumAda(error)) ({ data, error } = await pilih('sekolah_id'))
  if (error) return { data: null, error: 'Daftar sekolah gagal dimuat.' }

  // Pesan dikirim lewat nomor WhatsApp platform: hanya sekolah mitra yang sudah dikonfirmasi
  const { data: aktif, error: aktifErr } = await db.from('sekolah').select('id').eq('status_kemitraan', 'aktif').limit(1000)
  if (aktifErr) return { data: null, error: 'Daftar sekolah gagal dimuat.' }
  const terkonfirmasi = new Set(((aktif ?? []) as { id: string }[]).map(s => s.id))

  return {
    // null = belum pernah diatur di modal → semua kelas; daftar kosong = sengaja tidak ada
    data: ((data ?? []) as Baris[]).filter(b => terkonfirmasi.has(b.sekolah_id)).map(b => ({
      sekolah_id: b.sekolah_id,
      kelas:      b.pengingat_kelas_ids ? new Set(b.pengingat_kelas_ids) : null,
      jadwal:     jadwalPengingat(b),
    })),
    error: null,
  }
}

/**
 * Terbitkan tagihan bulan berjalan (kalender WIB) untuk satu sekolah. Mengembalikan
 * alasannya kalau tidak terbit, null kalau beres. Tidak pernah melempar: gagal terbit
 * tidak boleh menghentikan pengingat untuk tagihan yang sudah ada.
 */
async function terbitkanBulanIni(
  db: SupabaseClient, sekolahId: string, sekarang: Date, terbitkan: typeof runGenerate,
): Promise<string | null> {
  try {
    // Halaman Tagihan Aktif membaca baris ini tanpa sekolah_id karena RLS yang
    // menyaringnya; di sini service role, jadi sekolahnya wajib disebut
    const { data, error } = await db
      .from('tahun_ajaran').select('nama').eq('sekolah_id', sekolahId).eq('is_aktif', true).maybeSingle()
    if (error) return 'Tahun ajaran aktif gagal dimuat.'
    const tahunAjaran = (data as { nama: string | null } | null)?.nama
    if (!tahunAjaran) return 'Belum ada tahun ajaran aktif.'

    const { bulan, tahun } = bulanTahunWIB(sekarang)
    const hasil = await terbitkan(db, sekolahId, tahunAjaran, bulan, tahun)
    return hasil.success ? null : (hasil.error ?? 'Tagihan gagal diterbitkan.')
  } catch (e) {
    console.error(`[pengingat] penerbitan tagihan sekolah ${sekolahId} melempar galat: ${e instanceof Error ? e.message : 'galat tidak dikenal'}`)
    return 'Tagihan gagal diterbitkan.'
  }
}

async function antrekanSekolah(
  db: SupabaseClient, sekolahId: string, kelasPenerima: Set<string> | null, jadwal: number[],
  sekarang: Date, konfig: KonfigPengingat, origin: string,
): Promise<{ dibuat: number; dilewati: number }> {
  const galat = (apa: string) => new Error(apa)

  // Semua toggle hari di Pengaturan dimatikan
  if (jadwal.length === 0) return { dibuat: 0, dilewati: 0 }

  // Tagihan belum lunas yang jatuh temponya di antara H-terdekat dan H-terjauh. Baris lama
  // yang jatuh_tempo-nya kosong tidak ikut: tanggalnya tidak diketahui pasti.
  const dari     = awalHariWIB(sekarang, Math.min(...jadwal)).toISOString()
  const sebelum  = awalHariWIB(sekarang, Math.max(...jadwal) + 1).toISOString()
  type Sasaran = { id: string; siswa_id: string; jatuh_tempo: string }
  const tagihanRes = await ambilSemua<Sasaran>((awal, akhir) => db
    .from('tagihan').select('id, siswa_id, jatuh_tempo')
    .eq('sekolah_id', sekolahId).neq('status', 'lunas').gte('jatuh_tempo', dari).lt('jatuh_tempo', sebelum)
    .order('id').range(awal, akhir))
  if (tagihanRes.error) throw galat('Tagihan gagal dimuat.')

  // Satu sasaran per siswa: yang jatuh temponya paling dekat
  const sasaran = new Map<string, { tagihanId: string; hari: number }>()
  for (const t of tagihanRes.data) {
    const hari = selisihHari(sekarang, new Date(t.jatuh_tempo))
    if (!jadwal.includes(hari)) continue
    const ada = sasaran.get(t.siswa_id)
    if (!ada || hari < ada.hari) sasaran.set(t.siswa_id, { tagihanId: t.id, hari })
  }
  if (sasaran.size === 0) return { dibuat: 0, dilewati: 0 }

  const penilaian = await muatPenilaian(db, sekolahId, [...sasaran.keys()], sekarang, konfig)
  if (!penilaian.data) throw galat(penilaian.error ?? 'Data pengingat gagal dimuat.')

  type Calon = { p: PenilaianSiswa & { nomor: string }; tagihanId: string; hari: number }
  const calon: Calon[] = []
  for (const [siswaId, s] of sasaran) {
    const p = penilaian.data.get(siswaId)
    if (!p?.nomor || p.adaJobAktif || p.menungguVerifikasi || dalamCooldown(p, sekarang, konfig)) continue
    // null = semua kelas. Siswa tanpa kelas (alumni) tidak ikut kalau kelasnya dipilih-pilih.
    if (kelasPenerima && (!p.siswa.kelas_id || !kelasPenerima.has(p.siswa.kelas_id))) continue
    calon.push({ p: p as PenilaianSiswa & { nomor: string }, tagihanId: s.tagihanId, hari: s.hari })
  }
  if (calon.length === 0) return { dibuat: 0, dilewati: sasaran.size }

  const [sender, konteks, pembatas] = await Promise.all([
    pilihSender(db, sekolahId),
    muatKonteksPesan(db, sekolahId, [...new Set(calon.map(c => c.p.siswa.kelas_id).filter((id): id is string => !!id))]),
    muatPembatas(db, [...new Set(calon.map(c => c.p.nomor))], sekarang),
  ])
  if (!sender.id) throw galat(sender.error ?? 'Data pengingat gagal dimuat.')
  if (!konteks.data || !pembatas.data) throw galat('Data pengingat gagal dimuat.')

  const baris: JobOtomatisBaru[] = []
  for (const c of calon) {
    const ringkasan = ringkasOtomatis(c.p.tagihan, c.tagihanId, sekarang)
    if (!ringkasan) continue
    if (!lolosPembatas(c.p, pembatas.data, sekarang, konfig)) continue
    baris.push({
      ...susunIsiJob(c.p, ringkasan, konteks.data, origin),
      // Job otomatis selalu menunjuk tagihan yang diingatkannya, walau tautannya tidak aktif
      tagihan_id:   c.tagihanId,
      wa_sender_id: sender.id,
      sekolah_id:   sekolahId,
      siswa_id:     c.p.siswa.id,
      wali_phone:   c.p.nomor,
      source:       'otomatis',
      days_before:  c.hari,
      priority:     1,
      available_at: sekarang.toISOString(),
    })
  }

  const galatSisip = await sisipkanJob(db, baris)
  if (galatSisip) throw galat(galatSisip)
  return { dibuat: baris.length, dilewati: sasaran.size - baris.length }
}

/**
 * Jalankan sekali tiap pagi (07.55 WIB) sebelum jendela kirim dibuka. Aman dijalankan
 * dua kali pada hari yang sama: tagihan yang sudah terbit tidak diterbitkan lagi, dan
 * pengingat H-x untuk tagihan yang sama hanya dibuat sekali.
 */
export async function antrekanOtomatis(
  db: SupabaseClient, opsi: OpsiOtomatis,
): Promise<{ data: LaporanOtomatis[]; error: null } | { data: null; error: string }> {
  const { origin, sekarang = new Date(), konfig = KONFIG_PENGINGAT, terbitkan = runGenerate } = opsi

  const sekolah = await sekolahPenerima(db)
  if (!sekolah.data) return { data: null, error: sekolah.error ?? 'Daftar sekolah gagal dimuat.' }

  const laporan: LaporanOtomatis[] = []
  // Satu per satu: galat di satu sekolah tidak boleh menghentikan sekolah berikutnya
  for (const s of sekolah.data) {
    // Terbit dulu, baru dinilai: tagihan yang terbit pagi ini dan jatuh tempo 7 hari
    // lagi ikut diingatkan pada panggilan yang sama
    const tidakTerbit = await terbitkanBulanIni(db, s.sekolah_id, sekarang, terbitkan)
    if (tidakTerbit) console.warn(`[pengingat] tagihan bulan berjalan sekolah ${s.sekolah_id} tidak diterbitkan: ${tidakTerbit}`)
    const catatan = tidakTerbit ? { tidakTerbit } : {}
    try {
      laporan.push({ sekolahId: s.sekolah_id, ...await antrekanSekolah(db, s.sekolah_id, s.kelas, s.jadwal, sekarang, konfig, origin), ...catatan })
    } catch (e) {
      const galat = e instanceof Error ? e.message : 'galat tidak dikenal'
      console.error(`[pengingat] pengingat otomatis sekolah ${s.sekolah_id} gagal: ${galat}`)
      laporan.push({ sekolahId: s.sekolah_id, dibuat: 0, dilewati: 0, galat, ...catatan })
    }
  }
  return { data: laporan, error: null }
}
