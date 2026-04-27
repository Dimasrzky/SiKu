'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import './harga.css'

const PLANS = [
  {
    name: 'Starter',
    tagline: 'Sekolah kecil, s/d 200 siswa',
    price: 'Rp 299.000',
    period: 'per sekolah / bulan',
    popular: false,
    cta: 'Mulai Gratis 1 Bulan',
    href: '/daftar',
    features: [
      { label: 'Dashboard keuangan dasar',  on: true  },
      { label: 'Manajemen SPP & tagihan',   on: true  },
      { label: 'Notifikasi WA otomatis',    on: true  },
      { label: 'Laporan bulanan',           on: true  },
      { label: 'Multi-unit / yayasan',      on: false },
      { label: 'Laporan BOS otomatis',      on: false },
    ],
  },
  {
    name: 'Sekolah',
    tagline: 'Sekolah menengah, s/d 600 siswa',
    price: 'Rp 599.000',
    period: 'per sekolah / bulan',
    popular: true,
    cta: 'Mulai Gratis 1 Bulan',
    href: '/daftar',
    features: [
      { label: 'Semua fitur Starter',              on: true  },
      { label: 'Laporan BOS otomatis',             on: true  },
      { label: 'Portal orang tua + app',           on: true  },
      { label: 'Payment gateway terintergrasi',    on: true  },
      { label: 'Rekonsiliasi bank otomatis',       on: true  },
      { label: 'Multi-unit / yayasan',             on: false },
    ],
  },
  {
    name: 'Yayasan',
    tagline: 'Multi-unit, siswa tak terbatas',
    price: 'Rp 1.499.000',
    period: 'per yayasan / bulan',
    popular: false,
    cta: 'Hubungi Kami',
    href: '/daftar',
    features: [
      { label: 'Semua fitur Sekolah',               on: true },
      { label: 'Kelola banyak unit sekolah',        on: true },
      { label: 'Dashboard konsolidasi yayasan',     on: true },
      { label: 'Audit trail & ISAK 35',             on: true },
      { label: 'Dedicated onboarding',              on: true },
      { label: 'Priority support',                  on: true },
    ],
  },
]

const FAQS = [
  {
    q: 'Apakah demo gratis benar-benar gratis?',
    a: 'Ya. 1 bulan penuh tanpa batasan fitur, tanpa kartu kredit, tanpa syarat tersembunyi. Setelah 1 bulan Anda bisa memilih paket atau berhenti kapan saja.',
  },
  {
    q: 'Bisa upgrade atau downgrade paket?',
    a: 'Tentu. Anda dapat pindah paket kapan saja. Penagihan akan disesuaikan secara prorata.',
  },
  {
    q: 'Data siswa kami aman?',
    a: 'Data tersimpan di server Indonesia dengan enkripsi end-to-end. Kami tidak menjual atau berbagi data Anda ke pihak ketiga.',
  },
  {
    q: 'Bagaimana proses onboarding?',
    a: 'Tim kami menghubungi Anda dalam 1×24 jam setelah daftar untuk membantu setup awal — import data siswa, konfigurasi tagihan, dan pelatihan staf.',
  },
]

export default function HargaPage() {
  return (
    <>
      <Navbar />

      <main>
        {/* ─── HERO ─────────────────────────────────────── */}
        <section className="ph-hero">
          <div className="ph-hero-inner">
            <div className="ph-badge">Harga Transparan</div>
            <h1 className="ph-h1">
              Pilih paket yang tepat<br />
              untuk sekolah Anda
            </h1>
            <p className="ph-desc">
              Mulai dengan demo gratis 1 bulan penuh — tanpa kartu kredit,
              tanpa syarat tersembunyi. Pilih paket setelah Anda merasakan manfaatnya.
            </p>
          </div>
        </section>

        {/* ─── PRICING CARDS ────────────────────────────── */}
        <section className="ph-dark">
          <div className="ph-cards">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`ph-card${plan.popular ? ' ph-card--popular' : ''}`}
              >
                {plan.popular && (
                  <div className="ph-popular-badge">Paling populer</div>
                )}

                <div className="ph-plan-name">{plan.name}</div>
                <div className="ph-plan-tagline">{plan.tagline}</div>

                <div className="ph-price">{plan.price}</div>
                <div className="ph-period">{plan.period}</div>

                <ul className="ph-features">
                  {plan.features.map((f) => (
                    <li key={f.label} className={f.on ? 'ph-feat-on' : 'ph-feat-off'}>
                      <span className="ph-dot" />
                      {f.label}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`ph-cta${plan.popular ? ' ph-cta--popular' : ''}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="ph-note">
            Semua paket termasuk demo gratis 1 bulan · Tidak perlu kartu kredit
          </p>
        </section>

        {/* ─── FAQ ──────────────────────────────────────── */}
        <section className="ph-faq-section">
          <div className="ph-faq-inner">
            <div className="section-label" style={{ textAlign: 'center' }}>Pertanyaan Umum</div>
            <h2 className="ph-faq-title">Ada yang ingin ditanyakan?</h2>

            <div className="ph-faq-grid">
              {FAQS.map((faq) => (
                <div key={faq.q} className="ph-faq-card">
                  <div className="ph-faq-q">{faq.q}</div>
                  <div className="ph-faq-a">{faq.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── BOTTOM CTA ───────────────────────────────── */}
        <section className="ph-cta-section">
          <div className="ph-cta-inner">
            <h2 className="ph-cta-title">Mulai sekarang. Gratis 1 bulan.</h2>
            <p className="ph-cta-sub">
              Lebih dari 50 sekolah sudah merasakan manfaatnya.
              Tidak perlu keahlian IT — tim kami bantu dari awal.
            </p>
            <Link href="/daftar" className="btn-primary">
              ✦ Daftar Demo Gratis Sekarang
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
