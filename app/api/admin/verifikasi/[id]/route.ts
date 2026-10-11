import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { bacaPilihan, bagiKeTagihan, pilihanSekarang, unitBayar } from '@/lib/rincianKomponen'
import { muatTertagih } from '@/lib/tagihanTertagih'

interface AksiBody {
  /** Nominal yang dicatat; kosong = nominal yang diajukan wali */
  nominal?: number
}

type VerifikasiRow = {
  id:               string
  tagihan_id:       string
  siswa_id:         string
  sekolah_id:       string
  nominal_diajukan: number
  status:           string
  created_at:       string
  jenis:            string
  pilihan:          unknown
  rencana_lunas:    string | null
  catatan_wali:     string | null
}

type TagihanRow = {
  id:         string
  siswa_id:   string
  sekolah_id: string
  bulan:      number
  tahun:      number
}

const gagal = (error: string, status: number) => NextResponse.json({ error }, { status })

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

const formatTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    return gagal('Sesi admin tidak valid. Silakan masuk kembali.', 401)
  }

  const { id } = await params

  let body: Partial<AksiBody>
  try {
    body = await req.json()
  } catch {
    return gagal('Request tidak valid.', 400)
  }

  if (body.nominal !== undefined && (!Number.isSafeInteger(body.nominal) || body.nominal <= 0)) {
    return gagal('Nominal tidak valid.', 400)
  }

  const supabase = createServiceClient()

  const { data: verifikasiData, error: vErr } = await supabase
    .from('verifikasi_pembayaran')
    .select('id, tagihan_id, siswa_id, sekolah_id, nominal_diajukan, status, created_at, jenis, pilihan, rencana_lunas, catatan_wali')
    .eq('id', id)
    .single()

  if (vErr || !verifikasiData) return gagal('Data verifikasi tidak ditemukan.', 404)

  const verifikasi = verifikasiData as VerifikasiRow
  if (verifikasi.status !== 'menunggu') return gagal('Bukti transfer ini sudah diproses.', 400)

  const { data: tagihanData, error: tErr } = await supabase
    .from('tagihan')
    .select('id, siswa_id, sekolah_id, bulan, tahun')
    .eq('id', verifikasi.tagihan_id)
    .single()

  if (tErr || !tagihanData) return gagal('Tagihan tidak ditemukan.', 404)

  const tagihan = tagihanData as TagihanRow

  // Bukti dikaitkan ke tagihan terbaru yang dipilih wali, jadi semua pilihannya ada di
  // daftar tertagih tagihan itu. Sisanya dihitung ulang sekarang: sejak bukti diunggah
  // bisa saja ada pembayaran lain yang sudah dicatat.
  const tertagih = await muatTertagih(supabase, tagihan, new Date())
  if (!tertagih.data) return gagal('Gagal memuat rincian tagihan.', 500)

  const semua   = unitBayar(tertagih.data.daftar)
  const pilihan = bacaPilihan(verifikasi.pilihan)
  // Bukti dari sebelum fitur pilih komponen membayar semua yang ditagih, terlama dulu
  const units   = pilihan ? pilihanSekarang(semua, pilihan) : semua
  const sisa    = units.reduce((s, u) => s + u.sisa, 0)

  if (sisa <= 0) return gagal('Tagihan yang dipilih wali sudah lunas.', 400)

  const diajukan = Number(verifikasi.nominal_diajukan)
  const jumlah   = body.nominal ?? diajukan

  if (!Number.isSafeInteger(jumlah) || jumlah <= 0) return gagal('Nominal tidak valid.', 400)
  if (jumlah > sisa) return gagal(`Nominal melebihi sisa tagihan yang dipilih wali (${formatRp(sisa)}).`, 400)

  // Satu baris pembayaran per tagihan, beserta komponen yang ditutupnya
  const bagian = bagiKeTagihan(units, jumlah)

  // Klaim dulu: dua klik Setujui yang berbarengan tidak boleh mencatat uangnya dua kali
  const waktu = new Date().toISOString()
  const { data: klaim, error: klaimErr } = await supabase
    .from('verifikasi_pembayaran')
    .update({
      status:          'disetujui',
      diverifikasi_at: waktu,
      updated_at:      waktu,
      catatan:         jumlah !== diajukan ? `Nominal dicatat ${formatRp(jumlah)}, diajukan ${formatRp(diajukan)}` : null,
    })
    .eq('id', verifikasi.id)
    .eq('status', 'menunggu')
    .select('id')

  if (klaimErr) return gagal('Gagal memproses bukti transfer.', 500)
  if (!klaim || klaim.length === 0) return gagal('Bukti transfer ini sudah diproses.', 400)

  // Rencana dan catatan wali ikut ke catatan pembayaran, supaya tetap terbaca bendahara
  // sesudah bukti ini tidak lagi berstatus menunggu
  const catatan = [
    'Diverifikasi dari bukti transfer manual',
    verifikasi.jenis === 'cicilan'
      ? `cicilan${verifikasi.rencana_lunas ? `, sisa direncanakan lunas ${formatTanggal(verifikasi.rencana_lunas)}` : ''}`
      : null,
    verifikasi.catatan_wali ? `catatan wali: "${verifikasi.catatan_wali}"` : null,
  ].filter(Boolean).join(' · ')

  // Disisipkan dalam satu perintah supaya tidak ada bagian yang tercatat separuh
  const { error: bayarErr } = await supabase.from('pembayaran').insert(bagian.map(b => ({
    tagihan_id:    b.tagihan_id,
    siswa_id:      verifikasi.siswa_id,
    sekolah_id:    verifikasi.sekolah_id,
    jumlah:        b.jumlah,
    alokasi:       b.alokasi,
    metode:        'transfer',
    sumber:        'manual_transfer',
    status:        'terkonfirmasi',
    // Waktu orang tua mengunggah bukti, bukan waktu admin memverifikasi — verifikasi
    // yang tertunda beberapa hari tidak boleh membuat pembayaran tercatat telat.
    tanggal_bayar: verifikasi.created_at,
    catatan,
  })))

  if (bayarErr) {
    const { error: kembaliErr } = await supabase
      .from('verifikasi_pembayaran')
      .update({ status: 'menunggu', diverifikasi_at: null, catatan: null })
      .eq('id', verifikasi.id)
    if (kembaliErr) console.error(`[verifikasi] bukti ${verifikasi.id} tertandai disetujui tanpa pembayaran:`, kembaliErr)
    return gagal('Gagal mencatat pembayaran.', 500)
  }

  // Lunas = seluruh tagihan tertutup, bukan hanya komponen yang dipilih
  const statusBaru = new Map(bagian.map(b => {
    const t = tertagih.data!.daftar.find(d => d.id === b.tagihan_id)
    return [b.tagihan_id, t && t.terbayar + b.jumlah >= t.total_nominal ? 'lunas' : 'cicilan'] as const
  }))

  const hasilStatus = await Promise.all([...statusBaru].map(([tagihanId, status]) => supabase
    .from('tagihan')
    .update({ status })
    .eq('id', tagihanId)))
  const statusErr = hasilStatus.find(h => h.error)?.error
  if (statusErr) console.error(`[verifikasi] status tagihan bukti ${verifikasi.id} gagal diperbarui:`, statusErr)

  // Status tagihan yang tautannya dipakai wali. Tidak ada di daftar belum lunas = lunas.
  const tagihanStatus = statusBaru.get(tagihan.id) ?? tertagih.data.sasaran?.status ?? 'lunas'
  return NextResponse.json({ ok: true, tagihanStatus })
}
