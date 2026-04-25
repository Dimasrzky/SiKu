'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function HomePage() {

  // Scroll-reveal animation untuk elemen yang masuk viewport
  useEffect(() => {
    const targets = document.querySelectorAll(
      '.pain-card, .feat-card, .testi-card, .step'
    )

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1 }
    )

    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Navbar />

      {/* ─── HERO ─────────────────────────────────── */}
      <section className="hero">
        <div className="hero-inner">

          {/* Konten kiri */}
          <div>
            <div className="badge-free">
              Program DEMO Gratis 3 Bulan — Terbatas!
            </div>

            <h1>
              Sistem Keuangan Sekolah yang <em>Mudah</em> untuk Bendahara
            </h1>

            <p className="hero-desc">
              Kelola SPP, tagihan, dan laporan keuangan seluruh jenjang sekolah
              dalam satu platform. Notifikasi otomatis ke orang tua via WhatsApp.
              Tanpa ribet, tanpa manual.
            </p>

            <div className="hero-cta">
              <Link href="/daftar" className="btn-primary">
                ✦ Daftar Demo Gratis 3 Bulan
              </Link>
              <a href="#fitur" className="btn-secondary">
                Lihat Fitur
              </a>
            </div>

            <div className="hero-stats">
              <div>
                <div className="stat-num">100%</div>
                <div className="stat-label">Gratis 3 bulan pertama</div>
              </div>
              <div>
                <div className="stat-num">&lt; 1 jam</div>
                <div className="stat-label">Setup &amp; onboarding</div>
              </div>
              <div>
                <div className="stat-num">4 Jenjang</div>
                <div className="stat-label">TK · SD · SMP · SMA</div>
              </div>
            </div>
          </div>

          {/* Dashboard mockup kanan */}
          <div className="hero-visual">
            <div className="mockup-card">
              <div className="mockup-topbar">
                <div className="dot" style={{ background: '#FF5F56' }} />
                <div className="dot" style={{ background: '#FFBD2E' }} />
                <div className="dot" style={{ background: '#27C93F' }} />
                <div className="mockup-topbar-title">
                  SiKu — Dashboard Bendahara Sekolah
                </div>
              </div>
              <div className="mockup-body">
                <div className="mockup-greeting">Selamat pagi, Bu Sari 👋</div>
                <div className="mockup-title">Rekap SPP — April 2025</div>
                <div className="mockup-stats">
                  <div className="mstat">
                    <div className="mstat-val">187</div>
                    <div className="mstat-lbl">Total Siswa</div>
                  </div>
                  <div className="mstat">
                    <div className="mstat-val" style={{ color: 'var(--emerald)' }}>142</div>
                    <div className="mstat-lbl">Lunas</div>
                  </div>
                  <div className="mstat">
                    <div className="mstat-val" style={{ color: '#D97706' }}>45</div>
                    <div className="mstat-lbl">Belum Bayar</div>
                  </div>
                </div>
                <div className="mockup-table-head">
                  <span>Nama Siswa</span>
                  <span>Kelas</span>
                  <span>Tagihan</span>
                  <span>Status</span>
                </div>
                {[
                  { nama: 'Alif Ramadhan', kelas: 'VII-A', status: 'lunas' },
                  { nama: 'Budi Santoso', kelas: 'VIII-B', status: 'terlambat' },
                  { nama: 'Citra Dewi', kelas: 'IX-A', status: 'belum' },
                  { nama: 'Dina Putri', kelas: 'VII-C', status: 'lunas' },
                ].map((row) => (
                  <div className="mockup-row" key={row.nama}>
                    <span>{row.nama}</span>
                    <span>{row.kelas}</span>
                    <span>Rp 450rb</span>
                    <span>
                      {row.status === 'lunas' && <div className="badge-lunas">Lunas</div>}
                      {row.status === 'terlambat' && <div className="badge-terlambat">Terlambat</div>}
                      {row.status === 'belum' && <div className="badge-belum">Menunggu</div>}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mockup-footer">
                <span>
                  💬 <strong>23 notifikasi WA</strong> terkirim otomatis
                </span>
                <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>
                  Rp 63.900.000 terkumpul
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── PAIN POINTS ──────────────────────────── */}
      <section className="section">
        <div className="section-inner">
          <div style={{ textAlign: 'center' }}>
            <div className="section-label">Masalah Yang Sering Terjadi</div>
            <h2 className="section-title">
              Bendahara sekolah & yayasan kewalahan?
              <br />Kami paham.
            </h2>
            <p className="section-subtitle" style={{ margin: '0 auto', textAlign: 'center' }}>
              Tanpa sistem yang tepat, pekerjaan administratif keuangan sekolah
              bisa memakan waktu berjam-jam setiap hari.
            </p>
          </div>

          <div className="pain-grid">
            {[
              {
                num: '1',
                icon: '📋',
                title: 'Rekap SPP Manual di Excel',
                desc: 'Data ratusan siswa diinput satu per satu. Rentan salah ketik, susah dicari, sering tidak sinkron antar jenjang.',
              },
              {
                num: '2',
                icon: '📞',
                title: 'Menghubungi Orang Tua Secara Manual',
                desc: 'Reminder tunggakan SPP lewat telepon atau WhatsApp satu-satu. Menyita waktu, sering tidak tersampaikan.',
              },
              {
                num: '3',
                icon: '📑',
                title: 'Laporan Keuangan yang Tidak Real-time',
                desc: 'Kepala sekolah dan yayasan harus menunggu akhir bulan untuk melihat kondisi keuangan. Keputusan terlambat.',
              },
              {
                num: '4',
                icon: '🔒',
                title: 'Data Berceceran & Tidak Aman',
                desc: 'File Excel bisa hilang, tertimpa, atau diakses sembarang pihak. Tidak ada backup otomatis dan audit trail.',
              },
            ].map((item) => (
              <div className="pain-card" data-num={item.num} key={item.num}>
                <div className="pain-icon">{item.icon}</div>
                <div className="pain-title">{item.title}</div>
                <div className="pain-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FITUR ────────────────────────────────── */}
      <section className="section features-bg" id="fitur">
        <div className="section-inner">
          <div className="section-label">Solusi SiKu</div>
          <h2 className="section-title">
            Semua yang dibutuhkan
            <br />yayasan & bendahara sekolah swasta Indonesia
          </h2>
          <p className="section-subtitle">
            Dirancang khusus untuk alur kerja keuangan sekolah swasta Indonesia,
            dari TK hingga SMA.
          </p>

          <div className="features-grid">
            {[
              {
                icon: '💰',
                title: 'Manajemen SPP & Tagihan',
                desc: 'Generate tagihan otomatis setiap bulan untuk seluruh siswa. Kelola berbagai jenis biaya dalam satu sistem.',
                items: ['SPP, uang gedung, ekskul, dll.', 'Tagihan per kelas/jenjang/yayasan', 'Cicilan & diskon otomatis', 'Riwayat pembayaran lengkap'],
                highlight: true,
                badge: 'UNGGULAN',
              },
              {
                icon: '💬',
                title: 'Notifikasi WhatsApp Otomatis',
                desc: 'Sistem kirim pesan WA otomatis ke orang tua — tagihan, konfirmasi bayar, hingga pengingat tunggakan.',
                items: ['Reminder H-3, H-1 jatuh tempo', 'Konfirmasi pembayaran instan', 'Laporan bulanan ke orang tua'],
              },
              {
                icon: '🏦',
                title: 'Integrasi Pembayaran Digital',
                desc: 'Orang tua bayar via transfer bank, virtual account, atau QRIS. Dana otomatis terverifikasi di sistem.',
                items: ['Virtual Account semua bank', 'QRIS & e-wallet populer', 'Rekonsiliasi otomatis harian'],
              },
              {
                icon: '📊',
                title: 'Laporan & Dashboard Real-time',
                desc: 'Kepala sekolah dan yayasan pantau kondisi keuangan kapan saja. Ekspor ke Excel/PDF sekali klik.',
                items: ['Dashboard tunggakan & pelunasan', 'Laporan per jenjang & kelas', 'Ekspor Excel & PDF'],
              },
              {
                icon: '🏫',
                title: 'Multi-Jenjang & Multi-Sekolah',
                desc: 'Satu akun yayasan untuk mengelola TK, SD, SMP, dan SMA sekaligus. Laporan konsolidasi yayasan tersedia.',
                items: ['TK/PAUD · SD · SMP · SMA', 'Laporan konsolidasi yayasan', 'Pengaturan biaya per jenjang'],
              },
              {
                icon: '👥',
                title: 'Manajemen Siswa & Kelas',
                desc: 'Data master siswa terintegrasi dengan sistem keuangan. Import data siswa dari Excel dengan mudah.',
                items: ['Import data siswa via Excel', 'Naik kelas & pindah sekolah', 'Riwayat keuangan per siswa'],
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className={`feat-card${feat.highlight ? ' highlight' : ''}`}
              >
                {feat.badge && <div className="feat-badge">{feat.badge}</div>}
                <div className="feat-icon-wrap">{feat.icon}</div>
                <div className="feat-title">{feat.title}</div>
                <div className="feat-desc">{feat.desc}</div>
                <ul className="feat-list">
                  {feat.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CARA KERJA ───────────────────────────── */}
      <section className="section" id="cara-kerja">
        <div className="section-inner">
          <div style={{ textAlign: 'center' }}>
            <div className="section-label">Cara Kerja</div>
            <h2 className="section-title">Mulai dalam 3 langkah mudah</h2>
            <p className="section-subtitle" style={{ margin: '0 auto', textAlign: 'center' }}>
              Tidak perlu keahlian IT. Tim kami siap bantu setup dari awal
              hingga sekolah siap pakai.
            </p>
          </div>

          <div className="steps">
            {[
              {
                num: '1',
                title: 'Daftar & Isi Data Sekolah',
                desc: 'Isi formulir singkat. Tim kami hubungi dalam 1x24 jam untuk membantu proses setup awal sistem Anda.',
              },
              {
                num: '2',
                title: 'Import Data Siswa',
                desc: 'Upload data siswa dari Excel yang sudah ada. Sistem langsung siap generate tagihan untuk seluruh siswa.',
              },
              {
                num: '3',
                title: 'Sistem Berjalan Otomatis',
                desc: 'Tagihan dikirim, WA terkirim, pembayaran masuk — semua terpantau di dashboard real-time Anda.',
              },
            ].map((step) => (
              <div className="step" key={step.num}>
                <div className="step-num">{step.num}</div>
                <div className="step-title">{step.title}</div>
                <div className="step-desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONI ────────────────────────────── */}
      <section className="section features-bg">
        <div className="section-inner">
          <div style={{ textAlign: 'center' }}>
            <div className="section-label">Dari Bendahara Sekolah</div>
            <h2 className="section-title">Yang mereka rasakan</h2>
          </div>

          <div className="testi-grid">
            {[
              {
                stars: '★★★★★',
                quote: 'Dulu rekap SPP 3 jenjang bisa sampai 2 hari. Sekarang tinggal buka dashboard, semua sudah tersedia. WA ke orang tua juga otomatis, saya tidak perlu ketik satu-satu lagi.',
                initials: 'SR',
                color: '#1A3557',
                name: 'Sri Rahayu, S.Pd',
                school: 'Bendahara · SDIT Al-Hikmah, Yogyakarta',
              },
              {
                stars: '★★★★★',
                quote: 'Yayasan kami punya 3 sekolah. Sebelumnya laporan keuangan masing-masing tidak bisa dibandingkan. Sekarang bisa lihat konsolidasi semua sekolah dalam satu layar.',
                initials: 'BW',
                color: '#059669',
                name: 'Bambang Wicaksono',
                school: 'Bendahara Yayasan · Yayasan Pendidikan Nusantara',
              },
              {
                stars: '★★★★☆',
                quote: 'Awalnya saya pikir sulit dipakai karena tidak biasa dengan aplikasi. Ternyata mudah sekali. Support-nya juga cepat respons. Orang tua senang bisa bayar SPP lewat transfer langsung.',
                initials: 'DN',
                color: '#D97706',
                name: 'Dewi Nuraini',
                school: 'Bendahara · TK & SD Islam Terpadu Ceria',
              },
            ].map((t) => (
              <div className="testi-card" key={t.name}>
                <div className="stars">{t.stars}</div>
                <div className="testi-quote">&ldquo;{t.quote}&rdquo;</div>
                <div className="testi-author">
                  <div className="author-avatar" style={{ background: t.color }}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="author-name">{t.name}</div>
                    <div className="author-school">{t.school}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING CTA ──────────────────────────── */}
      <section className="section pricing-section" id="harga">
        <div className="pricing-inner">
          <div className="pricing-label">Program Pilot — Terbatas</div>
          <h2 className="pricing-title">
            3 Bulan Gratis.
            <br />Tanpa syarat tersembunyi.
          </h2>
          <p className="pricing-subtitle">
            Kami tahu sekolah perlu membuktikan manfaat sebelum berkomitmen.
            Karena itu kami tawarkan demo penuh — bukan versi terbatas — selama 3 bulan.
          </p>

          <div className="pricing-card">
            <div className="price-tag">Rp 0</div>
            <div className="price-sub">
              Selama 3 bulan pertama · Tidak perlu kartu kredit
            </div>
            <div className="price-features">
              {[
                'Semua fitur lengkap', 'Tidak ada batas siswa',
                'Notifikasi WhatsApp', 'Laporan & Dashboard',
                'Onboarding oleh tim kami', 'Dukungan teknis',
                'Export Excel & PDF', 'Multi-jenjang sekolah',
              ].map((f) => (
                <span className="price-feat-item" key={f}>{f}</span>
              ))}
            </div>
            <Link href="/daftar" className="btn-cta-big">
              Mulai Demo Gratis Sekarang →
            </Link>
            <div className="cta-note">
              Setelah 3 bulan, pilih lanjut atau berhenti — tanpa paksaan
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}