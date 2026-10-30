import { NextRequest, NextResponse } from 'next/server'
import { sekolahPemanggil } from '@/lib/pengingat/permintaan'
import { bulanTahunWIB } from '@/lib/pengingat/waktu'
import { createServiceClient } from '@/lib/supabase-service'
import { jatuhTempoSesudahDiubah } from '@/lib/jatuhTempo'

// Dipanggil halaman Paket per Kelas HANYA saat tanggal jatuh tempo paket diubah (lihat
// lib/jatuhTempo): semua tagihan bulan berjalan (WIB) di kelas-kelas paket itu, lunas
// maupun belum, ikut memakai tanggal barunya. Tagihan bulan lalu (tunggakan, termasuk
// input tunggakan awal) tidak disentuh. Jangan dipanggil dari hitung ulang biasa —
// tanggal yang sudah lewat didorong ke bulan berikutnya, jadi pemanggilan berulang akan
// terus memajukannya.

type PaketRow = { id: string; tahun_ajaran: string; tanggal_jatuh_tempo: number | null }

export async function POST(req: NextRequest) {
  const db    = createServiceClient()
  const akses = await sekolahPemanggil(db, req.headers.get('Authorization'))
  if (akses.error !== null) return NextResponse.json({ data: null, error: akses.error }, { status: akses.status })

  let paketId: unknown
  try {
    paketId = ((await req.json()) as { paket_id?: unknown }).paket_id
  } catch {
    return NextResponse.json({ data: null, error: 'Isian tidak valid.' }, { status: 400 })
  }
  if (typeof paketId !== 'string' || paketId === '') {
    return NextResponse.json({ data: null, error: 'Paket tidak valid.' }, { status: 400 })
  }

  const [{ data: paket, error: ePaket }, { data: ta }] = await Promise.all([
    db.from('paket').select('id, tahun_ajaran, tanggal_jatuh_tempo')
      .eq('id', paketId).eq('sekolah_id', akses.sekolahId).maybeSingle(),
    db.from('tahun_ajaran').select('nama').eq('sekolah_id', akses.sekolahId).eq('is_aktif', true).maybeSingle(),
  ])
  if (ePaket) return NextResponse.json({ data: null, error: 'Gagal membaca paket.' }, { status: 500 })
  if (!paket) return NextResponse.json({ data: null, error: 'Paket tidak ditemukan.' }, { status: 404 })

  // Tagihan bulan berjalan milik tahun ajaran aktif — paket tahun ajaran lain tidak menagih bulan ini
  const p = paket as PaketRow
  if ((ta as { nama?: string } | null)?.nama !== p.tahun_ajaran) {
    return NextResponse.json({ data: { diperbarui: 0 }, error: null })
  }

  const { data: kelasRows, error: eKelas } = await db
    .from('paket_kelas').select('kelas_id').eq('paket_id', p.id).limit(500)
  if (eKelas) return NextResponse.json({ data: null, error: 'Gagal membaca kelas paket.' }, { status: 500 })
  const kelasIds = ((kelasRows ?? []) as { kelas_id: string }[]).map(k => k.kelas_id)
  if (kelasIds.length === 0) return NextResponse.json({ data: { diperbarui: 0 }, error: null })

  const sekarang         = new Date()
  const { bulan, tahun } = bulanTahunWIB(sekarang)
  const jatuhTempo       = jatuhTempoSesudahDiubah(p.tanggal_jatuh_tempo, bulan, tahun, sekarang)

  const { data: diubah, error: eUbah } = await db
    .from('tagihan')
    .update({ jatuh_tempo: jatuhTempo })
    .eq('sekolah_id', akses.sekolahId)
    .eq('bulan', bulan)
    .eq('tahun', tahun)
    .in('kelas_id', kelasIds)
    .select('id')
  if (eUbah) return NextResponse.json({ data: null, error: 'Gagal memperbarui jatuh tempo tagihan.' }, { status: 500 })

  return NextResponse.json({ data: { diperbarui: (diubah ?? []).length, jatuh_tempo: jatuhTempo }, error: null })
}
