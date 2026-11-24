import type { SupabaseClient } from '@supabase/supabase-js'
import { adalahSekolahDemo } from '@/lib/akunSekolah'
import { bacaStatus, type StatusKemitraan } from '@/lib/kemitraan'
import { ringkasLangkahSetup, type RingkasanSetup } from '@/lib/langkahSetup'
import { formatRelatif, formatTanggalWIB, formatWaktu, formatWaktuWIB } from './format'

// Khusus server (service role): daftar sekolah untuk Beranda dan Kemitraan Sekolah di
// dasbor admin. Jangan diimpor dari komponen 'use client'.

/** Satu sekolah di dasbor admin; semua waktu sudah diformat (WIB) */
export interface SekolahAdmin {
  id:             string
  namaSekolah:    string
  jenjang:        string | null
  /** sekolah.kota — diisi bendahara di Pengaturan → Profil Sekolah, belum tentu ada */
  kota:           string | null
  namaBendahara:  string | null
  email:          string | null
  /** Nomor WhatsApp sekolah dengan awalan 62, tanpa tanda + */
  noWa:           string | null
  /** sekolah.email — email sekolah dari Pengaturan → Profil Sekolah, bukan email login */
  emailSekolah:   string | null
  status:         StatusKemitraan
  demo:           boolean
  setup:          RingkasanSetup
  /** Login terakhir bendahara (Supabase Auth), mis. "3 jam lalu"; null = belum pernah / tidak terbaca */
  loginRelatif:   string | null
  /** Waktu login yang sama, "24 Nov 2026, 09.12" (WIB) */
  loginLengkap:   string | null
  /** Waktu daftar, "24 Nov 2026, 09.12 WIB" */
  terdaftar:      string
  /** Tanggal konfirmasi kemitraan; null untuk sekolah lama */
  mitraSejak:     string | null
  /** pengaturan.pengingat_wa_aktif; null = baris pengaturan belum ada */
  pengingatAktif: boolean | null
}

type ProfilJoin     = { id: string; nama: string | null; email: string | null; role: string | null }
type PengaturanJoin = { jenjang_sekolah: string | null; pengingat_wa_aktif: boolean | null; setup_steps: unknown }
type SekolahRow = {
  id:                        string
  nama:                      string
  jenis:                     string | null
  kota:                      string | null
  no_wa:                     string | null
  email:                     string | null
  created_at:                string
  status_kemitraan:          string | null
  kemitraan_dikonfirmasi_at: string | null
  // Relasi balik: profiles selalu daftar; pengaturan bisa objek kalau sekolah_id-nya unik
  profiles:                  ProfilJoin[] | ProfilJoin | null
  pengaturan:                PengaturanJoin[] | PengaturanJoin | null
}

const sebagaiDaftar = <T,>(v: T[] | T | null): T[] => (Array.isArray(v) ? v : v ? [v] : [])

const AKUN_PER_HALAMAN = 1000

/**
 * Waktu login terakhir tiap akun. Hanya ada di Supabase Auth (auth.users.last_sign_in_at),
 * tidak di tabel publik, dan berubah hanya saat masuk dengan password — sesi yang dibiarkan
 * terbuka tidak memperbaruinya.
 */
async function bacaLoginTerakhir(db: SupabaseClient): Promise<{ peta: Map<string, string>; gagal: boolean }> {
  const peta = new Map<string, string>()
  for (let halaman = 1; halaman <= 20; halaman++) {
    const { data, error } = await db.auth.admin.listUsers({ page: halaman, perPage: AKUN_PER_HALAMAN })
    if (error) return { peta, gagal: true }
    for (const u of data.users) if (u.last_sign_in_at) peta.set(u.id, u.last_sign_in_at)
    if (data.users.length < AKUN_PER_HALAMAN) break
  }
  return { peta, gagal: false }
}

/**
 * Semua sekolah, urut nama. `denganLogin: false` melewati pembacaan Supabase Auth (Beranda).
 * `loginGagal` = waktu login tidak terbaca, jadi "belum pernah login" tidak bisa dibedakan.
 */
export async function muatSekolahAdmin(
  db: SupabaseClient,
  { denganLogin = true }: { denganLogin?: boolean } = {},
): Promise<{ data: SekolahAdmin[]; error: string | null; loginGagal: boolean }> {
  const [{ data, error }, { peta: loginTerakhir, gagal: loginGagal }] = await Promise.all([
    db.from('sekolah')
      .select('id, nama, jenis, kota, no_wa, email, created_at, status_kemitraan, kemitraan_dikonfirmasi_at, profiles(id, nama, email, role), pengaturan(jenjang_sekolah, pengingat_wa_aktif, setup_steps)')
      .order('nama', { ascending: true })
      .limit(1000),
    denganLogin ? bacaLoginTerakhir(db) : Promise.resolve({ peta: new Map<string, string>(), gagal: false }),
  ])
  if (error) return { data: [], error: 'Data sekolah gagal dimuat.', loginGagal }

  const idDemo   = process.env.DEMO_SEKOLAH_ID?.trim()
  const sekarang = new Date()

  const daftar = ((data ?? []) as unknown as SekolahRow[]).map((s): SekolahAdmin => {
    const profil     = sebagaiDaftar(s.profiles)
    const pengaturan = sebagaiDaftar(s.pengaturan)[0] ?? null
    const bendahara  = profil[0] ?? null
    // Sekolah dengan lebih dari satu akun: yang paling baru login
    const waktuLogin = profil
      .map(p => loginTerakhir.get(p.id))
      .filter((w): w is string => !!w)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null

    return {
      id:             s.id,
      namaSekolah:    s.nama,
      jenjang:        pengaturan?.jenjang_sekolah ?? null,
      kota:           s.kota?.trim() || null,
      namaBendahara:  bendahara?.nama ?? null,
      email:          bendahara?.email ?? null,
      noWa:           s.no_wa?.replace(/\D/g, '') || null,
      emailSekolah:   s.email?.trim() || null,
      status:         bacaStatus(s.status_kemitraan),
      demo:           adalahSekolahDemo(s, profil.map(p => p.role), idDemo),
      setup:          ringkasLangkahSetup(pengaturan?.setup_steps),
      loginRelatif:   waktuLogin ? formatRelatif(waktuLogin, sekarang) : null,
      loginLengkap:   waktuLogin ? formatWaktu(waktuLogin) : null,
      terdaftar:      formatWaktuWIB(s.created_at),
      mitraSejak:     s.kemitraan_dikonfirmasi_at ? formatTanggalWIB(s.kemitraan_dikonfirmasi_at) : null,
      pengingatAktif: pengaturan ? pengaturan.pengingat_wa_aktif === true : null,
    }
  })

  return { data: daftar, error: null, loginGagal }
}
