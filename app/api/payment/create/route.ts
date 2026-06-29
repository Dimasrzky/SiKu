import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { createIpaymuPayment } from '@/lib/ipaymu'

interface CreateBody {
  payment_token: string
  nominal:       number
  jenis:         'lunas' | 'cicilan'
}

type SiswaJoin = {
  nama:      string
  no_wa:     string | null
  nama_wali: string | null
  kelas:     { nama: string } | null
}

type TagihanRow = {
  id:                  string
  total_nominal:       number
  status:              string
  sekolah_id:          string
  siswa_id:            string
  payment_token_aktif: boolean
  siswa:               SiswaJoin | null
}

export async function POST(req: NextRequest) {
  let body: CreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request tidak valid.' }, { status: 400 })
  }

  const { payment_token, nominal, jenis } = body

  if (!payment_token || !nominal || !jenis) {
    return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 })
  }
  if (nominal <= 0 || !Number.isInteger(nominal)) {
    return NextResponse.json({ error: 'Nominal tidak valid.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tagihan, error: tagErr } = await supabase
    .from('tagihan')
    .select('id, total_nominal, status, sekolah_id, siswa_id, payment_token_aktif, siswa:siswa_id(nama, no_wa, nama_wali, kelas:kelas_id(nama))')
    .eq('payment_token', payment_token)
    .single()

  if (tagErr || !tagihan) {
    return NextResponse.json({ error: 'Tagihan tidak ditemukan.' }, { status: 404 })
  }

  const t = tagihan as unknown as TagihanRow

  if (t.status === 'lunas') {
    return NextResponse.json({ error: 'Tagihan sudah lunas.' }, { status: 400 })
  }
  if (!t.payment_token_aktif) {
    return NextResponse.json({ error: 'Link pembayaran sudah tidak aktif.' }, { status: 400 })
  }

  // Hitung sisa tagihan
  const { data: pembayaranList } = await supabase
    .from('pembayaran')
    .select('jumlah')
    .eq('tagihan_id', t.id)

  const totalBayar = (pembayaranList ?? []).reduce((s: number, p: { jumlah: number }) => s + p.jumlah, 0)
  const sisa       = t.total_nominal - totalBayar

  if (sisa <= 0) {
    return NextResponse.json({ error: 'Tagihan sudah lunas.' }, { status: 400 })
  }
  if (nominal > sisa) {
    return NextResponse.json({ error: `Nominal melebihi sisa tagihan (${sisa}).` }, { status: 400 })
  }
  if (jenis === 'cicilan' && nominal >= sisa) {
    return NextResponse.json({ error: 'Untuk cicilan, nominal harus kurang dari sisa tagihan.' }, { status: 400 })
  }

  // Buat record pending dulu untuk dapat ID sebagai referenceId ke iPaymu
  const { data: trxRecord, error: trxErr } = await supabase
    .from('payment_gateway_trx')
    .insert({
      tagihan_id:    t.id,
      sekolah_id:    t.sekolah_id,
      payment_token,
      nominal,
      jenis,
      status:        'pending',
    })
    .select('id')
    .single()

  if (trxErr || !trxRecord) {
    return NextResponse.json({ error: 'Gagal membuat catatan transaksi.' }, { status: 500 })
  }

  const siswa      = t.siswa
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const productName = `Tagihan ${siswa?.kelas?.nama ?? ''} - ${siswa?.nama ?? ''}`.trim()

  const result = await createIpaymuPayment({
    referenceId: trxRecord.id,
    nominal,
    productName,
    buyerName:   siswa?.nama_wali ?? siswa?.nama ?? 'Orang Tua',
    buyerPhone:  siswa?.no_wa ?? '',
    returnUrl:   `${appUrl}/bayar/sukses?ref=${trxRecord.id}`,
    cancelUrl:   `${appUrl}/bayar/${payment_token}?cancelled=1`,
    notifyUrl:   `${appUrl}/api/payment/callback`,
  })

  if (!result.success) {
    await supabase.from('payment_gateway_trx').delete().eq('id', trxRecord.id)
    return NextResponse.json({ error: result.error ?? 'Gagal membuat transaksi iPaymu.' }, { status: 502 })
  }

  await supabase
    .from('payment_gateway_trx')
    .update({ ipaymu_trx_id: result.trxId })
    .eq('id', trxRecord.id)

  return NextResponse.json({ paymentUrl: result.paymentUrl })
}
