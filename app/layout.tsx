import type { Metadata } from 'next'
import { Fraunces, Plus_Jakarta_Sans, DM_Sans } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://app.pakaisiku.id'),
  title: 'Login | SiKu',
  description: 'Masuk ke akun SiKu untuk mengelola SPP, tagihan, dan laporan keuangan sekolah Anda. Bagian dari Siku.',
  keywords: 'login siku, masuk akun pakaisiku, sistem keuangan sekolah, aplikasi SPP',
  alternates: {
    canonical: 'https://app.pakaisiku.id',
  },
  openGraph: {
    title: 'Login | SiKu',
    description: 'Masuk ke akun SiKu untuk mengelola SPP, tagihan, dan laporan keuangan sekolah Anda. Bagian dari Siku.',
    siteName: 'PakaiSiku',
    url: 'https://app.pakaisiku.id',
    locale: 'id_ID',
  },
  verification: {
    google: 'AYljetFck46XJADB0wAOb8HTXVECATUkGrmylA51ncM',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body className={`${fraunces.variable} ${jakarta.variable} ${dmSans.variable}`}>
        {children}
      </body>
    </html>
  )
}