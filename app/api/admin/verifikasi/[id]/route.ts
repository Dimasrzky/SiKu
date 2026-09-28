import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

interface AksiBody {
  aksi: 'lunas' | 'cicilan'
}

type VerifikasiRow = {
  id:               string
  tagihan_id:       string
  siswa_id:         string
  sekolah_id:       string
  nominal_diajukan: number
  status:           string
  created_at:       string
}

type TagihanRow = {
  id:            string
  total_nominal: number
  status:        string
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Sesi admin tidak valid. Silakan masuk kembali.' }, { status: 401 })
  }

  const { id } = await params

  let body: Partial<AksiBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request tidak valid.' }, { status: 400 })
  }

  if (body.aksi !== 'lunas' && body.aksi !== 'cicilan') {
    return NextResponse.json({ error: 'Aksi tidak valid.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: verifikasiData, error: vErr } = await supabase
    .from('verifikasi_pembayaran')
    .select('id, tagihan_id, siswa_id, sekolah_id, nominal_diajukan, status, created_at')
    .eq('id', id)
    .single()

  if (vErr || !verifikasiData) {
    return NextResponse.json({ error: 'Data verifikasi tidak ditemukan.' }, { status: 404 })
  }

  const verifikasi = verifikasiData as VerifikasiRow

  if (verifikasi.status !== 'menunggu') {
    return NextResponse.json({ error: 'Bukti transfer ini sudah diproses.' }, { status: 400 })
  }

  const { data: tagihanData, error: tErr } = await supabase
    .from('tagihan')
    .select('id, total_nominal, status')
    .eq('id', verifikasi.tagihan_id)
    .single()

  if (tErr || !tagihanData) {
    return NextResponse.json({ error: 'Tagihan tidak ditemukan.' }, { status: 404 })
  }

  const tagihan = tagihanData as TagihanRow

  const { data: pembayaranList } = await supabase
    .from('pembayaran')
    .select('jumlah')
    .eq('tagihan_id', tagihan.id)

  const totalBayar = (pembayaranList ?? []).reduce((s: number, p: { jumlah: number }) => s + p.jumlah, 0)
  const sisa       = tagihan.total_nominal - totalBayar

  if (sisa <= 0) {
    return NextResponse.json({ error: 'Tagihan ini sudah lunas.' }, { status: 400 })
  }

  const jumlah = body.aksi === 'lunas' ? sisa : verifikasi.nominal_diajukan

  if (jumlah <= 0 || jumlah > sisa) {
    return NextResponse.json({ error: 'Nominal tidak valid dibanding sisa tagihan saat ini.' }, { status: 400 })
  }

  const { error: bayarErr } = await supabase.from('pembayaran').insert({
    tagihan_id:    tagihan.id,
    siswa_id:      verifikasi.siswa_id,
    sekolah_id:    verifikasi.sekolah_id,
    jumlah,
    metode:        'transfer',
    sumber:        'manual_transfer',
    status:        'terkonfirmasi',
    // Waktu orang tua mengunggah bukti, bukan waktu admin memverifikasi — verifikasi
    // yang tertunda beberapa hari tidak boleh membuat pembayaran tercatat telat.
    tanggal_bayar: verifikasi.created_at,
    catatan:       'Diverifikasi dari bukti transfer manual',
  })

  if (bayarErr) {
    return NextResponse.json({ error: 'Gagal mencatat pembayaran.' }, { status: 500 })
  }

  const newTotalBayar    = totalBayar + jumlah
  const newTagihanStatus = newTotalBayar >= tagihan.total_nominal ? 'lunas' : 'cicilan'

  await supabase.from('tagihan').update({ status: newTagihanStatus }).eq('id', tagihan.id)

  await supabase
    .from('verifikasi_pembayaran')
    .update({ status: 'disetujui', diverifikasi_at: new Date().toISOString() })
    .eq('id', verifikasi.id)

  return NextResponse.json({ ok: true, tagihanStatus: newTagihanStatus })
}
