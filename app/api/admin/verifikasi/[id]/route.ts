import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { bagiPembayaran, muatTertagih } from '@/lib/tagihanTertagih'

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
  id:         string
  siswa_id:   string
  sekolah_id: string
  bulan:      number
  tahun:      number
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
    .select('id, siswa_id, sekolah_id, bulan, tahun')
    .eq('id', verifikasi.tagihan_id)
    .single()

  if (tErr || !tagihanData) {
    return NextResponse.json({ error: 'Tagihan tidak ditemukan.' }, { status: 404 })
  }

  const tagihan = tagihanData as TagihanRow

  // Bukti ini membayar semua yang ditagih halaman bayar lewat tautan tagihan tersebut:
  // sisa tagihan itu + tunggakan sebelumnya. Dihitung ulang sekarang, karena sejak
  // bukti diunggah bisa saja ada pembayaran lain yang sudah dicatat.
  const tertagih = await muatTertagih(supabase, tagihan, new Date())
  if (!tertagih.data) {
    return NextResponse.json({ error: 'Gagal memuat rincian tagihan.' }, { status: 500 })
  }
  const sisa = tertagih.data.total

  if (sisa <= 0) {
    return NextResponse.json({ error: 'Tagihan ini sudah lunas.' }, { status: 400 })
  }

  const jumlah = body.aksi === 'lunas' ? sisa : verifikasi.nominal_diajukan

  if (jumlah <= 0 || jumlah > sisa) {
    return NextResponse.json({ error: 'Nominal tidak valid dibanding sisa tagihan saat ini.' }, { status: 400 })
  }

  // Dibagi terlama dulu, satu baris pembayaran per tagihan, disisipkan dalam satu
  // perintah supaya tidak ada bagian yang tercatat separuh
  const bagian = bagiPembayaran(tertagih.data.daftar, jumlah)

  const { error: bayarErr } = await supabase.from('pembayaran').insert(bagian.map(b => ({
    tagihan_id:    b.tagihan.id,
    siswa_id:      verifikasi.siswa_id,
    sekolah_id:    verifikasi.sekolah_id,
    jumlah:        b.jumlah,
    metode:        'transfer',
    sumber:        'manual_transfer',
    status:        'terkonfirmasi',
    // Waktu orang tua mengunggah bukti, bukan waktu admin memverifikasi — verifikasi
    // yang tertunda beberapa hari tidak boleh membuat pembayaran tercatat telat.
    tanggal_bayar: verifikasi.created_at,
    catatan:       'Diverifikasi dari bukti transfer manual',
  })))

  if (bayarErr) {
    return NextResponse.json({ error: 'Gagal mencatat pembayaran.' }, { status: 500 })
  }

  await Promise.all(bagian.map(b => supabase
    .from('tagihan')
    .update({ status: b.lunas ? 'lunas' : 'cicilan' })
    .eq('id', b.tagihan.id)))

  await supabase
    .from('verifikasi_pembayaran')
    .update({ status: 'disetujui', diverifikasi_at: new Date().toISOString() })
    .eq('id', verifikasi.id)

  // Status tagihan yang tautannya dipakai wali. Tagihan itu tidak ikut terbayar kalau
  // uangnya habis untuk tunggakan yang lebih lama; tidak ada di daftar belum lunas = lunas.
  const bagianTautan = bagian.find(b => b.tagihan.id === tagihan.id)
  const tagihanStatus = bagianTautan
    ? (bagianTautan.lunas ? 'lunas' : 'cicilan')
    : (tertagih.data.sasaran?.status ?? 'lunas')
  return NextResponse.json({ ok: true, tagihanStatus })
}
