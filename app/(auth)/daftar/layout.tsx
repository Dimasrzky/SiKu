import type { Metadata } from 'next'

// Layout ini hanya membawa metadata: page.tsx di folder ini adalah client
// component, sedangkan metadata hanya bisa di-export dari server component
export const metadata: Metadata = {
  title: 'Daftar',
  description: 'Daftarkan sekolah Anda di SiKu untuk mengelola SPP, tagihan, dan laporan keuangan sekolah.',
}

const DaftarLayout = ({ children }: { children: React.ReactNode }) => children

export default DaftarLayout
