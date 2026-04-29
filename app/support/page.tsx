'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Mail, Clock, CheckCircle2, ChevronDown } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import './support.css'

const IkonWA = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const CHANNELS = [
  {
    icon: <IkonWA size={24} />,
    title: 'WhatsApp',
    desc: 'Chat langsung dengan tim kami. Respons rata-rata < 2 jam di hari kerja.',
    cta: 'Chat Sekarang',
    href: 'https://wa.me/6281234567890',
    accent: '#25D366',
  },
  {
    icon: <Mail size={24} />,
    title: 'Email',
    desc: 'Kirim pertanyaan detail ke email kami. Kami balas dalam 1×24 jam.',
    cta: 'Kirim Email',
    href: 'mailto:halo@siku.id',
    accent: 'var(--navy)',
  },
]

const FAQS = [
  {
    category: 'Akun & Akses',
    items: [
      {
        q: 'Bagaimana cara mendaftar akun SiKu?',
        a: 'Klik tombol "Coba Gratis" di halaman utama, isi formulir singkat, dan tim kami akan menghubungi Anda dalam 1×24 jam untuk proses setup awal.',
      },
      {
        q: 'Berapa banyak pengguna yang bisa ditambahkan?',
        a: 'Tidak ada batasan jumlah pengguna. Anda bisa menambahkan kepala sekolah, bendahara, staf TU, dan pengurus yayasan dengan level akses berbeda.',
      },
      {
        q: 'Apakah bisa mengakses SiKu dari HP?',
        a: 'Ya. SiKu berjalan di browser (Chrome, Safari, dll.) di HP, tablet, maupun PC — tanpa perlu instal aplikasi tambahan.',
      },
    ],
  },
  {
    category: 'Data & Keamanan',
    items: [
      {
        q: 'Apakah data siswa kami aman?',
        a: 'Data tersimpan di server Indonesia dengan enkripsi end-to-end. Kami tidak menjual atau berbagi data ke pihak ketiga, dan backup otomatis dilakukan setiap hari.',
      },
      {
        q: 'Bagaimana cara import data siswa dari Excel?',
        a: 'Unduh template Excel dari halaman "Data Siswa", isi sesuai format, lalu upload. Sistem akan memverifikasi dan mengimpor data secara otomatis.',
      },
    ],
  },
  {
    category: 'Tagihan & Pembayaran',
    items: [
      {
        q: 'Apakah orang tua bisa bayar SPP lewat transfer bank?',
        a: 'Ya. SiKu mendukung Virtual Account semua bank besar, QRIS, dan e-wallet (GoPay, OVO, Dana). Pembayaran otomatis terverifikasi dan tercatat di sistem.',
      },
      {
        q: 'Bagaimana notifikasi WhatsApp dikirim ke orang tua?',
        a: 'Sistem mengirim WA otomatis saat tagihan terbit, H-3 & H-1 sebelum jatuh tempo, dan saat pembayaran berhasil. Anda bisa kustomisasi template pesannya.',
      },
      {
        q: 'Bisa buat jenis tagihan selain SPP?',
        a: 'Tentu. Anda bisa membuat tagihan untuk uang gedung, ekskul, study tour, seragam, dan lainnya — masing-masing dengan pengaturan jatuh tempo dan nominal sendiri.',
      },
    ],
  },
]

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [form, setForm] = useState({ nama: '', email: '', sekolah: '', pesan: '' })
  const [sent, setSent] = useState(false)

  const toggle = (key: string) => setOpenFaq(openFaq === key ? null : key)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSent(true)
  }

  // Scroll-reveal: add .is-visible when element enters viewport
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-animate]')
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-visible') }),
      { threshold: 0.12 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  })

  return (
    <>
      <Navbar />

      <main>
        {/* ─── HERO ─────────────────────────────────────── */}
        <section className="sp-hero">
          <div className="sp-hero-inner">
            <div className="sp-badge sp-badge-anim">Pusat Bantuan</div>
            <h1 className="sp-h1 sp-h1-anim">Kami siap membantu Anda</h1>
            <p className="sp-desc sp-desc-anim">
              Tim support SiKu siap menjawab pertanyaan Anda seputar fitur,
              teknis, maupun proses onboarding sekolah Anda.
            </p>
          </div>
        </section>

        {/* ─── CHANNELS ─────────────────────────────────── */}
        <section className="sp-channels-section">
          <div className="sp-inner">
            <div className="sp-channels-grid">
              {CHANNELS.map((ch, i) => (
                <a
                  key={ch.title}
                  href={ch.href}
                  className="sp-channel-card"
                  target={ch.href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
                  data-animate
                  style={{ '--delay': `${i * 0.12}s` } as React.CSSProperties}
                >
                  <div className="sp-ch-icon" style={{ background: `${ch.accent}18`, color: ch.accent }}>
                    {ch.icon}
                  </div>
                  <div className="sp-ch-title">{ch.title}</div>
                  <div className="sp-ch-desc">{ch.desc}</div>
                  <div className="sp-ch-cta" style={{ color: ch.accent }}>{ch.cta} →</div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ──────────────────────────────────────── */}
        <section className="sp-faq-section">
          <div className="sp-inner">
            <div data-animate style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <div className="section-label">FAQ</div>
              <h2 className="section-title">Pertanyaan yang sering ditanyakan</h2>
            </div>

            <div className="sp-faq-cols">
              {FAQS.map((group, gi) => (
                <div
                  key={group.category}
                  data-animate
                  style={{ '--delay': `${gi * 0.13}s` } as React.CSSProperties}
                >
                  <div className="sp-faq-category">{group.category}</div>
                  {group.items.map((item) => {
                    const key = `${group.category}-${item.q}`
                    const open = openFaq === key
                    return (
                      <div key={item.q} className={`sp-faq-item${open ? ' sp-faq-open' : ''}`}>
                        <button className="sp-faq-q" onClick={() => toggle(key)}>
                          {item.q}
                          <span className="sp-faq-chevron"><ChevronDown size={16} /></span>
                        </button>
                        <div className="sp-faq-body">
                          <div className="sp-faq-body-inner">
                            <div className="sp-faq-a">{item.a}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CONTACT FORM ─────────────────────────────── */}
        <section className="sp-form-section">
          <div className="sp-form-inner">
            <div
              className="sp-form-left"
              data-animate="slide-left"
            >
              <div className="section-label">Hubungi Kami</div>
              <h2 className="section-title" style={{ marginTop: '0.5rem' }}>
                Tidak menemukan jawaban?
              </h2>
              <p className="section-subtitle">
                Ceritakan kendala Anda dan tim kami akan segera merespons.
              </p>

              <div className="sp-contact-info">
                <div className="sp-contact-item">
                  <Mail size={16} />
                  <a href="mailto:halo@siku.id">halo@siku.id</a>
                </div>
                <div className="sp-contact-item">
                  <IkonWA size={16} />
                  <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer">
                    WhatsApp: 0812-3456-7890
                  </a>
                </div>
                <div className="sp-contact-item">
                  <Clock size={16} />
                  <span>Senin – Jumat, 08.00 – 17.00 WIB</span>
                </div>
              </div>
            </div>

            <div
              className="sp-form-right"
              data-animate="slide-right"
              style={{ '--delay': '0.1s' } as React.CSSProperties}
            >
              {sent ? (
                <div className="sp-sent">
                  <div className="sp-sent-icon"><CheckCircle2 size={40} color="var(--emerald)" /></div>
                  <div className="sp-sent-title">Pesan Terkirim!</div>
                  <p className="sp-sent-desc">
                    Terima kasih. Tim kami akan menghubungi Anda dalam 1×24 jam.
                  </p>
                  <button className="sp-sent-reset" onClick={() => { setSent(false); setForm({ nama:'', email:'', sekolah:'', pesan:'' }) }}>
                    Kirim pesan lain
                  </button>
                </div>
              ) : (
                <form className="sp-form" onSubmit={handleSubmit}>
                  <div className="sp-field">
                    <label>Nama Lengkap</label>
                    <input
                      required
                      placeholder="cth: Sri Rahayu"
                      value={form.nama}
                      onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                    />
                  </div>
                  <div className="sp-field">
                    <label>Email</label>
                    <input
                      required
                      type="email"
                      placeholder="cth: bendahara@sekolah.sch.id"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="sp-field">
                    <label>Nama Sekolah / Yayasan</label>
                    <input
                      placeholder="cth: SDIT Al-Hikmah"
                      value={form.sekolah}
                      onChange={e => setForm(f => ({ ...f, sekolah: e.target.value }))}
                    />
                  </div>
                  <div className="sp-field">
                    <label>Pesan</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Jelaskan pertanyaan atau kendala Anda..."
                      value={form.pesan}
                      onChange={e => setForm(f => ({ ...f, pesan: e.target.value }))}
                    />
                  </div>
                  <button type="submit" className="sp-submit">Kirim Pesan</button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ─── BOTTOM CTA ───────────────────────────────── */}
        <section className="sp-cta-section">
          <div className="sp-cta-inner">
            <h2 className="sp-cta-title" data-animate>Belum punya akun SiKu?</h2>
            <p className="sp-cta-sub" data-animate style={{ '--delay': '0.1s' } as React.CSSProperties}>
              Coba gratis 1 bulan penuh — tim kami bantu setup dari awal.
            </p>
            <Link href="/daftar" className="btn-primary" data-animate style={{ '--delay': '0.2s' } as React.CSSProperties}>✦ Mulai Demo Gratis</Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
