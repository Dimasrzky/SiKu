import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'

const BUKTI_BUCKET  = 'bukti-transfer'
const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES  = ['image/jpeg', 'image/png']

type TagihanRow = {
  id:                  string
  total_nominal:       number
  status:              string
  sekolah_id:          string
  siswa_id:            string
  payment_token_aktif: boolean
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Request tidak valid.' }, { status: 400 })
  }

  const paymentToken = formData.get('payment_token')
  const bukti         = formData.get('bukti')

  if (typeof paymentToken !== 'string' || !paymentToken) {
    return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 })
  }
  if (!(bukti instanceof File)) {
    return NextResponse.json({ error: 'Bukti transfer wajib diunggah.' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(bukti.type)) {
    return NextResponse.json({ error: 'Format file harus JPG atau PNG.' }, { status: 400 })
  }
  if (bukti.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Ukuran file maksimal 5MB.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tagihanData, error: tagErr } = await supabase
    .from('tagihan')
    .select('id, total_nominal, status, sekolah_id, siswa_id, payment_token_aktif')
    .eq('payment_token', paymentToken)
    .single()

  if (tagErr || !tagihanData) {
    return NextResponse.json({ error: 'Tagihan tidak ditemukan.' }, { status: 404 })
  }

  const tagihan = tagihanData as TagihanRow

  if (!tagihan.payment_token_aktif) {
    return NextResponse.json({ error: 'Link pembayaran sudah tidak aktif.' }, { status: 400 })
  }
  if (tagihan.status === 'lunas') {
    return NextResponse.json({ error: 'Tagihan sudah lunas.' }, { status: 400 })
  }

  const { data: pembayaranList } = await supabase
    .from('pembayaran')
    .select('jumlah')
    .eq('tagihan_id', tagihan.id)

  const totalBayar = (pembayaranList ?? []).reduce((s: number, p: { jumlah: number }) => s + p.jumlah, 0)
  const sisa        = tagihan.total_nominal - totalBayar

  if (sisa <= 0) {
    return NextResponse.json({ error: 'Tagihan sudah lunas.' }, { status: 400 })
  }

  const ext  = bukti.type === 'image/png' ? 'png' : 'jpg'
  const path = `${tagihan.sekolah_id}/${tagihan.id}-${Date.now()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(BUKTI_BUCKET)
    .upload(path, bukti, { contentType: bukti.type, upsert: false })

  if (uploadErr) {
    return NextResponse.json({ error: 'Gagal mengunggah bukti transfer.' }, { status: 500 })
  }

  const { error: insertErr } = await supabase.from('verifikasi_pembayaran').insert({
    tagihan_id:       tagihan.id,
    siswa_id:         tagihan.siswa_id,
    sekolah_id:       tagihan.sekolah_id,
    nominal_diajukan: sisa,
    bukti_path:       path,
    status:           'menunggu',
  })

  if (insertErr) {
    await supabase.storage.from(BUKTI_BUCKET).remove([path])
    return NextResponse.json({ error: 'Gagal menyimpan konfirmasi pembayaran.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
