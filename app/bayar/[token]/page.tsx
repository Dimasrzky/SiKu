import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase-service'
import { muatTertagih, rincianSisa, type TagihanBayar } from '@/lib/tagihanTertagih'
import BayarWizard from './BayarWizard'
import BayarHeader from './BayarHeader'
import BayarFooter from './BayarFooter'
import BuktiSedangDiprosesView from './BuktiSedangDiprosesView'
import PembayaranLunasView from './PembayaranLunasView'
import { formatKelasNama } from './format'

// Link halaman ini dikirim ke wali murid lewat WhatsApp; title dan description
// ini juga menjadi og:title dan og:description di kartu pratinjau link
export const metadata: Metadata = {
  title: 'Pembayaran Tagihan',
  description: 'Lihat rincian tagihan sekolah dan lakukan pembayaran.',
}

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
}

export interface TagihanItem {
  nama_komponen: string
  /** Negatif untuk potongan beasiswa dan pembayaran yang sudah masuk */
  nominal:       number
  warna:         string
}

/** Baris rincian tagihan periode sebelumnya yang masih bersisa. */
export interface TunggakanItem extends TagihanItem {
  bulan: number
  tahun: number
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
    .select('id, siswa_id, sekolah_id, total_nominal, status, bulan, tahun, payment_token_aktif, siswa:siswa_id(nama, nis, nama_wali, kelas:kelas_id(nama))')
    .eq('payment_token', token)
    .single()

  const tagihan = data as unknown as TagihanRow | null

  if (!tagihan || !tagihan.payment_token_aktif) notFound()

  const siswa     = tagihan.siswa
  const kelasNama = formatKelasNama(siswa?.kelas?.nama ?? '')

  const sekarang = new Date()
  const today    = sekarang.toISOString().split('T')[0]
  const [{ data: sekolahData }, { data: staffAll }, { data: beasiswaRaw }, { data: rekeningData }, { data: verifikasiMenunggu }, tertagihRes] = await Promise.all([
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
    // Bukti yang belum diverifikasi untuk tagihan mana pun milik siswa ini — disaring di
    // bawah ke tagihan yang ikut ditagih lewat tautan ini
    supabase.from('verifikasi_pembayaran').select('tagihan_id, nominal_diajukan, created_at')
      .eq('siswa_id', tagihan.siswa_id).eq('status', 'menunggu')
      .order('created_at', { ascending: false }).limit(20),
    muatTertagih(supabase, tagihan, sekarang),
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

  // Menampilkan angka dari data yang tidak lengkap berarti meminta wali mentransfer
  // jumlah yang salah — lebih baik halamannya meminta dimuat ulang
  const tertagih = tertagihRes.data
  if (!tertagih) {
    return (
      <PageShell headerProps={headerProps} footerProps={footerProps}>
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 0 6px #21386b7b', padding: '2rem 1.5rem', textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A2C4E' }}>Rincian tagihan gagal dimuat</div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 6 }}>Silakan muat ulang halaman ini beberapa saat lagi.</div>
        </div>
      </PageShell>
    )
  }

  // Bukti yang sedang diproses untuk salah satu tagihan yang ditagih di sini — mis.
  // dikirim lewat tautan bulan lalu — berarti tunggakannya sudah dibayar dan menunggu
  // dicatat. Halaman ini tidak menawarkan transfer kedua untuk tagihan yang sama.
  const idTertagih = new Set([tagihan.id, ...tertagih.daftar.map(t => t.id)])
  type VerifikasiRow = { tagihan_id: string; nominal_diajukan: number; created_at: string }
  const menunggu = ((verifikasiMenunggu ?? []) as VerifikasiRow[]).find(v => idTertagih.has(v.tagihan_id))
  if (menunggu) {
    return (
      <PageShell headerProps={headerProps} footerProps={footerProps}>
        <BuktiSedangDiprosesView
          namaSiswa={siswa?.nama ?? ''}
          kelasNama={kelasNama}
          totalNominal={menunggu.nominal_diajukan}
          buktiDikirim={menunggu.created_at}
          namaBendahara={footerProps.namaBendahara}
          noWaBendahara={footerProps.noWaBendahara}
        />
      </PageShell>
    )
  }

  // Tiap blok rincian berjumlah sama dengan sisa tagihannya: komponen tagihan_item
  // (dicatat sebelum potongan), lalu potongan beasiswa dan pembayaran yang sudah masuk
  const rincian = (t: TagihanBayar): TagihanItem[] => rincianSisa(
    t.tagihan_item.map(i => ({ nama_komponen: i.nama_komponen, nominal: i.nominal, warna: i.komponen?.kelas_warna ?? '#94A3B8' })),
    t,
    (nama_komponen, nominal) => ({ nama_komponen, nominal, warna: '#94A3B8' }),
  )

  const items: TagihanItem[] = tertagih.sasaran ? rincian(tertagih.sasaran) : []

  // Tunggakan bulan-bulan sebelumnya, terlama dulu — ikut ditagih dan ikut dilunasi
  // saat bukti transfernya diverifikasi
  const tunggakan: TunggakanItem[] = tertagih.daftar
    .filter(t => t.id !== tagihan.id)
    .flatMap(t => rincian(t).map(i => ({ ...i, bulan: t.bulan, tahun: t.tahun })))

  return (
    <PageShell headerProps={headerProps} footerProps={footerProps}>
      <BayarWizard
        paymentToken={token}
        total={tertagih.total}
        namaSiswa={siswa?.nama ?? ''}
        nis={siswa?.nis ?? ''}
        kelasNama={kelasNama}
        items={items}
        tunggakan={tunggakan}
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
