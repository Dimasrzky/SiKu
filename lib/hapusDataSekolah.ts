import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilSemua } from './ambilSemua'
import { BUCKET_FOTO_PENGELUARAN } from './pengeluaran'
import { BUCKET_LOGO_SEKOLAH } from './logoSekolah'

// Khusus server (route handler dengan service role). Penghapusan data satu sekolah, urut
// dari anak ke induk — salah urutan membuat foreign key menolak penghapusan. Dipakai
// reset/isi data demo (/api/demo-reset, /api/demo-seed) dan Hapus akun sekolah di dasbor
// admin (/api/admin/sekolah/[id]). Jangan diimpor dari komponen 'use client'.

/** Tabel yang belum tentu ada di semua skema — ketiadaannya bukan kegagalan. */
const tabelTidakAda = (e: { code?: string; message?: string }) =>
  e.code === 'PGRST205' || e.code === '42P01'
  || (e.message ?? '').includes('Could not find the table')

/** Kumpulan kegagalan nyata, supaya penghapusan tidak pernah mengaku berhasil diam-diam. */
export type Gagal = { tabel: string; pesan: string }

type Kueri = ReturnType<SupabaseClient['from']>

export async function hapus(
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

/** Id baris milik sekolah, untuk menghapus tabel anak yang tanpa sekolah_id.
 *  Diambil bertahap — .limit() tunggal terpotong diam-diam di batas Max rows. */
async function idMilik(db: SupabaseClient, tabel: string, sekolahId: string): Promise<string[]> {
  const { data } = await ambilSemua<{ id: string }>((dari, sampai) =>
    db.from(tabel).select('id').eq('sekolah_id', sekolahId).order('id').range(dari, sampai))
  return data.map(r => r.id)
}

/**
 * Hapus seluruh data operasional sekolah: tagihan, pembayaran, paket, beasiswa, komponen,
 * siswa, kelas, tahun ajaran. Profil, sekolah, pengaturan, dan rekening tidak disentuh:
 * itu konfigurasi, dan Isi Data Contoh demo tidak boleh menghapus rekening yang sudah
 * disiapkan tim. Reset Demo dan hapusAkunSekolah menghapusnya sendiri.
 */
export async function hapusDataOperasional(db: SupabaseClient, sekolahId: string): Promise<Gagal[]> {
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

// ── Hapus akun sekolah (dasbor admin) ───────────────────────────────────────

/** Bucket berisi file sekolah. Semua path-nya berawalan `${sekolah_id}/`. */
const BUCKET_SEKOLAH = ['bukti-transfer', BUCKET_FOTO_PENGELUARAN, BUCKET_LOGO_SEKOLAH] as const

const FILE_PER_HALAMAN = 100

/**
 * Semua path file di folder sekolah pada satu bucket, sampai dua tingkat (foto nota
 * tersimpan di sekolah/pengeluaran/file). Bucket yang belum dibuat = tidak ada file.
 */
async function berkasSekolah(
  db: SupabaseClient,
  bucket: string,
  sekolahId: string,
): Promise<{ paths: string[]; error: string | null }> {
  const paths: string[] = []

  const telusuri = async (folder: string, sisaTingkat: number): Promise<string | null> => {
    for (let offset = 0; ; offset += FILE_PER_HALAMAN) {
      const { data, error } = await db.storage.from(bucket).list(folder, { limit: FILE_PER_HALAMAN, offset })
      if (error) return /not found/i.test(error.message) ? null : error.message
      const isi = data ?? []
      for (const item of isi) {
        const path = `${folder}/${item.name}`
        // Entri folder tidak punya id
        if (item.id) paths.push(path)
        else if (sisaTingkat > 0) {
          const galat = await telusuri(path, sisaTingkat - 1)
          if (galat) return galat
        }
      }
      if (isi.length < FILE_PER_HALAMAN) return null
    }
  }

  const error = await telusuri(sekolahId, 2)
  return { paths, error }
}

/** Status 404 dari Supabase Auth: akunnya memang sudah tidak ada */
const akunTidakAda = (e: { status?: number } | null) => e?.status === 404

/**
 * Hapus permanen satu sekolah: semua datanya, file di storage, akun login bendahara
 * (Supabase Auth), lalu baris sekolah itu sendiri. Supabase JS tidak punya transaksi,
 * jadi setiap langkah aman diulang, dan baris sekolah baru dihapus kalau semua langkah
 * sebelumnya berhasil — kalau ada yang gagal, sekolah tetap tampil di dasbor admin dan
 * Hapus bisa ditekan lagi untuk menghapus sisanya. Penjaga akses (sesi admin, bukan
 * sekolah demo) tugas pemanggil.
 */
export async function hapusAkunSekolah(db: SupabaseClient, sekolahId: string): Promise<Gagal[]> {
  // Akun login dicatat lebih dulu: sesudah profilnya terhapus, akun tak terlacak lagi
  const { data: profil, error: profilErr } = await db
    .from('profiles').select('id').eq('sekolah_id', sekolahId).limit(100)
  if (profilErr) return [{ tabel: 'profiles', pesan: profilErr.message }]
  const userIds = ((profil ?? []) as { id: string }[]).map(p => p.id)

  const gagal: Gagal[] = []

  // 1. Yang mengacu ke siswa, tagihan, atau komponen harus lepas sebelum induknya dihapus
  await hapus(db, gagal, 'reminder_job',            q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'wa_optout',               q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'pengeluaran_sumber_dana', q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'pengeluaran',             q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'kategori_pengeluaran',    q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'fitur_sekolah',           q => q.delete().eq('sekolah_id', sekolahId))

  // 2. Data operasional: tagihan, pembayaran, siswa, kelas, dst.
  gagal.push(...await hapusDataOperasional(db, sekolahId))

  // 3. Konfigurasi. Trigger rekening menulis rekening_log, jadi log dihapus sesudah rekening.
  //    wa_sender di sini hanya nomor khusus sekolah ini, bukan nomor bersama (sekolah_id null).
  await hapus(db, gagal, 'rekening',     q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'rekening_log', q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'wa_sender',    q => q.delete().eq('sekolah_id', sekolahId))
  await hapus(db, gagal, 'pengaturan',   q => q.delete().eq('sekolah_id', sekolahId))

  // 4. File: bukti transfer wali, foto nota pengeluaran, logo kop
  for (const bucket of BUCKET_SEKOLAH) {
    const { paths, error } = await berkasSekolah(db, bucket, sekolahId)
    if (error) { gagal.push({ tabel: `storage ${bucket}`, pesan: error }); continue }
    for (let i = 0; i < paths.length; i += FILE_PER_HALAMAN) {
      const { error: hapusErr } = await db.storage.from(bucket).remove(paths.slice(i, i + FILE_PER_HALAMAN))
      if (hapusErr) { gagal.push({ tabel: `storage ${bucket}`, pesan: hapusErr.message }); break }
    }
  }

  // 5. Akun login bendahara. Kalau profiles.id mengacu ke auth.users tanpa ON DELETE CASCADE,
  //    Auth menolak selama profilnya masih ada — profil dihapus dulu, lalu dicoba sekali lagi.
  for (const id of userIds) {
    const pertama = await db.auth.admin.deleteUser(id)
    if (!pertama.error || akunTidakAda(pertama.error)) continue
    const { error: profErr } = await db.from('profiles').delete().eq('id', id)
    if (profErr) { gagal.push({ tabel: 'profiles', pesan: profErr.message }); continue }
    const kedua = await db.auth.admin.deleteUser(id)
    if (kedua.error && !akunTidakAda(kedua.error)) gagal.push({ tabel: 'auth.users', pesan: kedua.error.message })
  }
  await hapus(db, gagal, 'profiles', q => q.delete().eq('sekolah_id', sekolahId))

  // 6. Baris sekolah paling akhir, hanya kalau tidak ada yang gagal
  if (gagal.length === 0) await hapus(db, gagal, 'sekolah', q => q.delete().eq('id', sekolahId))

  return gagal
}
