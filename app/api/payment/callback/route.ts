import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { cekTransaksi, resolveMetode, type IpaymuCallbackPayload } from '@/lib/ipaymu'
import { tagihanBelumLunas, bagiKeTagihan } from '@/lib/alokasiPembayaran'

type TrxRecord = {
  id:            string
  tagihan_id:    string
  sekolah_id:    string
  nominal:       number
  jenis:         string
  status:        string | null
  ipaymu_trx_id: string | null
}

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Selesai tanpa perlu dikirim ulang — termasuk notifikasi yang diabaikan */
const diterima = () => NextResponse.json({ received: true })
/** Belum bisa diproses sekarang. Status 5xx membuat iPaymu mengirim ulang notifikasinya. */
const cobaLagi = (error: string) => NextResponse.json({ error }, { status: 503 })

async function parsePayload(req: NextRequest): Promise<IpaymuCallbackPayload | null> {
  try {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      return await req.json()
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
  } catch {
    return null
  }
}

/**
 * Notifikasi pembayaran dari iPaymu. Route ini publik, jadi isi request tidak dipercaya:
 * status dan nominalnya ditanyakan ulang langsung ke iPaymu memakai nomor transaksi yang
 * dicatat saat pembayaran dibuat. Pembayaran hanya dicatat kalau iPaymu sendiri
 * menyatakan transaksi itu berhasil.
 */
export async function POST(req: NextRequest) {
  const payload = await parsePayload(req)
  const referenceId = String(payload?.reference_id ?? '')
  if (!payload || !POLA_UUID.test(referenceId)) return diterima()

  const supabase = createServiceClient()

  // reference_id = payment_gateway_trx.id
  const { data: trxRecord, error: trxErr } = await supabase
    .from('payment_gateway_trx')
    .select('id, tagihan_id, sekolah_id, nominal, jenis, status, ipaymu_trx_id')
    .eq('id', referenceId)
    .maybeSingle()

  if (trxErr) return cobaLagi('Gagal membaca transaksi.')
  if (!trxRecord) return diterima()

  const trx = trxRecord as TrxRecord
  if (trx.status === 'success') return diterima()

  // Nomor transaksi iPaymu dari saat pembayaran dibuat. Nomor di notifikasi hanya dipakai
  // kalau pencatatan itu dulu gagal, dan jawaban iPaymu nanti harus menunjuk transaksi ini.
  const trxIdNotifikasi = payload.trx_id ? String(payload.trx_id) : ''
  if (trx.ipaymu_trx_id && trxIdNotifikasi && trxIdNotifikasi !== trx.ipaymu_trx_id) {
    console.warn(`[callback] transaksi ${trx.id}: nomor transaksi di notifikasi tidak cocok, diabaikan`)
    return diterima()
  }
  const trxIdIpaymu = trx.ipaymu_trx_id ?? trxIdNotifikasi
  if (!trxIdIpaymu) return diterima()

  const cek = await cekTransaksi(trxIdIpaymu)
  if (cek.status === null) return cobaLagi('Status transaksi belum bisa dipastikan.')

  if (cek.referenceId !== null ? cek.referenceId !== trx.id : !trx.ipaymu_trx_id) {
    // Tanpa nomor tersimpan, hanya ReferenceId dari iPaymu yang bisa membuktikan
    // transaksi itu milik tagihan ini
    console.warn(`[callback] transaksi ${trx.id}: transaksi iPaymu ${trxIdIpaymu} bukan milik transaksi ini, diabaikan`)
    return diterima()
  }

  if (cek.status === 'pending') return diterima()

  const waktu = new Date().toISOString()

  if (cek.status !== 'sukses') {
    await supabase
      .from('payment_gateway_trx')
      .update({ status: cek.status === 'kedaluwarsa' ? 'expired' : 'failed', ipaymu_response: payload, updated_at: waktu })
      .eq('id', trx.id)
      .neq('status', 'success')
    return diterima()
  }

  if (cek.nominal !== null && cek.nominal < trx.nominal) {
    console.warn(`[callback] transaksi ${trx.id}: nominal iPaymu ${cek.nominal} kurang dari ${trx.nominal}, tidak dicatat`)
    return diterima()
  }

  // Ambil siswa_id dari tagihan
  const { data: tagihanRow } = await supabase
    .from('tagihan')
    .select('siswa_id')
    .eq('id', trx.tagihan_id)
    .single()

  if (!tagihanRow) {
    console.error(`[callback] transaksi ${trx.id} berhasil di iPaymu, tapi tagihan ${trx.tagihan_id} tidak ditemukan`)
    return diterima()
  }

  // Orang tua membayar tagihan bulan berjalan beserta tunggakannya dalam satu
  // transaksi, jadi nominalnya dibagi ke beberapa tagihan mulai dari yang terlama.
  const daftarBelumLunas = await tagihanBelumLunas(supabase, trx.sekolah_id, tagihanRow.siswa_id)
  const alokasi = daftarBelumLunas.length > 0
    ? bagiKeTagihan(daftarBelumLunas, trx.nominal)
    : [{ tagihan_id: trx.tagihan_id, jumlah: trx.nominal }]

  // Klaim dulu, hanya dari status yang tadi dibaca: notifikasi yang dikirim ulang
  // berbarengan tidak boleh mencatat uangnya dua kali
  const klaimQ = supabase
    .from('payment_gateway_trx')
    .update({ status: 'success', ipaymu_trx_id: trxIdIpaymu, ipaymu_response: payload, updated_at: waktu })
    .eq('id', trx.id)
  const { data: klaim, error: klaimErr } = await (trx.status === null ? klaimQ.is('status', null) : klaimQ.eq('status', trx.status))
    .select('id')

  if (klaimErr) return cobaLagi('Gagal memproses transaksi.')
  if (!klaim || klaim.length === 0) return diterima()

  const { error: bayarErr } = await supabase
    .from('pembayaran')
    .insert(alokasi.map(a => ({
      tagihan_id:     a.tagihan_id,
      siswa_id:       tagihanRow.siswa_id,
      sekolah_id:     trx.sekolah_id,
      jumlah:         a.jumlah,
      metode:         resolveMetode(payload.channel),
      sumber:         'gateway',
      gateway_trx_id: trxIdIpaymu,
      tanggal_bayar:  waktu,
      catatan:        `Via iPaymu${payload.channel ? ' – ' + payload.channel : ''}`,
    })))

  if (bayarErr) {
    // Lepas klaimnya supaya notifikasi berikutnya bisa mencatat ulang
    const { error: kembaliErr } = await supabase
      .from('payment_gateway_trx')
      .update({ status: trx.status, updated_at: new Date().toISOString() })
      .eq('id', trx.id)
      .eq('status', 'success')
    if (kembaliErr) console.error(`[callback] transaksi ${trx.id} tertandai success tanpa pembayaran:`, kembaliErr)
    return cobaLagi('Gagal menyimpan pembayaran.')
  }

  // Status tiap tagihan yang tersentuh alokasi dihitung database dari pembayaran yang
  // tercatat (trigger pembayaran_segarkan_status)
  return diterima()
}
