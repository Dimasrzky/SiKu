import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  komponenDitagihkan, bangunRiwayatTagih, TA_PERIODE_SELECT, type PeriodeTahunAjaran,
} from '@/lib/komponenTagihan'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PaketTotalRaw = {
  tahun_ajaran:  string
  paket_kelas:   { kelas_id: string }[]
  paket_komponen: { komponen_id: string; nominal: number; komponen: { jenis: string } | null }[]
}
type KompPaket = { komponen_id: string; nominal: number; jenis: string }
type TagihanItemRaw = { komponen_id: string | null; nominal: number }
type TagihanRaw = {
  id:            string
  total_nominal: number
  bulan:         number
  tahun:         number
  tagihan_item:  TagihanItemRaw[]
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
      .select('id, total_nominal, bulan, tahun, tagihan_item(komponen_id, nominal), siswa:siswa_id(id, kelas:kelas_id(id))')
      .eq('sekolah_id', sid)
      .limit(5000),
    supabaseAdmin
      .from('paket')
      .select('tahun_ajaran, paket_kelas(kelas_id), paket_komponen(komponen_id, nominal, komponen:komponen_id(jenis))')
      .eq('sekolah_id', sid),
    supabaseAdmin
      .from('tahun_ajaran')
      .select(`nama, ${TA_PERIODE_SELECT}`)
      .eq('is_aktif', true)
      .maybeSingle(),
  ])

  const ta          = (taData ?? null) as (PeriodeTahunAjaran & { nama: string }) | null
  const tahunAjaran = ta?.nama ?? ''

  // Riwayat penagihan per siswa per komponen — dasar aturan sekali-per-semester
  // dan sekali-per-tahun-ajaran.
  const riwayat = bangunRiwayatTagih(
    ((tagihanRaw ?? []) as unknown as TagihanRaw[]).map(r => ({
      siswa_id:     r.siswa?.id ?? '',
      bulan:        r.bulan,
      tahun:        r.tahun,
      tagihan_item: r.tagihan_item ?? [],
    }))
  )

  // kelas_id → komponen paket beserta jenis-nya, supaya bisa difilter per bulan.
  // Hanya paket tahun ajaran aktif: paket periode lama memetakan kelas yang sama
  // dan akan saling menimpa secara tidak menentu.
  const kelasKompList = new Map<string, KompPaket[]>()
  for (const p of ((paketRaw ?? []) as unknown as PaketTotalRaw[])) {
    if (p.tahun_ajaran !== tahunAjaran) continue
    const komps = p.paket_komponen.map(k => ({
      komponen_id: k.komponen_id, nominal: k.nominal, jenis: k.komponen?.jenis ?? '',
    }))
    for (const pk of p.paket_kelas) kelasKompList.set(pk.kelas_id, komps)
  }

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

    const toInsert = ((siswaAktif ?? []) as { id: string; kelas_id: string }[])
      .filter(s => !existingSiswaIds.has(s.id) && kelasKompList.has(s.kelas_id))
      // Tanpa kolom tahun_ajaran: tabel tagihan tidak punya kolom itu, dan
      // menyertakannya membuat seluruh insert ditolak Postgres.
      .map(s => ({
        sekolah_id:    sid,
        siswa_id:      s.id,
        bulan,
        tahun,
        status:        'belum_bayar',
        total_nominal: (kelasKompList.get(s.kelas_id) ?? [])
          .filter(k => komponenDitagihkan(k.jenis, bulan, tahun, ta, s.id, k.komponen_id, riwayat))
          .reduce((acc, k) => acc + k.nominal, 0),
      }))

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from('tagihan').insert(toInsert)
      // 23505 = unique violation, tagihan sudah dibuat proses lain — bukan kegagalan
      if (error && error.code !== '23505') {
        throw new Error(`Gagal membuat tagihan: ${error.message}`)
      }
    }
  }

  if (!tagihanRaw || tagihanRaw.length === 0) return 0

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
  const siswaIndividuMap = new Map<string, { komponen_id: string; jenis: string; nominal: number }[]>()
  for (const row of ((individuRaw ?? []) as unknown as IndividuRaw[])) {
    if (!row.komponen) continue
    const list = siswaIndividuMap.get(row.siswa_id) ?? []
    list.push({ komponen_id: row.komponen_id, jenis: row.komponen.jenis, nominal: row.nominal })
    siswaIndividuMap.set(row.siswa_id, list)
  }

  // Hitung correct total per tagihan dari snapshot tagihan_item
  const toUpdate: { id: string; total: number }[] = []
  for (const r of rows) {
    const siswaId = r.siswa?.id ?? ''

    const snapshot   = r.tagihan_item ?? []
    const paketBase  = snapshot.reduce((s, i) => s + i.nominal, 0)
    const kompNomMap = new Map(
      snapshot.filter(i => i.komponen_id).map(i => [i.komponen_id as string, i.nominal])
    )

    const individuTotal = (siswaIndividuMap.get(siswaId) ?? [])
      .filter(k => !kompNomMap.has(k.komponen_id))
      .filter(k => komponenDitagihkan(k.jenis, r.bulan, r.tahun, ta, siswaId, k.komponen_id, riwayat))
      .reduce((s, k) => s + k.nominal, 0)

    // Potongan beasiswa hanya berlaku atas komponen yang ditagihkan bulan ini
    let deduction = 0
    for (const bs of (siswaBeasiswaMap.get(siswaId) ?? [])) {
      for (const kid of bs.komponen_ids) {
        const kNominal = kompNomMap.get(kid)
        if (kNominal === undefined) continue
        deduction += bs.jenis_potongan === 'persen'
          ? Math.round(kNominal * (bs.persen ?? 0) / 100)
          : (bs.nominal ?? 0)
      }
    }

    const correct = Math.max(0, paketBase + individuTotal - deduction)
    // Number.isFinite menyaring NaN supaya total_nominal tidak terhapus jadi null
    if (Number.isFinite(correct) && correct !== r.total_nominal) {
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

  try {
    const updated = await recalculateAll(profile.sekolah_id as string)
    return NextResponse.json({ updated })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
