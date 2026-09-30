import type { Metadata } from 'next'

// Layout ini hanya membawa metadata: page.tsx di folder ini adalah client
// component, sedangkan metadata hanya bisa di-export dari server component.
// Template wajib ditulis ulang di sini: layout ini membungkus sub-laporan
// (jenjang, kelas, siswa), dan title berupa string biasa akan memutus template
// root sehingga judul sub-laporan tampil tanpa akhiran "| SiKu".
export const metadata: Metadata = {
  title: {
    default: 'Laporan',
    template: '%s | SiKu',
  },
}

const LaporanLayout = ({ children }: { children: React.ReactNode }) => children

export default LaporanLayout
