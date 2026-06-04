import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SetupStep = 'kelas_tahun_ajaran' | 'komponen_tagihan' | 'import_siswa'

const VALID_STEPS: SetupStep[] = ['kelas_tahun_ajaran', 'komponen_tagihan', 'import_siswa']

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })

  const body = await req.json() as { step: SetupStep; data?: Record<string, unknown> }
  const { step, data: stepData } = body

  if (!VALID_STEPS.includes(step)) {
    return NextResponse.json({ error: 'Step tidak valid' }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('sekolah_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.sekolah_id) {
    return NextResponse.json({ error: 'Profil tidak lengkap' }, { status: 400 })
  }

  // ── Simpan data kelas ke tabel kelas ──────────────────────────────────
  if (step === 'kelas_tahun_ajaran' && stepData) {
    const { tahun_ajaran, semester, kelas } = stepData as {
      tahun_ajaran: string
      semester:     string
      kelas:        { nama: string; warna: string }[]
    }

    await supabaseAdmin.from('kelas').delete().eq('sekolah_id', profile.sekolah_id)

    const rows = kelas.map(k => {
      const dashIdx = k.nama.indexOf('-')
      return {
        sekolah_id:   profile.sekolah_id,
        nama:         k.nama,
        jenjang:      dashIdx >= 0 ? k.nama.slice(0, dashIdx) : k.nama,
        warna:        k.warna,
        tahun_ajaran,
        semester,
      }
    })

    const { error: kelasError } = await supabaseAdmin.from('kelas').insert(rows)
    if (kelasError) {
      return NextResponse.json({ error: 'Gagal simpan kelas' }, { status: 500 })
    }
  }

  // ── Update flag setup_steps di pengaturan ─────────────────────────────
  const { data: pengaturan } = await supabaseAdmin
    .from('pengaturan')
    .select('setup_steps')
    .eq('sekolah_id', profile.sekolah_id)
    .maybeSingle()

  const current = { ...(pengaturan?.setup_steps ?? {}) } as Record<string, unknown>
  delete current[`${step}_config`]
  const updated = { ...current, [step]: true }

  const { error: updateError } = await supabaseAdmin
    .from('pengaturan')
    .update({ setup_steps: updated })
    .eq('sekolah_id', profile.sekolah_id)

  if (updateError) {
    return NextResponse.json({ error: 'Gagal update step' }, { status: 500 })
  }

  return NextResponse.json({ data: { setup_steps: updated }, error: null })
}
