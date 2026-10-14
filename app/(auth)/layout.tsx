import { DM_Sans } from 'next/font/google'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { IlustrasiAuth } from '@/components/auth/IlustrasiAuth'
import { ukuranIkon } from '@/components/auth/satuan'
import './auth.css'

// DM Sans bersumbu optical size, khusus halaman login & daftar: desain Figma memakai
// opsz 40 yang hurufnya lebih rapat dari DM Sans bawaan root layout
const dmSansOpsz = DM_Sans({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-auth',
  display: 'swap',
})

const URL_BERANDA = 'https://pakaisiku.id'

// Desktop: pil di kiri atas ilustrasi. Layar sempit (ilustrasi disembunyikan): tautan di atas logo.
const TautanBeranda = ({ className }: { className: string }) => (
  <a href={URL_BERANDA} className={className}>
    <ArrowLeft style={ukuranIkon(17)} strokeWidth={2.2} aria-hidden="true" />
    Kembali ke beranda
  </a>
)

// Layout bersama Login & Daftar. Ilustrasi kiri dan panel kanan tetap terpasang saat
// pindah halaman, jadi animasi masuk hanya berjalan sekali dan ilustrasi tidak terputus;
// yang berganti hanya isi panel (lihat components/auth/IsiPanel).
const AuthLayout = ({ children }: { children: React.ReactNode }) => (
  <div className={`auth-halaman ${dmSansOpsz.variable}`}>
    <IlustrasiAuth />
    <TautanBeranda className="auth-beranda" />
    <main className="auth-panel">
      <div className="auth-panel-gulir">
        <div className="auth-panel-isi">
          <TautanBeranda className="auth-beranda-hp" />
          <div className="auth-logo-hp" aria-hidden="true">
            <Image src="/image/SimbolSiKuTerang.png" width={42} height={43} alt="" />
          </div>
          {children}
        </div>
      </div>
    </main>
  </div>
)

export default AuthLayout
