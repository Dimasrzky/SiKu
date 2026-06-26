import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PaketTotalRaw = {
  paket_kelas:   { kelas_id: string }[]
  paket_komponen: { komponen_id: string; nominal: number }[]
}
type TagihanRaw = {
  id:            string
  total_nominal: number
  bulan:         number
  tahun:         number
  siswa: { id: string; kelas: { id: string } | null } | null
}
type BeasiswaRaw = {
  siswa_id: string
  beasiswa: {
    jenis_potongan: 'persen' | 'nominal'
    persen:         number | null
    nominal:        number | null
    beasiswa_komponen: { komponen_id: string }[]
  } | null
}
type IndividuRaw = {
  siswa_id:    string
  komponen_id: string
  nominal:     number
  komponen:    { jenis: string } | null
}

async function recalculateAll(sid: string): Promise<number> {
  const now    = new Date()
  const bulan  = now.getMonth() + 1
  const tahun  = now.getFullYear()

  // Fetch tagihan + paket + tahun ajaran aktif in parallel
  const [{ data: tagihanRaw }, { data: paketRaw }, { data: taData }] = await Promise.all([
    supabaseAdmin
      .from('tagihan')
      .select('id, total_nominal, bulan, tahun, siswa:siswa_id(id, kelas:kelas_id(id))')
      .eq('sekolah_id', sid)
      .limit(5000),
    supabaseAdmin
      .from('paket')
      .select('paket_kelas(kelas_id), paket_komponen(komponen_id, nominal)')
      .eq('sekolah_id', sid),
    supabaseAdmin
      .from('tahun_ajaran')
      .select('nama')
      .eq('is_aktif', true)
      .maybeSingle(),
  ])

  const tahunAjaran = (taData as { nama: string } | null)?.nama ?? ''

  // Insert tagihan bulan berjalan untuk siswa aktif yang belum punya tagihan
  if (tahunAjaran) {
    const { data: siswaAktif } = await supabaseAdmin
      .from('siswa')
      .select('id, kelas_id')
      .eq('sekolah_id', sid)
      .eq('status', 'aktif')
      .limit(1000)

    const existingSiswaIds = new Set(
      ((tagihanRaw ?? []) as unknown as TagihanRaw[])
        .filter(r => r.bulan === bulan && r.tahun === tahun)
        .map(r => r.siswa?.id)
        .filter(Boolean) as string[]
    )

    // Build kelas→total map from paket
    const kelasNominalTemp = new Map<string, number>()
    for (const p of ((paketRaw ?? []) as unknown as PaketTotalRaw[])) {
      const total = p.paket_komponen.reduce((s, k) => s + k.nominal, 0)
      for (const pk of p.paket_kelas) kelasNominalTemp.set(pk.kelas_id, total)
    }

    const toInsert = ((siswaAktif ?? []) as { id: string; kelas_id: string }[])
      .filter(s => !existingSiswaIds.has(s.id) && kelasNominalTemp.has(s.kelas_id))
      .map(s => ({
        sekolah_id:    sid,
        siswa_id:      s.id,
        tahun_ajaran:  tahunAjaran,
        bulan,
        tahun,
        status:        'belum_bayar',
        total_nominal: kelasNominalTemp.get(s.kelas_id) ?? 0,
      }))

    if (toInsert.length > 0) {
      await supabaseAdmin.from('tagihan').insert(toInsert)
    }
  }

  if (!tagihanRaw || tagihanRaw.length === 0) return 0

  // kelas_id → { total, kompNomMap }
  const kelasTotal = new Map<string, number>()
  const kelasKomps = new Map<string, Map<string, number>>()
  for (const p of ((paketRaw ?? []) as unknown as PaketTotalRaw[])) {
    const total      = p.paket_komponen.reduce((s, k) => s + k.nominal, 0)
    const kompNomMap = new Map(p.paket_komponen.map(k => [k.komponen_id, k.nominal]))
    for (const pk of p.paket_kelas) {
      kelasTotal.set(pk.kelas_id, total)
      kelasKomps.set(pk.kelas_id, kompNomMap)
    }
  }

  const rows     = (tagihanRaw as unknown as TagihanRaw[])
  const siswaIds = [...new Set(rows.map(r => r.siswa?.id).filter(Boolean) as string[])]

  if (siswaIds.length === 0) return 0

  const today = new Date().toISOString().split('T')[0]
  const [{ data: bsRaw }, { data: individuRaw }] = await Promise.all([
    supabaseAdmin
      .from('beasiswa_siswa')
      .select('siswa_id, beasiswa:beasiswa_id(jenis_potongan, persen, nominal, beasiswa_komponen(komponen_id))')
      .in('siswa_id', siswaIds)
      .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${today}`),
    supabaseAdmin
      .from('siswa_komponen_individu')
      .select('siswa_id, komponen_id, nominal, komponen:komponen_id(jenis)')
      .in('siswa_id', siswaIds),
  ])

  // siswa_id → beasiswa list
  type BsEntry = { jenis_potongan: 'persen' | 'nominal'; persen: number | null; nominal: number | null; komponen_ids: Set<string> }
  const siswaBeasiswaMap = new Map<string, BsEntry[]>()
  for (const row of ((bsRaw ?? []) as unknown as BeasiswaRaw[])) {
    if (!row.beasiswa) continue
    const list = siswaBeasiswaMap.get(row.siswa_id) ?? []
    list.push({
      jenis_potongan: row.beasiswa.jenis_potongan,
      persen:         row.beasiswa.persen,
      nominal:        row.beasiswa.nominal,
      komponen_ids:   new Set(row.beasiswa.beasiswa_komponen.map(bk => bk.komponen_id)),
    })
    siswaBeasiswaMap.set(row.siswa_id, list)
  }

  // siswa_id → individu list
  const siswaIndividuMap = new Map<string, { jenis: string; nominal: number }[]>()
  for (const row of ((individuRaw ?? []) as unknown as IndividuRaw[])) {
    if (!row.komponen) continue
    const list = siswaIndividuMap.get(row.siswa_id) ?? []
    list.push({ jenis: row.komponen.jenis, nominal: row.nominal })
    siswaIndividuMap.set(row.siswa_id, list)
  }

  // Hitung correct total per tagihan
  const toUpdate: { id: string; total: number }[] = []
  for (const r of rows) {
    const siswaId        = r.siswa?.id ?? ''
    const kelasId        = r.siswa?.kelas?.id ?? ''
    const isSemesterMonth = r.bulan === 1 || r.bulan === 7

    const paketBase  = kelasTotal.get(kelasId) ?? 0
    const kompNomMap = kelasKomps.get(kelasId)

    const individuTotal = (siswaIndividuMap.get(siswaId) ?? [])
      .filter(k => k.jenis === 'rutin_bulanan' || (k.jenis === 'per_semester' && isSemesterMonth))
      .reduce((s, k) => s + k.nominal, 0)

    let deduction = 0
    if (kompNomMap) {
      for (const bs of (siswaBeasiswaMap.get(siswaId) ?? [])) {
        for (const kid of bs.komponen_ids) {
          const kNominal = kompNomMap.get(kid)
          if (kNominal === undefined) continue
          deduction += bs.jenis_potongan === 'persen'
            ? Math.round(kNominal * (bs.persen ?? 0) / 100)
            : (bs.nominal ?? 0)
        }
      }
    }

    const correct = Math.max(0, paketBase + individuTotal - deduction)
    if (correct !== r.total_nominal) {
      toUpdate.push({ id: r.id, total: correct })
    }
  }

  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map(({ id, total }) =>
        supabaseAdmin.from('tagihan').update({ total_nominal: total }).eq('id', id)
      )
    )
  }

  return toUpdate.length
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
  if (!profile?.sekolah_id) return NextResponse.json({ error: 'Profil tidak lengkap' }, { status: 400 })

  const updated = await recalculateAll(profile.sekolah_id as string)
  return NextResponse.json({ updated })
}
