import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilSemua } from '../ambilSemua'
import { runGenerate } from '../generateTagihan'
import { selisihHari } from '../metrikLaporan'
import { KONFIG_PENGINGAT, type KonfigPengingat } from './konfig'
import { ringkasOtomatis } from './kelayakan'
import { lolosPembatas, muatPembatas, pilihSender, sisipkanJob } from './pembatas'
import { dalamCooldown, muatPenilaian, type PenilaianSiswa } from './penilaian'
import { muatKonteksPesan, susunIsiJob, type IsiJob } from './pesan'
import { awalHariWIB, bulanTahunWIB } from './waktu'

// Pengingat otomatis: tiap pagi, tagihan yang jatuh tempo 7, 3, dan 1 hari lagi
// dibuatkan job prioritas 1 (keputusan 1 Okt 2026 — spec aslinya mengingatkan pada hari
// jatuh tempo). Hanya untuk sekolah yang saklarnya menyala dan kelas yang dipilih di
// modal "Ingatkan orang tua". Tidak ada pesan yang dikirim dari sini.
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
  /** Tagihan yang jatuh tempo H-7/H-3/H-1 tetapi tidak dibuatkan job */
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
  /** Pemilih variasi sapaan/penutup — hanya diganti saat pengujian */
  acak?:     () => number
  /** Penerbit tagihan bulan berjalan — hanya diganti saat pengujian */
  terbitkan?: typeof runGenerate
}

/** Kolom pengingat_kelas_ids belum dibuat — dianggap "belum pernah diatur" (semua kelas) */
const kolomBelumAda = (e: { code?: string; message?: string } | null): boolean =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || (e.message ?? '').includes('pengingat_kelas_ids'))

async function sekolahPenerima(db: SupabaseClient): Promise<{ data: { sekolah_id: string; kelas: Set<string> | null }[] | null; error: string | null }> {
  type Baris = { sekolah_id: string; pengingat_kelas_ids?: string[] | null }
  let { data, error }: { data: unknown; error: { code?: string; message?: string } | null } =
    await db.from('pengaturan').select('sekolah_id, pengingat_kelas_ids').eq('pengingat_wa_aktif', true).limit(1000)
  if (error && kolomBelumAda(error)) {
    ({ data, error } = await db.from('pengaturan').select('sekolah_id').eq('pengingat_wa_aktif', true).limit(1000))
  }
  if (error) return { data: null, error: 'Daftar sekolah gagal dimuat.' }
  return {
    // null = belum pernah diatur di modal → semua kelas; daftar kosong = sengaja tidak ada
    data: ((data ?? []) as Baris[]).map(b => ({
      sekolah_id: b.sekolah_id,
      kelas:      b.pengingat_kelas_ids ? new Set(b.pengingat_kelas_ids) : null,
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
  db: SupabaseClient, sekolahId: string, kelasPenerima: Set<string> | null,
  sekarang: Date, konfig: KonfigPengingat, origin: string, acak: (() => number) | undefined,
): Promise<{ dibuat: number; dilewati: number }> {
  const galat = (apa: string) => new Error(apa)

  // Tagihan belum lunas yang jatuh temponya di antara H-terdekat dan H-terjauh. Baris lama
  // yang jatuh_tempo-nya kosong tidak ikut: tanggalnya tidak diketahui pasti.
  const jadwal   = konfig.jadwalOtomatisHari
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
      ...susunIsiJob(c.p, ringkasan, konteks.data, origin, acak),
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
  const { origin, sekarang = new Date(), konfig = KONFIG_PENGINGAT, acak, terbitkan = runGenerate } = opsi

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
      laporan.push({ sekolahId: s.sekolah_id, ...await antrekanSekolah(db, s.sekolah_id, s.kelas, sekarang, konfig, origin, acak), ...catatan })
    } catch (e) {
      const galat = e instanceof Error ? e.message : 'galat tidak dikenal'
      console.error(`[pengingat] pengingat otomatis sekolah ${s.sekolah_id} gagal: ${galat}`)
      laporan.push({ sekolahId: s.sekolah_id, dibuat: 0, dilewati: 0, galat, ...catatan })
    }
  }
  return { data: laporan, error: null }
}
