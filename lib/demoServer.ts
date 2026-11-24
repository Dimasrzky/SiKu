import type { SupabaseClient } from '@supabase/supabase-js'
import { hapus, type Gagal } from './hapusDataSekolah'

// Khusus server (route handler dengan service role) — dipakai bersama oleh
// /api/demo-reset dan /api/demo-seed supaya penjaga aksesnya tidak pernah berselisih.
// Penghapusan datanya ada di lib/hapusDataSekolah. Jangan diimpor dari komponen 'use client'.

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

/** Rekening tidak mengacu tabel lain, jadi aman dihapus kapan saja. */
export async function hapusRekeningDemo(db: SupabaseClient, sekolahId: string): Promise<Gagal[]> {
  const gagal: Gagal[] = []
  await hapus(db, gagal, 'rekening', q => q.delete().eq('sekolah_id', sekolahId))
  return gagal
}
