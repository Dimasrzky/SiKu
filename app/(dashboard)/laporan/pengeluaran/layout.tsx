import type { Metadata } from 'next'

// Metadata halaman — page.tsx di folder ini client component.
// Sejak 25 Nov 2026 Pengeluaran terbuka untuk semua sekolah, tanpa dipasang admin.
export const metadata: Metadata = {
  title: 'Pengeluaran',
}

const PengeluaranLayout = ({ children }: { children: React.ReactNode }) => children

export default PengeluaranLayout
