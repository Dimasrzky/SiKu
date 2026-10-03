import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilPerPotong } from '../ambilSemua'
import { gabungPembayaran, selisihHari } from '../metrikLaporan'
import type { KonfigPengingat } from './konfig'
import { ringkasTunggakan, type RingkasanTunggakan, type TagihanPengingat } from './kelayakan'
import { normalkanNomorWa } from './nomor'
import type { StatusJob, TampilanIngatkan } from './tipe'
import { awalBulanWIB, awalCooldownWIB } from './waktu'

// Penilaian siswa untuk pengingat: tunggakannya, nomor walinya, dan riwayat pengingatnya.
// Dipakai bersama oleh tombol Ingatkan (lib/pengingat/antrean) dan worker
// (lib/pengingat/worker) supaya keduanya tidak pernah memakai aturan yang berbeda.
//
// Khusus server (service role). Jangan diimpor dari komponen 'use client'.

export interface SiswaRow {
  id:        string
  nama:      string
  nama_wali: string | null
  no_wa:     string | null
  status:    string | null
  /** Snapshot teks kelas terakhir — hanya terisi untuk alumni */
  kelas:     string | null
  kelas_id:  string | null
}

type TagihanRow = Omit<TagihanPengingat, 'is_alumni' | 'terbayar' | 'bayar_terakhir'>

interface PembayaranRow { tagihan_id: string; jumlah: number; tanggal_bayar: string }

export interface JobRingkas { siswa_id: string; wali_phone: string; status: StatusJob; sent_at: string | null }

export const SELECT_JOB_RINGKAS = 'id, siswa_id, wali_phone, status, sent_at'

export interface PenilaianSiswa {
  siswa:              SiswaRow
  /** Nomor wali dalam format 62xxx; null kalau kosong atau tidak sah */
  nomor:              string | null
  /** Semua tagihan belum lunas siswa ini, sudah digabung dengan pembayarannya */
  tagihan:            TagihanPengingat[]
  ringkasan:          RingkasanTunggakan<TagihanPengingat>
  /** Masih punya job antre atau mengirim */
  adaJobAktif:        boolean
  /** Waktu kirim job yang terkirim sejak awal bulan atau awal masa cooldown, mana pun yang lebih dulu */
  terkirim:           Date[]
  /** Ada bukti transfer untuk tagihan belum lunasnya yang belum diverifikasi */
  menungguVerifikasi: boolean
}

export async function sekolahAktif(db: SupabaseClient, sekolahId: string): Promise<{ aktif: boolean; error: string | null }> {
  const { data, error } = await db
    .from('pengaturan').select('pengingat_wa_aktif').eq('sekolah_id', sekolahId).maybeSingle()
  if (error) return { aktif: false, error: 'Pengaturan pengingat gagal dimuat.' }
  return { aktif: (data as { pengingat_wa_aktif?: boolean } | null)?.pengingat_wa_aktif === true, error: null }
}

/** Siswa milik sekolah ini beserta tunggakan dan riwayat pengingatnya. Id sekolah lain dibuang. */
export async function muatPenilaian(
  db: SupabaseClient, sekolahId: string, siswaIds: string[], sekarang: Date, konfig: KonfigPengingat,
): Promise<{ data: Map<string, PenilaianSiswa> | null; error: string | null }> {
  const sejak = new Date(Math.min(
    awalBulanWIB(sekarang).getTime(),
    awalCooldownWIB(sekarang, konfig.cooldownHari).getTime(),
  )).toISOString()

  const [siswaRes, tagihanRes, aktifRes, terkirimRes, verifikasiRes] = await Promise.all([
    ambilPerPotong<SiswaRow>(siswaIds, (ids, dari, sampai) => db
      .from('siswa').select('id, nama, nama_wali, no_wa, status, kelas, kelas_id')
      .eq('sekolah_id', sekolahId).in('id', ids)
      .order('id').range(dari, sampai)),
    // Yang lunas tidak pernah menjadi tunggakan, jadi tidak perlu ikut diambil
    ambilPerPotong<TagihanRow>(siswaIds, (ids, dari, sampai) => db
      .from('tagihan').select('id, siswa_id, kelas_id, total_nominal, status, bulan, tahun, jatuh_tempo, payment_token, payment_token_aktif')
      .eq('sekolah_id', sekolahId).in('siswa_id', ids).neq('status', 'lunas')
      .order('id').range(dari, sampai)),
    ambilPerPotong<JobRingkas>(siswaIds, (ids, dari, sampai) => db
      .from('reminder_job').select(SELECT_JOB_RINGKAS)
      .eq('sekolah_id', sekolahId).in('siswa_id', ids).in('status', ['antre', 'mengirim'])
      .order('id').range(dari, sampai)),
    ambilPerPotong<JobRingkas>(siswaIds, (ids, dari, sampai) => db
      .from('reminder_job').select(SELECT_JOB_RINGKAS)
      .eq('sekolah_id', sekolahId).in('siswa_id', ids).eq('status', 'terkirim').gte('sent_at', sejak)
      .order('id').range(dari, sampai)),
    ambilPerPotong<{ siswa_id: string; tagihan_id: string }>(siswaIds, (ids, dari, sampai) => db
      .from('verifikasi_pembayaran').select('id, siswa_id, tagihan_id')
      .eq('sekolah_id', sekolahId).in('siswa_id', ids).eq('status', 'menunggu')
      .order('id').range(dari, sampai)),
  ])
  if (siswaRes.error || tagihanRes.error || aktifRes.error || terkirimRes.error || verifikasiRes.error) {
    return { data: null, error: 'Data pengingat gagal dimuat.' }
  }

  const pembayaranRes = await ambilPerPotong<PembayaranRow>(tagihanRes.data.map(t => t.id), (ids, dari, sampai) => db
    .from('pembayaran').select('id, tagihan_id, jumlah, tanggal_bayar')
    .in('tagihan_id', ids)
    .order('id').range(dari, sampai))
  if (pembayaranRes.error) return { data: null, error: 'Data pembayaran gagal dimuat.' }

  const alumni = new Set(siswaRes.data.filter(s => s.status === 'alumni').map(s => s.id))
  const tagihanPerSiswa = new Map<string, TagihanPengingat[]>()
  for (const t of gabungPembayaran(tagihanRes.data.map(t => ({ ...t, is_alumni: alumni.has(t.siswa_id) })), pembayaranRes.data)) {
    const daftar = tagihanPerSiswa.get(t.siswa_id) ?? []
    daftar.push(t)
    tagihanPerSiswa.set(t.siswa_id, daftar)
  }

  const punyaJobAktif = new Set(aktifRes.data.map(j => j.siswa_id))
  const terkirimPerSiswa = new Map<string, Date[]>()
  for (const j of terkirimRes.data) {
    if (!j.sent_at) continue
    const daftar = terkirimPerSiswa.get(j.siswa_id) ?? []
    daftar.push(new Date(j.sent_at))
    terkirimPerSiswa.set(j.siswa_id, daftar)
  }

  // Bukti untuk tagihan yang sudah lunas tidak dihitung — sama dengan label "Diproses" di dashboard
  const belumLunas = new Set(tagihanRes.data.map(t => t.id))
  const menunggu   = new Set(verifikasiRes.data.filter(v => belumLunas.has(v.tagihan_id)).map(v => v.siswa_id))

  return {
    data: new Map(siswaRes.data.map(s => {
      const tagihan = tagihanPerSiswa.get(s.id) ?? []
      return [s.id, {
        siswa:              s,
        nomor:              normalkanNomorWa(s.no_wa),
        tagihan,
        ringkasan:          ringkasTunggakan(tagihan, sekarang),
        adaJobAktif:        punyaJobAktif.has(s.id),
        terkirim:           terkirimPerSiswa.get(s.id) ?? [],
        menungguVerifikasi: menunggu.has(s.id),
      }]
    })),
    error: null,
  }
}

/** Pernah dikirimi pesan dalam masa cooldown */
export const dalamCooldown = (p: PenilaianSiswa, sekarang: Date, konfig: KonfigPengingat): boolean => {
  const awal = awalCooldownWIB(sekarang, konfig.cooldownHari).getTime()
  return p.terkirim.some(t => t.getTime() >= awal)
}

/**
 * Sisa hari kalender WIB sebelum siswa boleh diingatkan lagi, dihitung dari kiriman
 * terakhir: dikirim tanggal 7 → 2 (tgl 7), 1 (tgl 8), 0 (tgl 9). Sejalan dengan dalamCooldown.
 */
export const sisaCooldownHari = (p: PenilaianSiswa, sekarang: Date, konfig: KonfigPengingat): number => {
  if (p.terkirim.length === 0) return 0
  const terakhir = new Date(Math.max(...p.terkirim.map(t => t.getTime())))
  return Math.max(0, konfig.cooldownHari - selisihHari(terakhir, sekarang))
}

/**
 * Tampilan tombol satu siswa. Wali yang opt-out atau sudah kena batas bulanan sengaja
 * tetap `ingatkan` (keputusan 1 Okt 2026) — kliknya saja yang tidak menghasilkan job.
 * Siswa yang bukti transfernya masih menunggu verifikasi tidak diingatkan.
 */
export function tampilanSiswa(p: PenilaianSiswa | undefined, sekarang: Date, konfig: KonfigPengingat): TampilanIngatkan {
  if (!p) return 'nonaktif'
  if (p.adaJobAktif) return 'mengirim'
  if (dalamCooldown(p, sekarang, konfig)) return 'terkirim'
  return p.nomor && p.ringkasan.tunggakan.length > 0 && !p.menungguVerifikasi ? 'ingatkan' : 'nonaktif'
}
