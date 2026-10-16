import type { CSSProperties } from 'react'
import Image from 'next/image'
import { AlertTriangle, BookOpen, Calendar, Clock, Users } from 'lucide-react'
import { StatCard } from '@/components/StatCard'
import { FinanceCard } from '@/components/FinanceCard'
import { ChartCard } from '@/components/ChartCard'
import { Blok, BlokDonat, BlokTeks, KerangkaHalaman, LEBAR_NAMA, giliran } from './Blok'

// Kerangka Dashboard — meniru app/(dashboard)/dashboard/page.tsx: bar sambutan, kartu
// Total Tunggakan, stat card + Target Pembayaran, kartu keuangan, tiga grafik, insight,
// dan tabel status pembayaran. Ubah bersama halamannya.

/** Tinggi batang terkumpul dan tunggakan per bulan, dalam persen tinggi grafik */
const TINGGI_BATANG = [[56, 30], [68, 24], [60, 36], [78, 22], [70, 30], [42, 46]] as const
const TAB_TABEL     = ['Semua', 'Belum Bayar', 'Cicilan', 'Lunas', 'Menunggu Verifikasi'] as const
const KOLOM_TABEL   = ['No', 'NIS', 'Nama', 'Kelas', 'Tagihan Bulan Ini', 'Status', 'Aksi'] as const
const sSel: CSSProperties = { padding: '0.875rem 1.25rem' }

export const SkeletonDashboard = ({ nama, keterangan, tanggal, periode }: {
  /** Diisi halaman Dashboard (data login sudah terbaca); kosong saat dirender layout */
  nama?:       string
  /** "Bendahara – Sekolah" */
  keterangan?: string
  tanggal?:    string
  /** "Oktober 2026" untuk judul Target Pembayaran */
  periode?:    string
}) => (
  <KerangkaHalaman label="Dashboard">

    {/* ── Bar sambutan ── */}
    <div style={{ background: '#1A2C4E', borderRadius: '0 0 16px 16px', padding: '1.25rem 1.75rem', margin: '-1.5rem 0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', boxShadow: '0 2px 8px rgba(26, 44, 78, 0.7)' }}>
      <div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2, ...(nama ? {} : { display: 'flex', alignItems: 'center', gap: 6 }) }}>
          {nama ? `Selamat Datang, ${nama}` : <>Selamat Datang, <Blok gelap lebar={160} tinggi="0.95rem" sudut={4} /></>}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', flexShrink: 0, boxShadow: '0 0 6px #22C55E' }} />
          {keterangan
            ? <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>{keterangan}</span>
            : <BlokTeks gelap lebar={210} ukuran="0.8rem" />}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {tanggal ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#A3CDFE', border: '1px solid #A3CDFE', color: '#1A2C4E', borderRadius: 10, padding: '0.45rem 0.85rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <Calendar size={13} />{tanggal}
          </div>
        ) : (
          <Blok gelap lebar={140} tinggi={37} sudut={10} />
        )}
        <Blok gelap lebar={145} tinggi={37} sudut={10} />
        <Blok gelap lebar={118} tinggi={39} sudut={10} />
      </div>
    </div>

    {/* ── Kartu Total Tunggakan ── */}
    <div style={{ marginTop: '2rem', background: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: '1rem', boxShadow: '0 4px 9px rgba(45, 92, 145, 0.52)' }}>
      <div style={{ display: 'flex', padding: '1.5rem', gap: '1.25rem', position: 'relative' }}>
        <AlertTriangle size={130} className="watermark-float" style={{ position: 'absolute', right: 400, top: '50%', color: '#ef93936c', pointerEvents: 'none' }} />

        <div style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: '#1A2C4E', color: '#ffffff', padding: '6px 12px', borderRadius: 20, fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.03em', marginBottom: '0.65rem', boxShadow: '0 6px 10px rgba(92, 135, 184, 0.67)' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5A5A', animation: 'dot-pulse-glow 1.6s ease-in-out infinite' }} />
            Total Tunggakan Aktif
          </div>
          <div style={{ marginBottom: '0.6rem', borderBottom: '5px solid #1A2C4E', paddingBottom: '0.25rem', display: 'inline-block' }}>
            <BlokTeks lebar={320} ukuran="3rem" tinggiBaris={1.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', position: 'relative', top: 8, color: '#1A2C4E' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Users size={16} /><BlokTeks lebar={170} ukuran="1rem" /></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={16} /><BlokTeks lebar={150} ukuran="1rem" /></span>
          </div>
        </div>

        <div style={{ background: '#1A2C4E', borderRadius: 12, minWidth: 138, textAlign: 'center', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, boxShadow: '0 6px 10px rgba(92, 135, 184, 0.67)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F7DD7D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, position: 'relative', bottom: 13, marginLeft: '7rem' }}>
            <Image src="/icons/IconDollar.png" alt="" width={20} height={20} />
          </div>
          <BlokTeks gelap lebar={84} ukuran="2.4rem" style={{ marginTop: '-1.7rem', marginLeft: '-1.5rem' }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#6F788A' }}>Siswa sudah bayar</div>
          <BlokTeks gelap lebar={104} ukuran="0.9rem" style={{ marginLeft: '-0.2rem' }} />
        </div>
      </div>

      <div style={{ background: '#DE6666', padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#fff' }}>
          <AlertTriangle size={16} />
          <BlokTeks gelap lebar={230} ukuran="1rem" />
        </div>
        <BlokTeks gelap lebar={170} ukuran="1rem" />
      </div>
    </div>

    {/* ── Stat card + Target Pembayaran ── */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 230px) 1fr', gap: '1.2rem', marginBottom: '1.3rem', marginTop: '2rem' }}>
      <StatCard title="Total siswa aktif" value={<BlokTeks lebar={80} ukuran="2.5rem" tinggiBaris={1} />} icon={Users} />
      <StatCard title="Kelas aktif" value={<BlokTeks lebar={50} ukuran="2.5rem" tinggiBaris={1} />} icon={BookOpen} />
      <StatCard title="Tahun ajaran aktif" value={<BlokTeks lebar={120} ukuran="2.2rem" tinggiBaris={1} />} icon={Calendar}
        valueStyle={{ marginLeft: '-1.8rem', marginTop: '0.2rem', fontSize: '2.2rem' }} />

      <div style={{ background: '#fff', borderRadius: 13, padding: '0.6rem 1.25rem', boxShadow: '0 4px 8px rgba(92, 135, 184, 0.67)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1A2C4E', letterSpacing: '0.05em', display: 'flex', alignItems: 'center' }}>
            <Image src="/icons/IconTarget.png" alt="" width={30} height={16} style={{ marginRight: 8 }} />
            {/* Satu teks sebaris, supaya terlipat di tempat yang sama dengan judul aslinya */}
            {periode
              ? `Target Pembayaran – ${periode}`
              : <span>Target Pembayaran – <Blok lebar={110} tinggi={12} sudut={4} style={{ display: 'inline-block', verticalAlign: 'middle' }} /></span>}
          </div>
        </div>
        {/* flex seperti aslinya: div kosong biasa akan meleburkan margin 6 px ini */}
        <div style={{ display: 'flex', marginBottom: 6 }} />
        <Blok tinggi={20} sudut={6} style={{ marginBottom: 5 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <BlokTeks lebar={140} ukuran="0.9rem" />
          <BlokTeks lebar={70} ukuran="0.9rem" />
        </div>
      </div>
    </div>

    {/* ── Kartu keuangan ── */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
      {/* Lebar blok info seperti teks aslinya — di layar 1366 px info "x% siswa sudah
          lunas" membuat judul kartu pertama terlipat dua baris */}
      {([
        { title: 'Terkumpul bulan ini', warna: '#69C183', info: 150 },
        { title: 'Belum dibayar',       warna: '#DE6666', info: 160 },
        { title: 'Total beasiswa',      warna: '#BB8848', info: 100, sub: 'dari total tagihan' },
      ]).map(k => (
        <FinanceCard key={k.title} memuat title={k.title} valueColor={k.warna} progress={0} progressColor={k.warna}
          value={<BlokTeks lebar={150} ukuran="2rem" tinggiBaris={1} />}
          info={<BlokTeks lebar={k.info} ukuran="0.7rem" />}
          progressLabel={<BlokTeks lebar={30} ukuran="0.7rem" />}
          progressSub={k.sub} />
      ))}
    </div>

    {/* ── Grafik ── */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 'minmax(300px, auto)', gap: '1rem', marginBottom: '1rem' }}>
      <ChartCard title="Tren Tagihan Bulanan" subtitle="6 bulan terakhir" action={<BlokTeks lebar={70} ukuran="0.9rem" />}>
        <div style={{ marginTop: 'auto' }}>
          {/* Proporsi sama dengan viewBox grafik batang asli (1204 × 394) */}
          <div style={{ aspectRatio: '1204 / 394', display: 'flex', justifyContent: 'space-between', padding: '0 1%', marginBottom: 24 }}>
            {TINGGI_BATANG.map(([terkumpul, tunggakan], i) => (
              <div key={i} style={{ width: '10.8%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 320, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <Blok lebar="46%" tinggi={`${terkumpul}%`} sudut={5} />
                  <Blok lebar="46%" tinggi={`${tunggakan}%`} sudut={5} />
                </div>
                <div style={{ flex: 74, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Blok lebar="56%" tinggi="36%" sudut={3} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '3rem' }}>
          {[{ warna: '#69C183', label: 'Terkumpul' }, { warna: '#DE6666', label: 'Tunggakan' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.95rem', color: '#3c3f45' }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: l.warna, flexShrink: 0 }} /> {l.label}
            </div>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Komposisi Pemasukan" subtitle="Per komponen tagihan" action={<BlokTeks lebar={60} ukuran="0.9rem" />}>
        <div style={{ flex: 1, display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <BlokDonat lebar="40%" dalam={69} luar={96.5} style={{ maxWidth: 190 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Blok lebar={12} tinggi={12} sudut={3} />
                <BlokTeks lebar={giliran(['72%', '56%', '84%', '62%'], i)} ukuran="0.95rem" style={{ flex: 1 }} />
                <BlokTeks lebar={32} ukuran="0.95rem" />
              </div>
            ))}
          </div>
        </div>
      </ChartCard>

      <ChartCard title="Pembayaran per Kelas" subtitle="% siswa lunas bulan ini">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.6rem' }}>
          {[0, 1, 2].map(i => (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <BlokTeks lebar={giliran([70, 84, 64], i)} ukuran="0.95rem" />
                <BlokTeks lebar={56} ukuran="0.85rem" />
              </div>
              <Blok tinggi={18} sudut={999} />
            </div>
          ))}
        </div>
      </ChartCard>
    </div>

    {/* ── Insight ── */}
    <section style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 16px 2px rgba(45, 91, 145, 0.75)' }}>
      {[0, 1].map(i => (
        <div key={i} style={{ display: 'flex' }}>
          <Blok lebar={12} tinggi="auto" sudut={0} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.45rem 1.4rem 0.6rem 0.65rem', borderTop: i > 0 ? '2px solid #E7E9EC' : undefined }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <BlokTeks lebar={giliran([130, 90], i)} ukuran="1rem" tinggiBaris={1.35} />
              <BlokTeks lebar={giliran(['62%', '48%'], i)} ukuran="1rem" tinggiBaris={1.4} />
              <BlokTeks lebar={giliran(['40%', '34%'], i)} ukuran="0.78rem" tinggiBaris={1.4} />
            </div>
            <Blok lebar={130} tinggi={31} sudut={8} />
          </div>
        </div>
      ))}
    </section>

    {/* ── Tabel status pembayaran siswa ── */}
    <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '2px 2px 8px 8px rgba(45,91,145,0.10)', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.2rem', marginBlock: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex' }}>
          {TAB_TABEL.map((tab, i) => (
            <span key={tab} style={{ display: 'inline-block', padding: '0.5rem 0.9rem', fontSize: '1rem', fontWeight: i === 0 ? 700 : 600, color: '#1A2C4E', border: `2px solid ${i === 0 ? '#1A2C4E' : 'transparent'}`, borderRadius: 10 }}>
              {tab}
            </span>
          ))}
        </div>
        <Blok lebar={400} tinggi={40} sudut={10} style={{ maxWidth: '100%' }} />
      </div>

      <div style={{ overflowX: 'auto', padding: '0 1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1A2C4E' }}>
              {KOLOM_TABEL.map((col, idx) => (
                <th key={col} style={{
                  padding: '0.6rem 1rem', textAlign: col === 'No' || col === 'Aksi' ? 'center' : 'left',
                  fontSize: '1rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
                  borderRadius: idx === 0 ? '8px 0 0 8px' : idx === KOLOM_TABEL.length - 1 ? '0 8px 8px 0' : undefined,
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, i) => (
              <tr key={i}>
                <td style={sSel}><Blok lebar={16} tinggi={12} style={{ margin: '0 auto' }} /></td>
                <td style={sSel}><Blok lebar={giliran([62, 70, 56], i)} tinggi={12} /></td>
                <td style={sSel}><Blok lebar={giliran(LEBAR_NAMA, i)} tinggi={13} /></td>
                <td style={sSel}><Blok lebar={52} tinggi={25} sudut={6} /></td>
                <td style={sSel}><Blok lebar={giliran([96, 104, 88], i)} tinggi={13} /></td>
                <td style={sSel}><Blok lebar={giliran([86, 104, 72], i)} tinggi={27} sudut={6} /></td>
                {/* Selang-seling tombol Ingatkan dan ikon lunas, seperti campuran aslinya */}
                <td style={sSel}>
                  {i % 2 === 0
                    ? <Blok lebar={112} tinggi={39} sudut={10} style={{ margin: '0 auto' }} />
                    : <Blok lebar={22} tinggi={22} sudut={5} style={{ margin: '0 auto' }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '1rem 1.5rem', borderTop: '1px solid #F1F5F9' }}>
        {[40, 36, 36, 36, 36, 40].map((l, i) => <Blok key={i} lebar={l} tinggi={36} sudut={8} />)}
      </div>
    </div>
  </KerangkaHalaman>
)
