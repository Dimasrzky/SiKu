import type { SupabaseClient } from '@supabase/supabase-js'
import { KONFIG_PENGINGAT, type KonfigPengingat } from './konfig'
import { lolosPembatas, muatPembatas, pilihSender, sisipkanJob } from './pembatas'
import { muatPenilaian, sekolahAktif, sisaCooldownHari, tampilanSiswa, type PenilaianSiswa } from './penilaian'
import { muatKonteksPesan, susunIsiJob, type IsiJob } from './pesan'
import type { HasilPengingat, TampilanIngatkan } from './tipe'

// Pintu masuk antrean pengingat WhatsApp untuk tombol "Ingatkan" dan "Ingatkan semua":
// menilai tiap siswa, lalu membuat job prioritas 2 untuk yang lolos semua aturan. Tidak
// ada pesan yang dikirim dari sini — pengiriman sepenuhnya urusan worker.
//
// Khusus server (route handler dengan service role). Jangan diimpor dari komponen
// 'use client'.

type Hasil = { data: HasilPengingat; error: null } | { data: null; error: string }

/** Sisa hari cooldown untuk siswa yang tombolnya `terkirim` — bahan label "H-2"/"H-1" */
function sisaCooldownTerkirim(
  status: Record<string, TampilanIngatkan>, penilaian: Map<string, PenilaianSiswa>,
  sekarang: Date, konfig: KonfigPengingat,
): Record<string, number> {
  const sisa: Record<string, number> = {}
  for (const [id, t] of Object.entries(status)) {
    const p = penilaian.get(id)
    if (t === 'terkirim' && p) sisa[id] = sisaCooldownHari(p, sekarang, konfig)
  }
  return sisa
}

/** Kolom reminder_job yang diisi saat job manual dibuat; sisanya memakai bawaan tabel */
interface JobManualBaru extends IsiJob {
  wa_sender_id: string
  sekolah_id:   string
  siswa_id:     string
  wali_phone:   string
  source:       'manual'
  priority:     2
  created_by:   string
  available_at: string
}

export interface OpsiStatusPengingat {
  sekolahId: string
  siswaIds:  string[]
  sekarang?: Date
  konfig?:   KonfigPengingat
}

/** Tampilan tombol tiap siswa, tanpa mengubah apa pun. */
export async function statusPengingat(db: SupabaseClient, opsi: OpsiStatusPengingat): Promise<Hasil> {
  const { sekolahId, siswaIds, sekarang = new Date(), konfig = KONFIG_PENGINGAT } = opsi

  const sekolah = await sekolahAktif(db, sekolahId)
  if (sekolah.error) return { data: null, error: sekolah.error }
  if (!sekolah.aktif) return { data: { aktif: false, status: {} }, error: null }

  const { data: penilaian, error: galatMuat } = await muatPenilaian(db, sekolahId, siswaIds, sekarang, konfig)
  if (!penilaian) return { data: null, error: galatMuat ?? 'Data pengingat gagal dimuat.' }

  const status: Record<string, TampilanIngatkan> = {}
  for (const id of siswaIds) status[id] = tampilanSiswa(penilaian.get(id), sekarang, konfig)
  return { data: { aktif: true, status, sisaCooldown: sisaCooldownTerkirim(status, penilaian, sekarang, konfig) }, error: null }
}

export interface OpsiAntrekanManual extends OpsiStatusPengingat {
  /** Bendahara yang menekan tombol */
  userId: string
  /** Alamat aplikasi tanpa garis miring di akhir, untuk tautan halaman bayar */
  origin: string
  /** Pemilih variasi sapaan/penutup — hanya diganti saat pengujian */
  acak?:  () => number
}

/**
 * Buat job manual (prioritas 2) untuk siswa yang tombolnya sedang `ingatkan`. Siswa lain
 * tidak dibuatkan job dan cukup dikembalikan tampilan terakhirnya.
 */
export async function antrekanManual(db: SupabaseClient, opsi: OpsiAntrekanManual): Promise<Hasil> {
  const { sekolahId, siswaIds, userId, origin, sekarang = new Date(), konfig = KONFIG_PENGINGAT, acak } = opsi

  const sekolah = await sekolahAktif(db, sekolahId)
  if (sekolah.error) return { data: null, error: sekolah.error }
  if (!sekolah.aktif) return { data: { aktif: false, status: {} }, error: null }

  const { data: penilaian, error: galatMuat } = await muatPenilaian(db, sekolahId, siswaIds, sekarang, konfig)
  if (!penilaian) return { data: null, error: galatMuat ?? 'Data pengingat gagal dimuat.' }

  const status: Record<string, TampilanIngatkan> = {}
  for (const id of siswaIds) status[id] = tampilanSiswa(penilaian.get(id), sekarang, konfig)
  const sisaCooldown = sisaCooldownTerkirim(status, penilaian, sekarang, konfig)

  const calon = siswaIds
    .filter(id => status[id] === 'ingatkan')
    .map(id => penilaian.get(id))
    .filter((p): p is PenilaianSiswa & { nomor: string } => !!p?.nomor)
  if (calon.length === 0) return { data: { aktif: true, status, sisaCooldown }, error: null }

  const nomor    = [...new Set(calon.map(p => p.nomor))]
  const kelasIds = [...new Set(calon.map(p => p.siswa.kelas_id).filter((id): id is string => !!id))]

  const [sender, konteks, pembatas] = await Promise.all([
    pilihSender(db, sekolahId),
    muatKonteksPesan(db, sekolahId, kelasIds),
    muatPembatas(db, nomor, sekarang),
  ])
  if (!sender.id) return { data: null, error: sender.error ?? 'Data pengingat gagal dimuat.' }
  if (!konteks.data || !pembatas.data) return { data: null, error: 'Data pengingat gagal dimuat.' }

  const baris: JobManualBaru[] = []
  for (const p of calon) {
    // Opt-out, batas bulanan, dan batas per nomor: tidak dibuatkan job, tombol tetap Ingatkan
    if (!lolosPembatas(p, pembatas.data, sekarang, konfig)) continue
    baris.push({
      ...susunIsiJob(p, p.ringkasan, konteks.data, origin, acak),
      wa_sender_id: sender.id,
      sekolah_id:   sekolahId,
      siswa_id:     p.siswa.id,
      wali_phone:   p.nomor,
      source:       'manual',
      priority:     2,
      created_by:   userId,
      available_at: sekarang.toISOString(),
    })
  }

  const galatSisip = await sisipkanJob(db, baris)
  if (galatSisip) return { data: null, error: galatSisip }
  for (const b of baris) status[b.siswa_id] = 'mengirim'

  return { data: { aktif: true, status, sisaCooldown }, error: null }
}
