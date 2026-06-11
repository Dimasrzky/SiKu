import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SiswaInput {
  nama:      string
  nis:       string
  kelas_id:  string
  nama_wali: string | null
  no_wa:     string | null
}

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

  const body = await req.json() as { siswa: SiswaInput[] }

  if (!Array.isArray(body?.siswa) || body.siswa.length === 0) {
    return NextResponse.json({ error: 'Data siswa tidak valid' }, { status: 400 })
  }

  const rows = body.siswa.map(s => ({
    sekolah_id: profile.sekolah_id,
    nama:       s.nama,
    nis:        s.nis,
    kelas_id:   s.kelas_id,
    nama_wali:  s.nama_wali ?? null,
    no_wa:      s.no_wa ?? null,
    status:     'aktif',
  }))

  const { data, error } = await supabaseAdmin
    .from('siswa')
    .insert(rows)
    .select('id, nama, nis')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null })
}
