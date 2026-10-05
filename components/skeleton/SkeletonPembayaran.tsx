import type { CSSProperties } from 'react'
import { Banknote, TrendingUp } from 'lucide-react'
import { Blok, BlokTeks, KepalaHalaman, KerangkaHalaman, LEBAR_NAMA, giliran } from './Blok'

// Kerangka Pembayaran — meniru app/(dashboard)/pembayaran/page.tsx: kartu ringkasan
// periode (tiga kartu) dan tabel transaksi. Ubah bersama halamannya.

const KOLOM = ['Tanggal', 'Nama', 'Kelas', 'Nominal', 'Metode', 'Ke-', 'Status'] as const
const sSel: CSSProperties = { padding: '0.7rem 0.875rem' }
const sKartu: CSSProperties = { background: '#fff', borderRadius: 12, padding: '1.25rem', border: '1px solid #F1F5F9', boxShadow: '0 2px 10px #3244736e' }
const sLabel: CSSProperties = { fontSize: '1rem', fontWeight: 600, color: '#94A3B8' }

export const SkeletonPembayaran = () => (
  <KerangkaHalaman label="Pembayaran">
    <KepalaHalaman ikon={<Banknote size={30} color="#ffffff" />} judul="Pembayaran" subjudul="Rekam jejak seluruh transaksi pembayaran siswa" />

    {/* ── Ringkasan periode ── */}
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8F0', borderLeft: '28px solid #1A2C4E', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
        <div style={{ width: 48, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Banknote size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', lineHeight: 1.2 }}>Ringkasan periode ini</div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500, marginTop: 2 }}>Rekap nominal dan kondisi pembayaran bulan ini</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
        <div style={sKartu}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={sLabel}>Total pemasukan</span>
            <TrendingUp size={22} color="#1A2C4E" />
          </div>
          <BlokTeks lebar={170} ukuran="1.65rem" tinggiBaris={1.1} style={{ marginBottom: '0.75rem' }} />
          <div style={{ height: 1, background: '#E2E8F0', marginBottom: '0.875rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['● Gateway', '● Manual'].map(label => (
              <div key={label} style={{ flex: 1, background: '#1A2C4E', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', marginBottom: '0.2rem' }}>{label}</div>
                <BlokTeks gelap lebar={72} ukuran="0.72rem" />
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...sKartu, border: undefined, padding: '1.1rem' }}>
          <div style={{ marginBottom: '0.75rem' }}><span style={sLabel}>Tingkat Pelunasan</span></div>
          <BlokTeks lebar={72} ukuran="2rem" tinggiBaris={1} style={{ marginBottom: '0.5rem' }} />
          <Blok tinggi={15} sudut={99} style={{ marginBottom: '0.5rem' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}>
            Sisa belum masuk: <BlokTeks lebar={96} ukuran="0.9rem" />
          </div>
        </div>

        <div style={sKartu}>
          <div style={{ marginBottom: '0.5rem' }}><span style={sLabel}>Tren bulanan</span></div>
          <BlokTeks lebar={100} ukuran="1.85rem" tinggiBaris={1} style={{ marginBottom: '0.25rem' }} />
          <BlokTeks lebar={160} ukuran="0.78rem" style={{ marginBottom: '0.875rem' }} />
          <div style={{ background: '#1A2C4E', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.875rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>Bulan ini</span>
              <BlokTeks gelap lebar={60} ukuran="0.8rem" />
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '0 0.875rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.875rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>Bulan lalu</span>
              <BlokTeks gelap lebar={60} ukuran="0.78rem" />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ── Tabel transaksi ── */}
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #F1F5F9', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.6rem', padding: '0.875rem 1rem', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap', alignItems: 'center' }}>
        <Blok lebar={130} tinggi={36} sudut={8} />
        <Blok lebar={140} tinggi={36} sudut={8} />
        <Blok lebar={400} tinggi={40} sudut={8} style={{ marginLeft: 'auto', maxWidth: '100%' }} />
      </div>
      <div style={{ overflowX: 'auto', padding: '0 1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: '#1A2C4E' }}>
              {KOLOM.map((h, i) => (
                <th key={h} style={{ padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', borderRadius: i === 0 ? '8px 0 0 8px' : i === KOLOM.length - 1 ? '0 8px 8px 0' : undefined }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                <td style={sSel}><Blok lebar={62} tinggi={11} /></td>
                <td style={sSel}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Blok lebar={30} tinggi={30} sudut="50%" />
                    <Blok lebar={giliran(LEBAR_NAMA, i)} tinggi={12} />
                  </div>
                </td>
                <td style={sSel}><Blok lebar={46} tinggi={21} sudut={6} /></td>
                <td style={sSel}><Blok lebar={giliran([88, 96, 80], i)} tinggi={12} /></td>
                <td style={sSel}><Blok lebar={giliran([64, 72, 58], i)} tinggi={21} sudut={20} /></td>
                <td style={sSel}><Blok lebar={110} tinggi={11} /></td>
                <td style={sSel}><Blok lebar={giliran([70, 84, 62], i)} tinggi={23} sudut={20} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', borderTop: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '0.5rem' }}>
        <BlokTeks lebar={150} ukuran="0.78rem" />
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {[64, 34, 34, 34, 64].map((l, i) => <Blok key={i} lebar={l} tinggi={34} sudut={7} />)}
        </div>
      </div>
    </div>
  </KerangkaHalaman>
)
