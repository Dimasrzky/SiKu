import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase-service'
import { kunciUnit, rentangRencana, unitBayar, type PilihanBayar } from '@/lib/rincianKomponen'
import { muatBuktiMenunggu, muatTertagih, rincianSisa, sisaTagihan, type TagihanBayar } from '@/lib/tagihanTertagih'
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
  // Alamatnya memuat token; kalau link-nya tersebar, jangan sampai masuk hasil pencarian
  robots: { index: false, follow: false },
}

// Sesudah semua tagihan di tautan lunas, tanda terimanya tampil selama ini. Lewat dari itu
// tautan yang terlanjur tersebar (grup WA, screenshot) tidak lagi menampilkan data siswa.
const MASA_TANDA_TERIMA_MS = 30 * 24 * 60 * 60 * 1000

/** "••••002": orang tua tetap mengenali anaknya, NIS lengkap tidak ikut terkirim ke browser */
const samarkanNis = (nis: string | null | undefined): string => {
  const n = (nis ?? '').trim()
  return n ? '••••' + n.slice(-3) : ''
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
  created_at:          string
  siswa:               SiswaJoin | null
}

export interface TagihanItem {
  nama_komponen: string
  /** Negatif untuk potongan beasiswa dan pembayaran yang sudah masuk */
  nominal:       number
  warna:         string
}

/** Satu komponen yang bisa dicentang wali */
export interface KomponenPilih {
  /** kunciUnit — sama dengan kunci di daftar unit */
  kunci:    string
  nama:     string
  warna:    string
  /** Sebelum potongan beasiswa */
  nominal:  number
  potongan: number
  terbayar: number
  /** 0 = komponen ini sudah lunas */
  sisa:     number
}

/** Satu bulan tagihan yang masih bersisa */
export interface BlokTagihan {
  tagihan_id: string
  bulan:      number
  tahun:      number
  /** Tagihan yang ditunjuk tautan ini; yang lain tunggakan bulan sebelumnya */
  diTautan:   boolean
  sisa:       number
  /** null = tagihan ini dibayar utuh, dicentang lewat `kunciUtuh` */
  komponen:   KomponenPilih[] | null
  kunciUtuh:  string
  /** Untuk tagihan utuh: komponen apa adanya, lalu potongan dan yang sudah dibayar */
  rincian:    TagihanItem[]
}

/** Yang dipilih wali di langkah 1, dikirim bersama bukti transfer */
export interface Pengajuan {
  /** kunciUnit yang dicentang — dipakai lagi kalau wali kembali ke langkah 1 */
  kunci:        string[]
  pilihan:      PilihanBayar[]
  jenis:        'lunas' | 'cicilan'
  /** Yang ditransfer sekarang */
  nominal:      number
  totalDipilih: number
  /** 'YYYY-MM-DD', hanya untuk cicilan */
  rencana:      string | null
  catatan:      string
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
    .select('id, siswa_id, sekolah_id, total_nominal, status, bulan, tahun, payment_token_aktif, created_at, siswa:siswa_id(nama, nis, nama_wali, kelas:kelas_id(nama))')
    .eq('payment_token', token)
    .single()

  const tagihan = data as unknown as TagihanRow | null

  if (!tagihan || !tagihan.payment_token_aktif) notFound()

  const siswa     = tagihan.siswa
  const kelasNama = formatKelasNama(siswa?.kelas?.nama ?? '')

  const sekarang = new Date()
  const today    = sekarang.toISOString().split('T')[0]
  const [{ data: sekolahData }, { data: staffAll }, { data: beasiswaRaw }, { data: rekeningData }, menungguRes, tertagihRes] = await Promise.all([
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
    muatBuktiMenunggu(supabase, tagihan),
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

  // Menampilkan angka dari data yang tidak lengkap berarti meminta wali mentransfer
  // jumlah yang salah — lebih baik halamannya meminta dimuat ulang
  const tertagih = tertagihRes.data

  // Tagihan di tautan ini sudah lunas. Wali boleh membayar bulan ini lebih dulu dan menunda
  // tunggakannya, jadi tunggakan yang tersisa tetap ditawarkan di sini; "Lunas" hanya
  // kalau memang tidak ada sisa.
  if (tagihan.status === 'lunas' && (!tertagih || tertagih.daftar.length === 0)) {
    const { data: pembayaranLunas } = await supabase
      .from('pembayaran')
      .select('tanggal_bayar')
      .eq('tagihan_id', tagihan.id)
      .order('tanggal_bayar', { ascending: false })
      .limit(1)
      .maybeSingle()
    const tanggalLunas = (pembayaranLunas as { tanggal_bayar: string } | null)?.tanggal_bayar ?? null

    if (sekarang.getTime() - new Date(tanggalLunas ?? tagihan.created_at).getTime() > MASA_TANDA_TERIMA_MS) {
      return (
        <PageShell headerProps={headerProps} footerProps={footerProps}>
          <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 0 6px #21386b7b', padding: '2rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A2C4E' }}>Tautan pembayaran ini sudah tidak berlaku</div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 6, lineHeight: 1.6 }}>
              Seluruh tagihan pada tautan ini sudah lunas. Untuk tanda terima atau pertanyaan lain, silakan hubungi bagian TU sekolah.
            </div>
          </div>
        </PageShell>
      )
    }

    return (
      <PageShell headerProps={headerProps} footerProps={footerProps}>
        <PembayaranLunasView
          namaSiswa={siswa?.nama ?? ''}
          kelasNama={kelasNama}
          totalNominal={tagihan.total_nominal}
          waktuLunas={tanggalLunas ?? new Date().toISOString()}
          bulan={tagihan.bulan}
          tahun={tagihan.tahun}
        />
      </PageShell>
    )
  }

  // Tanpa daftar bukti yang menunggu, halaman bisa menawarkan transfer kedua untuk
  // komponen yang sudah dibayar — sama gagalnya dengan rincian yang tidak lengkap
  if (!tertagih || menungguRes.error) {
    return (
      <PageShell headerProps={headerProps} footerProps={footerProps}>
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 0 6px #21386b7b', padding: '2rem 1.5rem', textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A2C4E' }}>Rincian tagihan gagal dimuat</div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 6 }}>Silakan muat ulang halaman ini beberapa saat lagi.</div>
        </div>
      </PageShell>
    )
  }

  // Bukti siswa ini yang sedang diproses — lewat tautan mana pun, mis. tautan bulan lalu
  // — berarti sebagian tagihannya sudah dibayar dan menunggu dicatat. Halaman ini tidak
  // menawarkan transfer kedua sampai bukti itu selesai diverifikasi.
  const menunggu = menungguRes.data
  if (menunggu) {
    const cicilan = menunggu.jenis === 'cicilan'
    return (
      <PageShell headerProps={headerProps} footerProps={footerProps}>
        <BuktiSedangDiprosesView
          namaSiswa={siswa?.nama ?? ''}
          kelasNama={kelasNama}
          totalNominal={menunggu.nominal_diajukan}
          cicilan={cicilan ? {
            sisa:    Math.max(0, (menunggu.total_dipilih ?? 0) - menunggu.nominal_diajukan),
            rencana: menunggu.rencana_lunas,
          } : null}
          buktiDikirim={menunggu.created_at}
          namaBendahara={footerProps.namaBendahara}
          noWaBendahara={footerProps.noWaBendahara}
        />
      </PageShell>
    )
  }

  // Rincian tagihan yang dibayar utuh berjumlah sama dengan sisanya: komponen tagihan_item
  // (dicatat sebelum potongan), lalu potongan beasiswa dan pembayaran yang sudah masuk
  const rincian = (t: TagihanBayar): TagihanItem[] => rincianSisa(
    t.tagihan_item.map(i => ({ nama_komponen: i.nama_komponen, nominal: i.nominal, warna: i.komponen?.kelas_warna ?? '#94A3B8' })),
    t,
    (nama_komponen, nominal) => ({ nama_komponen, nominal, warna: '#94A3B8' }),
  )

  // Bulan-bulan yang masih bersisa: tunggakan terlama dulu, lalu tagihan di tautan ini.
  // Wali memilih komponen mana yang dibayar sekarang (lib/rincianKomponen).
  const blok: BlokTagihan[] = tertagih.daftar.map(t => ({
    tagihan_id: t.id,
    bulan:      t.bulan,
    tahun:      t.tahun,
    diTautan:   t.id === tagihan.id,
    sisa:       sisaTagihan(t),
    komponen:   t.rincian.perKomponen
      ? t.rincian.komponen.map(k => ({
          kunci:    kunciUnit({ tagihan_id: t.id, tagihan_item_id: k.item.id }),
          nama:     k.item.nama_komponen,
          warna:    k.item.komponen?.kelas_warna ?? '#94A3B8',
          nominal:  k.item.nominal,
          potongan: k.item.potongan,
          terbayar: k.terbayar,
          sisa:     k.sisa,
        }))
      : null,
    kunciUtuh:  kunciUnit({ tagihan_id: t.id, tagihan_item_id: null }),
    rincian:    t.rincian.perKomponen ? [] : rincian(t),
  }))

  return (
    <PageShell headerProps={headerProps} footerProps={footerProps}>
      <BayarWizard
        paymentToken={token}
        namaSiswa={siswa?.nama ?? ''}
        nis={samarkanNis(siswa?.nis)}
        kelasNama={kelasNama}
        blok={blok}
        units={unitBayar(tertagih.daftar)}
        lunasDiTautan={tagihan.status === 'lunas' ? { bulan: tagihan.bulan, tahun: tagihan.tahun } : null}
        // Dihitung di server supaya HTML server dan browser sama, juga menjelang tengah malam
        rentangRencana={rentangRencana(sekarang)}
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
