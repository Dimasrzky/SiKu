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

// Metadata di sini berlaku untuk SEMUA route, jadi isinya harus netral.
// Metadata khusus halaman login ada di app/(auth)/page.tsx; route lain mengisi title
// sendiri lewat page.tsx (server) atau layout.tsx di foldernya (page client).
export const metadata: Metadata = {
  metadataBase: new URL('https://app.pakaisiku.id'),
  title: {
    default: 'SiKu',
    template: '%s | SiKu',
  },
  description: 'Kelola SPP, tagihan, dan laporan keuangan sekolah dengan SiKu.',
  // Tanpa title/description di sini, og:title dan og:description otomatis
  // mengikuti title/description tiap halaman (dipakai pratinjau link WhatsApp)
  openGraph: {
    siteName: 'PakaiSiku',
    locale: 'id_ID',
  },
  verification: {
    google: 'AYljetFck46XJADB0wAOb8HTXVECATUkGrmylA51ncM',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body suppressHydrationWarning className={`${fraunces.variable} ${jakarta.variable} ${dmSans.variable}`}>
        {children}
      </body>
    </html>
  )
}