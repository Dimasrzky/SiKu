import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase-service'
import PaymentForm from './PaymentForm'

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

type TagihanItem = { nama_komponen: string; nominal: number }
type SiswaJoin   = { nama: string; nis: string | null; nama_wali: string | null; kelas: { nama: string } | null }
type TagihanRow  = {
  id:                  string
  total_nominal:       number
  status:              string
  bulan:               number
  tahun:               number
  payment_token_aktif: boolean
  siswa:               SiswaJoin | null
  tagihan_item:        TagihanItem[]
}

export default async function BayarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase  = createServiceClient()

  const { data } = await supabase
    .from('tagihan')
    .select('id, total_nominal, status, bulan, tahun, payment_token_aktif, siswa:siswa_id(nama, nis, nama_wali, kelas:kelas_id(nama)), tagihan_item(nama_komponen, nominal)')
    .eq('payment_token', token)
    .single()

  const tagihan = data as unknown as TagihanRow | null

  if (!tagihan || !tagihan.payment_token_aktif) notFound()

  const siswa    = tagihan.siswa
  const periode  = `${BULAN_NAMES[tagihan.bulan]} ${tagihan.tahun}`

  if (tagihan.status === 'lunas') {
    return (
      <PageShell>
        <div style={{ background: '#fff', borderRadius: 16, padding: '2.5rem 2rem', textAlign: 'center', boxShadow: '0 4px 24px #0000000f' }}>
          <div style={{ width: 72, height: 72, background: '#D1FAE5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2.5rem' }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A2C4E', marginBottom: 8 }}>Tagihan Sudah Lunas</div>
          <div style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Tagihan <strong>{siswa?.nama ?? ''}</strong> periode {periode} sudah lunas.
          </div>
        </div>
      </PageShell>
    )
  }

  // Hitung sisa
  const { data: pembayaranList } = await supabase
    .from('pembayaran')
    .select('jumlah')
    .eq('tagihan_id', tagihan.id)

  const totalBayar    = (pembayaranList ?? []).reduce((s, p: { jumlah: number }) => s + p.jumlah, 0)
  const sisa          = tagihan.total_nominal - totalBayar
  const isFirstPayment = totalBayar === 0

  return (
    <PageShell>
      <PaymentForm
        paymentToken={token}
        totalNominal={tagihan.total_nominal}
        sisa={sisa}
        isFirstPayment={isFirstPayment}
        namaSiswa={siswa?.nama ?? ''}
        namaWali={siswa?.nama_wali ?? ''}
        kelasNama={siswa?.kelas?.nama ?? ''}
        periode={periode}
        items={tagihan.tagihan_item ?? []}
      />
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#F1F5F9',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#1A2C4E', letterSpacing: '-0.5px' }}>SiKu</div>
          <div style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: 2 }}>Portal Pembayaran Sekolah</div>
        </div>
        {children}
        <div style={{ textAlign: 'center', marginTop: '1.25rem', color: '#CBD5E1', fontSize: '0.72rem' }}>
          Transaksi diproses oleh iPaymu · PT. Inti Prima Mandiri Utama
        </div>
      </div>
    </main>
  )
}
