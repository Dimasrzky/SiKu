import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { bacaPilihanTersimpan, labelUnit } from '@/lib/rincianKomponen'
import VerifikasiTable, { type VerifikasiItem } from '../VerifikasiTable'

export const metadata: Metadata = {
  title: 'Verifikasi Pembayaran',
}

type SiswaJoin  = { nama: string; nis: string | null }

type VerifikasiRow = {
  id:               string
  nominal_diajukan: number
  bukti_path:       string
  jenis:            string
  pilihan:          unknown
  total_dipilih:    number | null
  rencana_lunas:    string | null
  catatan_wali:     string | null
  siswa:            SiswaJoin | null
}

const BUKTI_BUCKET = 'bukti-transfer'

const formatTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })

export default async function VerifikasiSekolahPage({ params }: { params: Promise<{ sekolahId: string }> }) {
  const { sekolahId } = await params

  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/')
  }

  const supabase = createServiceClient()

  const { data: sekolahData } = await supabase.from('sekolah').select('nama').eq('id', sekolahId).maybeSingle()
  if (!sekolahData) notFound()

  const { data } = await supabase
    .from('verifikasi_pembayaran')
    .select('id, nominal_diajukan, bukti_path, jenis, pilihan, total_dipilih, rencana_lunas, catatan_wali, siswa:siswa_id(nama, nis)')
    .eq('sekolah_id', sekolahId)
    .eq('status', 'menunggu')
    .order('created_at', { ascending: true })
    .limit(200)

  const rows = (data ?? []) as unknown as VerifikasiRow[]

  const buktiUrls = await Promise.all(
    rows.map(r => supabase.storage.from(BUKTI_BUCKET).createSignedUrl(r.bukti_path, 60 * 60))
  )

  const items: VerifikasiItem[] = rows.map((r, i) => {
    const diajukan = Number(r.nominal_diajukan)
    return {
      id:              r.id,
      namaSiswa:       r.siswa?.nama ?? '-',
      nis:             r.siswa?.nis ?? '-',
      nominalDiajukan: diajukan,
      // Bukti dari sebelum fitur pilih komponen tidak menyimpan total pilihannya; saat itu
      // yang diajukan selalu seluruh yang ditagih
      totalDipilih:    r.total_dipilih ?? diajukan,
      jenis:           r.jenis === 'cicilan' ? 'cicilan' : 'lunas',
      pilihan:         (bacaPilihanTersimpan(r.pilihan) ?? []).map(u => ({ label: labelUnit(u), sisa: u.sisa })),
      rencana:         r.rencana_lunas ? formatTanggal(r.rencana_lunas) : null,
      catatanWali:     r.catatan_wali,
      buktiUrl:        buktiUrls[i]?.data?.signedUrl ?? null,
    }
  })

  return <VerifikasiTable items={items} namaSekolah={sekolahData.nama} />
}
