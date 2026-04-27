'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import './support.css'

const CHANNELS = [
  {
    icon: '💬',
    title: 'WhatsApp',
    desc: 'Chat langsung dengan tim kami. Respons rata-rata < 2 jam di hari kerja.',
    cta: 'Chat Sekarang',
    href: 'https://wa.me/6281234567890',
    accent: '#25D366',
  },
  {
    icon: '📧',
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

  return (
    <>
      <Navbar />

      <main>
        {/* ─── HERO ─────────────────────────────────────── */}
        <section className="sp-hero">
          <div className="sp-hero-inner">
            <div className="sp-badge">Pusat Bantuan</div>
            <h1 className="sp-h1">Kami siap membantu Anda</h1>
            <p className="sp-desc">
              Tim support SiKu siap menjawab pertanyaan Anda seputar fitur,
              teknis, maupun proses onboarding sekolah Anda.
            </p>
          </div>
        </section>

        {/* ─── CHANNELS ─────────────────────────────────── */}
        <section className="sp-channels-section">
          <div className="sp-inner">
            <div className="sp-channels-grid">
              {CHANNELS.map((ch) => (
                <a key={ch.title} href={ch.href} className="sp-channel-card" target={ch.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
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
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <div className="section-label">FAQ</div>
              <h2 className="section-title">Pertanyaan yang sering ditanyakan</h2>
            </div>

            <div className="sp-faq-cols">
              {FAQS.map((group) => (
                <div key={group.category}>
                  <div className="sp-faq-category">{group.category}</div>
                  {group.items.map((item) => {
                    const key = `${group.category}-${item.q}`
                    const open = openFaq === key
                    return (
                      <div key={item.q} className={`sp-faq-item${open ? ' sp-faq-open' : ''}`}>
                        <button className="sp-faq-q" onClick={() => toggle(key)}>
                          {item.q}
                          <span className="sp-faq-chevron">{open ? '−' : '+'}</span>
                        </button>
                        {open && <div className="sp-faq-a">{item.a}</div>}
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
            <div className="sp-form-left">
              <div className="section-label">Hubungi Kami</div>
              <h2 className="section-title" style={{ marginTop: '0.5rem' }}>
                Tidak menemukan jawaban?
              </h2>
              <p className="section-subtitle">
                Ceritakan kendala Anda dan tim kami akan segera merespons.
              </p>

              <div className="sp-contact-info">
                <div className="sp-contact-item">
                  <span>📧</span>
                  <a href="mailto:halo@siku.id">halo@siku.id</a>
                </div>
                <div className="sp-contact-item">
                  <span>💬</span>
                  <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer">
                    WhatsApp: 0812-3456-7890
                  </a>
                </div>
                <div className="sp-contact-item">
                  <span>🕐</span>
                  <span>Senin – Jumat, 08.00 – 17.00 WIB</span>
                </div>
              </div>
            </div>

            <div className="sp-form-right">
              {sent ? (
                <div className="sp-sent">
                  <div className="sp-sent-icon">✅</div>
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
            <h2 className="sp-cta-title">Belum punya akun SiKu?</h2>
            <p className="sp-cta-sub">
              Coba gratis 1 bulan penuh — tim kami bantu setup dari awal.
            </p>
            <Link href="/daftar" className="btn-primary">✦ Mulai Demo Gratis</Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
