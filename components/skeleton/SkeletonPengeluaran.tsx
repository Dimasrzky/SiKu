import { BarChart2, Scale, TrendingDown, TrendingUp } from 'lucide-react'
import {
  JUDUL_HALAMAN, KOLOM_RINCIAN, KOLOM_RINCIAN_KANAN, KartuKas, PilihanTab, SUBJUDUL_HALAMAN,
  sBarisKartu, sBingkaiPengeluaran, sTabel, sTd, sTh,
} from '@/components/pengeluaran/BagianPengeluaran'
import { Blok, BlokTeks, KepalaHalaman, KerangkaHalaman, giliran } from './Blok'

// Kerangka halaman Pengeluaran (app/(dashboard)/laporan/pengeluaran) — tab Rincian,
// yang selalu tampil pertama. Ubah bersama halamannya.

const LEBAR_KETERANGAN = [150, 118, 176, 96, 138, 124] as const

export const SkeletonPengeluaran = () => (
  <KerangkaHalaman label="pengeluaran">
    <KepalaHalaman
      ikon={<BarChart2 size={30} color="#ffffff" />}
      judul={JUDUL_HALAMAN}
      subjudul={SUBJUDUL_HALAMAN}
      jarakBawah="1.75rem"
      kanan={<><Blok lebar={210} tinggi={38} sudut={8} /><Blok lebar={170} tinggi={38} sudut={8} /><Blok lebar={190} tinggi={38} sudut={8} /></>}
    />

    <div style={sBingkaiPengeluaran}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <PilihanTab aktif="rincian" />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Blok lebar={136} tinggi={33} sudut={8} />
          <Blok lebar={72} tinggi={33} sudut={8} />
          <Blok lebar={78} tinggi={33} sudut={8} />
        </div>
      </div>

      <div style={sBarisKartu}>
        <KartuKas label="Pemasukan SPP" Ikon={TrendingUp} warna="#16A34A" latar="#DCFCE7"
          nilai={<BlokTeks lebar={150} ukuran="1.45rem" tinggiBaris={1.2} />} keterangan={<BlokTeks lebar={190} ukuran="0.76rem" tinggiBaris={1.45} />} />
        <KartuKas label="Pengeluaran" Ikon={TrendingDown} warna="#DC2626" latar="#FEE2E2"
          nilai={<BlokTeks lebar={136} ukuran="1.45rem" tinggiBaris={1.2} />} keterangan={<BlokTeks lebar={120} ukuran="0.76rem" tinggiBaris={1.45} />} />
        <KartuKas label="Selisih" Ikon={Scale} warna="#1A2C4E" latar="#DCE9FF"
          nilai={<BlokTeks lebar={144} ukuran="1.45rem" tinggiBaris={1.2} />} keterangan={<BlokTeks lebar={170} ukuran="0.76rem" tinggiBaris={1.45} />} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={sTabel}>
          <thead>
            <tr>{KOLOM_RINCIAN.map((k, i) => <th key={k} style={{ ...sTh, textAlign: KOLOM_RINCIAN_KANAN.has(i) ? 'right' : 'left' }}>{k}</th>)}</tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                <td style={sTd}><BlokTeks lebar={14} ukuran="0.83rem" /></td>
                <td style={sTd}><BlokTeks lebar={giliran([88, 104, 76], i)} ukuran="0.83rem" /></td>
                <td style={sTd}><BlokTeks lebar={giliran(LEBAR_KETERANGAN, i)} ukuran="0.83rem" /></td>
                <td style={sTd}><BlokTeks lebar={44} ukuran="0.83rem" /></td>
                <td style={sTd}><BlokTeks lebar={50} ukuran="0.83rem" /></td>
                <td style={sTd}><BlokTeks lebar={70} ukuran="0.83rem" style={{ justifyContent: 'flex-end' }} /></td>
                <td style={sTd}><BlokTeks lebar={84} ukuran="0.83rem" style={{ justifyContent: 'flex-end' }} /></td>
                <td style={sTd}><Blok lebar={70} tinggi={22} sudut={6} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </KerangkaHalaman>
)
