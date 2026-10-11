import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { periodeIndex } from '@/lib/komponenTagihan'
import {
  MAKS_CATATAN_WALI, bacaPilihan, pilihanPersis, rentangRencana, unitBayar, type PilihanBayar,
} from '@/lib/rincianKomponen'
import { muatBuktiMenunggu, muatTertagih } from '@/lib/tagihanTertagih'

const BUKTI_BUCKET  = 'bukti-transfer'
const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES  = ['image/jpeg', 'image/png']

type TagihanRow = {
  id:                  string
  status:              string
  sekolah_id:          string
  siswa_id:            string
  bulan:               number
  tahun:               number
  payment_token_aktif: boolean
}

const PESAN_BERUBAH = 'Rincian tagihan berubah sejak halaman dibuka. Muat ulang halaman, lalu pilih lagi.'

const gagal = (error: string, status: number) => NextResponse.json({ error }, { status })

/** 'YYYY-MM-DD' yang benar-benar ada di kalender */
function tanggalSah(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return gagal('Request tidak valid.', 400)
  }

  const paymentToken = formData.get('payment_token')
  const bukti        = formData.get('bukti')

  if (typeof paymentToken !== 'string' || !paymentToken) return gagal('Parameter tidak lengkap.', 400)
  if (!(bukti instanceof File))                          return gagal('Bukti transfer wajib diunggah.', 400)
  if (!ALLOWED_TYPES.includes(bukti.type))               return gagal('Format file harus JPG atau PNG.', 400)
  if (bukti.size > MAX_SIZE_BYTES)                       return gagal('Ukuran file maksimal 5MB.', 400)

  // Pilihan wali (lib/rincianKomponen). Halaman dari sebelum fitur pilih komponen tidak
  // mengirimnya — artinya semua yang ditagih, dibayar lunas, seperti dulu.
  const pilihanRaw = formData.get('pilihan')
  let pilihan: PilihanBayar[] | null = null
  if (pilihanRaw !== null) {
    try { pilihan = bacaPilihan(JSON.parse(String(pilihanRaw))) } catch { pilihan = null }
    if (!pilihan) return gagal('Pilihan tagihan tidak valid.', 400)
  }

  const jenisRaw = formData.get('jenis')
  const jenis = jenisRaw === null || jenisRaw === 'lunas' ? 'lunas' : jenisRaw === 'cicilan' ? 'cicilan' : null
  if (!jenis) return gagal('Jenis pembayaran tidak valid.', 400)

  const nominalRaw   = formData.get('nominal')
  const nominalKlien = nominalRaw === null ? null : /^\d{1,13}$/.test(String(nominalRaw)) ? Number(nominalRaw) : NaN
  if (nominalKlien !== null && !Number.isSafeInteger(nominalKlien)) return gagal('Nominal tidak valid.', 400)

  const catatanRaw = formData.get('catatan_wali')
  const catatan    = typeof catatanRaw === 'string' ? catatanRaw.trim() : ''
  if (Array.from(catatan).length > MAKS_CATATAN_WALI) return gagal(`Catatan maksimal ${MAKS_CATATAN_WALI} karakter.`, 400)

  const supabase = createServiceClient()

  const { data: tagihanData, error: tagErr } = await supabase
    .from('tagihan')
    .select('id, status, sekolah_id, siswa_id, bulan, tahun, payment_token_aktif')
    .eq('payment_token', paymentToken)
    .single()

  if (tagErr || !tagihanData) return gagal('Tagihan tidak ditemukan.', 404)

  const tagihan = tagihanData as TagihanRow
  if (!tagihan.payment_token_aktif) return gagal('Link pembayaran sudah tidak aktif.', 400)

  // Yang bisa dipilih = yang ditagih halaman bayar: sisa tagihan ini + tunggakan
  // sebelumnya. Tagihan di tautan yang sudah lunas masih bisa dipakai membayar tunggakannya.
  const sekarang = new Date()
  const tertagih = await muatTertagih(supabase, tagihan, sekarang)
  if (!tertagih.data) return gagal('Gagal memuat rincian tagihan. Silakan coba lagi.', 500)

  const units = unitBayar(tertagih.data.daftar)
  if (units.length === 0) return gagal('Tagihan sudah lunas.', 400)

  // Satu bukti menunggu per siswa, sama dengan halaman bayar yang terkunci selama itu —
  // dua bukti untuk komponen yang sama mencatat uangnya dua kali
  const menunggu = await muatBuktiMenunggu(supabase, tagihan)
  if (menunggu.error) return gagal('Gagal memuat rincian tagihan. Silakan coba lagi.', 500)
  if (menunggu.data) return gagal('Bukti transfer sebelumnya masih diverifikasi. Silakan tunggu sampai selesai.', 409)

  const dipilih = pilihan ? pilihanPersis(units, pilihan) : units
  if (!dipilih) return gagal(PESAN_BERUBAH, 409)
  const totalDipilih = dipilih.reduce((s, u) => s + u.sisa, 0)

  let nominal: number
  let rencanaLunas: string | null = null
  if (jenis === 'lunas') {
    // Halaman yang usang menampilkan total lain, dan wali mentransfer angka yang tampil
    if (nominalKlien !== null && nominalKlien !== totalDipilih) return gagal(PESAN_BERUBAH, 409)
    nominal = totalDipilih
  } else {
    if (nominalKlien === null || nominalKlien <= 0 || nominalKlien >= totalDipilih) {
      return gagal('Nominal cicilan harus lebih dari Rp 0 dan kurang dari total yang dipilih.', 400)
    }
    nominal = nominalKlien

    const rencana = String(formData.get('rencana_lunas') ?? '')
    const rentang = rentangRencana(sekarang)
    if (!tanggalSah(rencana)) return gagal('Tanggal rencana pelunasan wajib diisi.', 400)
    if (rencana < rentang.awal) return gagal('Tanggal rencana pelunasan tidak boleh sebelum hari ini.', 400)
    if (rencana > rentang.akhir) return gagal('Tanggal rencana pelunasan paling lambat setahun dari hari ini.', 400)
    // Akhir hari WIB, seperti tagihan.jatuh_tempo
    rencanaLunas = new Date(`${rencana}T23:59:59.999+07:00`).toISOString()
  }

  // Bukti dikaitkan ke tagihan terbaru yang dipilih: Dashboard dan pengingat membaca
  // bulan yang sedang dibayar dari kolom ini
  const terbaru = dipilih.reduce((a, b) => (periodeIndex(b.bulan, b.tahun) > periodeIndex(a.bulan, a.tahun) ? b : a))

  const ext  = bukti.type === 'image/png' ? 'png' : 'jpg'
  const path = `${tagihan.sekolah_id}/${terbaru.tagihan_id}-${Date.now()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(BUKTI_BUCKET)
    .upload(path, bukti, { contentType: bukti.type, upsert: false })

  if (uploadErr) return gagal('Gagal mengunggah bukti transfer.', 500)

  const { error: insertErr } = await supabase.from('verifikasi_pembayaran').insert({
    tagihan_id:       terbaru.tagihan_id,
    siswa_id:         tagihan.siswa_id,
    sekolah_id:       tagihan.sekolah_id,
    nominal_diajukan: nominal,
    bukti_path:       path,
    status:           'menunggu',
    jenis,
    // Salinan apa yang dipilih beserta sisanya saat itu — untuk ditampilkan ke admin dan
    // bendahara; verifikasi menghitung ulang sisanya dari keadaan saat disetujui
    pilihan:          dipilih,
    total_dipilih:    totalDipilih,
    rencana_lunas:    rencanaLunas,
    catatan_wali:     jenis === 'cicilan' && catatan ? catatan : null,
  })

  if (insertErr) {
    await supabase.storage.from(BUKTI_BUCKET).remove([path])
    return gagal('Gagal menyimpan konfirmasi pembayaran.', 500)
  }

  return NextResponse.json({ ok: true, nominal, sisa: totalDipilih - nominal })
}
