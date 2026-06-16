import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://app.pakaisiku.id'

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/daftar'],
      disallow: [
        '/dashboard',
        '/siswa',
        '/tagihan',
        '/pembayaran',
        '/laporan',
        '/pengaturan',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
