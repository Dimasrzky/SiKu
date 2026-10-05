import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilPerPotong, ambilSemua } from '@/lib/ambilSemua'
import { runGenerate } from '@/lib/generateTagihan'
import { bolehDihitungUlang, hitungUlangTagihan, type PotonganBeasiswa } from '@/lib/hitungUlangTagihan'
import {
  komponenDitagihkan, bangunRiwayatTagih, periodeIndex, periodeDariISO, kunciRiwayat,
  TA_PERIODE_SELECT, type PeriodeTahunAjaran,
} from '@/lib/komponenTagihan'
import { bulanTahunWIB } from '@/lib/pengingat/waktu'
import { createServiceClient } from '@/lib/supabase-service'

// Menerbitkan tagihan, membaca seluruh tagihan sekolah, lalu menulis koreksinya — bisa
// melewati batas waktu bawaan fungsi Vercel
export const maxDuration = 60

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
type TagihanItemTersimpan = TagihanItemRaw & { id: string; tagihan_id: string }
type TagihanRaw = {
  id:            string
  total_nominal: number
  status:        string
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
  komponen:    { nama: string; jenis: string } | null
}
type IndividuSiswa = { komponen_id: string; nama: string; jenis: string; nominal: number }

// Berapa total_nominal yang ditulis berbarengan — satu permintaan per tagihan
const UKURAN_TULIS = 20
// Sama dengan potongan .in() di lib/ambilSemua: daftar id ikut terkirim lewat URL
const UKURAN_HAPUS = 150

/** Galat yang pesannya aman ditampilkan; rincian dari database hanya masuk log server */
class GalatRekalkulasi extends Error {}

const galat = (pesan: string, sebab?: { code?: string; message?: string } | null): GalatRekalkulasi => {
  console.error(`[recalculate-tagihan] ${pesan}${sebab ? ` — ${sebab.code ?? ''} ${sebab.message ?? ''}` : ''}`)
  return new GalatRekalkulasi(pesan)
}

/**
 * Rincian tagihan sesudah komponen susulan disisipkan, dibaca ulang dari database.
 *
 * Dua pemanggilan yang berjalan bersamaan sama-sama melihat komponen itu belum tercatat
 * dan sama-sama menyisipkannya. Dari baris kembar hanya yang ber-id terkecil yang
 * dipertahankan: kedua pemanggil memilih baris yang sama, jadi hasil akhirnya tepat satu
 * baris — siapa pun yang selesai lebih dulu.
 */
async function rincianSesudahSusulan(
  db: SupabaseClient, susulan: TagihanItemInsert[],
): Promise<Map<string, TagihanItemRaw[]>> {
  const res = await ambilPerPotong<TagihanItemTersimpan>(
    [...new Set(susulan.map(i => i.tagihan_id))],
    (ids, dari, sampai) => db
      .from('tagihan_item')
      .select('id, tagihan_id, komponen_id, nominal')
      .in('tagihan_id', ids)
      .order('id').range(dari, sampai),
  )
  if (res.error) throw galat('Gagal memuat rincian tagihan.', res.error)

  const kunci        = (tagihanId: string, komponenId: string | null) => `${tagihanId}|${komponenId}`
  const kunciSusulan = new Set(susulan.map(i => kunci(i.tagihan_id, i.komponen_id)))
  const sudahAda     = new Set<string>()
  const kembar: string[] = []
  const rincian = new Map<string, TagihanItemRaw[]>()
  for (const it of [...res.data].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const k = kunci(it.tagihan_id, it.komponen_id)
    if (kunciSusulan.has(k)) {
      if (sudahAda.has(k)) { kembar.push(it.id); continue }
      sudahAda.add(k)
    }
    rincian.set(it.tagihan_id, [...(rincian.get(it.tagihan_id) ?? []), { komponen_id: it.komponen_id, nominal: it.nominal }])
  }

  for (let i = 0; i < kembar.length; i += UKURAN_HAPUS) {
    const { error } = await db.from('tagihan_item').delete().in('id', kembar.slice(i, i + UKURAN_HAPUS))
    if (error) throw galat('Gagal merapikan rincian tagihan.', error)
  }
  return rincian
}

// Setiap pembacaan di bawah harus lengkap atau menghentikan seluruh proses. Hasilnya
// ditulis kembali ke total_nominal, jadi data yang terpotong atau gagal dimuat tidak boleh
// dibaca sebagai "kosong": daftar beasiswa yang kosong berarti semua potongan dicabut.
async function recalculateAll(db: SupabaseClient, sid: string): Promise<number> {
  // Bulan berjalan menurut kalender WIB. Server berjalan di UTC; dengan jam server, tujuh
  // jam pertama tiap bulan masih dihitung sebagai bulan lalu.
  const { bulan, tahun } = bulanTahunWIB(new Date())

  // Service role melewati RLS, jadi tahun ajaran wajib disaring per sekolah. Tanpa filter
  // ini, dua sekolah yang sama-sama punya tahun ajaran aktif membuat pembacaannya gagal.
  const { data: taData, error: eTa } = await db
    .from('tahun_ajaran')
    .select(`nama, ${TA_PERIODE_SELECT}`)
    .eq('sekolah_id', sid)
    .eq('is_aktif', true)
    .maybeSingle()
  if (eTa) throw galat('Gagal memuat tahun ajaran aktif.', eTa)

  const ta          = (taData ?? null) as (PeriodeTahunAjaran & { nama: string }) | null
  const tahunAjaran = ta?.nama ?? ''

  // Tagihan bulan berjalan untuk siswa aktif yang belum punya diterbitkan lewat fungsi
  // yang sama dengan halaman Tagihan Aktif dan cron pengingat: potongan beasiswa dan
  // komponen individu dihitung saat terbit, bukan dikoreksi pada panggilan berikutnya.
  // Kelas yang belum berpaket dilewati, sama seperti di sana. Gagal terbit bukan alasan
  // untuk berhenti: tagihan yang sudah ada tetap perlu dihitung ulang.
  if (tahunAjaran) {
    const terbit = await runGenerate(db, sid, tahunAjaran, bulan, tahun)
    if (!terbit.success) {
      console.warn(`[recalculate-tagihan] tagihan bulan berjalan sekolah ${sid} tidak diterbitkan: ${terbit.error ?? 'tanpa keterangan'}`)
    }
  }

  // Dibaca sesudah penerbitan, supaya tagihan yang baru terbit ikut masuk riwayat
  const [tagihanRes, paketRes] = await Promise.all([
    // Bertahap sampai habis: satu permintaan terpotong diam-diam di batas baris PostgREST
    ambilSemua<TagihanRaw>((dari, sampai) => db
      .from('tagihan')
      .select('id, total_nominal, status, bulan, tahun, tagihan_item(komponen_id, nominal), siswa:siswa_id(id, kelas:kelas_id(id))')
      .eq('sekolah_id', sid)
      .order('id').range(dari, sampai)),
    db
      .from('paket')
      .select('tahun_ajaran, paket_kelas(kelas_id), paket_komponen(komponen_id, nominal, komponen:komponen_id(nama, jenis))')
      .eq('sekolah_id', sid),
  ])
  if (tagihanRes.error) throw galat('Gagal memuat tagihan.', tagihanRes.error)
  if (paketRes.error) throw galat('Gagal memuat paket.', paketRes.error)

  const rows = tagihanRes.data
  if (rows.length === 0) return 0

  // Riwayat penagihan per siswa per komponen — dasar aturan sekali-per-semester
  // dan sekali-per-tahun-ajaran.
  const riwayat = bangunRiwayatTagih(
    rows.map(r => ({
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
  for (const p of ((paketRes.data ?? []) as unknown as PaketTotalRaw[])) {
    if (p.tahun_ajaran !== tahunAjaran) continue
    const komps = p.paket_komponen.map(k => ({
      komponen_id: k.komponen_id, nominal: k.nominal,
      nama: k.komponen?.nama ?? '', jenis: k.komponen?.jenis ?? '',
    }))
    for (const pk of p.paket_kelas) kelasKompList.set(pk.kelas_id, komps)
  }

  // ── Backfill snapshot yang hilang ───────────────────────────────────────────
  // Tagihan yang terbit tanpa tagihan_item sama sekali tidak punya rincian, dan
  // seluruh hilir membacanya sebagai bernilai nol. runGenerate tidak akan
  // memperbaikinya: ia melewati siswa yang barisnya sudah ada.
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
    const { error } = await db.from('tagihan_item').insert(backfillItems)
    if (error) throw galat('Gagal memulihkan rincian tagihan.', error)
  }

  // ── Hitung ulang: hanya tagihan bulan berjalan yang belum lunas ─────────────
  // Aturannya di lib/hitungUlangTagihan, sama dengan yang ditampilkan halaman Tagihan
  // Aktif. Tagihan lunas dan tagihan bulan-bulan lalu tidak disentuh sama sekali.
  const sasaran  = rows.filter(r => bolehDihitungUlang(r, bulan, tahun))
  const siswaIds = [...new Set(sasaran.map(r => r.siswa?.id).filter(Boolean) as string[])]
  if (siswaIds.length === 0) return 0

  const today = new Date().toISOString().split('T')[0]
  const [bsRes, individuRes] = await Promise.all([
    ambilPerPotong<BeasiswaRaw>(siswaIds, (ids, dari, sampai) => db
      .from('beasiswa_siswa')
      .select('siswa_id, beasiswa:beasiswa_id(jenis_potongan, persen, nominal, beasiswa_komponen(komponen_id))')
      .in('siswa_id', ids)
      .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${today}`)
      .order('id').range(dari, sampai)),
    ambilPerPotong<IndividuRaw>(siswaIds, (ids, dari, sampai) => db
      .from('siswa_komponen_individu')
      .select('siswa_id, komponen_id, nominal, komponen:komponen_id(nama, jenis)')
      .in('siswa_id', ids)
      .order('id').range(dari, sampai)),
  ])
  if (bsRes.error) throw galat('Gagal memuat data beasiswa.', bsRes.error)
  if (individuRes.error) throw galat('Gagal memuat data komponen individu.', individuRes.error)

  // siswa_id → beasiswa list
  const siswaBeasiswaMap = new Map<string, PotonganBeasiswa[]>()
  for (const row of bsRes.data) {
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
  const siswaIndividuMap = new Map<string, IndividuSiswa[]>()
  for (const row of individuRes.data) {
    if (!row.komponen) continue
    const list = siswaIndividuMap.get(row.siswa_id) ?? []
    list.push({ komponen_id: row.komponen_id, nama: row.komponen.nama, jenis: row.komponen.jenis, nominal: row.nominal })
    siswaIndividuMap.set(row.siswa_id, list)
  }

  const hitung = (r: TagihanRaw) => {
    const siswaId = r.siswa?.id ?? ''
    return hitungUlangTagihan({
      siswaId, bulan: r.bulan, tahun: r.tahun, totalTersimpan: r.total_nominal,
      rincian:  r.tagihan_item ?? [],
      individu: siswaIndividuMap.get(siswaId) ?? [],
      beasiswa: siswaBeasiswaMap.get(siswaId) ?? [],
      ta, riwayat,
    })
  }

  // Langkah 1 — komponen individu yang ditambahkan setelah tagihan terbit dicatat ke
  // rincian lebih dulu. Rincian yang sudah tertulis tanpa total masih pulih sendiri pada
  // panggilan berikutnya; total tanpa rincian tidak — komponennya ditagih lagi bulan depan.
  const susulan: TagihanItemInsert[] = sasaran.flatMap(r => hitung(r).susulan.map(k => ({
    tagihan_id: r.id, komponen_id: k.komponen_id, nama_komponen: k.nama, nominal: k.nominal,
  })))
  if (susulan.length > 0) {
    const { error } = await db.from('tagihan_item').insert(susulan)
    if (error) throw galat('Gagal mencatat komponen individu ke rincian tagihan.', error)

    const rincian = await rincianSesudahSusulan(db, susulan)
    for (const r of sasaran) {
      const baru = rincian.get(r.id)
      if (baru) r.tagihan_item = baru
    }
  }

  // Langkah 2 — total dari rincian yang sudah pasti
  const toUpdate: { id: string; total: number }[] = []
  for (const r of sasaran) {
    const { total } = hitung(r)
    if (total !== null && total !== r.total_nominal) toUpdate.push({ id: r.id, total })
  }

  // Beberapa sekaligus, bukan semuanya: ratusan permintaan berbarengan mudah ditolak
  // server, dan penulisan yang gagal harus terlihat — bukan dihitung sebagai berhasil
  for (let i = 0; i < toUpdate.length; i += UKURAN_TULIS) {
    const hasil = await Promise.all(
      toUpdate.slice(i, i + UKURAN_TULIS).map(({ id, total }) =>
        db.from('tagihan').update({ total_nominal: total }).eq('id', id).eq('sekolah_id', sid)
      )
    )
    const gagal = hasil.find(h => h.error)
    if (gagal?.error) throw galat('Gagal menyimpan total tagihan.', gagal.error)
  }

  return toUpdate.length
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: { user }, error: authError } = await db.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })

  const { data: profile } = await db
    .from('profiles').select('sekolah_id').eq('id', user.id).maybeSingle()
  if (!profile?.sekolah_id) return NextResponse.json({ error: 'Profil tidak lengkap' }, { status: 400 })

  try {
    const updated = await recalculateAll(db, profile.sekolah_id as string)
    return NextResponse.json({ updated })
  } catch (err) {
    if (err instanceof GalatRekalkulasi) return NextResponse.json({ error: err.message }, { status: 500 })
    console.error('[recalculate-tagihan] galat tak terduga:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghitung ulang tagihan.' }, { status: 500 })
  }
}
