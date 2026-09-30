import type { Metadata } from 'next'

// Layout ini hanya membawa metadata: page.tsx di folder ini adalah client
// component, sedangkan metadata hanya bisa di-export dari server component
export const metadata: Metadata = {
  title: 'Komponen Individu',
}

const KomponenIndividuLayout = ({ children }: { children: React.ReactNode }) => children

export default KomponenIndividuLayout
