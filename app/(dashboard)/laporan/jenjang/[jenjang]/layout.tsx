import type { Metadata } from 'next'

// Layout ini hanya membawa metadata: page.tsx di folder ini adalah client
// component, sedangkan metadata hanya bisa di-export dari server component
export const generateMetadata = async (
  { params }: { params: Promise<{ jenjang: string }> },
): Promise<Metadata> => {
  const { jenjang } = await params
  // Link ke halaman ini memakai encodeURIComponent; decode gagal (mis. ada "%"
  // tanpa kode hex) tidak boleh menggagalkan render halaman
  let nama = jenjang
  try { nama = decodeURIComponent(jenjang) } catch { /* pakai apa adanya */ }
  return { title: `Laporan Jenjang ${nama}` }
}

const LaporanJenjangLayout = ({ children }: { children: React.ReactNode }) => children

export default LaporanJenjangLayout
