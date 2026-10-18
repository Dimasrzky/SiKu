import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { fiturSah, type KodeFitur } from '@/lib/fiturSekolah'

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const gagal = (error: string, status: number) => NextResponse.json({ data: null, error }, { status })

/** Sesi admin, id sekolah, dan kode fitur dari body — dipakai tambah maupun cabut */
async function bacaPermintaan(
  req: NextRequest,
  params: Promise<{ sekolahId: string }>,
): Promise<{ sekolahId: string; fitur: KodeFitur } | { tolak: NextResponse }> {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    return { tolak: gagal('Sesi admin tidak valid. Silakan masuk kembali.', 401) }
  }

  const { sekolahId } = await params
  if (!POLA_UUID.test(sekolahId)) return { tolak: gagal('Sekolah tidak ditemukan.', 404) }

  let body: { fitur?: unknown }
  try {
    body = await req.json()
  } catch {
    return { tolak: gagal('Request tidak valid.', 400) }
  }
  if (!fiturSah(body.fitur)) return { tolak: gagal('Subfitur tidak dikenal.', 400) }

  return { sekolahId, fitur: body.fitur }
}

/** Tambahkan subfitur ke sekolah yang mengajukan. Menambahkan dua kali tidak membuat baris ganda. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ sekolahId: string }> }) {
  const p = await bacaPermintaan(req, params)
  if ('tolak' in p) return p.tolak

  const db = createServiceClient()
  const { data: sekolah, error: bacaErr } = await db.from('sekolah').select('id').eq('id', p.sekolahId).maybeSingle()
  if (bacaErr) return gagal('Data sekolah gagal dimuat.', 500)
  if (!sekolah) return gagal('Sekolah tidak ditemukan.', 404)

  const { error } = await db
    .from('fitur_sekolah')
    .upsert({ sekolah_id: p.sekolahId, fitur: p.fitur }, { onConflict: 'sekolah_id,fitur', ignoreDuplicates: true })
  if (error) return gagal('Gagal menambahkan subfitur.', 500)

  return NextResponse.json({ data: { sekolahId: p.sekolahId, fitur: p.fitur }, error: null })
}

/** Cabut subfitur. Data yang sudah dicatat sekolah tidak ikut dihapus. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sekolahId: string }> }) {
  const p = await bacaPermintaan(req, params)
  if ('tolak' in p) return p.tolak

  const db = createServiceClient()
  const { error } = await db.from('fitur_sekolah').delete().eq('sekolah_id', p.sekolahId).eq('fitur', p.fitur)
  if (error) return gagal('Gagal mencabut subfitur.', 500)

  return NextResponse.json({ data: { sekolahId: p.sekolahId, fitur: p.fitur }, error: null })
}
