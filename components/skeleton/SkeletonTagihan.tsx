import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import {
  AlertTriangle, Award, Banknote, BookOpen, CalendarDays, ChevronRight, ClipboardList, Layers,
  LayoutGrid, LayoutList, Pencil, Puzzle, RefreshCw, Scissors, Users, Users2,
} from 'lucide-react'
import { STATUS_TAGIHAN, URUTAN_STATUS } from '@/lib/statusTagihan'
import { BadgeAktif, BarisDaftar, Blok, BlokDonat, BlokTeks, KepalaHalaman, KerangkaHalaman, LEBAR_NAMA, giliran } from './Blok'

// Kerangka halaman Tagihan — masing-masing meniru page.tsx di app/(dashboard)/tagihan/
// <rute>; ubah bersama halamannya. Tahun Ajaran dan Komponen meniru tampilan normal,
// karena mode setup hanya muncul sekali saat onboarding.

const sTengah: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center' }

/** Kepala kartu tahun ajaran aktif (Tahun Ajaran, Komponen): ikon jam, nama + badge, rentang tanggal */
const KepalaTahunAjaran = ({ badge }: { badge: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <div style={{ width: 70, height: 48, background: '#1A2C4E', borderRadius: 12, flexShrink: 0, ...sTengah }}>
      <Image src="/icons/IconWaktu.png" width={26} height={26} alt="" />
    </div>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <BlokTeks lebar={130} ukuran="1.25rem" tinggiBaris={1.2} />
        {badge}
      </div>
      <BlokTeks lebar={210} ukuran="0.8rem" style={{ marginTop: 2 }} />
    </div>
  </div>
)

// ── Tagihan Aktif ────────────────────────────────────────────────────────────

const KOLOM_TAGIHAN = ['Nama', 'Kelas', 'Total tagihan', 'Status', 'Jatuh tempo', 'Aksi'] as const
const sTd: CSSProperties = { padding: '0.875rem 1rem', verticalAlign: 'middle' }
const sKartuDalam: CSSProperties = { background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1rem 1.25rem', boxShadow: '0 2px 10px #3244736e' }

/** `catatan` tampil di atas kerangka selama tagihan bulan ini sedang dibuat otomatis */
export const SkeletonTagihanAktif = ({ catatan }: { catatan?: string }) => (
  <KerangkaHalaman label="Tagihan Aktif">
    <KepalaHalaman kecil ikon={<Image src="/icons/IconMoney.png" width={30} height={30} alt="" />}
      judul="Tagihan Aktif" subjudul="Ringkasan tagihan dan status pembayaran siswa saat ini"
      kanan={<Blok lebar={232} tinggi={40} sudut={10} />} />

    {catatan && (
      <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content', background: '#fff', borderRadius: 20, padding: '0.4rem 0.95rem', marginBottom: '1rem', fontSize: '0.82rem', fontWeight: 600, color: '#1A2C4E', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <ClipboardList size={14} /> {catatan}
      </div>
    )}

    {/* ── Ringkasan status pembayaran ── */}
    <div style={{ background: '#fff', borderRadius: 12, marginBottom: '1.25rem', borderLeft: '28px solid #1A2C4E', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1.1rem 1.5rem' }}>
        <div style={{ width: 40, height: 40, background: '#1A2C4E', borderRadius: 10, flexShrink: 0, ...sTengah }}>
          <ClipboardList size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A2C4E', lineHeight: 1.2 }}>Ringkasan status pembayaran</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 2 }}>Sebaran dan nilai tagihan saat ini</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1.25rem 1.5rem' }}>
        <div style={sKartuDalam}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>Total siswa ditagih</span>
            <Image src="/icons/DolarBiru.png" width={40} height={40} alt="" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8rem' }}>
            {/* Donat asli: viewBox 100, r 38, tebal 13 */}
            <BlokDonat lebar={140} dalam={63} luar={89} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {URUTAN_STATUS.map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_TAGIHAN[s].solid, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', color: '#374151' }}>{STATUS_TAGIHAN[s].label}</span>
                  </div>
                  <BlokTeks lebar={24} ukuran="0.875rem" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={sKartuDalam}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>Total tagihan periode ini</span>
            <Image src="/icons/BankBiru.png" width={30} height={30} alt="" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <BlokTeks lebar={150} ukuran="0.75rem" style={{ marginTop: 2 }} />
            <Image src="/icons/IconKomponen.png" width={22} height={22} alt="" style={{ opacity: 0.45 }} />
          </div>
          <div style={{ paddingBottom: '0.75rem', borderBottom: '3px solid #DADBDE', marginBottom: '0.875rem' }}>
            <BlokTeks lebar={210} ukuran="1.75rem" />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {[
              { ikon: '/icons/Sampun.png', label: 'Sudah masuk', titik: '#22C55E' },
              { ikon: '/icons/Dereng.png', label: 'Belum masuk', titik: '#EF4444' },
            ].map(k => (
              <div key={k.label} style={{ flex: 1 }}>
                <div style={{ background: '#F7DD7D', borderRadius: 10, padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.4rem' }}>
                  <Image src={k.ikon} width={14} height={14} alt="" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A2C4E' }}>{k.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: '0.25rem' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: k.titik, flexShrink: 0 }} />
                  <BlokTeks lebar={96} ukuran="0.82rem" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* ── Filter + tabel ── */}
    <div style={{ background: '#fff', borderRadius: 12, marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Blok lebar={130} tinggi={36} sudut={8} />
          <Blok lebar={120} tinggi={36} sudut={8} />
        </div>
        <Blok lebar={500} tinggi={44} sudut={8} style={{ maxWidth: '100%' }} />
      </div>
      <div style={{ overflowX: 'auto', padding: '0 1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#1A2C4E' }}>
              {KOLOM_TAGIHAN.map(col => (
                <th key={col} style={{ padding: '0.45rem 1rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', borderRadius: col === 'Nama' ? '8px 0 0 8px' : col === 'Aksi' ? '0 8px 8px 0' : undefined }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }, (_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={sTd}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <Blok lebar={36} tinggi={36} sudut="50%" />
                    <div>
                      <BlokTeks lebar={giliran(LEBAR_NAMA, i)} ukuran="0.875rem" />
                      <BlokTeks lebar={70} ukuran="0.7rem" />
                    </div>
                  </div>
                </td>
                <td style={sTd}><Blok lebar={giliran([50, 58, 46], i)} tinggi={25} sudut={8} /></td>
                <td style={sTd}><Blok lebar={giliran([100, 112, 92], i)} tinggi={13} /></td>
                <td style={sTd}><Blok lebar={giliran([86, 70, 96], i)} tinggi={27} sudut={20} /></td>
                <td style={sTd}><Blok lebar={110} tinggi={12} /></td>
                <td style={sTd}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Blok lebar={96} tinggi={30} sudut={8} />
                    <Blok lebar={30} tinggi={30} sudut={8} style={{ marginLeft: 'auto' }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid #F1F5F9' }}>
        <BlokTeks lebar={170} ukuran="0.75rem" />
      </div>
    </div>
  </KerangkaHalaman>
)

// ── Tahun Ajaran ─────────────────────────────────────────────────────────────

const sStatTahun: CSSProperties  = { background: '#ffffff', borderRadius: 16, padding: '0.875rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', boxShadow: '0 2px 10px #3244736e', width: 320, flexShrink: 0, marginLeft: '1.5rem' }
const sLabelTahun: CSSProperties = { fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 12, position: 'relative', bottom: 5 }

const BarisSemester = ({ nama }: { nama: string }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Blok lebar={32} tinggi={32} sudut="50%" />
        <div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#6F788A' }}>{nama}</div>
          <BlokTeks lebar={230} ukuran="0.8rem" style={{ marginTop: 1 }} />
        </div>
      </div>
      <Blok lebar={70} tinggi={21} sudut={20} style={{ marginRight: '1.5rem' }} />
    </div>
    <Blok lebar="95%" tinggi={10} sudut={99} style={{ marginLeft: 45 }} />
  </div>
)

export const SkeletonTahunAjaran = () => (
  <KerangkaHalaman label="Tahun Ajaran">
    <KepalaHalaman kecil ikon={<Image src="/icons/IconCalender.png" width={30} height={30} alt="" />}
      judul="Tahun Ajaran" subjudul="Kelola periode aktif"
      kanan={<Blok lebar={190} tinggi={42} sudut={8} />} />

    {/* ── Tahun ajaran aktif ── */}
    <div style={{ background: '#fff', borderLeft: '30px solid #1A2C4E', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '2rem' }}>
      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <KepalaTahunAjaran badge={<Blok lebar={70} tinggi={23} sudut={20} />} />
        <Blok lebar={110} tinggi={39} sudut={8} />
      </div>

      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', gap: '0.5rem' }}>
        {([['Total siswa', Users2], ['Komponen tagihan', LayoutGrid], ['Total kelas', BookOpen]] as const).map(([label, Ikon]) => (
          <div key={label} style={sStatTahun}>
            <div>
              <div style={sLabelTahun}>{label}</div>
              <BlokTeks lebar={50} ukuran="1.75rem" tinggiBaris={1} style={{ position: 'relative', left: 12 }} />
            </div>
            <Ikon size={22} color="#1A2C4E" />
          </div>
        ))}
      </div>

      <div style={{ padding: '0 1.5rem' }}>
        <div style={{ height: 1.5, background: '#C1C6CF', width: '100%' }} />
      </div>

      <div style={{ padding: '1.25rem 1.5rem 2.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--navy-dark)', marginBottom: '1.25rem' }}>Pembagian semester</div>
        <BarisSemester nama="Semester ganjil" />
        <div style={{ height: 2, background: '#C1C6CF', margin: '2rem 0 1rem' }} />
        <BarisSemester nama="Semester genap" />
      </div>
    </div>

    {/* ── Riwayat ── */}
    <div style={{ marginTop: '1rem', marginBottom: '1.5rem', background: '#fff', borderLeft: '30px solid #1A2C4E', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
      <div style={{ padding: '1rem 1.5rem' }}>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--navy-dark)' }}>Riwayat tahun ajaran</span>
      </div>
      {[0, 1].map(i => (
        <div key={i} style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i === 0 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <Blok lebar={36} tinggi={36} sudut={10} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 2 }}>
                <BlokTeks lebar={110} ukuran="0.9rem" />
                <Blok lebar={72} tinggi={18} sudut={20} />
              </div>
              <BlokTeks lebar={260} ukuran="0.75rem" />
            </div>
          </div>
          <ChevronRight size={18} color="#94A3B8" />
        </div>
      ))}
    </div>
  </KerangkaHalaman>
)

// ── Komponen Tagihan ─────────────────────────────────────────────────────────

const TAB_KOMPONEN = ['Semua', 'Rutin Bulanan', 'Sekali Bayar', 'Per Semester'] as const
const sStatKomponen: CSSProperties = { background: '#ffffff', borderRadius: 16, padding: '0.875rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', boxShadow: '0 2px 10px #3244736e', flex: 1, minWidth: 0 }

export const SkeletonKomponen = () => (
  <KerangkaHalaman label="Komponen Tagihan">
    <KepalaHalaman kecil bayanganIkon="0 8px 16px rgba(26,44,78,0.3)"
      ikon={<Image src="/icons/IconKomponen.png" width={30} height={30} alt="" />}
      judul="Komponen Tagihan" subjudul="Kelola item pembayaran"
      kanan={<><Blok lebar={130} tinggi={40} sudut={8} /><Blok lebar={160} tinggi={42} sudut={8} /></>} />

    <div style={{ background: '#fff', borderLeft: '25px solid #1A2C4E', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
      <div style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
        <KepalaTahunAjaran badge={<BadgeAktif />} />
      </div>

      <div style={{ padding: '0 1.5rem 1.25rem', display: 'flex', gap: '0.875rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        {([['Total komponen', LayoutGrid], ['Rutin bulanan', RefreshCw], ['Sekali bayar', Banknote], ['Per semester', CalendarDays]] as const).map(([label, Ikon]) => (
          <div key={label} style={sStatKomponen}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 18 }}>{label}</div>
              <BlokTeks lebar={40} ukuran="1.75rem" tinggiBaris={1} />
            </div>
            <Ikon size={22} color="#1A2C4E" />
          </div>
        ))}
      </div>

      <div style={{ padding: '0 1.5rem' }}>
        <div style={{ height: 1, background: '#C1C6CF', width: '100%', marginBottom: '2rem' }} />
      </div>

      <div style={{ padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.6rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {TAB_KOMPONEN.map((tab, i) => (
            <span key={tab} style={{ display: 'inline-block', background: '#fff', fontSize: '0.9rem', fontWeight: i === 0 ? 700 : 500, color: '#1A2C4E', border: `2px solid ${i === 0 ? '#1A2C4E' : '#C1C6CF'}`, borderRadius: 8, padding: '0.3rem 0.9rem', whiteSpace: 'nowrap' }}>
              {tab}
            </span>
          ))}
        </div>
        <Blok lebar={400} tinggi={36} sudut={8} style={{ maxWidth: '100%' }} />
      </div>

      <div style={{ marginRight: '1.5rem' }}>
        {[0, 1, 2, 3, 4].map(i => <BarisDaftar key={i} i={i} label="Nominal default" garis={i < 4} />)}
      </div>
    </div>
  </KerangkaHalaman>
)

// ── Paket per Kelas ──────────────────────────────────────────────────────────

const sFooterPaket: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#64748B', fontWeight: 500 }

export const SkeletonPaketKelas = () => (
  <KerangkaHalaman label="Paket per kelas">
    <KepalaHalaman ikon={<Image src="/icons/IconBox.png" width={32} height={32} alt="" />}
      judul="Paket per kelas" subjudul="Kelola paket tagihan per jenjang kelas" jarakBawah="2rem"
      kanan={<Blok lebar={200} tinggi={42} sudut={10} />} />

    <div style={{ background: '#fff', border: '1px solid var(--border)', borderLeft: '30px solid #1A2C4E', borderRadius: 15, padding: '1.25rem 1.5rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 6px 6px 24px rgba(26,44,78,0.14)' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <Blok lebar={280} tinggi={36} sudut={8} />
      </div>
      {[0, 1].map(i => (
        <div key={i} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px #3244736e', padding: '1.2rem 1.5rem', marginBottom: i === 0 ? '1.6rem' : 0, marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                <BlokTeks lebar={giliran([190, 160], i)} ukuran="1.2rem" />
                <span style={{ background: '#69C183', color: '#ffffff', border: '2px solid #C1E6CC', fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 1rem', borderRadius: 99, flexShrink: 0 }}>Aktif</span>
              </div>
              <BlokTeks lebar={giliran([300, 250], i)} ukuran="1rem" />
            </div>
            <div style={{ display: 'flex', gap: '0.45rem', flexShrink: 0 }}>
              <Blok lebar={32} tinggi={32} sudut={8} />
              <Blok lebar={32} tinggi={32} sudut={8} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              {[180, 156, 204].map(l => <Blok key={l} lebar={l} tinggi={28} sudut={99} />)}
            </div>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              {[168, 146].map(l => <Blok key={l} lebar={l} tinggi={28} sudut={99} />)}
            </div>
          </div>

          <div style={{ height: 1, background: '#E2E8F0', margin: '0.875rem 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <span style={sFooterPaket}><Layers size={14} /><BlokTeks lebar={80} ukuran="0.82rem" /></span>
            <span style={sFooterPaket}><CalendarDays size={14} /> Jatuh tempo: <BlokTeks lebar={90} ukuran="0.82rem" /></span>
            <span style={sFooterPaket}><Pencil size={14} /> Tidak ada override</span>
          </div>
        </div>
      ))}
    </div>
  </KerangkaHalaman>
)

// ── Beasiswa & Potongan ──────────────────────────────────────────────────────

const STAT_PROGRAM = [
  { ikon: <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>❖</span>, label: 'Komponen' },
  { ikon: <Users size={20} />,         label: 'Penerima' },
  { ikon: <AlertTriangle size={20} />, label: 'Segera berakhir' },
]

export const SkeletonBeasiswa = () => (
  <KerangkaHalaman label="Beasiswa dan Potongan">
    <KepalaHalaman ikon={<Award size={28} color="#fff" />} judul="Beasiswa & Potongan" subjudul="Kelola program beasiswa untuk siswa" jarakBawah="2rem"
      kanan={
        <div style={{ display: 'flex', gap: '1.4rem' }}>
          {([['Program Beasiswa', Award, true], ['Potongan Personal', Scissors, false]] as const).map(([label, Ikon, aktif]) => (
            <span key={label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 1rem', borderRadius: 8,
              fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap',
              background: aktif ? '#1A2C4E' : 'transparent', color: aktif ? '#fff' : '#1A2C4E',
              border: `1px solid ${aktif ? '#1A2C4E' : '#304263'}`,
              boxShadow: aktif ? '0 3px 6px rgba(18, 47, 102, 0.35)' : '0 2px 4px rgba(18, 47, 102, 0.12)',
            }}>
              <Ikon size={18} strokeWidth={aktif ? 1.75 : 2.25} />
              {label}
            </span>
          ))}
        </div>
      } />

    {/* ── Program beasiswa ── */}
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Image src="/icons/Folder.png" width={23} height={18} alt="" />
          <BlokTeks lebar={120} ukuran="1rem" />
        </div>
        <Blok lebar={190} tinggi={38} sudut={8} style={{ marginLeft: 'auto' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1.25rem' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: '0 2px 10px #3244736e' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <BlokTeks lebar={giliran([130, 110, 150], i)} ukuran="0.95rem" />
                <BlokTeks lebar={70} ukuran="0.9rem" style={{ marginTop: 2 }} />
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {[0, 1, 2].map(k => <Blok key={k} lebar={25} tinggi={25} sudut={6} />)}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
              {STAT_PROGRAM.map(s => (
                <div key={s.label} style={{ position: 'relative', background: '#A3CDFE', borderRadius: 8, padding: '0.45rem 0.3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ position: 'absolute', top: 6, left: 7, display: 'flex', color: '#1A2C4E' }}>{s.ikon}</span>
                  <BlokTeks lebar={24} ukuran="1.7rem" />
                  <div style={{ fontSize: '0.7rem', color: '#1A2C4E', fontWeight: 600, textAlign: 'center', lineHeight: 1.1 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <Blok tinggi={39} sudut={8} />
          </div>
        ))}
      </div>
    </div>

    {/* ── Penerima beasiswa ── */}
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 38, height: 38, background: '#1A2C4E', borderRadius: 10, flexShrink: 0, ...sTengah }}>
            <Users size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1A2C4E' }}>Penerima Beasiswa</div>
            <BlokTeks lebar={230} ukuran="0.78rem" />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.5rem' }}>
        <Blok lebar={120} tinggi={38} sudut={8} />
        <Blok lebar={400} tinggi={44} sudut={8} style={{ maxWidth: '60%' }} />
      </div>
      <div style={{ padding: '0 1rem 1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', borderRadius: 10, overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#1A2C4E', color: '#fff' }}>
              {['Siswa', 'Potongan', 'Kelas', 'Aksi'].map(h => (
                <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map(i => (
              <tr key={i} style={{ borderTop: i > 0 ? '1px solid #F1F5F9' : undefined }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Blok lebar={36} tinggi={36} sudut="50%" />
                    <div>
                      <BlokTeks lebar={giliran(LEBAR_NAMA, i)} ukuran="0.85rem" />
                      <BlokTeks lebar={100} ukuran="0.73rem" />
                    </div>
                  </div>
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <BlokTeks lebar={60} ukuran="0.85rem" />
                  <BlokTeks lebar={84} ukuran="0.73rem" />
                </td>
                <td style={{ padding: '0.75rem 1rem' }}><Blok lebar={46} tinggi={22} sudut={6} /></td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {[0, 1, 2].map(k => <Blok key={k} lebar={25} tinggi={25} sudut={6} />)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </KerangkaHalaman>
)

// ── Komponen Individu ────────────────────────────────────────────────────────

const STAT_INDIVIDU = [
  { label: 'Komponen aktif',         Ikon: Puzzle },
  { label: 'Siswa terdampak',        Ikon: Users },
  { label: 'Komponen belum dipakai', Ikon: AlertTriangle },
] as const

export const SkeletonKomponenIndividu = () => (
  <KerangkaHalaman label="Komponen Individu">
    <KepalaHalaman ikon={<LayoutList size={28} color="#fff" />} judul="Komponen Individu"
      subjudul="Tambahkan komponen ke siswa tertentu tanpa mengubah paket kelas" jarakBawah="2rem" />

    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: '28px solid #1A2C4E', borderRadius: 16, boxShadow: '0 2px 16px rgba(26,44,78,0.08)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1 }}>
          <div style={{ width: 46, height: 46, background: '#1A2C4E', borderRadius: 12, flexShrink: 0, ...sTengah }}>
            <Users size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A2C4E' }}>Aktivitas assign</div>
            <div style={{ fontSize: '0.83rem', color: '#64748B' }}>Assign komponen tambahan ke siswa lintas kelas dan jenjang</div>
          </div>
        </div>
        <Blok lebar={140} tinggi={38} sudut={8} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9' }}>
        {STAT_INDIVIDU.map(({ label, Ikon }) => (
          <div key={label} style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', boxShadow: '0 2px 10px #3244736e' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <BlokTeks lebar={40} ukuran="1.75rem" />
            </div>
            <Ikon size={24} color="#1A2C4E" />
          </div>
        ))}
      </div>

      <div style={{ padding: '1.25rem 1.5rem 0' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A2C4E', marginBottom: '0.2rem' }}>Komponen aktif</div>
        <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1rem' }}>Komponen tagihan yang di-assign langsung ke siswa</div>
      </div>
      {[0, 1, 2].map(i => <BarisDaftar key={i} i={i} label="Nominal default" garis={i < 2} />)}
    </div>

    {/* ── Siswa per komponen ── */}
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
        <div style={{ width: 46, height: 46, background: '#1A2C4E', borderRadius: 12, flexShrink: 0, marginRight: '0.85rem', ...sTengah }}>
          <Users size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A2C4E' }}>Siswa per Komponen</div>
          <BlokTeks lebar={110} ukuran="0.83rem" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.5rem', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
        <Blok lebar={160} tinggi={36} sudut={8} />
        <Blok lebar={120} tinggi={36} sudut={8} />
        <Blok lebar={500} tinggi={39} sudut={8} style={{ marginLeft: 'auto', maxWidth: '100%' }} />
      </div>
      <div style={{ padding: '0 1.5rem 1.5rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', borderRadius: 10, overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: '#1A2C4E', color: '#fff' }}>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontWeight: 600 }}>Nama</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Nominal</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Kelas</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map(i => (
              <tr key={i} style={{ borderTop: i > 0 ? '1px solid #F1F5F9' : undefined }}>
                <td style={{ padding: '0.75rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Blok lebar={38} tinggi={38} sudut="50%" />
                    <div>
                      <BlokTeks lebar={giliran(LEBAR_NAMA, i + 3)} ukuran="0.875rem" />
                      <BlokTeks lebar={130} ukuran="0.75rem" />
                    </div>
                  </div>
                </td>
                <td style={{ padding: '0.75rem 1rem' }}><Blok lebar={90} tinggi={13} /></td>
                <td style={{ padding: '0.75rem 1rem' }}><Blok lebar={46} tinggi={22} sudut={6} /></td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    {[0, 1, 2].map(k => <Blok key={k} lebar={26} tinggi={26} sudut={4} />)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </KerangkaHalaman>
)
