import type { SupabaseClient } from '@supabase/supabase-js'
import { KONFIG_PENGINGAT, type KonfigPengingat } from './konfig'
import { ringkasOtomatis } from './kelayakan'
import { beritahuDeveloper } from './notifikasi'
import { buatPengirim, type MessageSender } from './pengirim'
import { dalamCooldown, muatPenilaian, sekolahAktif } from './penilaian'
import { muatKonteksPesan, susunIsiJob, type IsiJob } from './pesan'
import type { ReminderJob, WaSender } from './tipe'
import { awalHariWIB, bukaBerikutnya, dalamJendelaKirim, samaTanggalWIB } from './waktu'

// Worker antrean pengingat WhatsApp — satu-satunya yang memanggil penyedia (Fonnte).
//
// Vercel tidak punya proses yang berjalan terus, jadi worker dipicu pg_cron tiap 30 detik
// dan tiap pemanggilan mengirim PALING BANYAK SATU pesan per nomor pengirim. Semua yang
// di spec disimpan di variabel loop (jeda acak berikutnya, hitungan batch, gagal
// beruntun, jenjang terakhir) disimpan di baris wa_sender, sehingga worker tahan restart.
//
// Khusus server (service role). Jangan diimpor dari komponen 'use client'.

/**
 * Paling lama menunggu jeda acak di dalam satu pemanggilan; lebih dari itu diserahkan ke
 * pemanggilan berikutnya. Harus lebih panjang dari selang pg_cron (30 detik): dengan
 * begitu setiap jeda acak pasti jatuh di dalam jangkauan salah satu pemanggilan dan
 * pesan keluar tepat pada waktunya. Kalau selang pg_cron lebih panjang dari ini, jeda
 * yang jatuh di celahnya dibulatkan ke pemanggilan berikutnya dan jarak antar pesan jadi
 * seragam (kelipatan selang pg_cron) — justru pola yang mau dihindari.
 */
const TUNGGU_MAKS_MS = 35_000
/**
 * Kalau jedanya sudah habis sebelum pemanggilan ini datang (pesan pertama pagi hari, atau
 * pemanggilan yang terlambat), pesan ditahan dulu selama selang acak sampai sekian, supaya
 * tidak keluar tepat pada detik pg_cron memanggil.
 */
const SELANG_ACAK_MAKS_MS = 30_000
/** Lama kunci worker. Harus lebih panjang dari batas waktu fungsi (60 detik) supaya dua pemanggilan tidak pernah tumpang tindih */
const LAMA_KUNCI_MS = 90_000
/** Job yang dibatalkan saat cek ulang tidak memakai jatah kirim, tetapi dibatasi supaya satu pemanggilan tetap singkat */
const MAKS_BATAL_PER_PANGGILAN = 25
/**
 * Sesudah berjalan selama ini, pemanggilan tidak mengambil job berikutnya lagi. Sisanya
 * disisakan untuk satu cek device dan satu pengiriman, supaya pemanggilan tidak terpotong
 * batas waktu fungsi (60 detik) di tengah mengirim.
 */
const BATAS_KERJA_MS = 38_000

export type HasilWorker =
  | 'terkirim'                  // satu pesan diterima penyedia
  | 'gagal'                     // penyedia menolak pesan; tidak dicoba ulang
  | 'antrean_kosong'
  | 'di_luar_jendela'           // di luar jam/hari kirim
  | 'batas_harian'
  | 'belum_waktunya'            // jeda acak sebelum pesan berikutnya belum habis
  | 'sedang_berjalan'           // pemanggilan lain masih memegang kunci
  | 'jeda_jenjang'              // berganti jenjang; jedanya baru dijadwalkan
  | 'penyedia_tidak_terjangkau' // status device tidak bisa dicek; dihitung sebagai satu kegagalan
  | 'hanya_membatalkan'         // pemanggilan ini habis untuk membatalkan job yang tidak lagi layak
  | 'breaker'                   // circuit breaker menghentikan antrean

export interface LaporanWorker {
  senderId:   string
  hasil:      HasilWorker
  /** Job yang dibatalkan saat cek ulang pada pemanggilan ini */
  dibatalkan: number
  jobId?:     string
  alasan?:    string
}

export interface OpsiWorker {
  /** Alamat aplikasi tanpa garis miring di akhir, untuk tautan halaman bayar */
  origin:        string
  konfig?:       KonfigPengingat
  // Semua di bawah ini hanya diganti saat pengujian
  sekarang?:     () => Date
  tunggu?:       (ms: number) => Promise<void>
  /** Bilangan acak di [0, 1) */
  acak?:         () => number
  buatPengirim?: (sender: WaSender) => MessageSender | { galat: string }
  beritahu?:     (isi: string) => Promise<void>
  /** Batas selang acak sebelum pesan yang jedanya sudah habis; 0 = langsung kirim */
  selangAcakMaksMs?: number
}

type Opsi = Required<OpsiWorker>

const KOLOM_SENDER = 'id, sekolah_id, phone, provider, status, pause_reason, paused_at, sent_today, counter_reset_at, batch_count, fail_streak, last_jenjang, next_send_at, locked_until, created_at, updated_at'
const KOLOM_JOB    = 'id, wa_sender_id, sekolah_id, siswa_id, tagihan_id, wali_phone, jenjang, source, days_before, priority, status, attempts, total_tagihan, created_at'

type JobAntre = Pick<ReminderJob,
  'id' | 'wa_sender_id' | 'sekolah_id' | 'siswa_id' | 'tagihan_id' | 'wali_phone' | 'jenjang'
  | 'source' | 'days_before' | 'priority' | 'status' | 'attempts' | 'total_tagihan' | 'created_at'>

/** Keadaan worker yang dibawa dari satu pemanggilan ke berikutnya */
type Keadaan = Pick<WaSender, 'sent_today' | 'batch_count' | 'fail_streak' | 'last_jenjang' | 'counter_reset_at'>

class GalatDatabase extends Error {}

const periksa = <T extends { error: unknown }>(hasil: T, apa: string): T => {
  if (hasil.error) throw new GalatDatabase(`${apa} gagal`)
  return hasil
}

/**
 * Cek ulang tepat sebelum kirim: sejak job dibuat bisa saja tagihannya lunas, walinya
 * membalas STOP, atau buktinya sedang diverifikasi. Kalau masih layak, pesannya disusun
 * ulang supaya total dan tautannya sesuai keadaan saat ini.
 */
async function periksaUlang(db: SupabaseClient, job: JobAntre, kini: Date, o: Opsi): Promise<{ batal: string } | { isi: IsiJob }> {
  const sekolah = await sekolahAktif(db, job.sekolah_id)
  if (sekolah.error) throw new GalatDatabase(sekolah.error)
  if (!sekolah.aktif) return { batal: 'sekolah tidak lagi memakai antrean' }

  const [penilaian, optout] = await Promise.all([
    muatPenilaian(db, job.sekolah_id, [job.siswa_id], kini, o.konfig),
    db.from('wa_optout').select('id').eq('phone', job.wali_phone).limit(1),
  ])
  if (!penilaian.data) throw new GalatDatabase(penilaian.error ?? 'Data pengingat gagal dimuat.')
  periksa(optout, 'Membaca wa_optout')

  const p = penilaian.data.get(job.siswa_id)
  if (!p) return { batal: 'siswa tidak ditemukan' }
  if (p.nomor !== job.wali_phone) return { batal: 'nomor wali berubah' }
  if ((optout.data ?? []).length > 0) return { batal: 'wali berhenti berlangganan (STOP)' }
  if (p.menungguVerifikasi) return { batal: 'bukti transfer menunggu verifikasi' }
  if (dalamCooldown(p, kini, o.konfig)) return { batal: 'masih dalam masa cooldown' }

  // Otomatis: tagihan yang diingatkan + tunggakan lamanya. Manual: seluruh tunggakan.
  let ringkasan = p.ringkasan
  if (job.source === 'otomatis') {
    const otomatis = job.tagihan_id ? ringkasOtomatis(p.tagihan, job.tagihan_id, kini) : null
    if (!otomatis) return { batal: 'tagihan sudah lunas' }
    ringkasan = otomatis
  } else if (ringkasan.tunggakan.length === 0) {
    return { batal: 'tidak ada tunggakan lagi' }
  }

  const konteks = await muatKonteksPesan(db, job.sekolah_id, p.siswa.kelas_id ? [p.siswa.kelas_id] : [])
  if (!konteks.data) throw new GalatDatabase(konteks.error ?? 'Data sekolah gagal dimuat.')

  const isi = susunIsiJob(p, ringkasan, konteks.data, o.origin, o.acak)
  // Job otomatis tetap menunjuk tagihan yang diingatkannya walau tautannya tidak aktif.
  // Jenjang tidak ikut diubah: urutan antrean sudah dihitung dengan jenjang saat job dibuat.
  return { isi: { ...isi, tagihan_id: job.source === 'otomatis' ? job.tagihan_id : isi.tagihan_id, jenjang: job.jenjang } }
}

async function prosesPengirim(db: SupabaseClient, sender: WaSender, o: Opsi): Promise<LaporanWorker> {
  const { konfig } = o
  let dibatalkan = 0
  const lapor = (hasil: HasilWorker, lain: Partial<LaporanWorker> = {}): LaporanWorker =>
    ({ senderId: sender.id, hasil, dibatalkan, ...lain })

  // pg_cron hanya memanggil worker kalau next_send_at sudah dekat. Selama pengiriman tidak
  // mungkin (di luar jendela, jatah harian habis), next_send_at digeser ke pembukaan
  // berikutnya supaya worker tidak dipanggil percuma sepanjang malam dan akhir pekan.
  const tundaSampai = async (kapan: Date) => {
    if (new Date(sender.next_send_at).getTime() >= kapan.getTime()) return
    periksa(await db.from('wa_sender')
      .update({ next_send_at: kapan.toISOString() })
      .eq('id', sender.id).lt('next_send_at', kapan.toISOString()), 'Menunda wa_sender')
  }

  let kini = o.sekarang()
  const mulai = kini.getTime()
  if (!dalamJendelaKirim(kini, konfig)) {
    await tundaSampai(bukaBerikutnya(kini, konfig))
    return lapor('di_luar_jendela')
  }

  // Hari baru (WIB): hitungan harian dan urutan batch mulai dari nol
  const hariBaru = !sender.counter_reset_at || !samaTanggalWIB(new Date(sender.counter_reset_at), kini)
  const keadaan: Keadaan = {
    sent_today:       hariBaru ? 0 : sender.sent_today,
    batch_count:      hariBaru ? 0 : sender.batch_count,
    last_jenjang:     hariBaru ? null : sender.last_jenjang,
    counter_reset_at: hariBaru ? kini.toISOString() : sender.counter_reset_at,
    fail_streak:      sender.fail_streak,
  }
  if (keadaan.sent_today >= konfig.maksPerHari) {
    // Jatah hari ini habis: lanjut pada pembukaan pertama mulai besok
    await tundaSampai(bukaBerikutnya(awalHariWIB(kini, 1), konfig))
    return lapor('batas_harian')
  }

  const sisaJeda = new Date(sender.next_send_at).getTime() - kini.getTime()
  if (sisaJeda > TUNGGU_MAKS_MS) return lapor('belum_waktunya')

  // Kunci: satu UPDATE bersyarat. Kalau dua pemanggilan tiba bersamaan, hanya satu yang
  // mendapat barisnya; yang lain melihat locked_until sudah terisi.
  const kunci = periksa(await db.from('wa_sender')
    .update({ locked_until: new Date(kini.getTime() + LAMA_KUNCI_MS).toISOString() })
    .eq('id', sender.id).eq('status', 'aktif')
    .or(`locked_until.is.null,locked_until.lt.${kini.toISOString()}`)
    .select('id'), 'Mengunci wa_sender')
  if ((kunci.data ?? []).length === 0) return lapor('sedang_berjalan')

  /** Simpan keadaan worker dan lepaskan kunci */
  const simpan = async (perubahan: Partial<WaSender> = {}) => {
    periksa(await db.from('wa_sender')
      .update({ ...keadaan, ...perubahan, locked_until: null })
      .eq('id', sender.id), 'Menyimpan wa_sender')
  }

  /**
   * Circuit breaker: hentikan seluruh antrean nomor ini sampai dibuka manual. Hitungan
   * gagal beruntun dinolkan supaya antrean yang dibuka lagi mulai dari awal.
   */
  const hentikan = async (alasan: string, lain: Partial<LaporanWorker> = {}): Promise<LaporanWorker> => {
    await simpan({ status: 'pause', pause_reason: alasan, paused_at: o.sekarang().toISOString(), fail_streak: 0 })
    await o.beritahu(
      `SiKu: antrean pengingat WhatsApp dihentikan.\nNomor pengirim: ${sender.phone}\nAlasan: ${alasan}\n`
      + 'Antrean hanya berjalan lagi setelah dibuka secara manual.',
    )
    return lapor('breaker', { alasan, ...lain })
  }

  try {
    // Selama kunci dipegang tidak ada pemanggilan lain yang sedang mengirim, jadi job yang
    // masih berstatus mengirim pasti peninggalan pemanggilan yang terhenti di tengah jalan.
    // Hasil kirimnya tidak diketahui; ditandai gagal dan tidak dicoba ulang.
    periksa(await db.from('reminder_job')
      .update({ status: 'gagal', provider_response: { galat: 'Worker terhenti saat mengirim; hasil kirim tidak diketahui.' } })
      .eq('wa_sender_id', sender.id).eq('status', 'mengirim'), 'Membersihkan job macet')

    // Antrean kosong tidak perlu menunggu apa-apa
    const ada = periksa(await db.from('reminder_job').select('id')
      .eq('wa_sender_id', sender.id).eq('status', 'antre').lte('available_at', kini.toISOString())
      .limit(1), 'Memeriksa antrean')
    if ((ada.data ?? []).length === 0) { await simpan(); return lapor('antrean_kosong') }

    // Tunggu sisa jeda supaya pesan keluar tepat pada waktu acaknya. Kalau jedanya sudah
    // habis sebelum pemanggilan ini datang, tahan selama selang acak pendek (lihat
    // SELANG_ACAK_MAKS_MS).
    const lamaTunggu = sisaJeda > 0 ? sisaJeda : Math.round(o.acak() * o.selangAcakMaksMs)
    if (lamaTunggu > 0) {
      await o.tunggu(lamaTunggu)
      kini = o.sekarang()
      if (!dalamJendelaKirim(kini, konfig)) {
        await simpan({ next_send_at: bukaBerikutnya(kini, konfig).toISOString() })
        return lapor('di_luar_jendela')
      }
    }

    let pengirim: MessageSender | null = null

    for (let i = 0; i < MAKS_BATAL_PER_PANGGILAN; i++) {
      // Job pertama selalu dicoba; sesudah itu hanya selama waktunya masih longgar
      if (i > 0 && o.sekarang().getTime() - mulai > BATAS_KERJA_MS) break

      // Prioritas dulu, lalu jenjang, lalu urutan masuk — sama dengan ORDER BY di spec
      const berikut = periksa(await db.from('reminder_job').select(KOLOM_JOB)
        .eq('wa_sender_id', sender.id).eq('status', 'antre').lte('available_at', kini.toISOString())
        .order('priority').order('jenjang').order('created_at').order('id')
        .limit(1), 'Mengambil job')
      const job = ((berikut.data ?? []) as JobAntre[])[0]
      if (!job) { await simpan(); return lapor('antrean_kosong') }

      const ulang = await periksaUlang(db, job, kini, o)
      if ('batal' in ulang) {
        periksa(await db.from('reminder_job')
          .update({ status: 'dibatalkan', cancel_reason: ulang.batal })
          .eq('id', job.id).eq('status', 'antre'), 'Membatalkan job')
        dibatalkan++
        continue
      }

      // Jeda antar jenjang: dijadwalkan dulu, job-nya dikirim pada pemanggilan sesudah jeda
      if (keadaan.last_jenjang !== null && job.jenjang !== keadaan.last_jenjang) {
        await simpan({
          last_jenjang: job.jenjang,
          batch_count:  0,
          next_send_at: new Date(kini.getTime() + acakAntara(o, konfig.jedaJenjangMinDetik, konfig.jedaJenjangMaksDetik)).toISOString(),
        })
        return lapor('jeda_jenjang', { jobId: job.id })
      }

      if (!pengirim) {
        const dibuat = o.buatPengirim(sender)
        if ('galat' in dibuat) return await hentikan(dibuat.galat)
        pengirim = dibuat

        const device = await pengirim.cekDevice()
        if (device.keadaan === 'terputus') return await hentikan(device.alasan ?? 'device terputus')
        if (device.keadaan === 'tidak_diketahui') {
          const gagalBeruntun = keadaan.fail_streak + 1
          const alasan = device.alasan ?? 'status device tidak bisa dicek'
          if (gagalBeruntun >= konfig.maksGagalBeruntun) return await hentikan(alasan)
          await simpan({ fail_streak: gagalBeruntun, next_send_at: jedaBerikutnya(o, o.sekarang(), false) })
          return lapor('penyedia_tidak_terjangkau', { alasan })
        }
      }

      // Penjaga status: kalau job ini keburu berubah (dibatalkan dari tempat lain), lewati
      const klaim = periksa(await db.from('reminder_job')
        .update({ ...ulang.isi, status: 'mengirim', attempts: job.attempts + 1 })
        .eq('id', job.id).eq('status', 'antre')
        .select('id'), 'Menandai job mengirim')
      if ((klaim.data ?? []).length === 0) continue

      const kirim   = await pengirim.kirim(job.wali_phone, ulang.isi.message)
      const selesai = o.sekarang()

      if (kirim.ok) {
        periksa(await db.from('reminder_job')
          .update({ status: 'terkirim', sent_at: selesai.toISOString(), provider_response: kirim.respons ?? null })
          .eq('id', job.id), 'Menandai job terkirim')

        const batch     = keadaan.batch_count + 1
        const istirahat = batch >= konfig.ukuranBatch
        await simpan({
          sent_today:   keadaan.sent_today + 1,
          fail_streak:  0,
          batch_count:  istirahat ? 0 : batch,
          last_jenjang: job.jenjang,
          next_send_at: jedaBerikutnya(o, selesai, istirahat),
        })
        return lapor('terkirim', { jobId: job.id })
      }

      const alasan = kirim.alasan ?? 'pesan ditolak penyedia'
      console.error(`[pengingat] job ${job.id} gagal dikirim: ${alasan}`)
      periksa(await db.from('reminder_job')
        .update({ status: 'gagal', provider_response: kirim.respons ?? { alasan } })
        .eq('id', job.id), 'Menandai job gagal')

      const gagalBeruntun = keadaan.fail_streak + 1
      if (gagalBeruntun >= konfig.maksGagalBeruntun) {
        return await hentikan(alasan, { jobId: job.id })
      }
      await simpan({ fail_streak: gagalBeruntun, last_jenjang: job.jenjang, next_send_at: jedaBerikutnya(o, selesai, false) })
      return lapor('gagal', { jobId: job.id, alasan })
    }

    // Pemanggilan ini habis untuk membatalkan job — sisanya dilanjutkan pemanggilan berikutnya
    await simpan()
    return lapor('hanya_membatalkan')
  } catch (e) {
    // Lepaskan kunci supaya pemanggilan berikutnya tidak menunggu sampai kuncinya kedaluwarsa
    await db.from('wa_sender').update({ locked_until: null }).eq('id', sender.id)
    throw e
  }
}

const acakAntara = (o: Opsi, minDetik: number, maksDetik: number): number =>
  Math.round((minDetik + o.acak() * (maksDetik - minDetik)) * 1000)

/** Paling cepat pesan berikutnya boleh dikirim: jeda acak biasa, atau mini-istirahat setelah satu batch */
function jedaBerikutnya(o: Opsi, dari: Date, istirahat: boolean): string {
  const k  = o.konfig
  const ms = istirahat
    ? acakAntara(o, k.istirahatMinDetik, k.istirahatMaksDetik)
    : acakAntara(o, k.delayMinDetik, k.delayMaksDetik)
  return new Date(dari.getTime() + ms).toISOString()
}

/**
 * Satu putaran worker untuk semua nomor pengirim yang aktif. Dipanggil pg_cron tiap
 * 30 detik; aman dipanggil lebih sering atau berbarengan.
 */
export async function jalankanWorker(
  db: SupabaseClient, opsi: OpsiWorker,
): Promise<{ data: LaporanWorker[]; error: null } | { data: null; error: string }> {
  const o: Opsi = {
    origin:       opsi.origin,
    konfig:       opsi.konfig ?? KONFIG_PENGINGAT,
    sekarang:     opsi.sekarang ?? (() => new Date()),
    tunggu:       opsi.tunggu ?? (ms => new Promise(selesai => setTimeout(selesai, ms))),
    acak:         opsi.acak ?? Math.random,
    buatPengirim: opsi.buatPengirim ?? (sender => buatPengirim(sender.provider)),
    beritahu:     opsi.beritahu ?? (isi => beritahuDeveloper(isi)),
    selangAcakMaksMs: opsi.selangAcakMaksMs ?? SELANG_ACAK_MAKS_MS,
  }

  const { data, error } = await db.from('wa_sender').select(KOLOM_SENDER).eq('status', 'aktif').order('created_at').limit(50)
  if (error) return { data: null, error: 'Daftar nomor pengirim gagal dimuat.' }

  // Berbarengan: tiap nomor punya kunci, hitungan, dan jeda acaknya sendiri. Semuanya
  // ditunggu sampai selesai supaya tidak ada pengiriman yang terpotong di tengah jalan.
  const hasil = await Promise.allSettled(((data ?? []) as WaSender[]).map(sender => prosesPengirim(db, sender, o)))

  const laporan: LaporanWorker[] = []
  for (const h of hasil) {
    if (h.status === 'fulfilled') laporan.push(h.value)
    else if (h.reason instanceof GalatDatabase) return { data: null, error: h.reason.message }
    else throw h.reason
  }
  return { data: laporan, error: null }
}
