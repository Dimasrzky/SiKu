import type { SupabaseClient } from '@supabase/supabase-js'

// Pembatas percobaan: password salah di login admin verifikasi dan konfirmasi password
// rekening, juga permintaan dari halaman bayar publik (transaksi, bukti transfer) per
// tautan. Dicatat di tabel percobaan_login, hanya lewat service role.

/**
 * true = kunci ini sudah mencapai `batas` percobaan gagal dalam `menit` terakhir.
 * null = tabelnya tidak bisa dibaca; pemanggil sebaiknya menolak dulu daripada membuka pintu.
 */
export async function terlaluBanyakPercobaan(
  db: SupabaseClient, kunci: string, batas: number, menit: number,
): Promise<boolean | null> {
  const sejak = new Date(Date.now() - menit * 60_000).toISOString()
  const { count, error } = await db
    .from('percobaan_login')
    .select('id', { count: 'exact', head: true })
    .eq('kunci', kunci)
    .gte('created_at', sejak)
  if (error) return null
  return (count ?? 0) >= batas
}

/** Catat satu percobaan, sekalian buang catatan yang sudah lebih dari sehari */
export async function catatPercobaan(db: SupabaseClient, kunci: string): Promise<void> {
  const kemarin = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  await Promise.all([
    db.from('percobaan_login').insert({ kunci }),
    db.from('percobaan_login').delete().lt('created_at', kemarin),
  ])
}
