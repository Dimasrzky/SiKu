import type { Metadata } from 'next'
import LoginForm from './LoginForm'

// Halaman ini ada di grup route (auth), segmen anak root layout, jadi template
// '%s | SiKu' berlaku: judul tab menjadi "Login | SiKu"
export const metadata: Metadata = {
  title: 'Login',
  description: 'Masuk ke akun SiKu untuk mengelola SPP, tagihan, dan laporan keuangan sekolah Anda. Bagian dari Siku.',
  keywords: 'login siku, masuk akun pakaisiku, sistem keuangan sekolah, aplikasi SPP',
  alternates: {
    canonical: 'https://app.pakaisiku.id',
  },
  // og:title dan og:description otomatis mengikuti title dan description di atas
  openGraph: {
    siteName: 'PakaiSiku',
    url: 'https://app.pakaisiku.id',
    locale: 'id_ID',
  },
}

const LoginPage = () => <LoginForm />

export default LoginPage
