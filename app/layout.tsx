import type { Metadata } from 'next'
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
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

export const metadata: Metadata = {
  title: 'EduKas — Sistem Keuangan Sekolah Swasta Modern',
  description: 'Kelola SPP, tagihan, dan laporan keuangan sekolah swasta Indonesia dalam satu platform digital. Notifikasi otomatis ke orang tua via WhatsApp.',
  keywords: 'sistem keuangan sekolah, aplikasi SPP, bendahara sekolah, yayasan pendidikan Indonesia',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body className={`${fraunces.variable} ${jakarta.variable}`}>
        {children}
      </body>
    </html>
  )
}