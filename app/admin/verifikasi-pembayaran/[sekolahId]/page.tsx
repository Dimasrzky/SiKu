import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import VerifikasiTable, { type VerifikasiItem } from '../VerifikasiTable'

type SiswaJoin  = { nama: string; nis: string | null }
type TagihanJoin = { total_nominal: number }

type VerifikasiRow = {
  id:               string
  nominal_diajukan: number
  bukti_path:       string
  siswa:            SiswaJoin | null
  tagihan:          TagihanJoin | null
}

const BUKTI_BUCKET = 'bukti-transfer'

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
    .select('id, nominal_diajukan, bukti_path, siswa:siswa_id(nama, nis), tagihan:tagihan_id(total_nominal)')
    .eq('sekolah_id', sekolahId)
    .eq('status', 'menunggu')
    .order('created_at', { ascending: true })
    .limit(200)

  const rows = (data ?? []) as unknown as VerifikasiRow[]

  const buktiUrls = await Promise.all(
    rows.map(r => supabase.storage.from(BUKTI_BUCKET).createSignedUrl(r.bukti_path, 60 * 60))
  )

  const items: VerifikasiItem[] = rows.map((r, i) => ({
    id:              r.id,
    namaSiswa:       r.siswa?.nama ?? '-',
    nis:             r.siswa?.nis ?? '-',
    nominalTagihan:  r.tagihan?.total_nominal ?? 0,
    nominalDiajukan: r.nominal_diajukan,
    buktiUrl:        buktiUrls[i]?.data?.signedUrl ?? null,
  }))

  return <VerifikasiTable items={items} namaSekolah={sekolahData.nama} />
}
