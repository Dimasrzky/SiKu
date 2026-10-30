import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-service'
import { jenisGambar } from '@/lib/jenisGambar'
import {
  BUCKET_LOGO_SEKOLAH, KOLOM_LOGO, UKURAN_LOGO_MAKS, adalahJenisLogo, type JenisLogo,
} from '@/lib/logoSekolah'

// Logo yayasan dan logo sekolah untuk kop laporan. Bucket-nya privat tanpa policy
// storage, jadi semua akses lewat route ini dengan service role — dan selalu untuk
// sekolah milik akun yang login saja.

const gagal = (error: string, status: number) => NextResponse.json({ data: null, error }, { status })

/** Kolom logo belum dibuat — SQL kop laporan (31 Okt 2026) belum dijalankan */
const kolomBelumAda = (e: { code?: string; message?: string }) =>
  e.code === '42703' || e.code === 'PGRST204' || (e.message ?? '').includes('logo_')

const PESAN_BELUM_SIAP = 'Penyimpanan logo belum disiapkan di database. Jalankan SQL kop laporan terlebih dahulu.'

interface Akses { db: SupabaseClient; sekolahId: string }

async function periksaAkses(req: NextRequest): Promise<{ akses: Akses } | { tolak: NextResponse }> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return { tolak: gagal('Unauthorized', 401) }

  const db = createServiceClient()
  const { data: { user }, error: authError } = await db.auth.getUser(token)
  if (authError || !user) return { tolak: gagal('Sesi tidak valid. Silakan masuk kembali.', 401) }

  const { data: profil } = await db.from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
  const sekolahId = (profil as { sekolah_id: string | null } | null)?.sekolah_id
  if (!sekolahId) return { tolak: gagal('Profil tidak lengkap.', 400) }
  return { akses: { db, sekolahId } }
}

type PathLogo = Record<JenisLogo, string | null>

/** Path logo yang tersimpan; path di luar folder sekolah ini dianggap tidak ada */
async function bacaPath({ db, sekolahId }: Akses): Promise<{ path: PathLogo } | { tolak: NextResponse }> {
  const { data, error } = await db
    .from('sekolah')
    .select('logo_yayasan_path, logo_sekolah_path')
    .eq('id', sekolahId)
    .maybeSingle()
  if (error) return { tolak: gagal(kolomBelumAda(error) ? PESAN_BELUM_SIAP : 'Data logo gagal dimuat.', 500) }

  const baris = (data ?? {}) as { logo_yayasan_path?: string | null; logo_sekolah_path?: string | null }
  const milikSendiri = (p: string | null | undefined) => (p && p.startsWith(`${sekolahId}/`) ? p : null)
  return { path: { yayasan: milikSendiri(baris.logo_yayasan_path), sekolah: milikSendiri(baris.logo_sekolah_path) } }
}

const keDataUrl = (isi: Uint8Array, jenis: string) => `data:${jenis};base64,${Buffer.from(isi).toString('base64')}`

/** Kedua logo sebagai data URL — null kalau belum diunggah atau berkasnya hilang */
export async function GET(req: NextRequest) {
  const hasil = await periksaAkses(req)
  if ('tolak' in hasil) return hasil.tolak
  const { db } = hasil.akses

  const tersimpan = await bacaPath(hasil.akses)
  if ('tolak' in tersimpan) return tersimpan.tolak

  const unduh = async (path: string | null): Promise<string | null> => {
    if (!path) return null
    const { data, error } = await db.storage.from(BUCKET_LOGO_SEKOLAH).download(path)
    if (error || !data) {
      console.error('[Logo sekolah] berkas gagal diunduh:', path, error)
      return null
    }
    const isi   = new Uint8Array(await data.arrayBuffer())
    const jenis = jenisGambar(isi)
    return jenis ? keDataUrl(isi, jenis) : null
  }

  const [yayasan, sekolah] = await Promise.all([unduh(tersimpan.path.yayasan), unduh(tersimpan.path.sekolah)])
  return NextResponse.json({ data: { yayasan, sekolah }, error: null }, { headers: { 'Cache-Control': 'no-store' } })
}

/** Unggah atau ganti satu logo (PNG/JPG, maks. 2 MB) */
export async function POST(req: NextRequest) {
  const hasil = await periksaAkses(req)
  if ('tolak' in hasil) return hasil.tolak
  const { db, sekolahId } = hasil.akses

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return gagal('Request tidak valid.', 400)
  }
  const jenisLogo = formData.get('jenis')
  if (!adalahJenisLogo(jenisLogo)) return gagal('Jenis logo tidak dikenal.', 400)
  const logo = formData.get('logo')
  if (!(logo instanceof File)) return gagal('Logo wajib dipilih.', 400)
  if (logo.size > UKURAN_LOGO_MAKS) return gagal('Ukuran logo maksimal 2MB.', 400)

  // Jenis berkas dari isinya, bukan dari label yang dikirim browser
  const isi   = new Uint8Array(await logo.arrayBuffer())
  const jenis = jenisGambar(isi)
  if (!jenis) return gagal('Format logo harus PNG atau JPG.', 400)

  const lama = await bacaPath(hasil.akses)
  if ('tolak' in lama) return lama.tolak

  const path = `${sekolahId}/${jenisLogo}-${crypto.randomUUID()}.${jenis === 'image/png' ? 'png' : 'jpg'}`
  const { error: unggahErr } = await db.storage
    .from(BUCKET_LOGO_SEKOLAH)
    .upload(path, isi, { contentType: jenis, upsert: false })
  if (unggahErr) {
    console.error('[Logo sekolah] gagal mengunggah:', unggahErr)
    const belumAda = /bucket not found/i.test(unggahErr.message)
    return gagal(belumAda ? PESAN_BELUM_SIAP : 'Logo gagal diunggah.', 500)
  }

  const { error: ubahErr } = await db
    .from('sekolah')
    .update({ [KOLOM_LOGO[jenisLogo]]: path })
    .eq('id', sekolahId)
  if (ubahErr) {
    await db.storage.from(BUCKET_LOGO_SEKOLAH).remove([path])
    return gagal(kolomBelumAda(ubahErr) ? PESAN_BELUM_SIAP : 'Logo gagal disimpan.', 500)
  }

  const pathLama = lama.path[jenisLogo]
  if (pathLama) await db.storage.from(BUCKET_LOGO_SEKOLAH).remove([pathLama])
  return NextResponse.json({ data: { jenis: jenisLogo, dataUrl: keDataUrl(isi, jenis), path }, error: null })
}

/** Hapus satu logo: DELETE /api/sekolah/logo?jenis=yayasan|sekolah */
export async function DELETE(req: NextRequest) {
  const hasil = await periksaAkses(req)
  if ('tolak' in hasil) return hasil.tolak
  const { db, sekolahId } = hasil.akses

  const jenisLogo = req.nextUrl.searchParams.get('jenis')
  if (!adalahJenisLogo(jenisLogo)) return gagal('Jenis logo tidak dikenal.', 400)

  const lama = await bacaPath(hasil.akses)
  if ('tolak' in lama) return lama.tolak

  const { error } = await db
    .from('sekolah')
    .update({ [KOLOM_LOGO[jenisLogo]]: null })
    .eq('id', sekolahId)
  if (error) return gagal('Logo gagal dihapus.', 500)

  const pathLama = lama.path[jenisLogo]
  if (pathLama) await db.storage.from(BUCKET_LOGO_SEKOLAH).remove([pathLama])
  return NextResponse.json({ data: { jenis: jenisLogo }, error: null })
}
