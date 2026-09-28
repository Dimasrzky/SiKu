import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilSemua } from './ambilSemua'

// Khusus server (route handler dengan service role) — dipakai bersama oleh
// /api/demo-reset dan /api/demo-seed supaya penjaga akses dan urutan hapusnya
// tidak pernah berselisih. Jangan diimpor dari komponen 'use client'.

/**
 * Penjaga akses aksi demo: token valid, akunnya super_admin, dan sekolah target
 * memang sekolah demo. Keduanya menghapus data massal, jadi ketiga syarat wajib.
 */
export async function cekAksesDemo(
  db: SupabaseClient,
  token: string | undefined,
  demoSekolahId: string,
): Promise<{ userId: string; error: null } | { userId: null; error: string; status: number }> {
  if (!token) return { userId: null, error: 'Unauthorized', status: 401 }

  const { data: { user }, error: authError } = await db.auth.getUser(token)
  if (authError || !user) return { userId: null, error: 'Token tidak valid', status: 401 }

  const { data: roleCheck } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (roleCheck?.role !== 'super_admin') return { userId: null, error: 'Akses tidak sah.', status: 403 }

  const { data: sekolahCheck } = await db
    .from('sekolah').select('id, jenis').eq('id', demoSekolahId).eq('jenis', 'demo').maybeSingle()
  if (!sekolahCheck || sekolahCheck.id !== demoSekolahId) {
    return { userId: null, error: 'Sekolah demo tidak valid.', status: 403 }
  }

  return { userId: user.id, error: null }
}

/** Tabel yang belum tentu ada di semua skema — ketiadaannya bukan kegagalan. */
const tabelTidakAda = (e: { code?: string; message?: string }) =>
  e.code === 'PGRST205' || e.code === '42P01'
  || (e.message ?? '').includes('Could not find the table')

/** Kumpulan kegagalan nyata, supaya reset tidak pernah lagi mengaku berhasil diam-diam. */
export type Gagal = { tabel: string; pesan: string }

type Kueri = ReturnType<SupabaseClient['from']>

async function hapus(
  db: SupabaseClient,
  gagal: Gagal[],
  tabel: string,
  bangun: (q: Kueri) => PromiseLike<{ error: { code?: string; message?: string } | null }>,
) {
  const { error } = await bangun(db.from(tabel))
  if (error && !tabelTidakAda(error)) gagal.push({ tabel, pesan: error.message ?? 'gagal' })
}

// Id dikirim lewat URL oleh filter .in() — ribuan UUID sekaligus melampaui batas
// panjang URL, jadi penghapusan tabel anak dipecah per potongan.
const UKURAN_POTONGAN = 150

async function hapusPerPotong(db: SupabaseClient, gagal: Gagal[], tabel: string, kolom: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += UKURAN_POTONGAN) {
    const potong = ids.slice(i, i + UKURAN_POTONGAN)
    await hapus(db, gagal, tabel, q => q.delete().in(kolom, potong))
  }
}

/** Id baris milik sekolah demo, untuk menghapus tabel anak yang tanpa sekolah_id.
 *  Diambil bertahap — .limit() tunggal terpotong diam-diam di batas Max rows. */
async function idMilik(db: SupabaseClient, tabel: string, sekolahId: string): Promise<string[]> {
  const { data } = await ambilSemua<{ id: string }>((dari, sampai) =>
    db.from(tabel).select('id').eq('sekolah_id', sekolahId).order('id').range(dari, sampai))
  return data.map(r => r.id)
}

/**
 * Hapus seluruh data operasional sekolah demo, urut dari anak ke induk — salah
 * urutan membuat foreign key menolak penghapusan. Profil, sekolah, pengaturan, dan
 * rekening tidak disentuh: itu konfigurasi, dan Isi Data Contoh tidak boleh
 * menghapus rekening yang sudah disiapkan tim. Reset Demo menghapusnya sendiri.
 */
export async function hapusDataDemo(db: SupabaseClient, sekolahId: string): Promise<Gagal[]> {
  const gagal: Gagal[] = []

  // Id induk dikumpulkan lebih dulu — sesudah induknya terhapus, anaknya tak terlacak
  const [tagihanIds, paketIds, beasiswaIds, komponenIds] = await Promise.all([
    idMilik(db, 'tagihan', sekolahId),
    idMilik(db, 'paket', sekolahId),
    idMilik(db, 'beasiswa', sekolahId),
    idMilik(db, 'komponen_tagihan', sekolahId),
  ])

  // Semua yang mengacu ke tagihan
  await hapusPerPotong(db, gagal, 'tagihan_item', 'tagihan_id', tagihanIds)
  await hapus(db, gagal, 'verifikasi_pembayaran', q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'payment_gateway_trx',   q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'pembayaran',            q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'tagihan_siswa',         q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'tagihan',               q => q.delete().eq('sekolah_id', sekolahId))

  // Paket dan anaknya
  await hapusPerPotong(db, gagal, 'paket_kelas',    'paket_id', paketIds)
  await hapusPerPotong(db, gagal, 'paket_komponen', 'paket_id', paketIds)
  await hapus(db, gagal, 'paket', q => q.delete().eq('sekolah_id', sekolahId))

  // Beasiswa dan anaknya
  await hapusPerPotong(db, gagal, 'beasiswa_siswa',    'beasiswa_id', beasiswaIds)
  await hapusPerPotong(db, gagal, 'beasiswa_komponen', 'beasiswa_id', beasiswaIds)
  await hapus(db, gagal, 'beasiswa', q => q.delete().eq('sekolah_id', sekolahId))

  // Komponen individu harus lepas sebelum komponen induknya dihapus
  await hapus(db, gagal, 'siswa_komponen_individu', q => q.delete().eq('sekolah_id', sekolahId))
  await hapusPerPotong(db, gagal, 'komponen_tagihan_item',     'komponen_id', komponenIds)
  await hapusPerPotong(db, gagal, 'komponen_tagihan_potongan', 'komponen_id', komponenIds)
  await hapus(db, gagal, 'komponen_tagihan', q => q.delete().eq('sekolah_id', sekolahId))

  // Catatan tindak lanjut mengacu ke siswa. Foreign key-nya ON DELETE CASCADE,
  // tapi dihapus eksplisit supaya urutan ini tidak bergantung pada skema
  await hapus(db, gagal, 'catatan_tindak_lanjut', q => q.delete().eq('sekolah_id', sekolahId))

  // Siswa mengacu ke kelas, jadi siswa lebih dulu
  await hapus(db, gagal, 'siswa',        q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'kelas',        q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'tahun_ajaran', q => q.delete().eq('sekolah_id', sekolahId))

  return gagal
}

/** Rekening tidak mengacu tabel lain, jadi aman dihapus kapan saja. */
export async function hapusRekeningDemo(db: SupabaseClient, sekolahId: string): Promise<Gagal[]> {
  const gagal: Gagal[] = []
  await hapus(db, gagal, 'rekening', q => q.delete().eq('sekolah_id', sekolahId))
  return gagal
}
