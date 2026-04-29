'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Wallet, Landmark, BarChart3, Building2, GraduationCap, FileSpreadsheet, PhoneCall, Clock4, ShieldAlert } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const IkonWA = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

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
              Program DEMO Gratis 1 Bulan!
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
                ✦ Daftar Demo Gratis 1 Bulan
              </Link>
              <a href="#fitur" className="btn-secondary">
                Lihat Fitur
              </a>
            </div>

            <div className="hero-stats">
              <div>
                <div className="stat-num">100%</div>
                <div className="stat-label">Gratis 1 bulan pertama</div>
              </div>
              <div>
                <div className="stat-num">&lt; 1 jam</div>
                <div className="stat-label">Setup &amp; onboarding</div>
              </div>
              <div>
                <div className="stat-num">5 Jenjang</div>
                <div className="stat-label">TK · SD · SMP · SMA · SMK</div>
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
                <div className="mockup-title">Rekap SPP — April 2026</div>
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
                <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true" style={{ flexShrink:0 }}>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <strong>23 notifikasi WA</strong> terkirim otomatis
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
              Keuangan kewalahan?
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
                icon: <FileSpreadsheet size={22} />,
                title: 'Rekap SPP Manual di Excel',
                desc: 'Data ratusan siswa diinput satu per satu. Rentan salah ketik, susah dicari, sering tidak sinkron antar jenjang.',
              },
              {
                num: '2',
                icon: <PhoneCall size={22} />,
                title: 'Menghubungi Orang Tua Secara Manual',
                desc: 'Reminder tunggakan SPP lewat telepon atau WhatsApp satu-satu. Menyita waktu, sering tidak tersampaikan.',
              },
              {
                num: '3',
                icon: <Clock4 size={22} />,
                title: 'Laporan Keuangan yang Tidak Real-time',
                desc: 'Kepala sekolah dan yayasan harus menunggu akhir bulan untuk melihat kondisi keuangan. Keputusan terlambat.',
              },
              {
                num: '4',
                icon: <ShieldAlert size={22} />,
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
            dari TK hingga SMA/SMK.
          </p>

          <div className="features-grid">
            {[
              {
                icon: <Wallet size={24} />,
                iconBg: '#EFF6FF', iconColor: '#1D4ED8',
                title: 'Manajemen SPP & Tagihan',
                desc: 'Generate tagihan otomatis setiap bulan untuk seluruh siswa. Kelola berbagai jenis biaya dalam satu sistem.',
                items: ['SPP, uang gedung, ekskul, dll.', 'Tagihan per kelas/jenjang/yayasan', 'Cicilan & diskon otomatis', 'Riwayat pembayaran lengkap'],
                highlight: true,
                badge: 'UNGGULAN',
              },
              {
                icon: <IkonWA />,
                iconBg: '#F0FDF4', iconColor: '#16A34A',
                title: 'Notifikasi WhatsApp Otomatis',
                desc: 'Sistem kirim pesan WA otomatis ke orang tua — tagihan, konfirmasi bayar, hingga pengingat tunggakan.',
                items: ['Reminder H-3, H-1 jatuh tempo', 'Konfirmasi pembayaran instan', 'Laporan bulanan ke orang tua'],
              },
              {
                icon: <Landmark size={24} />,
                iconBg: '#FFF7ED', iconColor: '#C2410C',
                title: 'Integrasi Pembayaran Digital',
                desc: 'Orang tua bayar via transfer bank, virtual account, atau QRIS. Dana otomatis terverifikasi di sistem.',
                items: ['Virtual Account semua bank', 'QRIS & e-wallet populer', 'Rekonsiliasi otomatis harian'],
              },
              {
                icon: <BarChart3 size={24} />,
                iconBg: '#F5F3FF', iconColor: '#7C3AED',
                title: 'Laporan & Dashboard Real-time',
                desc: 'Kepala sekolah dan yayasan pantau kondisi keuangan kapan saja. Ekspor ke Excel/PDF sekali klik.',
                items: ['Dashboard tunggakan & pelunasan', 'Laporan per jenjang & kelas', 'Ekspor Excel & PDF'],
              },
              {
                icon: <Building2 size={24} />,
                iconBg: '#FFF1F2', iconColor: '#BE123C',
                title: 'Multi-Jenjang & Multi-Sekolah',
                desc: 'Satu akun yayasan untuk mengelola TK, SD, SMP, dan SMA sekaligus. Laporan konsolidasi yayasan tersedia.',
                items: ['TK/PAUD · SD · SMP · SMA', 'Laporan konsolidasi yayasan', 'Pengaturan biaya per jenjang'],
              },
              {
                icon: <GraduationCap size={24} />,
                iconBg: '#ECFDF5', iconColor: '#059669',
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
                <div className="feat-icon-wrap" style={{ background: feat.iconBg, color: feat.iconColor }}>{feat.icon}</div>
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
          <h2 className="pricing-title">
            1 Bulan Gratis.
            <br />Tanpa syarat tersembunyi.
          </h2>
          <p className="pricing-subtitle">
            Kami tahu sekolah perlu membuktikan manfaat sebelum berkomitmen.
            Karena itu kami tawarkan demo penuh — bukan versi terbatas — selama 1 bulan.
          </p>

          <div className="pricing-card">
            <div className="price-tag">Rp 0</div>
            <div className="price-sub">
              Selama 1 bulan pertama · Tidak perlu kartu kredit
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
              Mulai Demo Gratis Sekarang
            </Link>
            <div className="cta-note">
              Setelah 1 bulan, pilih lanjut atau berhenti — tanpa paksaan
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}