'use client'

import Link from 'next/link'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

interface FormData {
  nama: string
  wa: string
  jabatan: string
  sekolah: string
  jenjang: string
  jumlah: string
  kota: string
  tantangan: string
}

interface FormErrors {
  nama?: string
  wa?: string
  jabatan?: string
  sekolah?: string
  jenjang?: string
  kota?: string
}

const JENJANG_OPTIONS = [
  'TK / PAUD',
  'SD / MI',
  'SMP / MTs',
  'SMA / SMK / MA',
  'Multi-jenjang (Yayasan)',
]

const JUMLAH_OPTIONS = [
  'Di bawah 100 siswa',
  '100 – 300 siswa',
  '300 – 600 siswa',
  'Di atas 600 siswa',
]

const JABATAN_OPTIONS = [
  'Bendahara Sekolah',
  'Bendahara Yayasan',
]

export default function DaftarPage() {
  const [form, setForm] = useState<FormData>({
    nama: '',
    wa: '',
    jabatan: '',
    sekolah: '',
    jenjang: '',
    jumlah: '',
    kota: '',
    tantangan: '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Hapus error saat user mulai mengetik
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    const phoneRegex = /^(08|628|\+628)[0-9]{8,11}$/

    if (!form.nama.trim()) newErrors.nama = 'Nama wajib diisi'
    if (!form.wa.trim()) {
      newErrors.wa = 'Nomor WhatsApp wajib diisi'
    } else if (!phoneRegex.test(form.wa.replace(/\s/g, ''))) {
      newErrors.wa = 'Format tidak valid. Contoh: 081234567890'
    }
    if (!form.jabatan) newErrors.jabatan = 'Pilih jabatan Anda'
    if (!form.sekolah.trim()) newErrors.sekolah = 'Nama sekolah wajib diisi'
    if (!form.jenjang) newErrors.jenjang = 'Pilih jenjang sekolah'
    if (!form.kota.trim()) newErrors.kota = 'Kota wajib diisi'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)

    // ─── TODO: Kirim data ke backend / Google Sheets ────────────
    // Contoh: fetch('/api/leads', { method: 'POST', body: JSON.stringify(form) })
    // Sementara simulasi delay 1.5 detik untuk UX
    await new Promise((res) => setTimeout(res, 1500))

    console.log('Lead captured:', form)
    setIsSubmitting(false)
    setIsSuccess(true)
  }

  const waMessage = encodeURIComponent(
    `Halo EduKas, saya ${form.nama || 'baru saja'} mendaftar demo gratis. Sekolah saya: ${form.sekolah || '-'}. Mohon bantu proses onboarding.`
  )

  return (
    <>
      <Navbar />

      <div className="form-page">
        <div className="form-page-inner">

          {/* Tombol kembali */}
          <Link href="/" className="form-page-back">
            ← Kembali ke beranda
          </Link>

          <div className="form-wrapper">
            {!isSuccess ? (
              <>
                <div className="form-header-label">Demo Gratis 1 Bulan</div>
                <h1 className="form-title">Daftar Sekarang</h1>
                <p className="form-subtitle">
                  Isi formulir di bawah. Tim kami akan menghubungi Anda melalui
                  WhatsApp dalam <strong>1×24 jam</strong> untuk proses onboarding.
                  Tidak perlu tanda tangan kontrak, tidak perlu kartu kredit.
                </p>

                {/* Nama & WA */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="nama">
                      Nama Lengkap <span>*</span>
                    </label>
                    <input
                      id="nama"
                      name="nama"
                      type="text"
                      className={`form-input${errors.nama ? ' error' : ''}`}
                      placeholder="cth: Bu Sari Dewi"
                      value={form.nama}
                      onChange={handleChange}
                    />
                    {errors.nama && (
                      <div className="form-error-msg">{errors.nama}</div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="wa">
                      No. WhatsApp Aktif <span>*</span>
                    </label>
                    <input
                      id="wa"
                      name="wa"
                      type="tel"
                      className={`form-input${errors.wa ? ' error' : ''}`}
                      placeholder="cth: 081234567890"
                      value={form.wa}
                      onChange={handleChange}
                    />
                    {errors.wa && (
                      <div className="form-error-msg">{errors.wa}</div>
                    )}
                  </div>
                </div>

                {/* Jabatan */}
                <div className="form-group">
                  <label className="form-label" htmlFor="jabatan">
                    Jabatan Anda <span>*</span>
                  </label>
                  <select
                    id="jabatan"
                    name="jabatan"
                    className={`form-select${errors.jabatan ? ' error' : ''}`}
                    value={form.jabatan}
                    onChange={handleChange}
                  >
                    <option value="">-- Pilih Jabatan --</option>
                    {JABATAN_OPTIONS.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                  {errors.jabatan && (
                    <div className="form-error-msg">{errors.jabatan}</div>
                  )}
                </div>

                {/* Nama Sekolah */}
                <div className="form-group">
                  <label className="form-label" htmlFor="sekolah">
                    Nama Sekolah / Yayasan <span>*</span>
                  </label>
                  <input
                    id="sekolah"
                    name="sekolah"
                    type="text"
                    className={`form-input${errors.sekolah ? ' error' : ''}`}
                    placeholder="cth: SD Islam Terpadu Al-Hikmah"
                    value={form.sekolah}
                    onChange={handleChange}
                  />
                  {errors.sekolah && (
                    <div className="form-error-msg">{errors.sekolah}</div>
                  )}
                </div>

                {/* Jenjang & Jumlah Siswa */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="jenjang">
                      Jenjang Sekolah <span>*</span>
                    </label>
                    <select
                      id="jenjang"
                      name="jenjang"
                      className={`form-select${errors.jenjang ? ' error' : ''}`}
                      value={form.jenjang}
                      onChange={handleChange}
                    >
                      <option value="">-- Pilih Jenjang --</option>
                      {JENJANG_OPTIONS.map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                    {errors.jenjang && (
                      <div className="form-error-msg">{errors.jenjang}</div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="jumlah">
                      Jumlah Siswa (estimasi)
                    </label>
                    <select
                      id="jumlah"
                      name="jumlah"
                      className="form-select"
                      value={form.jumlah}
                      onChange={handleChange}
                    >
                      <option value="">-- Pilih Rentang --</option>
                      {JUMLAH_OPTIONS.map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Kota */}
                <div className="form-group">
                  <label className="form-label" htmlFor="kota">
                    Kota / Kabupaten <span>*</span>
                  </label>
                  <input
                    id="kota"
                    name="kota"
                    type="text"
                    className={`form-input${errors.kota ? ' error' : ''}`}
                    placeholder="cth: Yogyakarta"
                    value={form.kota}
                    onChange={handleChange}
                  />
                  {errors.kota && (
                    <div className="form-error-msg">{errors.kota}</div>
                  )}
                </div>

                {/* Tantangan */}
                <div className="form-group">
                  <label className="form-label" htmlFor="tantangan">
                    Tantangan utama yang ingin diselesaikan
                  </label>
                  <textarea
                    id="tantangan"
                    name="tantangan"
                    className="form-textarea"
                    rows={3}
                    placeholder="cth: Rekap SPP masih manual di Excel, susah pantau tunggakan..."
                    value={form.tantangan}
                    onChange={handleChange}
                  />
                </div>

                <button
                  className="submit-btn"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Mendaftarkan...'
                    : 'Daftar Sekarang — 100% Gratis 1 Bulan ✦'}
                </button>

                <div className="form-privacy">
                  🔒 Data Anda aman dan tidak akan disebarkan ke pihak ketiga manapun.
                  <br />
                  Dengan mendaftar, Anda setuju untuk dihubungi oleh tim EduKas melalui WhatsApp.
                </div>
              </>
            ) : (
              /* ─── SUCCESS STATE ─── */
              <div className="success-state">
                <div className="success-icon">✅</div>
                <div className="success-title">Pendaftaran Berhasil!</div>
                <div className="success-desc">
                  Terima kasih sudah mendaftar, <strong>{form.nama}</strong>!
                  <br /><br />
                  Tim EduKas akan menghubungi Anda melalui WhatsApp dalam{' '}
                  <strong>1×24 jam</strong> untuk memulai proses onboarding
                  sekolah <strong>{form.sekolah}</strong>.
                  <br /><br />
                  Sambil menunggu, Anda bisa langsung chat dengan tim kami.
                </div>

                <a
                  href={`https://wa.me/6281234567890?text=${waMessage}`}
                  className="whatsapp-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Chat WhatsApp Tim EduKas
                </a>
              </div>
            )}
          </div>

        </div>
      </div>

      <Footer />
    </>
  )
}