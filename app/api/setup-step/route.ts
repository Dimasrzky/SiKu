import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SetupStep = 'tahun_ajaran' | 'komponen_tagihan' | 'buat_kelas' | 'import_siswa'

const VALID_STEPS: SetupStep[] = ['tahun_ajaran', 'komponen_tagihan', 'buat_kelas', 'import_siswa']

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

  // ── Simpan data tahun ajaran ke tabel tahun_ajaran ───────────────────
  if (step === 'tahun_ajaran' && stepData) {
    const {
      nama, tanggal_mulai, tanggal_selesai,
      semester_ganjil_mulai, semester_ganjil_selesai,
      semester_genap_mulai, semester_genap_selesai,
    } = stepData as {
      nama: string
      tanggal_mulai: string; tanggal_selesai: string
      semester_ganjil_mulai: string; semester_ganjil_selesai: string
      semester_genap_mulai: string; semester_genap_selesai: string
    }

    await supabaseAdmin.from('tahun_ajaran').delete().eq('sekolah_id', profile.sekolah_id).eq('is_aktif', true)

    const { error: taError } = await supabaseAdmin.from('tahun_ajaran').insert({
      sekolah_id: profile.sekolah_id,
      nama,
      tanggal_mulai,
      tanggal_selesai,
      semester_ganjil_mulai,
      semester_ganjil_selesai,
      semester_genap_mulai,
      semester_genap_selesai,
      is_aktif: true,
    })

    if (taError) return NextResponse.json({ error: taError.message ?? 'Gagal simpan tahun ajaran' }, { status: 500 })
  }

  // ── Simpan komponen tagihan ke tabel tersendiri ──────────────────────
  if (step === 'komponen_tagihan' && stepData) {
    type KomponenCard = {
      id: string
      jenis: string
      nama?: string
      kelasJenjang?: string
      kelasWarna?: string
      kelasJumlah?: number
      kelasRef?: string
      scope?: 'semua' | 'perorangan'
      keterangan?: string | null
      nominalDefault?: number | null
      items: Array<{ id: string; nama: string; nominal: number }>
      potonganData?: Array<{ kelasJenjang?: string; namaItem: string; nominalAsli: number; persenPotong: number }>
    }
    const { tahun_ajaran, semester, komponen } = stepData as {
      tahun_ajaran: string
      semester:     string
      komponen:     KomponenCard[]
    }

    await supabaseAdmin.from('komponen_tagihan').delete().eq('sekolah_id', profile.sekolah_id)

    for (const card of komponen) {
      const { data: ins } = await supabaseAdmin
        .from('komponen_tagihan')
        .insert({
          sekolah_id:      profile.sekolah_id,
          jenis:           card.jenis,
          nama:            card.nama            ?? null,
          kelas_warna:     card.kelasWarna      ?? null,
          keterangan:      card.keterangan      ?? null,
          nominal_default: card.nominalDefault  ?? null,
          tahun_ajaran,
          semester,
        })
        .select('id')
        .single()

      if (!ins) continue

      if (card.items.length > 0) {
        await supabaseAdmin.from('komponen_tagihan_item').insert(
          card.items.map((item, i) => ({
            komponen_id: ins.id,
            nama:        item.nama,
            nominal:     item.nominal,
            urutan:      i,
          }))
        )
      }

      if (card.potonganData && card.potonganData.length > 0) {
        await supabaseAdmin.from('komponen_tagihan_potongan').insert(
          card.potonganData.map(p => ({
            komponen_id:   ins.id,
            kelas_jenjang: p.kelasJenjang ?? '',
            nama_item:     p.namaItem,
            nominal_asli:  p.nominalAsli,
            persen_potong: p.persenPotong,
          }))
        )
      }
    }
  }

  // ── Simpan kelas ke tabel kelas ───────────────────────────────────────
  if (step === 'buat_kelas' && stepData) {
    const { tahun_ajaran, semester, kelas } = stepData as {
      tahun_ajaran: string
      semester:     string
      kelas:        { nama: string; warna: string }[]
    }

    await supabaseAdmin.from('kelas').delete().eq('sekolah_id', profile.sekolah_id)

    if (kelas.length > 0) {
      await supabaseAdmin.from('kelas').insert(
        kelas.map(k => ({
          sekolah_id:   profile.sekolah_id,
          nama:         k.nama,
          jenjang:      k.nama.split('-')[0] ?? '',
          warna:        k.warna,
          tahun_ajaran,
          semester,
        }))
      )
    }
  }

  // ── Update flag setup_steps di pengaturan ─────────────────────────────
  const { data: pengaturan } = await supabaseAdmin
    .from('pengaturan')
    .select('setup_steps')
    .eq('sekolah_id', profile.sekolah_id)
    .maybeSingle()

  const current = { ...(pengaturan?.setup_steps ?? {}) } as Record<string, unknown>
  const updated = { ...current, [step]: true }
  delete updated['komponen_tagihan_data']

  const { error: updateError } = await supabaseAdmin
    .from('pengaturan')
    .update({ setup_steps: updated })
    .eq('sekolah_id', profile.sekolah_id)

  if (updateError) {
    return NextResponse.json({ error: 'Gagal update step' }, { status: 500 })
  }

  return NextResponse.json({ data: { setup_steps: updated }, error: null })
}
