import type { CSSProperties } from 'react'
import Image from 'next/image'
import { AlertCircle, ChevronDown, GraduationCap, LayoutGrid, Users } from 'lucide-react'
import { BadgeAktif, BarisDaftar, Blok, BlokDonat, BlokTeks, KepalaHalaman, KerangkaHalaman, LEBAR_NAMA, giliran } from './Blok'

// Kerangka halaman Siswa — masing-masing meniru page.tsx di app/(dashboard)/siswa/
// <rute>; ubah bersama halamannya. Daftar Siswa dan Manajemen Kelas meniru tampilan
// normal, karena mode setup hanya muncul sekali saat onboarding.

const sTengah: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center' }
const sKartuKecil: CSSProperties = { background: '#fff', borderRadius: 12, boxShadow: '0 2px 10px #3244736e' }

// ── Daftar Siswa ─────────────────────────────────────────────────────────────

const KOLOM_SISWA = ['Nama', 'NIS', 'Kelas', 'Orang tua', 'Beasiswa/potongan', 'Aksi'] as const
const sTdSiswa: CSSProperties = { padding: '0.75rem 1.25rem' }

export const SkeletonDaftarSiswa = () => (
  <KerangkaHalaman label="Daftar Siswa">
    <KepalaHalaman ikon={<GraduationCap size={30} color="#fff" />} judul="Daftar siswa" subjudul="kelola data siswa dan keterhubungan dengan kelas"
      kanan={<><Blok lebar={150} tinggi={40} sudut={8} /><Blok lebar={132} tinggi={37} sudut={8} /></>} />

    {/* ── Ringkasan ── */}
    <div style={{ background: '#ffffff', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: '28px solid #1A2C4E' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '2rem' }}>
        <div style={{ width: 46, height: 46, background: '#1A2C4E', borderRadius: 12, flexShrink: 0, ...sTengah }}>
          <Users size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A2C4E' }}>Ringkasan data siswa</div>
          <div style={{ fontSize: '0.83rem', color: '#1A2C4E' }}>Pantau jumlah dan sebaran siswa di setiap tingkat</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: 20 }}>
        <div style={{ ...sKartuKecil, padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#1A2C4E' }}>Total siswa</span>
            <Users size={22} color="#94A3B8" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Donat asli: viewBox 100, r 35, tebal 12 */}
            <BlokDonat lebar={150} dalam={58} luar={82} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8rem' }}>
                    <Blok lebar={10} tinggi={10} sudut="50%" style={{ position: 'relative', left: 110 }} />
                    <BlokTeks lebar={52} ukuran="0.8rem" />
                  </div>
                  <BlokTeks lebar={24} ukuran="0.82rem" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ ...sKartuKecil, padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#1A2C4E' }}>Beasiswa &amp; potongan</span>
            <GraduationCap size={22} color="#94A3B8" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <BlokTeks lebar={30} ukuran="1.5rem" />
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748B' }}>Siswa</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Blok lebar={giliran([140, 110, 124], i)} tinggi={20} sudut={20} />
                <BlokTeks lebar={54} ukuran="0.8rem" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* ── Semua siswa ── */}
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A2C4E' }}>Semua siswa</div>
        <div style={{ fontSize: '0.83rem', color: '#64748B' }}>Cari, lihat, dan kelola data siswa secara individual</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.5rem', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
        <Blok lebar={140} tinggi={39} sudut={8} />
        <Blok lebar={140} tinggi={39} sudut={8} />
        <Blok lebar={485} tinggi={41} sudut={8} style={{ marginLeft: 'auto', maxWidth: '100%' }} />
      </div>
      <div style={{ overflowX: 'auto', padding: '0 1.5rem 1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#1A2C4E', color: '#fff' }}>
              {KOLOM_SISWA.map(h => (
                <th key={h} style={{ height: 44, padding: '0 1.25rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} style={{ padding: '0.5rem 0.1rem' }}>
                <div style={{ background: '#A3CDFE', borderRadius: 6, padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Image src="/icons/IconLayer.png" width={16} height={16} alt="" />
                  <BlokTeks lebar={64} ukuran="0.9rem" style={{ flex: 1 }} />
                  <BlokTeks lebar={110} ukuran="0.8rem" />
                </div>
              </td>
            </tr>
            {Array.from({ length: 8 }, (_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={sTdSiswa}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Blok lebar={36} tinggi={36} sudut="50%" />
                    <Blok lebar={giliran(LEBAR_NAMA, i)} tinggi={13} />
                  </div>
                </td>
                <td style={sTdSiswa}><Blok lebar={giliran([70, 78, 64], i)} tinggi={12} /></td>
                <td style={sTdSiswa}><Blok lebar={46} tinggi={24} sudut={6} /></td>
                <td style={sTdSiswa}><Blok lebar={giliran([120, 96, 132, 108], i)} tinggi={12} /></td>
                <td style={sTdSiswa}>
                  {i % 3 === 0 ? <Blok lebar={112} tinggi={20} sudut={20} /> : <Blok lebar={18} tinggi={8} sudut={3} />}
                </td>
                <td style={sTdSiswa}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <Blok lebar={27} tinggi={27} sudut={6} />
                    <Blok lebar={26} tinggi={26} sudut={6} />
                    <Blok lebar={27} tinggi={27} sudut={4} />
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

// ── Manajemen Kelas ──────────────────────────────────────────────────────────

const sStatKelas: CSSProperties = { background: '#ffffff', borderRadius: 16, padding: '0.875rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', boxShadow: '0 2px 10px #3244736e', flex: 1, minWidth: 0 }
const STAT_KELAS = [
  { label: 'Total kelas',          Ikon: LayoutGrid },
  { label: 'Total siswa',          Ikon: Users },
  { label: 'Belum ada wali kelas', Ikon: AlertCircle },
] as const

export const SkeletonManajemenKelas = () => (
  <KerangkaHalaman label="Manajemen Kelas">
    <KepalaHalaman ikon={<Image src="/icons/IconGroup.png" width={35} height={35} alt="" />} bayanganIkon="10px 16px 14px rgba(18,47,102,0.31)"
      judul="Manajemen Kelas" subjudul="Kelola daftar kelas sekolah"
      kanan={<Blok lebar={196} tinggi={45} sudut={10} />} />

    <div style={{ background: '#fff', border: '1px solid var(--border)', borderLeft: '30px solid #1A2C4E', borderRadius: 15, padding: '1.25rem 1.5rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 6px 6px 24px rgba(26,44,78,0.14)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ width: 70, height: 48, background: '#1A2C4E', borderRadius: 12, padding: '0.7rem', flexShrink: 0, ...sTengah }}>
          <Image src="/icons/IconWaktu.png" width={26} height={26} alt="" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem' }}>
            <BlokTeks lebar={120} ukuran="1.3rem" />
            <BadgeAktif />
          </div>
          <BlokTeks lebar={220} ukuran="0.9rem" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', maxWidth: '70%', marginLeft: 30 }}>
        {STAT_KELAS.map(({ label, Ikon }) => (
          <div key={label} style={sStatKelas}>
            <div>
              <div style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6, position: 'relative', bottom: 7 }}>{label}</div>
              <BlokTeks lebar={44} ukuran="1.75rem" tinggiBaris={1} />
            </div>
            <Ikon size={28} color="#1A2C4E" style={{ marginTop: -4, marginRight: -6, flexShrink: 0 }} />
          </div>
        ))}
      </div>

      <div style={{ padding: '0 1.5rem' }}>
        <div style={{ height: 1.5, background: '#C1C6CF', width: '100%', marginBottom: '2rem' }} />
      </div>

      <div style={{ padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.6rem' }}>
        <div style={{ display: 'flex', marginLeft: '-0.75rem', fontSize: '1rem', fontWeight: 700, color: '#1A2C4E' }}>
          <span style={{ padding: '0.3rem 0.75rem' }}>
            <span style={{ display: 'inline-block', paddingBottom: '0.25rem' }}>Semua</span>
          </span>
          <span style={{ padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ display: 'inline-block', borderBottom: '3px solid transparent', paddingBottom: '0.25rem' }}>Pilih tingkat kelas</span>
            <ChevronDown size={14} color="#1A2C4E" />
          </span>
        </div>
        <Blok lebar={400} tinggi={36} sudut={10} style={{ maxWidth: '100%' }} />
      </div>

      <div style={{ marginRight: '1.3rem' }}>
        {[0, 1].map(g => (
          <div key={g}>
            <div style={{ background: '#A3CDFE', width: '94%', borderRadius: 6, marginLeft: 20, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Image src="/icons/IconLayer.png" width={16} height={16} alt="" />
              <BlokTeks lebar={62} ukuran="0.9rem" style={{ position: 'relative', right: '38%' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <BlokTeks lebar={110} ukuran="0.82rem" />
                <Blok lebar={28} tinggi={28} sudut={7} />
              </div>
            </div>
            {[0, 1].map(i => <BarisDaftar key={i} i={g * 2 + i} label="Jumlah siswa" garis={i === 0} />)}
          </div>
        ))}
      </div>
    </div>
  </KerangkaHalaman>
)

// ── Naik Kelas ───────────────────────────────────────────────────────────────

export const SkeletonNaikKelas = () => (
  <KerangkaHalaman label="Naik Kelas">
    <KepalaHalaman ikon={<Image src="/icons/NaikKelas.png" width={33} height={30} alt="" />}
      judul="Naik kelas" subjudul="Proses kenaikan kelas siswa untuk tahun ajaran baru" />

    {/* Kartu status tahun ajaran — keadaan awal halaman sebelum proses dijalankan */}
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8F0', borderLeft: '28px solid #1A2C4E', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', minHeight: 280 }}>
      <Blok lebar={64} tinggi={64} sudut="50%" />
      <div style={{ width: '100%', maxWidth: 440 }}>
        <BlokTeks lebar={250} ukuran="1.15rem" style={{ justifyContent: 'center', marginBottom: 6 }} />
        <BlokTeks lebar="94%" ukuran="0.875rem" style={{ justifyContent: 'center' }} />
        <BlokTeks lebar="78%" ukuran="0.875rem" style={{ justifyContent: 'center' }} />
        <BlokTeks lebar="52%" ukuran="0.875rem" style={{ justifyContent: 'center' }} />
      </div>
      <Blok lebar={360} tinggi={46} sudut={10} style={{ marginTop: '0.5rem', maxWidth: '100%' }} />
    </div>
  </KerangkaHalaman>
)

// ── Alumni ───────────────────────────────────────────────────────────────────

const KOLOM_ALUMNI = ['Nama', 'NIS', 'Angkatan', 'Status', 'Orang Tua', 'Pelunasan', ''] as const
const STATUS_ALUMNI = [
  { label: 'Lulus',  warna: '#7C3AED' },
  { label: 'Pindah', warna: '#F59E0B' },
  { label: 'Keluar', warna: '#EF4444' },
] as const
const sTdAlumni: CSSProperties = { padding: '0.7rem 1rem' }

export const SkeletonAlumni = () => (
  <KerangkaHalaman label="Alumni">
    <KepalaHalaman ikon={<GraduationCap size={30} color="#ffffff" />} judul="Alumni"
      subjudul="Data siswa yang telah lulus, pindah, atau keluar dari sekolah" />

    {/* ── Ringkasan ── */}
    <div style={{ background: '#ffffff', borderRadius: 16, padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '28px solid #1A2C4E' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ width: 36, height: 36, background: '#1A2C4E', borderRadius: 10, flexShrink: 0, ...sTengah }}>
          <GraduationCap size={17} color="#ffffff" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1A2C4E' }}>Ringkasan alumni</div>
          <div style={{ fontSize: '0.9rem', color: 'rgb(117, 117, 117)', marginTop: 1 }}>Sebaran status dan angkatan alumni seluruh periode</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        <div style={{ ...sKartuKecil, padding: '1rem 1.1rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 500, color: '#64748B', marginBottom: '0.75rem' }}>Total alumni</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
            {/* Donat asli: viewBox 110, r 38, tebal 18 */}
            <BlokDonat lebar={110} dalam={53} luar={86} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
              {STATUS_ALUMNI.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: s.warna, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, flex: 1 }}>{s.label}</span>
                  <BlokTeks lebar={20} ukuran="0.78rem" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...sKartuKecil, padding: '1rem 1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 500, color: '#64748B' }}>Angkatan terbaru</div>
            <Users size={15} color="#94A3B8" />
          </div>
          <BlokTeks lebar={50} ukuran="2.2rem" tinggiBaris={1} />
          <BlokTeks lebar={140} ukuran="0.8rem" style={{ marginTop: 3 }} />
          <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <BlokTeks lebar={96} ukuran="0.78rem" />
                <BlokTeks lebar={50} ukuran="0.72rem" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* ── Tabel alumni ── */}
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ padding: '0.875rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.625rem', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
        <Blok lebar={150} tinggi={38} sudut={8} />
        <Blok lebar={125} tinggi={38} sudut={8} />
        <div style={{ flex: 1 }} />
        <Blok lebar={400} tinggi={39} sudut={8} style={{ maxWidth: '100%' }} />
      </div>
      <div style={{ overflowX: 'auto', padding: '0 1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#1A2C4E' }}>
              {KOLOM_ALUMNI.map((h, i) => (
                <th key={i} style={{ padding: '0.45rem 1rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', borderRadius: i === 0 ? '8px 0 0 8px' : i === KOLOM_ALUMNI.length - 1 ? '0 8px 8px 0' : undefined }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }, (_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F8FAFC', background: i % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                <td style={sTdAlumni}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <Blok lebar={34} tinggi={34} sudut="50%" />
                    <Blok lebar={giliran(LEBAR_NAMA, i + 2)} tinggi={12} />
                  </div>
                </td>
                <td style={sTdAlumni}><Blok lebar={giliran([70, 64, 76], i)} tinggi={11} /></td>
                <td style={sTdAlumni}><Blok lebar={40} tinggi={11} /></td>
                <td style={sTdAlumni}><Blok lebar={giliran([64, 70, 60], i)} tinggi={22} sudut={20} /></td>
                <td style={sTdAlumni}><Blok lebar={giliran([110, 92, 124], i)} tinggi={11} /></td>
                <td style={sTdAlumni}><Blok lebar={giliran([58, 86], i)} tinggi={22} sudut={20} /></td>
                <td style={{ padding: '0.7rem 0.875rem' }}><Blok lebar={20} tinggi={20} sudut={5} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid #F1F5F9' }}>
        <BlokTeks lebar={170} ukuran="0.75rem" />
      </div>
    </div>
  </KerangkaHalaman>
)
