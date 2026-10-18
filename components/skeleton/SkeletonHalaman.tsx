import { SkeletonDashboard } from './SkeletonDashboard'
import { SkeletonPembayaran } from './SkeletonPembayaran'
import { SkeletonPengaturan } from './SkeletonPengaturan'
import {
  SkeletonBeasiswa, SkeletonKomponen, SkeletonKomponenIndividu, SkeletonPaketKelas, SkeletonTagihanAktif, SkeletonTahunAjaran,
} from './SkeletonTagihan'
import { SkeletonAlumni, SkeletonDaftarSiswa, SkeletonManajemenKelas, SkeletonNaikKelas } from './SkeletonSiswa'
import { SkeletonLaporan, SkeletonLaporanJenjang, SkeletonLaporanKelas, SkeletonLaporanSiswa } from './SkeletonLaporan'
import { SkeletonPengeluaran } from './SkeletonPengeluaran'
import { Blok, BlokTeks, KerangkaHalaman } from './Blok'

/** Rute tanpa kerangka khusus: judul + satu kartu berisi baris */
const SkeletonUmum = () => (
  <KerangkaHalaman label="halaman">
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
      <Blok lebar={60} tinggi={60} sudut={14} />
      <div>
        <BlokTeks lebar={220} ukuran="1.8rem" tinggiBaris={1.2} />
        <BlokTeks lebar={320} ukuran="1rem" style={{ marginTop: '0.2rem' }} />
      </div>
    </div>
    <div style={{ background: '#fff', borderRadius: 14, borderLeft: '28px solid #1A2C4E', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[0, 1, 2, 3, 4].map(i => <BlokTeks key={i} lebar={['70%', '55%', '82%', '48%', '64%'][i]} ukuran="1rem" />)}
    </div>
  </KerangkaHalaman>
)

const bacaSegmen = (segmen: string | undefined) => {
  try { return decodeURIComponent(segmen ?? '') } catch { return segmen ?? '' }
}

/**
 * Kerangka halaman menurut URL — dipakai layout selama data login belum terbaca
 * (termasuk HTML dari server), supaya bentuk halaman langsung tampil sejak awal.
 * Halaman masing-masing memakai kerangka yang sama selama datanya dimuat.
 */
export const SkeletonHalaman = ({ pathname }: { pathname: string }) => {
  switch (pathname) {
    case '/dashboard':             return <SkeletonDashboard />
    case '/pembayaran':            return <SkeletonPembayaran />
    case '/pengaturan':            return <SkeletonPengaturan />
    case '/tagihan':
    case '/tagihan/aktif':         return <SkeletonTagihanAktif />
    case '/tagihan/tahun-ajaran':  return <SkeletonTahunAjaran />
    case '/tagihan/komponen':      return <SkeletonKomponen />
    case '/tagihan/paket-kelas':   return <SkeletonPaketKelas />
    case '/tagihan/beasiswa':      return <SkeletonBeasiswa />
    case '/tagihan/individu':      return <SkeletonKomponenIndividu />
    case '/siswa':
    case '/siswa/daftar-siswa':    return <SkeletonDaftarSiswa />
    case '/siswa/manajemen-kelas': return <SkeletonManajemenKelas />
    case '/siswa/naik-kelas':      return <SkeletonNaikKelas />
    case '/siswa/alumni':          return <SkeletonAlumni />
    case '/laporan':               return <SkeletonLaporan />
    case '/laporan/pengeluaran':   return <SkeletonPengeluaran />
  }
  // /laporan/<level>/<id>
  const [, akar, level, id] = pathname.split('/')
  if (akar === 'laporan' && id) {
    if (level === 'jenjang') return <SkeletonLaporanJenjang jenjang={bacaSegmen(id)} />
    if (level === 'kelas')   return <SkeletonLaporanKelas />
    if (level === 'siswa')   return <SkeletonLaporanSiswa />
  }
  return <SkeletonUmum />
}
