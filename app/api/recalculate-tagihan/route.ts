import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  komponenDitagihkan, bangunRiwayatTagih, periodeIndex, periodeDariISO, kunciRiwayat,
  TA_PERIODE_SELECT, type PeriodeTahunAjaran,
} from '@/lib/komponenTagihan'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PaketTotalRaw = {
  tahun_ajaran:  string
  paket_kelas:   { kelas_id: string }[]
  paket_komponen: { komponen_id: string; nominal: number; komponen: { nama: string; jenis: string } | null }[]
}
// `nama` ikut dibawa karena tagihan_item.nama_komponen adalah snapshot teks —
// komponen yang dihapus belakangan tetap terbaca di kuitansi lama
type KompPaket = { komponen_id: string; nominal: number; nama: string; jenis: string }
type TagihanItemInsert = { tagihan_id: string; komponen_id: string; nama_komponen: string; nominal: number }
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
      .select('tahun_ajaran, paket_kelas(kelas_id), paket_komponen(komponen_id, nominal, komponen:komponen_id(nama, jenis))')
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
      komponen_id: k.komponen_id, nominal: k.nominal,
      nama: k.komponen?.nama ?? '', jenis: k.komponen?.jenis ?? '',
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

    const siswaBaru = ((siswaAktif ?? []) as { id: string; kelas_id: string }[])
      .filter(s => !existingSiswaIds.has(s.id) && kelasKompList.has(s.kelas_id))

    // Komponen yang benar-benar ditagihkan, dihitung sekali lalu dipakai dua kali:
    // untuk total_nominal dan untuk snapshot tagihan_item. Menurunkannya dua kali
    // secara terpisah adalah cara termudah membuat keduanya berselisih.
    const kompPerSiswa = new Map<string, KompPaket[]>(
      siswaBaru.map(s => [
        s.id,
        (kelasKompList.get(s.kelas_id) ?? [])
          .filter(k => komponenDitagihkan(k.jenis, bulan, tahun, ta, s.id, k.komponen_id, riwayat)),
      ])
    )

    // Tanpa kolom tahun_ajaran: tabel tagihan tidak punya kolom itu, dan
    // menyertakannya membuat seluruh insert ditolak Postgres. kelas_id,
    // tahun_ajaran_id, dan jatuh_tempo diisi trigger tagihan_isi_snapshot.
    const toInsert = siswaBaru.map(s => ({
      sekolah_id:    sid,
      siswa_id:      s.id,
      bulan,
      tahun,
      status:        'belum_bayar',
      total_nominal: (kompPerSiswa.get(s.id) ?? []).reduce((acc, k) => acc + k.nominal, 0),
    }))

    if (toInsert.length > 0) {
      // .select() wajib: id baris baru dibutuhkan untuk menautkan tagihan_item.
      // Tagihan tanpa rincian akan dibaca seluruh hilir sebagai bernilai nol.
      const { data: inserted, error } = await supabaseAdmin
        .from('tagihan').insert(toInsert).select('id, siswa_id')
      // 23505 = unique violation, tagihan sudah dibuat proses lain — bukan kegagalan
      if (error && error.code !== '23505') {
        throw new Error(`Gagal membuat tagihan: ${error.message}`)
      }

      const items: TagihanItemInsert[] = ((inserted ?? []) as { id: string; siswa_id: string }[])
        .flatMap(t => (kompPerSiswa.get(t.siswa_id) ?? []).map(k => ({
          tagihan_id: t.id, komponen_id: k.komponen_id, nama_komponen: k.nama, nominal: k.nominal,
        })))
      if (items.length > 0) {
        const { error: itemError } = await supabaseAdmin.from('tagihan_item').insert(items)
        if (itemError) throw new Error(`Gagal menyimpan rincian tagihan: ${itemError.message}`)
      }
    }
  }

  const rows = ((tagihanRaw ?? []) as unknown as TagihanRaw[])
  if (rows.length === 0) return 0

  // ── Backfill snapshot yang hilang ───────────────────────────────────────────
  // Tagihan yang terbit sebelum route ini ikut menulis tagihan_item sama sekali
  // tidak punya rincian. Rekalkulasi di bawah membaca snapshot kosong itu sebagai
  // nol lalu menimpa total_nominal yang sudah benar — kerusakannya permanen
  // karena runGenerate melewati siswa yang barisnya sudah ada.
  // kelasKompList hanya memuat paket tahun ajaran aktif. Tagihan dari tahun
  // ajaran lama karenanya harus dilewati — kelasnya bisa saja cocok, tapi
  // komponen dan nominal yang ditambalkan akan milik periode yang salah.
  const taMulai   = ta ? periodeDariISO(ta.tanggal_mulai)   : null
  const taSelesai = ta ? periodeDariISO(ta.tanggal_selesai) : null

  const perluBackfill = rows
    .filter(r => (r.tagihan_item ?? []).length === 0)
    .filter(r => r.siswa?.kelas?.id && kelasKompList.has(r.siswa.kelas.id))
    .filter(r => {
      if (taMulai === null || taSelesai === null) return false
      const periode = periodeIndex(r.bulan, r.tahun)
      return periode >= taMulai && periode <= taSelesai
    })
    // Kronologis: aturan sekali-per-semester dan sekali-per-tahun-ajaran
    // bergantung pada bulan mana yang lebih dulu menagihkan komponen tsb
    .sort((a, b) => periodeIndex(a.bulan, a.tahun) - periodeIndex(b.bulan, b.tahun))

  const backfillItems: TagihanItemInsert[] = []
  for (const r of perluBackfill) {
    const siswaId = r.siswa?.id ?? ''
    const komps   = (kelasKompList.get(r.siswa!.kelas!.id) ?? [])
      .filter(k => komponenDitagihkan(k.jenis, r.bulan, r.tahun, ta, siswaId, k.komponen_id, riwayat))
    if (komps.length === 0) continue

    for (const k of komps) {
      backfillItems.push({
        tagihan_id: r.id, komponen_id: k.komponen_id, nama_komponen: k.nama, nominal: k.nominal,
      })
    }
    // Snapshot in-memory ikut diisi supaya rekalkulasi total di bawah memakai
    // hasil backfill, bukan nol — tanpa ini perbaikannya butuh dua kali panggil
    r.tagihan_item = komps.map(k => ({ komponen_id: k.komponen_id, nominal: k.nominal }))
    // Riwayat ikut tumbuh supaya komponen sekali-bayar tidak diulang di bulan berikutnya
    const periode = periodeIndex(r.bulan, r.tahun)
    for (const k of komps) {
      const kunci = kunciRiwayat(siswaId, k.komponen_id)
      riwayat.set(kunci, [...(riwayat.get(kunci) ?? []), periode])
    }
  }

  if (backfillItems.length > 0) {
    const { error } = await supabaseAdmin.from('tagihan_item').insert(backfillItems)
    if (error) throw new Error(`Gagal memulihkan rincian tagihan: ${error.message}`)
  }

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

    // Snapshot kosong bukan bukti tagihannya memang nol — bisa jadi rinciannya
    // yang belum ada (paket kelasnya terhapus, atau backfill di atas tidak
    // menemukan komponen). Menimpa nominal yang sudah terbit dengan nol
    // menghapus angka yang kuitansinya mungkin sudah dipegang orang tua.
    if (snapshot.length === 0 && correct === 0 && r.total_nominal > 0) continue

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
