import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — tambah tahun ajaran mendatang (is_aktif: false)
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('sekolah_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.sekolah_id) return NextResponse.json({ error: 'Profil tidak lengkap' }, { status: 400 })

  const body = await req.json() as {
    nama: string
    tanggal_mulai: string
    tanggal_selesai: string
    semester_ganjil_mulai: string
    semester_ganjil_selesai: string
    semester_genap_mulai: string
    semester_genap_selesai: string
  }

  const { error } = await supabaseAdmin.from('tahun_ajaran').insert({
    sekolah_id:              profile.sekolah_id,
    nama:                    body.nama,
    tanggal_mulai:           body.tanggal_mulai,
    tanggal_selesai:         body.tanggal_selesai,
    semester_ganjil_mulai:   body.semester_ganjil_mulai,
    semester_ganjil_selesai: body.semester_ganjil_selesai,
    semester_genap_mulai:    body.semester_genap_mulai,
    semester_genap_selesai:  body.semester_genap_selesai,
    is_aktif: false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { ok: true }, error: null })
}

// PATCH — aktifkan tahun ajaran berdasarkan id (set yang lain jadi false)
export async function PATCH(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('sekolah_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.sekolah_id) return NextResponse.json({ error: 'Profil tidak lengkap' }, { status: 400 })

  const body = await req.json() as { id: string }

  await supabaseAdmin.from('tahun_ajaran')
    .update({ is_aktif: false })
    .eq('sekolah_id', profile.sekolah_id)

  const { error } = await supabaseAdmin.from('tahun_ajaran')
    .update({ is_aktif: true })
    .eq('id', body.id)
    .eq('sekolah_id', profile.sekolah_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { ok: true }, error: null })
}

// PUT — update data tahun ajaran by id (is_aktif tidak berubah)
export async function PUT(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('sekolah_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.sekolah_id) return NextResponse.json({ error: 'Profil tidak lengkap' }, { status: 400 })

  const body = await req.json() as {
    id: string
    nama: string
    tanggal_mulai: string
    tanggal_selesai: string
    semester_ganjil_mulai: string
    semester_ganjil_selesai: string
    semester_genap_mulai: string
    semester_genap_selesai: string
  }

  const { error } = await supabaseAdmin.from('tahun_ajaran')
    .update({
      nama:                    body.nama,
      tanggal_mulai:           body.tanggal_mulai,
      tanggal_selesai:         body.tanggal_selesai,
      semester_ganjil_mulai:   body.semester_ganjil_mulai,
      semester_ganjil_selesai: body.semester_ganjil_selesai,
      semester_genap_mulai:    body.semester_genap_mulai,
      semester_genap_selesai:  body.semester_genap_selesai,
    })
    .eq('id', body.id)
    .eq('sekolah_id', profile.sekolah_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { ok: true }, error: null })
}
