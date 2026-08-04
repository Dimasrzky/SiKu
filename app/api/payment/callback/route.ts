import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { isCallbackSuccess, resolveMetode, type IpaymuCallbackPayload } from '@/lib/ipaymu'
import { tagihanBelumLunas, bagiKeTagihan } from '@/lib/alokasiPembayaran'

type TrxRecord = {
  id:         string
  tagihan_id: string
  sekolah_id: string
  nominal:    number
  jenis:      string
  status:     string
}

async function parsePayload(req: NextRequest): Promise<IpaymuCallbackPayload> {
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    return req.json()
  }
  // iPaymu mengirim form-encoded
  const text   = await req.text()
  const params = new URLSearchParams(text)
  const get    = (k: string) => params.get(k) ?? ''
  return {
    trx_id:       get('trx_id'),
    reference_id: get('reference_id'),
    status:       get('status'),
    status_code:  get('status_code'),
    amount:       get('amount'),
    fee:          get('fee') || undefined,
    channel:      get('channel') || undefined,
    buyer_name:   get('buyer_name') || undefined,
    buyer_phone:  get('buyer_phone') || undefined,
  }
}

export async function POST(req: NextRequest) {
  const payload = await parsePayload(req)

  const supabase = createServiceClient()

  // Cari transaksi berdasarkan reference_id (= payment_gateway_trx.id)
  const { data: trxRecord, error: trxErr } = await supabase
    .from('payment_gateway_trx')
    .select('id, tagihan_id, sekolah_id, nominal, jenis, status')
    .eq('id', payload.reference_id)
    .single()

  if (trxErr || !trxRecord) {
    // Kembalikan 200 agar iPaymu tidak retry terus
    return NextResponse.json({ received: true })
  }

  const trx = trxRecord as TrxRecord

  // Idempotent: jika sudah diproses, abaikan
  if (trx.status === 'success') {
    return NextResponse.json({ received: true })
  }

  const newTrxStatus = isCallbackSuccess(payload) ? 'success'
    : payload.status_code === '3' ? 'expired'
    : 'failed'

  // Update status transaksi gateway
  await supabase
    .from('payment_gateway_trx')
    .update({
      status:           newTrxStatus,
      ipaymu_trx_id:    payload.trx_id,
      ipaymu_response:  payload,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', trx.id)

  if (!isCallbackSuccess(payload)) {
    return NextResponse.json({ received: true })
  }

  // Ambil siswa_id dari tagihan
  const { data: tagihanRow } = await supabase
    .from('tagihan')
    .select('siswa_id, total_nominal')
    .eq('id', trx.tagihan_id)
    .single()

  if (!tagihanRow) {
    return NextResponse.json({ received: true })
  }

  // Orang tua membayar tagihan bulan berjalan beserta tunggakannya dalam satu
  // transaksi, jadi nominalnya dibagi ke beberapa tagihan mulai dari yang terlama.
  const daftarBelumLunas = await tagihanBelumLunas(supabase, trx.sekolah_id, tagihanRow.siswa_id)
  const alokasi = daftarBelumLunas.length > 0
    ? bagiKeTagihan(daftarBelumLunas, trx.nominal)
    : [{ tagihan_id: trx.tagihan_id, jumlah: trx.nominal }]

  const { error: bayarErr } = await supabase
    .from('pembayaran')
    .insert(alokasi.map(a => ({
      tagihan_id:     a.tagihan_id,
      siswa_id:       tagihanRow.siswa_id,
      sekolah_id:     trx.sekolah_id,
      jumlah:         a.jumlah,
      metode:         resolveMetode(payload.channel),
      sumber:         'gateway',
      gateway_trx_id: payload.trx_id,
      tanggal_bayar:  new Date().toISOString(),
      catatan:        `Via iPaymu${payload.channel ? ' – ' + payload.channel : ''}`,
    })))

  if (bayarErr) {
    return NextResponse.json({ error: 'Gagal menyimpan pembayaran.' }, { status: 500 })
  }

  // Perbarui status tiap tagihan yang tersentuh alokasi
  for (const a of alokasi) {
    const [{ data: bayarTagihan }, { data: tRow }] = await Promise.all([
      supabase.from('pembayaran').select('jumlah').eq('tagihan_id', a.tagihan_id),
      supabase.from('tagihan').select('total_nominal').eq('id', a.tagihan_id).single(),
    ])
    if (!tRow) continue
    const totalBayar = ((bayarTagihan ?? []) as { jumlah: number }[]).reduce((s, p) => s + p.jumlah, 0)
    await supabase
      .from('tagihan')
      .update({ status: totalBayar >= tRow.total_nominal ? 'lunas' : 'cicilan' })
      .eq('id', a.tagihan_id)
  }

  return NextResponse.json({ received: true })
}
