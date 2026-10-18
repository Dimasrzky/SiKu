import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-service'
import { jenisGambar } from '@/lib/jenisGambar'
import { sekolahPunyaFitur } from '@/lib/fiturSekolah'
import { BUCKET_FOTO_PENGELUARAN } from '@/lib/pengeluaran'

const MAX_SIZE_BYTES    = 5 * 1024 * 1024
const MASA_TAUTAN_DETIK = 10 * 60

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const gagal = (error: string, status: number) => NextResponse.json({ data: null, error }, { status })

interface Akses {
  db:            SupabaseClient
  sekolahId:     string
  pengeluaranId: string
  /** null juga kalau path tersimpan berada di luar folder sekolah ini */
  fotoPath:      string | null
}

/**
 * Foto nota pengeluaran disimpan di bucket privat tanpa policy storage, jadi semua akses
 * lewat route ini: pemilik pengeluaran harus sekolah akun yang login, dan sekolah itu
 * harus masih punya subfitur Pengeluaran.
 */
async function periksaAkses(req: NextRequest, params: Promise<{ id: string }>): Promise<{ akses: Akses } | { tolak: NextResponse }> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return { tolak: gagal('Unauthorized', 401) }

  const db = createServiceClient()
  const { data: { user }, error: authError } = await db.auth.getUser(token)
  if (authError || !user) return { tolak: gagal('Sesi tidak valid. Silakan masuk kembali.', 401) }

  const { id } = await params
  if (!POLA_UUID.test(id)) return { tolak: gagal('Pengeluaran tidak ditemukan.', 404) }

  const { data: profil } = await db.from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
  const sekolahId = (profil as { sekolah_id: string | null } | null)?.sekolah_id
  if (!sekolahId) return { tolak: gagal('Profil tidak lengkap.', 400) }

  const fitur = await sekolahPunyaFitur(db, sekolahId, 'pengeluaran')
  if (fitur.error !== null) return { tolak: gagal(fitur.error, 500) }
  if (!fitur.data) return { tolak: gagal('Fitur Pengeluaran belum aktif untuk sekolah ini.', 403) }

  const { data: baris, error: bacaErr } = await db
    .from('pengeluaran')
    .select('id, foto_path')
    .eq('id', id)
    .eq('sekolah_id', sekolahId)
    .maybeSingle()
  if (bacaErr) return { tolak: gagal('Data pengeluaran gagal dimuat.', 500) }
  if (!baris) return { tolak: gagal('Pengeluaran tidak ditemukan.', 404) }

  const path = (baris as { foto_path: string | null }).foto_path
  return {
    akses: { db, sekolahId, pengeluaranId: id, fotoPath: path?.startsWith(`${sekolahId}/`) ? path : null },
  }
}

/** Unggah atau ganti foto nota (JPG/PNG, maks. 5 MB) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const hasil = await periksaAkses(req, params)
  if ('tolak' in hasil) return hasil.tolak
  const { db, sekolahId, pengeluaranId, fotoPath } = hasil.akses

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return gagal('Request tidak valid.', 400)
  }
  const foto = formData.get('foto')
  if (!(foto instanceof File)) return gagal('Foto wajib dipilih.', 400)
  if (foto.size > MAX_SIZE_BYTES) return gagal('Ukuran foto maksimal 5MB.', 400)

  // Jenis berkas dari isinya, bukan dari label yang dikirim browser
  const isi   = new Uint8Array(await foto.arrayBuffer())
  const jenis = jenisGambar(isi)
  if (!jenis) return gagal('Format foto harus JPG atau PNG.', 400)

  const path = `${sekolahId}/${pengeluaranId}/${crypto.randomUUID()}.${jenis === 'image/png' ? 'png' : 'jpg'}`
  const { error: unggahErr } = await db.storage
    .from(BUCKET_FOTO_PENGELUARAN)
    .upload(path, isi, { contentType: jenis, upsert: false })
  if (unggahErr) return gagal('Foto gagal diunggah.', 500)

  const { error: ubahErr } = await db
    .from('pengeluaran')
    .update({ foto_path: path, updated_at: new Date().toISOString() })
    .eq('id', pengeluaranId)
    .eq('sekolah_id', sekolahId)
  if (ubahErr) {
    await db.storage.from(BUCKET_FOTO_PENGELUARAN).remove([path])
    return gagal('Foto gagal disimpan.', 500)
  }

  if (fotoPath) await db.storage.from(BUCKET_FOTO_PENGELUARAN).remove([fotoPath])
  return NextResponse.json({ data: { foto_path: path }, error: null })
}

/** Tautan sementara untuk melihat foto nota */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const hasil = await periksaAkses(req, params)
  if ('tolak' in hasil) return hasil.tolak
  const { db, fotoPath } = hasil.akses
  if (!fotoPath) return gagal('Pengeluaran ini tidak punya foto nota.', 404)

  const { data, error } = await db.storage.from(BUCKET_FOTO_PENGELUARAN).createSignedUrl(fotoPath, MASA_TAUTAN_DETIK)
  if (error || !data?.signedUrl) return gagal('Foto gagal dimuat.', 500)
  return NextResponse.json({ data: { url: data.signedUrl }, error: null })
}

/** Hapus foto nota; pengeluarannya tetap */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const hasil = await periksaAkses(req, params)
  if ('tolak' in hasil) return hasil.tolak
  const { db, sekolahId, pengeluaranId, fotoPath } = hasil.akses

  const { error } = await db
    .from('pengeluaran')
    .update({ foto_path: null, updated_at: new Date().toISOString() })
    .eq('id', pengeluaranId)
    .eq('sekolah_id', sekolahId)
  if (error) return gagal('Foto gagal dihapus.', 500)

  if (fotoPath) await db.storage.from(BUCKET_FOTO_PENGELUARAN).remove([fotoPath])
  return NextResponse.json({ data: { id: pengeluaranId }, error: null })
}
