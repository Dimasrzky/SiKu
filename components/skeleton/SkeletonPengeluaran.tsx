import Image from 'next/image'
import { FileText, TrendingDown, TrendingUp } from 'lucide-react'
import {
  JUDUL_HALAMAN, KOLOM_RIWAYAT, KartuKas, NAVY, PilihanTab, SUBJUDUL_HALAMAN,
  sBarisKartu, sBingkaiPengeluaran, sKartuPutih,
} from '@/components/pengeluaran/BagianPengeluaran'
import { Blok, BlokTeks, KepalaHalaman, KerangkaHalaman, LEBAR_FILTER_PERIODE, giliran } from './Blok'

// Kerangka halaman Pengeluaran (app/(dashboard)/laporan/pengeluaran) — tab Ringkasan Kas,
// yang selalu tampil pertama. Sekolah yang belum pernah mencatat pengeluaran melihat ajakan
// mencatat sesudahnya; kerangka memakai tampilan yang paling sering. Ubah bersama halamannya.

const LEBAR_KETERANGAN = [128, 104, 140, 96, 118, 132] as const
const WARNA_KOMPONEN   = ['#5C9BE4', '#C1AD69', '#AB69C1'] as const

export const SkeletonPengeluaran = () => (
  <KerangkaHalaman label="pengeluaran">
    <KepalaHalaman
      ikon={<Image src="/icons/Outcome.png" width={30} height={30} alt="" />}
      judul={JUDUL_HALAMAN}
      subjudul={SUBJUDUL_HALAMAN}
      jarakBawah="1.75rem"
      kanan={<><Blok lebar={LEBAR_FILTER_PERIODE} tinggi={40} sudut={9} /><Blok lebar={LEBAR_CATAT} tinggi={40} sudut={9} /></>}
    />

    <div style={sBingkaiPengeluaran}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <PilihanTab aktif="kas" />
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Blok lebar={62} tinggi={30} sudut={6} />
          <Blok lebar={70} tinggi={30} sudut={6} />
        </div>
      </div>

      <div style={sBarisKartu}>
        <KartuKas label="Pemasukan" Ikon={TrendingUp} warnaIkon={NAVY}
          nilai={<BlokTeks lebar={160} ukuran="1.5rem" tinggiBaris={1.25} />} keterangan={<BlokTeks lebar={176} ukuran="0.74rem" tinggiBaris={1.45} />} />
        <KartuKas label="Pengeluaran" Ikon={TrendingDown} warnaIkon="#E57373"
          nilai={<BlokTeks lebar={132} ukuran="1.5rem" tinggiBaris={1.25} />} keterangan={<BlokTeks lebar={120} ukuran="0.74rem" tinggiBaris={1.45} />} />
        <KartuKas label="Selisih" Ikon={FileText} warnaIkon={NAVY}
          nilai={<BlokTeks lebar={150} ukuran="1.5rem" tinggiBaris={1.25} />} keterangan={<BlokTeks lebar={186} ukuran="0.74rem" tinggiBaris={1.45} />} />
      </div>
    </div>

    <div className="pg-kas-grid" style={{ marginTop: '1.5rem' }}>
      <div style={{ ...sKartuPutih, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              {KOLOM_RIWAYAT.map(k => (
                <th key={k} style={{ padding: '0.85rem 1rem 0.7rem', textAlign: k === 'Jumlah' ? 'right' : 'left', fontSize: '0.84rem', fontWeight: 500, color: NAVY, borderBottom: '2px solid #E5E7EB' }}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                <td style={sSel}><BlokTeks lebar={40} ukuran="0.8rem" /></td>
                <td style={sSel}><BlokTeks lebar={giliran(LEBAR_KETERANGAN, i)} ukuran="0.8rem" /></td>
                <td style={sSel}><Blok lebar={giliran([34, 70, 52], i)} tinggi={17} sudut={20} /></td>
                <td style={sSel}><BlokTeks lebar={96} ukuran="0.8rem" style={{ justifyContent: 'flex-end' }} /></td>
                <td style={sSel}><Blok lebar={78} tinggi={19} sudut={20} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...sKartuPutih, overflow: 'hidden' }}>
        {WARNA_KOMPONEN.map((w, i) => (
          <div key={w} style={{ borderLeft: `5px solid ${w}`, borderBottom: '1px solid #E5E7EB', padding: '0.75rem 1rem 0.7rem 0.95rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <BlokTeks lebar={giliran([40, 70, 110], i)} ukuran="0.9rem" />
              <BlokTeks lebar={86} ukuran="1.05rem" />
            </div>
            <Blok tinggi={9} sudut={9} style={{ margin: '0.45rem 0 0.4rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <BlokTeks lebar={120} ukuran="0.68rem" />
              <BlokTeks lebar={62} ukuran="0.68rem" />
            </div>
          </div>
        ))}
        <div style={{ background: NAVY, padding: '1rem 1.15rem 0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontSize: '0.95rem', opacity: 0.92 }}>Total Saldo Kas</span>
            <BlokTeks lebar={110} ukuran="1.35rem" gelap />
          </div>
        </div>
      </div>
    </div>
  </KerangkaHalaman>
)

/** Tombol "Catat Pengeluaran" di kepala halaman, diukur di Chrome */
const LEBAR_CATAT = 182

const sSel: React.CSSProperties = { padding: '0.7rem 1rem', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' }
