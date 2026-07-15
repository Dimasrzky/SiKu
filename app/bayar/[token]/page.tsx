import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase-service'
import BayarWizard from './BayarWizard'
import BayarHeader from './BayarHeader'
import BayarFooter from './BayarFooter'
import BuktiSedangDiprosesView from './BuktiSedangDiprosesView'
import PembayaranLunasView from './PembayaranLunasView'
import { formatKelasNama } from './format'

type TagihanItemRaw = { nama_komponen: string; nominal: number; komponen: { kelas_warna: string | null } | null }
type SiswaJoin      = { nama: string; nis: string | null; nama_wali: string | null; kelas: { nama: string } | null }
type TagihanRow      = {
  id:                  string
  siswa_id:            string
  sekolah_id:           string
  total_nominal:       number
  status:              string
  bulan:               number
  tahun:               number
  payment_token_aktif: boolean
  siswa:               SiswaJoin | null
  tagihan_item:        TagihanItemRaw[]
}

export interface TagihanItem {
  nama_komponen: string
  nominal:       number
  warna:         string
}

type SekolahRow  = { nama: string; no_wa: string | null; yayasan: string | null }
type StaffRow    = { nama: string; jabatan: string | null; no_wa: string | null; avatar: string | null }
type RekeningRow = { bank: string; no_rek: string; atas_nama: string }
type BeasiswaRaw = {
  beasiswa: {
    nama:           string | null
    keterangan:     string | null
    jenis:          'beasiswa' | 'override'
    jenis_potongan: 'persen' | 'nominal'
    persen:         number | null
    nominal:        number | null
  } | null
}

export interface BeasiswaBadge {
  label: 'beasiswa' | 'potongan'
  nama:  string
  nilai: string
}

export default async function BayarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase  = createServiceClient()

  const { data } = await supabase
    .from('tagihan')
    .select('id, siswa_id, sekolah_id, total_nominal, status, bulan, tahun, payment_token_aktif, siswa:siswa_id(nama, nis, nama_wali, kelas:kelas_id(nama)), tagihan_item(nama_komponen, nominal, komponen:komponen_id(kelas_warna))')
    .eq('payment_token', token)
    .single()

  const tagihan = data as unknown as TagihanRow | null

  if (!tagihan || !tagihan.payment_token_aktif) notFound()

  const siswa     = tagihan.siswa
  const kelasNama = formatKelasNama(siswa?.kelas?.nama ?? '')

  const today = new Date().toISOString().split('T')[0]
  const [{ data: sekolahData }, { data: staffAll }, { data: beasiswaRaw }, { data: rekeningData }, { data: verifikasiLatest }] = await Promise.all([
    supabase.from('sekolah').select('nama, no_wa, yayasan').eq('id', tagihan.sekolah_id).maybeSingle(),
    supabase.from('profiles').select('nama, jabatan, no_wa, avatar').eq('sekolah_id', tagihan.sekolah_id).limit(20),
    supabase
      .from('beasiswa_siswa')
      .select('beasiswa:beasiswa_id(nama, keterangan, jenis, jenis_potongan, persen, nominal)')
      .eq('siswa_id', tagihan.siswa_id)
      .or(`berlaku_sampai.is.null,berlaku_sampai.gte.${today}`),
    supabase.from('rekening').select('bank, no_rek, atas_nama')
      .eq('sekolah_id', tagihan.sekolah_id).eq('jenis', 'transfer').eq('aktif', true)
      .order('urutan', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('verifikasi_pembayaran').select('status, nominal_diajukan, created_at')
      .eq('tagihan_id', tagihan.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const sekolah  = sekolahData  as SekolahRow  | null
  const rekening = rekeningData as RekeningRow | null

  const staffList = (staffAll ?? []) as StaffRow[]
  const staff = staffList.find(s => s.jabatan === 'Bendahara') ?? staffList[0] ?? null

  const badges: BeasiswaBadge[] = ((beasiswaRaw ?? []) as unknown as BeasiswaRaw[])
    .filter(r => r.beasiswa)
    .map(r => {
      const b     = r.beasiswa!
      const nilai = b.jenis_potongan === 'persen' ? `${b.persen ?? 0}%` : `Rp ${(b.nominal ?? 0).toLocaleString('id-ID')}`
      return b.jenis === 'beasiswa'
        ? { label: 'beasiswa' as const, nama: b.nama ?? 'Beasiswa', nilai }
        : { label: 'potongan' as const, nama: b.keterangan ?? 'Potongan', nilai }
    })

  const headerProps = {
    namaSekolah: sekolah?.nama ?? '',
    yayasan:     sekolah?.yayasan ?? '',
    avatar:      staff?.avatar ?? null,
  }
  const footerProps = {
    namaBendahara: staff?.nama ?? '',
    noWaBendahara: staff?.no_wa ?? sekolah?.no_wa ?? '',
  }

  if (tagihan.status === 'lunas') {
    const { data: pembayaranLunas } = await supabase
      .from('pembayaran')
      .select('tanggal_bayar')
      .eq('tagihan_id', tagihan.id)
      .order('tanggal_bayar', { ascending: false })
      .limit(1)
      .maybeSingle()

    return (
      <PageShell headerProps={headerProps} footerProps={footerProps}>
        <PembayaranLunasView
          namaSiswa={siswa?.nama ?? ''}
          kelasNama={kelasNama}
          totalNominal={tagihan.total_nominal}
          waktuLunas={(pembayaranLunas as { tanggal_bayar: string } | null)?.tanggal_bayar ?? new Date().toISOString()}
          bulan={tagihan.bulan}
          tahun={tagihan.tahun}
        />
      </PageShell>
    )
  }

  if (verifikasiLatest?.status === 'menunggu') {
    return (
      <PageShell headerProps={headerProps} footerProps={footerProps}>
        <BuktiSedangDiprosesView
          namaSiswa={siswa?.nama ?? ''}
          kelasNama={kelasNama}
          totalNominal={verifikasiLatest.nominal_diajukan}
          buktiDikirim={verifikasiLatest.created_at}
          namaBendahara={footerProps.namaBendahara}
          noWaBendahara={footerProps.noWaBendahara}
        />
      </PageShell>
    )
  }

  // Hitung sisa
  const { data: pembayaranList } = await supabase
    .from('pembayaran')
    .select('jumlah')
    .eq('tagihan_id', tagihan.id)

  const totalBayar = (pembayaranList ?? []).reduce((s, p: { jumlah: number }) => s + p.jumlah, 0)
  const sisa         = tagihan.total_nominal - totalBayar

  const items: TagihanItem[] = (tagihan.tagihan_item ?? []).map(it => ({
    nama_komponen: it.nama_komponen,
    nominal:       it.nominal,
    warna:         it.komponen?.kelas_warna ?? '#94A3B8',
  }))

  return (
    <PageShell headerProps={headerProps} footerProps={footerProps}>
      <BayarWizard
        paymentToken={token}
        totalNominal={tagihan.total_nominal}
        sisa={sisa}
        namaSiswa={siswa?.nama ?? ''}
        nis={siswa?.nis ?? ''}
        kelasNama={kelasNama}
        items={items}
        badges={badges}
        rekening={rekening ? { bank: rekening.bank, noRek: rekening.no_rek, atasNama: rekening.atas_nama } : null}
        namaBendahara={footerProps.namaBendahara}
        noWaBendahara={footerProps.noWaBendahara}
      />
    </PageShell>
  )
}

function PageShell({
  headerProps,
  footerProps,
  children,
}: {
  headerProps: { namaSekolah: string; yayasan: string; avatar: string | null }
  footerProps: { namaBendahara: string; noWaBendahara: string }
  children: React.ReactNode
}) {
  return (
    <main style={{ minHeight: '100vh', background: '#EEF3FC', display: 'flex', flexDirection: 'column' }}>
      <BayarHeader {...headerProps} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '1.75rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          {children}
        </div>
      </div>
      <BayarFooter {...footerProps} />
    </main>
  )
}
