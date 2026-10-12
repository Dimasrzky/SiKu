import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Halaman SiKu tidak boleh disematkan di situs lain (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Halaman bayar orang tua: alamatnya memuat token, jadi tidak ikut terkirim ke
        // situs lain dan tidak boleh masuk hasil mesin pencari kalau link-nya tersebar.
        // Aturan ini di belakang supaya Referrer-Policy di atas tertimpa.
        source: '/bayar/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
