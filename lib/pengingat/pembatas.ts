import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilPerPotong } from '../ambilSemua'
import type { KonfigPengingat } from './konfig'
import { SELECT_JOB_RINGKAS, type JobRingkas, type PenilaianSiswa } from './penilaian'
import { awalBulanWIB, awalHariWIB } from './waktu'

// Aturan yang menahan pembuatan job walau siswanya layak diingatkan: opt-out, batas
// bulanan per siswa, dan batas harian per nomor tujuan. Dipakai bersama oleh pengingat
// manual (lib/pengingat/antrean) dan otomatis (lib/pengingat/otomatis). Khusus server.

export interface Pembatas {
  /** Nomor yang membalas STOP */
  optout:        Set<string>
  /** Pesan ke tiap nomor hari ini: yang sudah terkirim ditambah yang masih di antrean */
  pesanPerNomor: Map<string, number>
}

export async function muatPembatas(
  db: SupabaseClient, nomor: string[], sekarang: Date,
): Promise<{ data: Pembatas | null; error: string | null }> {
  const awalHari = awalHariWIB(sekarang).toISOString()
  const [optoutRes, aktifRes, hariIniRes] = await Promise.all([
    ambilPerPotong<{ phone: string }>(nomor, (potong, dari, sampai) => db
      .from('wa_optout').select('id, phone').in('phone', potong).order('id').range(dari, sampai)),
    // Batas per nomor tujuan berlaku lintas sekolah, jadi tanpa filter sekolah_id
    ambilPerPotong<JobRingkas>(nomor, (potong, dari, sampai) => db
      .from('reminder_job').select(SELECT_JOB_RINGKAS)
      .in('wali_phone', potong).in('status', ['antre', 'mengirim'])
      .order('id').range(dari, sampai)),
    ambilPerPotong<JobRingkas>(nomor, (potong, dari, sampai) => db
      .from('reminder_job').select(SELECT_JOB_RINGKAS)
      .in('wali_phone', potong).eq('status', 'terkirim').gte('sent_at', awalHari)
      .order('id').range(dari, sampai)),
  ])
  if (optoutRes.error || aktifRes.error || hariIniRes.error) return { data: null, error: 'Data pengingat gagal dimuat.' }

  const pesanPerNomor = new Map<string, number>()
  for (const j of [...aktifRes.data, ...hariIniRes.data]) {
    pesanPerNomor.set(j.wali_phone, (pesanPerNomor.get(j.wali_phone) ?? 0) + 1)
  }
  return { data: { optout: new Set(optoutRes.data.map(o => o.phone)), pesanPerNomor }, error: null }
}

/**
 * Boleh dibuatkan job? Kalau ya, jatah nomornya langsung dipakai — pemanggil harus
 * membuat job-nya.
 */
export function lolosPembatas(
  p: PenilaianSiswa & { nomor: string }, pembatas: Pembatas, sekarang: Date, konfig: KonfigPengingat,
): boolean {
  if (pembatas.optout.has(p.nomor)) return false
  const awalBulan = awalBulanWIB(sekarang).getTime()
  if (p.terkirim.filter(t => t.getTime() >= awalBulan).length >= konfig.maksPerBulan) return false
  const sudah = pembatas.pesanPerNomor.get(p.nomor) ?? 0
  if (sudah >= konfig.maksPerNomorPerHari) return false
  pembatas.pesanPerNomor.set(p.nomor, sudah + 1)
  return true
}

/** Nomor pengirim untuk sekolah ini: yang khusus sekolahnya dulu, lalu nomor bersama (sekolah_id NULL) */
export async function pilihSender(db: SupabaseClient, sekolahId: string): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await db.from('wa_sender').select('id, sekolah_id').neq('status', 'nonaktif').limit(50)
  if (error) return { id: null, error: 'Data pengingat gagal dimuat.' }
  const senders = (data ?? []) as { id: string; sekolah_id: string | null }[]
  const sender  = senders.find(s => s.sekolah_id === sekolahId) ?? senders.find(s => s.sekolah_id === null)
  return sender ? { id: sender.id, error: null } : { id: null, error: 'Nomor pengirim WhatsApp belum disiapkan.' }
}

/**
 * Masukkan job ke antrean. Bentrok index unik (klik ganda, "Ingatkan semua" berbarengan,
 * cron terpanggil dua kali) bukan galat: baris diulang satu per satu dan yang bentrok
 * dilewati, karena memang sudah ada di antrean. Mengembalikan pesan galat atau null.
 */
export async function sisipkanJob(db: SupabaseClient, baris: object[]): Promise<string | null> {
  if (baris.length === 0) return null
  const { error } = await db.from('reminder_job').insert(baris)
  if (!error) return null
  if (error.code !== '23505') return 'Pengingat gagal dimasukkan ke antrean.'
  for (const b of baris) {
    const { error: e } = await db.from('reminder_job').insert(b)
    if (e && e.code !== '23505') return 'Pengingat gagal dimasukkan ke antrean.'
  }
  return null
}
