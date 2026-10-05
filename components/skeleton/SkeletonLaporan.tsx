import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import {
  AlertTriangle, ArrowDown, ArrowUp, BarChart2, CalendarCheck, ChevronRight,
  GraduationCap, PieChart, Receipt, TrendingUp, TriangleAlert, Users, UsersRound,
} from 'lucide-react'
import { URUTAN_STATUS_SISWA } from '@/lib/metrikLaporan'
import { KartuTab } from '@/components/laporan/KartuTab'
import { LegendaBulan, URUTAN_LEGENDA } from '@/components/laporan/HeatmapSiswa'
import { STATUS_SISWA_UI } from '@/components/laporan/StatusSiswaBadge'
import {
  URUTAN_DONUT, sGarisBawah, sIsiMetrik, sJudulMetrik, sKartuMetrik, sKepalaMetrik, sKetMetrik,
} from '@/components/laporan/RingkasanUtama'
import {
  WARNA_LAPORAN as WARNA, sBarisKartu, sBingkai, sIkonKartu, sJudulKartu, sJudulPanel, sKartu, sKepalaKartu, sSubjudulPanel,
} from '@/components/laporan/gayaLaporan'
import { Blok, BlokDonat, BlokTeks, KepalaHalaman, KerangkaHalaman, LEBAR_NAMA, giliran } from './Blok'

// Kerangka halaman Laporan — utama, Jenjang, Kelas, dan Siswa. Masing-masing meniru
// page.tsx di app/(dashboard)/laporan; ubah bersama halamannya.

const sTengah: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center' }

/** Bagian jejak: teks = label asli, angka = lebar blok (nama kelas/siswa belum diketahui) */
type BagianJejak = string | number

const KepalaLaporan = ({ judul, subjudul, jejak = [], kanan }: { judul: ReactNode; subjudul: ReactNode; jejak?: BagianJejak[]; kanan?: ReactNode }) => (
  <KepalaHalaman ikon={<BarChart2 size={30} color="#ffffff" />} judul={judul} subjudul={subjudul} jarakBawah="1.75rem"
    jejak={jejak.length > 0 && jejak.map((b, i) => (
      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        {i > 0 && <ChevronRight size={13} color="#94A3B8" />}
        {typeof b === 'number'
          ? <BlokTeks lebar={b} ukuran="0.82rem" />
          : <span style={i === jejak.length - 1 ? { color: '#0F172A', fontWeight: 700 } : { color: '#3C75B7', fontWeight: 600 }}>{b}</span>}
      </span>
    ))}
    kanan={kanan ?? <><Blok lebar={200} tinggi={42} sudut={8} /><Blok lebar={180} tinggi={42} sudut={8} /></>} />
)

/** Subjudul level Jenjang/Kelas/Siswa berisi label filter periode — belum diketahui */
const SubjudulFilter = () => <BlokTeks lebar={240} ukuran="1rem" />

// ── Grafik tren (Laporan utama & Jenjang) ────────────────────────────────────

/** Tinggi batang per bulan, dalam persen tinggi area plot */
const TINGGI_TREN = [58, 64, 52, 70, 66, 74, 60, 68, 72, 56, 62, 40] as const

/** Legenda + tombol "Lihat tabel" di kepala grafik tren */
const KepalaTren = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem 1.1rem', flexWrap: 'wrap' }}>
    {[{ warna: WARNA.hijau, label: 'Terbayar' }, { warna: WARNA.kuning, label: 'Tagihan' }].map(l => (
      <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: WARNA.abuMuda }}>
        <span style={{ width: 11, height: 11, borderRadius: 2, background: l.warna }} />
        {l.label}
      </span>
    ))}
    {/* Tombol aslinya setinggi ±25,6 px: ikon di dalam inline-flex menggeser garis dasarnya */}
    <BlokTeks lebar={86} ukuran="0.85rem" tinggiBaris={1.88} />
  </div>
)

/** Ukuran sama dengan TrenTagihanChart: tinggi 220, plot y 20–175, batang mulai x 83 */
const GrafikTren = () => (
  <div style={{ position: 'relative', height: 220 }}>
    {[0, 0.5, 1].map(t => {
      const y = 175 - 155 * t
      return (
        <div key={t}>
          <Blok lebar={20} tinggi={8} sudut={3} style={{ position: 'absolute', left: 6, top: y - 4 }} />
          <div style={{ position: 'absolute', left: 52, right: 4, top: y, height: 1, background: '#E5E7EB' }} />
        </div>
      )
    })}
    <div style={{ position: 'absolute', left: 83, right: 10, top: 20, height: 155, display: 'flex', alignItems: 'flex-end' }}>
      {TINGGI_TREN.map((h, i) => (
        <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <Blok lebar="55%" tinggi={`${h}%`} sudut="3px 3px 0 0" style={{ maxWidth: 36 }} />
        </div>
      ))}
    </div>
    <div style={{ position: 'absolute', left: 83, right: 10, top: 190, display: 'flex' }}>
      {TINGGI_TREN.map((_, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Blok lebar={20} tinggi={9} sudut={3} />
          <Blok lebar={24} tinggi={8} sudut={3} />
        </div>
      ))}
    </div>
  </div>
)

// ── Laporan utama ────────────────────────────────────────────────────────────

/** Urutan tampil di kartu Umur tunggakan: terlama di atas (lib/metrikLaporan BATAS_UMUR, dibalik) */
const UMUR_TUNGGAKAN = ['> 90 hari', '61–90 hari', '31–60 hari', '1–30 hari'] as const

const DAFTAR_LAPORAN = [
  { Ikon: Receipt,       judul: 'Laporan transaksi',        sub: 'Rekap seluruh transaksi pembayaran periode ini' },
  { Ikon: AlertTriangle, judul: 'Laporan tunggakan',        sub: 'Daftar siswa yang masih memiliki tunggakan' },
  { Ikon: Users,         judul: 'Laporan data siswa aktif', sub: 'Data lengkap seluruh siswa yang aktif saat ini' },
  { Ikon: GraduationCap, judul: 'Laporan alumni',           sub: 'Data alumni per angkatan beserta status pelunasan' },
  { Ikon: BarChart2,     judul: 'Laporan keuangan tahunan', sub: 'Rekap pemasukan keseluruhan per tahun ajaran, siap audit' },
] as const

const BarisRincian = ({ warna, label }: { warna: string; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
    <span style={{ ...sKetMetrik, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: warna, flexShrink: 0 }} />
      {label}
    </span>
    <BlokTeks lebar={70} ukuran="1rem" tinggiBaris={1.4} />
  </div>
)

export const SkeletonLaporan = () => (
  <KerangkaHalaman label="Laporan">
    <KepalaLaporan judul="Laporan" subjudul="Analisis keuangan dan unduhan laporan per periode"
      kanan={<><Blok lebar={200} tinggi={42} sudut={8} /><Blok lebar={180} tinggi={42} sudut={8} /><Blok lebar={232} tinggi={39} sudut={8} /></>} />

    <div className="laporan-utama" style={{ ...sBingkai, padding: '1.5rem 1.875rem 2.5rem', gap: '1.75rem', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 70, height: 46, background: WARNA.navy, borderRadius: 10, flexShrink: 0, boxShadow: '0 3px 6px rgba(26, 44, 78, 0.3)', ...sTengah }}>
            <Image src="/icons/Grafik.png" alt="" width={22} height={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.2, color: WARNA.navy }}>Ringkasan periode ini</h2>
            <div style={{ fontSize: '0.875rem', color: WARNA.abu }}>Analisis status dan kondisi pembayaran berdasarkan periode yang dipilih</div>
          </div>
        </div>
        <Blok lebar={475} tinggi={43} sudut={8} style={{ maxWidth: '100%' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', padding: '0 0.875rem' }}>
        {/* Baris 1: kartu metrik */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
          <div style={sKartuMetrik}>
            <div style={sKepalaMetrik}>
              <span style={sJudulMetrik}>Total pemasukan</span>
              <TrendingUp size={26} color={WARNA.navy} strokeWidth={2.25} aria-hidden />
            </div>
            <div style={sIsiMetrik}>
              <div style={sGarisBawah}><BlokTeks lebar={190} ukuran="1.9rem" tinggiBaris={1.15} /></div>
              <BlokTeks lebar={130} ukuran="1rem" tinggiBaris={1.4} style={{ marginTop: '0.85rem' }} />
            </div>
          </div>
          <div style={sKartuMetrik}>
            <div style={sKepalaMetrik}>
              <span style={sJudulMetrik}>Tingkat pelunasan</span>
              <Image src="/icons/Pie.png" alt="" width={24} height={24} />
            </div>
            <div style={sIsiMetrik}>
              <BlokTeks lebar={90} ukuran="1.9rem" tinggiBaris={1.15} />
              <BlokTeks lebar={150} ukuran="1rem" tinggiBaris={1.4} style={{ justifyContent: 'flex-end', marginTop: '-0.25rem' }} />
            </div>
            <Blok tinggi={14} sudut={99} style={{ marginTop: '0.5rem' }} />
          </div>
          <div style={sKartuMetrik}>
            <div style={sKepalaMetrik}>
              <span style={sJudulMetrik}>Total tunggakan</span>
              <TriangleAlert size={26} color={WARNA.navy} strokeWidth={2} aria-hidden />
            </div>
            <div style={sIsiMetrik}>
              <div style={sGarisBawah}><BlokTeks lebar={190} ukuran="1.9rem" tinggiBaris={1.15} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.85rem' }}>
                <BarisRincian warna={WARNA.hijau} label="Belum jatuh tempo" />
                <BarisRincian warna={WARNA.merah} label="Menunggak" />
              </div>
            </div>
          </div>
        </div>

        {/* Baris 2: komposisi status + tagihan vs realisasi */}
        <div className="laporan-baris-dua">
          <KartuTab judul="Komposisi status pembayaran">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem 2rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {/* Donat asli: 124 px, r 52, tebal 16 */}
              <BlokDonat lebar={124} dalam={71} luar={96.8} />
              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                {URUTAN_DONUT.map((d, i) => (
                  <div key={d.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.65rem 0', borderTop: i > 0 ? `1px solid ${WARNA.garis}` : 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: WARNA.abuMuda }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.warna, flexShrink: 0 }} />
                      {d.label}
                    </span>
                    <BlokTeks lebar={22} ukuran="0.85rem" />
                  </div>
                ))}
              </div>
            </div>
          </KartuTab>
          <KartuTab judul="Tagihan vs realisasi" aksi={<KepalaTren />}>
            <GrafikTren />
          </KartuTab>
        </div>

        {/* Baris 3: komponen paling banyak belum dibayar */}
        <KartuTab judul="Komponen paling banyak belum dibayar">
          <div>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.65rem 0', borderTop: i > 0 ? `1px solid ${WARNA.garisTegas}` : 'none' }}>
                <Blok lebar={30} tinggi={30} sudut={5} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <BlokTeks lebar={giliran([110, 140, 92, 124], i)} ukuran="1rem" tinggiBaris={1.25} />
                  <BlokTeks lebar={giliran([136, 124, 146, 116], i)} ukuran="0.9rem" tinggiBaris={1.25} />
                </div>
                <BlokTeks lebar={80} ukuran="1rem" />
              </div>
            ))}
          </div>
        </KartuTab>

        {/* Baris 4: umur tunggakan + pembayaran per jenjang */}
        <div className="laporan-baris-empat">
          <KartuTab judul="Umur tunggakan">
            <div style={{ padding: '0 0 0.85rem 0.6rem', borderBottom: `1px solid ${WARNA.garisTegas}` }}>
              <BlokTeks lebar={150} ukuran="1.55rem" tinggiBaris={1.2} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.85rem', color: WARNA.abu }}>
                <UsersRound size={15} aria-hidden /> <BlokTeks lebar={60} ukuran="0.85rem" />
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.4rem' }}>
              {UMUR_TUNGGAKAN.map(label => (
                <div key={label}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 500, color: WARNA.navy }}>{label}</span>
                    <BlokTeks lebar={110} ukuran="0.85rem" />
                  </div>
                  <Blok tinggi={14} sudut={99} />
                </div>
              ))}
            </div>
            {/* Tampil di halaman asli bila ada siswa berstatus Tertunggak — yang umum terjadi */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '2px', paddingTop: '1.4rem', fontSize: '1.1rem', color: WARNA.merah }}>
              <TriangleAlert size={18} aria-hidden />
              <Blok lebar={22} tinggi={14} sudut={4} />
              Siswa butuh tindakan segera
            </div>
          </KartuTab>
          <KartuTab judul="Pembayaran per jenjang">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginTop: '0.5rem' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ padding: '0.5rem 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <BlokTeks lebar={84} ukuran="0.9rem" />
                    <BlokTeks lebar={giliran([120, 104, 132], i)} ukuran="0.9rem" />
                  </div>
                  <Blok tinggi={14} sudut={99} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.4rem', color: WARNA.abuMuda }}>
                    <UsersRound size={18} aria-hidden /> <BlokTeks lebar={150} ukuran="0.9rem" />
                  </span>
                </div>
              ))}
            </div>
            {/* Tampil di halaman asli bila jenjang terbaik dan terendah berbeda */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '1rem' }}>
              {['Jenjang terbaik', 'Perlu perhatian'].map(judul => (
                <div key={judul} style={{ flex: '1 1 150px', border: `1px solid ${WARNA.garis}`, borderRadius: 8, boxShadow: '0 1px 4px rgba(26, 44, 78, 0.12)', padding: '0.6rem 0.8rem' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 500, color: WARNA.navy }}>{judul}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: 4 }}>
                    <BlokTeks lebar={96} ukuran="1.25rem" />
                    <BlokTeks lebar={52} ukuran="1.3rem" />
                  </div>
                </div>
              ))}
            </div>
          </KartuTab>
        </div>
      </div>
    </div>

    {/* ── Daftar laporan ── */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem', marginTop: '1.3rem' }}>
      {DAFTAR_LAPORAN.map(({ Ikon, judul, sub }) => (
        <div key={judul} style={{ background: '#fff', borderRadius: 14, padding: '1rem 1.25rem', boxShadow: '0 0 10px rgba(39, 74, 156, 0.51)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 55, height: 55, background: '#1A2C4E', borderRadius: 12, flexShrink: 0, ...sTengah }}>
            <Ikon size={22} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{judul}</div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{sub}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <Blok lebar={70} tinggi={39} sudut={8} />
            <Blok lebar={80} tinggi={35} sudut={8} />
          </div>
        </div>
      ))}
    </div>
  </KerangkaHalaman>
)

// ── Kartu ringkasan level Jenjang, Kelas, dan Siswa (KartuRingkasan) ────────

const BarisKecil = ({ warna, label, lebar }: { warna: string; label: string; lebar: number }) => (
  <div style={sBarisKartu}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: warna, flexShrink: 0 }} />
      <span style={{ fontSize: '0.76rem', color: '#64748B' }}>{label}</span>
    </div>
    <BlokTeks lebar={lebar} ukuran="0.76rem" />
  </div>
)

const KartuRingkasanKerangka = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem', marginBottom: '0.9rem' }}>
    <div style={sKartu}>
      <div style={sKepalaKartu}>
        <span style={sJudulKartu}>Total pemasukan</span>
        <div style={{ ...sIkonKartu, background: '#F0FDF4' }}><TrendingUp size={16} color="#22C55E" /></div>
      </div>
      <BlokTeks lebar={150} ukuran="1.5rem" tinggiBaris={1.15} style={{ marginBottom: '0.35rem' }} />
      <BlokTeks lebar={110} ukuran="0.76rem" tinggiBaris={1.45} />
    </div>
    <div style={sKartu}>
      <div style={sKepalaKartu}>
        <span style={sJudulKartu}>Tingkat pelunasan</span>
        <div style={{ ...sIkonKartu, background: '#EFF6FF' }}><PieChart size={16} color="#3B82F6" /></div>
      </div>
      <BlokTeks lebar={70} ukuran="1.5rem" tinggiBaris={1.15} style={{ marginBottom: '0.35rem' }} />
      <Blok tinggi={12} sudut={99} style={{ margin: '0.4rem 0 0.5rem' }} />
      <BlokTeks lebar="88%" ukuran="0.76rem" tinggiBaris={1.45} />
      <BlokTeks lebar="56%" ukuran="0.76rem" tinggiBaris={1.45} />
    </div>
    <div style={sKartu}>
      <div style={sKepalaKartu}>
        <span style={sJudulKartu}>Ketepatan waktu</span>
        <div style={{ ...sIkonKartu, background: '#EEF2FF' }}><CalendarCheck size={16} color="#4F46E5" /></div>
      </div>
      <BlokTeks lebar={70} ukuran="1.5rem" tinggiBaris={1.15} style={{ marginBottom: '0.35rem' }} />
      <BlokTeks lebar="84%" ukuran="0.76rem" tinggiBaris={1.45} style={{ marginBottom: '0.6rem' }} />
      <div style={sBarisKartu}>
        <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Rata-rata telat</span>
        <BlokTeks lebar={96} ukuran="0.76rem" />
      </div>
    </div>
    <div style={sKartu}>
      <div style={sKepalaKartu}>
        <span style={sJudulKartu}>Tunggakan</span>
        <div style={{ ...sIkonKartu, background: '#FEF2F2' }}><AlertTriangle size={16} color="#EF4444" /></div>
      </div>
      <BlokTeks lebar={140} ukuran="1.5rem" tinggiBaris={1.15} style={{ marginBottom: '0.75rem' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <BarisKecil warna="#EF4444" label="Siswa menunggak" lebar={56} />
        <BarisKecil warna="#22C55E" label="Akan masuk" lebar={90} />
      </div>
    </div>
  </div>
)

/** Kepala tabel laporan (tanpa latar): label kolom asli, kolom urutan aktif bertanda panah */
const KepalaTabelLaporan = ({ kolom }: { kolom: readonly { label: string; kanan?: boolean; urut?: 'naik' | 'turun' }[] }) => (
  <thead>
    <tr>
      {kolom.map(k => (
        <th key={k.label} style={{ textAlign: k.kanan ? 'right' : 'left', padding: '0.5rem 0.6rem', borderBottom: '1.5px solid #E2E8F0', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', fontWeight: 700, color: k.urut ? '#1A2C4E' : '#64748B' }}>
            {k.label}
            {k.urut === 'naik' && <ArrowUp size={12} />}
            {k.urut === 'turun' && <ArrowDown size={12} />}
          </span>
        </th>
      ))}
    </tr>
  </thead>
)

const sTdLaporan: CSSProperties = { padding: '0.65rem 0.6rem' }
const sKanan: CSSProperties = { justifyContent: 'flex-end' }

/** Nilai berjudul + keterangan kecil di bawahnya, rata kanan */
const NilaiDuaBaris = ({ lebar, lebarKet }: { lebar: number; lebarKet: number }) => (
  <>
    <BlokTeks lebar={lebar} ukuran="0.82rem" style={sKanan} />
    <BlokTeks lebar={lebarKet} ukuran="0.7rem" style={sKanan} />
  </>
)

// ── Laporan Jenjang ──────────────────────────────────────────────────────────

const KOLOM_JENJANG = [
  { label: 'Kelas' },
  { label: 'Siswa',           kanan: true },
  { label: 'Pelunasan',       kanan: true },
  { label: 'Tepat waktu',     kanan: true },
  { label: 'Rata-rata telat', kanan: true },
  { label: 'Tunggakan',       kanan: true, urut: 'turun' },
  { label: 'Siswa menunggak', kanan: true },
] as const

export const SkeletonLaporanJenjang = ({ jenjang }: { jenjang: string }) => (
  <KerangkaHalaman label={`laporan Jenjang ${jenjang}`}>
    <KepalaLaporan judul={`Jenjang ${jenjang}`} subjudul={<SubjudulFilter />} jejak={['Laporan', `Jenjang ${jenjang}`]} />

    <div style={sBingkai}>
      <KartuRingkasanKerangka />

      <div style={sKartu}>
        <div style={sJudulPanel}>Perbandingan kelas</div>
        <div style={sSubjudulPanel}>Klik judul kolom untuk mengurutkan · klik kelas untuk melihat siswanya</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 720 }}>
            <KepalaTabelLaporan kolom={KOLOM_JENJANG} />
            <tbody>
              {[0, 1, 2].map(i => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={sTdLaporan}><BlokTeks lebar={giliran([56, 64, 50], i)} ukuran="0.82rem" /></td>
                  <td style={sTdLaporan}><BlokTeks lebar={22} ukuran="0.82rem" style={sKanan} /></td>
                  <td style={sTdLaporan}><NilaiDuaBaris lebar={40} lebarKet={96} /></td>
                  <td style={sTdLaporan}><NilaiDuaBaris lebar={40} lebarKet={86} /></td>
                  <td style={sTdLaporan}><BlokTeks lebar={46} ukuran="0.82rem" style={sKanan} /></td>
                  <td style={sTdLaporan}><BlokTeks lebar={giliran([96, 84, 104], i)} ukuran="0.82rem" style={sKanan} /></td>
                  <td style={sTdLaporan}><BlokTeks lebar={44} ukuran="0.82rem" style={sKanan} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...sKartu, marginBottom: '1rem' }}>
        <div style={sJudulPanel}>Tagihan vs realisasi jenjang {jenjang.toLowerCase()}</div>
        <div style={{ ...sSubjudulPanel, marginBottom: '0.75rem' }}>
          Per bulan jatuh tempo, termasuk tunggakan bulan sebelumnya · 12 bulan terakhir · tidak mengikuti filter periode
        </div>
        <div style={{ marginBottom: '0.75rem' }}><KepalaTren /></div>
        <GrafikTren />
      </div>
    </div>
  </KerangkaHalaman>
)

// ── Laporan Kelas ────────────────────────────────────────────────────────────

const KOLOM_KELAS = [
  { label: 'Siswa' },
  { label: 'Status',          urut: 'naik' },
  { label: 'Tepat waktu',     kanan: true },
  { label: 'Rata-rata telat', kanan: true },
  { label: 'Tunggakan',       kanan: true },
  { label: 'Pengingat',       kanan: true },
] as const

const SEL_HEATMAP = 30

export const SkeletonLaporanKelas = () => (
  <KerangkaHalaman label="laporan kelas">
    <KepalaLaporan judul={<BlokTeks lebar={150} ukuran="1.8rem" tinggiBaris={1.2} />} subjudul={<SubjudulFilter />} jejak={['Laporan', 74, 56]} />

    <div style={sBingkai}>
      <KartuRingkasanKerangka />

      <div style={sKartu}>
        <div style={sJudulPanel}>Status siswa</div>
        <div style={sSubjudulPanel}>
          Tertunggak: ≥2 tagihan menunggak atau tunggakan &gt;60 hari · Lancar: tepat waktu ≥90% tanpa tunggakan · klik untuk menyaring
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
          {URUTAN_STATUS_SISWA.map(st => {
            const ui = STATUS_SISWA_UI[st]
            return (
              <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0.75rem 0.9rem' }}>
                <span style={{ width: 34, height: 34, borderRadius: 8, background: ui.bg, color: ui.color, flexShrink: 0, ...sTengah }}>
                  <ui.Ikon size={18} />
                </span>
                <span>
                  <BlokTeks lebar={84} ukuran="1.2rem" tinggiBaris={1.1} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: ui.color }}>{ui.label}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={sKartu}>
        <div style={sJudulPanel}>Pola bayar per bulan</div>
        <BlokTeks lebar={200} ukuran="0.75rem" style={{ marginBottom: '1rem' }} />
        <LegendaBulan kategori={URUTAN_LEGENDA} />
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `minmax(150px, 200px) repeat(12, ${SEL_HEATMAP}px)`, gap: 2, alignItems: 'center', width: 'max-content' }}>
            <div />
            {Array.from({ length: 12 }, (_, m) => (
              <div key={m} style={{ display: 'flex', justifyContent: 'center', paddingBottom: 4 }}>
                <Blok lebar={18} tinggi={9} sudut={3} />
              </div>
            ))}
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <div style={{ paddingRight: 8 }}><BlokTeks lebar={giliran(LEBAR_NAMA, i)} ukuran="0.78rem" /></div>
                {Array.from({ length: 12 }, (_, m) => <Blok key={m} lebar={SEL_HEATMAP} tinggi={26} sudut={4} />)}
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#94A3B8', minHeight: '1.2em' }}>
          Arahkan kursor ke sebuah sel untuk melihat rinciannya.
        </div>
      </div>

      <div style={{ ...sKartu, marginBottom: '1rem' }}>
        <div style={sJudulPanel}>Daftar siswa</div>
        <div style={sSubjudulPanel}>Klik nama untuk profil siswa · pengingat WA merangkum semua tunggakan siswa, termasuk dari tahun ajaran lain</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 760 }}>
            <KepalaTabelLaporan kolom={KOLOM_KELAS} />
            <tbody>
              {Array.from({ length: 5 }, (_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={sTdLaporan}>
                    <BlokTeks lebar={giliran(LEBAR_NAMA, i + 4)} ukuran="0.82rem" />
                    <BlokTeks lebar={70} ukuran="0.7rem" />
                  </td>
                  <td style={sTdLaporan}><Blok lebar={giliran([96, 76, 110], i)} tinggi={22} sudut={20} /></td>
                  <td style={sTdLaporan}><NilaiDuaBaris lebar={40} lebarKet={60} /></td>
                  <td style={sTdLaporan}><BlokTeks lebar={46} ukuran="0.82rem" style={sKanan} /></td>
                  <td style={sTdLaporan}><NilaiDuaBaris lebar={giliran([92, 80], i)} lebarKet={120} /></td>
                  <td style={sTdLaporan}><Blok lebar={84} tinggi={26} sudut={8} style={{ marginLeft: 'auto' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </KerangkaHalaman>
)

// ── Laporan Siswa ────────────────────────────────────────────────────────────

const BARIS_TIMELINE = [
  { label: 'Kelas' },
  { label: 'Status', status: true },
  { label: null },
  { label: null },
  { label: 'Total tagihan', garis: true },
  { label: 'Terbayar' },
] as const

export const SkeletonLaporanSiswa = () => (
  <KerangkaHalaman label="laporan siswa">
    <KepalaLaporan judul={<BlokTeks lebar={220} ukuran="1.8rem" tinggiBaris={1.2} />} subjudul={<BlokTeks lebar={200} ukuran="1rem" />} jejak={['Laporan', 74, 56, 120]} />

    <div style={sBingkai}>
      {/* Status + pengingat */}
      <div style={{ ...sKartu, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap', minWidth: 0 }}>
          <Blok lebar={96} tinggi={24} sudut={20} />
          <BlokTeks lebar={280} ukuran="0.85rem" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BlokTeks lebar={200} ukuran="0.8rem" />
          <Blok lebar={180} tinggi={34} sudut={8} />
        </div>
      </div>

      <KartuRingkasanKerangka />

      {/* Timeline 12 bulan */}
      <div style={sKartu}>
        <div style={sJudulPanel}>Timeline 12 bulan</div>
        <div style={sSubjudulPanel}>
          12 bulan terakhir · status dinilai per tagihan bulanan, karena pembayaran tidak dicatat per komponen · baris komponen berisi nominal yang ditagihkan
        </div>
        <LegendaBulan kategori={URUTAN_LEGENDA} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: '0.75rem' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 130 }} />
                {Array.from({ length: 12 }, (_, m) => (
                  <th key={m} style={{ minWidth: 54, paddingBottom: 4 }}>
                    <Blok lebar={22} tinggi={9} sudut={3} style={{ margin: '0 auto' }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BARIS_TIMELINE.map((b, i) => (
                <tr key={i}>
                  <th scope="row" style={{ textAlign: 'left', color: b.label === 'Kelas' ? '#64748B' : '#0F172A', fontWeight: b.label === 'Kelas' ? 600 : 700, paddingRight: '0.75rem', whiteSpace: 'nowrap', borderTop: 'garis' in b ? '1px solid #E2E8F0' : undefined }}>
                    {b.label ?? <BlokTeks lebar={giliran([70, 90], i)} ukuran="0.75rem" />}
                  </th>
                  {Array.from({ length: 12 }, (_, m) => (
                    <td key={m} style={{ borderTop: 'garis' in b ? '1px solid #E2E8F0' : undefined }}>
                      {'status' in b
                        ? <Blok tinggi={26} sudut={4} />
                        : <Blok lebar={giliran([30, 26, 34], m + i)} tinggi={9} sudut={3} style={{ margin: '0 auto' }} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Riwayat transaksi + catatan tindak lanjut */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '1rem' }}>
        <div style={sKartu}>
          <div style={sJudulPanel}>Riwayat transaksi</div>
          <div style={sSubjudulPanel}>Semua pembayaran siswa ini, terbaru dulu · tidak mengikuti filter</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.9rem' }}>
            <Blok lebar={150} tinggi={22} sudut={20} />
            <Blok lebar={130} tinggi={22} sudut={20} />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ color: '#64748B', textAlign: 'left' }}>
                <th style={{ padding: '0.4rem 0.5rem 0.4rem 0', fontWeight: 600 }}>Tanggal</th>
                <th style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Untuk</th>
                <th style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Metode</th>
                <th style={{ padding: '0.4rem 0', fontWeight: 600, textAlign: 'right' }}>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map(i => (
                <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.45rem 0.5rem 0.45rem 0' }}><BlokTeks lebar={110} ukuran="0.8rem" /></td>
                  <td style={{ padding: '0.45rem 0.5rem' }}><BlokTeks lebar={giliran([84, 72, 92], i)} ukuran="0.8rem" /></td>
                  <td style={{ padding: '0.45rem 0.5rem' }}><BlokTeks lebar={60} ukuran="0.8rem" /></td>
                  <td style={{ padding: '0.45rem 0' }}><BlokTeks lebar={giliran([84, 96, 76], i)} ukuran="0.8rem" style={sKanan} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={sKartu}>
          <div style={sJudulPanel}>Catatan tindak lanjut</div>
          <div style={sSubjudulPanel}>Alasan singkat keterlambatan · hanya terlihat oleh pengguna sekolah ini · tidak ikut ekspor</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <Blok tinggi={36} sudut={8} />
            <Blok tinggi={76} sudut={8} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <BlokTeks lebar={40} ukuran="0.7rem" />
              <Blok lebar={124} tinggi={32} sudut={8} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[0, 1].map(i => (
              <div key={i} style={{ border: '1px solid #EEF2F6', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <Blok lebar={giliran([90, 120], i)} tinggi={20} sudut={20} />
                  <BlokTeks lebar={110} ukuran="0.7rem" />
                </div>
                <BlokTeks lebar={giliran(['80%', '64%'], i)} ukuran="0.8rem" tinggiBaris={1.5} style={{ marginTop: '0.4rem' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </KerangkaHalaman>
)
