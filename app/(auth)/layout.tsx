import { DM_Sans } from 'next/font/google'
import Image from 'next/image'
import { IlustrasiAuth } from '@/components/auth/IlustrasiAuth'
import './auth.css'

// DM Sans bersumbu optical size, khusus halaman login & daftar: desain Figma memakai
// opsz 40 yang hurufnya lebih rapat dari DM Sans bawaan root layout
const dmSansOpsz = DM_Sans({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-auth',
  display: 'swap',
})

// Layout bersama Login & Daftar. Ilustrasi kiri dan panel kanan tetap terpasang saat
// pindah halaman, jadi animasi masuk hanya berjalan sekali dan ilustrasi tidak terputus;
// yang berganti hanya isi panel (lihat components/auth/IsiPanel).
const AuthLayout = ({ children }: { children: React.ReactNode }) => (
  <div className={`auth-halaman ${dmSansOpsz.variable}`}>
    <IlustrasiAuth />
    <main className="auth-panel">
      <div className="auth-panel-gulir">
        <div className="auth-panel-isi">
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
