import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { createQrisPayment, createVAPayment, type VAChannel } from '@/lib/ipaymu'
import { catatPercobaan, terlaluBanyakPercobaan } from '@/lib/percobaanLogin'

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Tautan bayar bersifat publik: transaksi QRIS/VA dari satu tautan dibatasi supaya
// pemegang link tidak bisa membanjiri iPaymu
const BATAS_TRANSAKSI = 5
const JENDELA_MENIT   = 15

type PaymentMethod = 'qris' | VAChannel

interface CreateBody {
  payment_token: string
  nominal:       number
  jenis:         'lunas' | 'cicilan'
  method:        PaymentMethod
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

const VA_CHANNELS: VAChannel[] = ['bca', 'bni', 'bri', 'mandiri', 'cimb', 'permata']

export async function POST(req: NextRequest) {
  let body: CreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request tidak valid.' }, { status: 400 })
  }

  const { payment_token, nominal, jenis, method } = body

  if (!payment_token || !nominal || !jenis || !method) {
    return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 })
  }
  if (typeof payment_token !== 'string' || !POLA_UUID.test(payment_token)) {
    return NextResponse.json({ error: 'Tagihan tidak ditemukan.' }, { status: 404 })
  }
  if (nominal <= 0 || !Number.isInteger(nominal)) {
    return NextResponse.json({ error: 'Nominal tidak valid.' }, { status: 400 })
  }
  if (method !== 'qris' && !VA_CHANNELS.includes(method as VAChannel)) {
    return NextResponse.json({ error: 'Metode pembayaran tidak valid.' }, { status: 400 })
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

  // Dihitung hanya untuk tautan yang memang ada, supaya token acak tidak mengisi tabel
  const kunci = `bayar-transaksi:${payment_token}`
  const terlalu = await terlaluBanyakPercobaan(supabase, kunci, BATAS_TRANSAKSI, JENDELA_MENIT)
  if (terlalu === null) {
    return NextResponse.json({ error: 'Gagal memproses permintaan. Silakan coba lagi.' }, { status: 503 })
  }
  if (terlalu) {
    return NextResponse.json({ error: `Terlalu banyak permintaan pembayaran. Coba lagi dalam ${JENDELA_MENIT} menit.` }, { status: 429 })
  }
  await catatPercobaan(supabase, kunci)

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
    return NextResponse.json({ error: `Nominal melebihi sisa tagihan.` }, { status: 400 })
  }
  if (jenis === 'cicilan' && nominal >= sisa) {
    return NextResponse.json({ error: 'Nominal cicilan harus kurang dari sisa tagihan.' }, { status: 400 })
  }

  // Buat record pending
  const { data: trxRecord, error: trxErr } = await supabase
    .from('payment_gateway_trx')
    .insert({
      tagihan_id:    t.id,
      sekolah_id:    t.sekolah_id,
      payment_token,
      nominal,
      jenis,
      status: 'pending',
    })
    .select('id')
    .single()

  if (trxErr || !trxRecord) {
    return NextResponse.json({ error: 'Gagal membuat catatan transaksi.' }, { status: 500 })
  }

  const siswa       = t.siswa
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const productName = `Tagihan ${siswa?.kelas?.nama ?? ''} - ${siswa?.nama ?? ''}`.trim()
  const notifyUrl   = `${appUrl}/api/payment/callback`
  const buyerName   = siswa?.nama_wali ?? siswa?.nama ?? 'Orang Tua'
  const buyerPhone  = siswa?.no_wa ?? ''

  const baseParams = {
    referenceId: trxRecord.id,
    nominal,
    productName,
    buyerName,
    buyerPhone,
    notifyUrl,
  }

  if (method === 'qris') {
    const result = await createQrisPayment(baseParams)

    if (!result.success) {
      await supabase.from('payment_gateway_trx').delete().eq('id', trxRecord.id)
      return NextResponse.json({ error: result.error ?? 'Gagal membuat QRIS.' }, { status: 502 })
    }

    await supabase
      .from('payment_gateway_trx')
      .update({ ipaymu_trx_id: result.trxId })
      .eq('id', trxRecord.id)

    return NextResponse.json({ type: 'qris', qrUrl: result.qrUrl, trxId: result.trxId })
  }

  // Virtual Account
  const vaResult = await createVAPayment({ ...baseParams, channel: method as VAChannel })

  if (!vaResult.success) {
    await supabase.from('payment_gateway_trx').delete().eq('id', trxRecord.id)
    return NextResponse.json({ error: vaResult.error ?? 'Gagal membuat Virtual Account.' }, { status: 502 })
  }

  await supabase
    .from('payment_gateway_trx')
    .update({ ipaymu_trx_id: vaResult.trxId })
    .eq('id', trxRecord.id)

  return NextResponse.json({
    type:      'va',
    paymentNo: vaResult.paymentNo,
    bankName:  vaResult.bankName,
    expired:   vaResult.expired,
    trxId:     vaResult.trxId,
  })
}
