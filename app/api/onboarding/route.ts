import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEMO_EMAIL      = process.env.DEMO_EMAIL!
const DEMO_SEKOLAH_ID = process.env.DEMO_SEKOLAH_ID!

const DEMO_TABLES = [
  'tagihan_siswa',
  'pembayaran',
  'rekening',
  'tagihan',
  'siswa',
  'kelas',
] as const

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })

  const body = await req.json() as {
    nama: string; jabatan: string; namaSekolah: string; noWaSekolah: string; jenjangSekolah?: string
  }
  const { nama, jabatan, namaSekolah, noWaSekolah, jenjangSekolah = 'SMP/MTs' } = body

  if (!nama?.trim() || !jabatan?.trim() || !namaSekolah?.trim() || !noWaSekolah?.trim()) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
  }

  // ── DEMO FLOW ──────────────────────────────────────────────────────────────
  if (user.email === DEMO_EMAIL) {
    // Guard 1: user harus punya role super_admin — tolak jika ada yg masuk pakai email demo tapi bukan akun aslinya
    const { data: roleCheck } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (roleCheck?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Akses demo tidak sah.' }, { status: 403 })
    }

    // Guard 2: sekolah harus ada dan jenis = 'demo'
    const { data: sekolahCheck } = await supabaseAdmin
      .from('sekolah')
      .select('id, jenis')
      .eq('id', DEMO_SEKOLAH_ID)
      .eq('jenis', 'demo')
      .single()

    if (!sekolahCheck) {
      return NextResponse.json({ error: 'Akun demo tidak valid' }, { status: 403 })
    }

    // Guard 3: pastikan id yang akan di-DELETE sama dengan DEMO_SEKOLAH_ID
    if (sekolahCheck.id !== DEMO_SEKOLAH_ID) {
      return NextResponse.json({ error: 'ID sekolah demo tidak cocok' }, { status: 403 })
    }

    // Reset semua data demo — scoped ke DEMO_SEKOLAH_ID
    for (const table of DEMO_TABLES) {
      const { error: delError } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('sekolah_id', DEMO_SEKOLAH_ID)
      if (delError) console.error(`Reset ${table} error:`, delError.message)
    }

    // Update profiles (nama + jabatan sesuai sekolah yg dikunjungi)
    await supabaseAdmin.from('profiles').update({
      nama,
      jabatan,
      sekolah: namaSekolah,
      avatar:  nama.trim().charAt(0).toUpperCase(),
    }).eq('id', user.id)

    // Update nama sekolah demo
    await supabaseAdmin.from('sekolah')
      .update({ nama: namaSekolah, no_wa: noWaSekolah })
      .eq('id', DEMO_SEKOLAH_ID)

    // Upsert pengaturan demo — termasuk jenjang_sekolah dan reset setup_steps
    await supabaseAdmin.from('pengaturan').upsert({
      sekolah_id:      DEMO_SEKOLAH_ID,
      jenjang_sekolah: jenjangSekolah,
      setup_steps: {
        profil_sekolah:   true,
        tahun_ajaran:     false,
        komponen_tagihan: false,
        buat_kelas:       false,
        import_siswa:     false,
      },
    }, { onConflict: 'sekolah_id' })

    return NextResponse.json({
      data: { sekolahId: DEMO_SEKOLAH_ID, role: 'super_admin' },
      error: null,
    })
  }

  // ── TRIAL FLOW ─────────────────────────────────────────────────────────────
  // Hanya untuk akun yang belum punya sekolah. Tanpa pengecekan ini akun lama bisa membuat
  // sekolah trial baru berulang kali dan memindahkan dirinya ke sana sebagai admin.
  const { data: profilLama, error: profilLamaError } = await supabaseAdmin
    .from('profiles')
    .select('sekolah_id')
    .eq('id', user.id)
    .maybeSingle()
  if (profilLamaError) {
    return NextResponse.json({ error: 'Gagal memeriksa profil' }, { status: 500 })
  }
  if (profilLama?.sekolah_id) {
    return NextResponse.json({ error: 'Akun ini sudah terdaftar di sebuah sekolah' }, { status: 409 })
  }

  const kode           = `TRIAL-${Date.now().toString(36).toUpperCase()}`
  const trialExpiresAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: sekolah, error: sekolahError } = await supabaseAdmin
    .from('sekolah')
    .insert({ nama: namaSekolah, kode, jenis: 'trial', trial_expires_at: trialExpiresAt, no_wa: noWaSekolah })
    .select('id')
    .single()

  if (sekolahError) {
    return NextResponse.json({ error: 'Gagal membuat data sekolah' }, { status: 500 })
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').update({
    nama,
    jabatan,
    sekolah:    namaSekolah,
    avatar:     nama.trim().charAt(0).toUpperCase(),
    sekolah_id: sekolah.id,
    role:       'admin',
  }).eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: 'Gagal update profil' }, { status: 500 })
  }

  const { error: pengaturanError } = await supabaseAdmin.from('pengaturan').insert({
    sekolah_id:      sekolah.id,
    jenjang_sekolah: jenjangSekolah,
    setup_steps: {
      profil_sekolah:   true,
      tahun_ajaran:     false,
      komponen_tagihan: false,
      buat_kelas:       false,
      import_siswa:     false,
    },
  })

  if (pengaturanError) {
    return NextResponse.json({ error: 'Gagal setup pengaturan' }, { status: 500 })
  }

  return NextResponse.json({
    data: { sekolahId: sekolah.id, role: 'admin' },
    error: null,
  })
}
