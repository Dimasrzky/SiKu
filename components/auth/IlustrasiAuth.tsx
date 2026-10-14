'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { MockupDasbor, DATA_AWAL, type DataDemo } from './MockupDasbor'
import { GelembungWA, KartuTransfer, TombolIngatkanDemo, type FaseIngatkan } from './ElemenApung'

// Sisi kiri halaman login & daftar: sambutan, mockup dasbor, tiga elemen mengambang,
// dan logo pojok. Animasi masuk & naik-turun murni CSS (auth.css); komponen ini hanya
// menjalankan siklus tombol Ingatkan dan angka dasbor:
//   klik → "Mengirim…" 3 detik → kembali "Ingatkan" → satu pembayaran masuk senilai
//   kartu Transfer Berhasil (Rp 500.000): tunggakan dan "Belum dibayar" turun Rp 500.000,
//   "Terkumpul bulan ini" naik Rp 500.000, siswa belum bayar −1, bar Terkumpul +1%,
//   siswa menunggak −1 tiap dua siklus. Setelah beberapa siklus angka memudar dan kembali
//   ke angka mockup, lalu siklus berulang.

const NOMINAL_TRANSFER = 500_000
const SIKLUS_SEBELUM_ULANG = 6
const JEDA_AWAL_MS = 3200     // animasi masuk selesai ±1,6 detik; klik pertama menyusul
const LAMA_TEKAN_MS = 350
const LAMA_MENGIRIM_MS = 3000
const JEDA_SEBELUM_ANGKA_MS = 400
const JEDA_ANTAR_KLIK_MS = 4250

const satuPembayaran = (d: DataDemo, siklus: number): DataDemo => ({
  tunggakan:    d.tunggakan - NOMINAL_TRANSFER,
  belumBayar:   d.belumBayar - 1,
  menunggak:    siklus % 2 === 0 ? d.menunggak - 1 : d.menunggak,
  persen:       d.persen + 1,
  terkumpul:    d.terkumpul + NOMINAL_TRANSFER,
  belumDibayar: d.belumDibayar - NOMINAL_TRANSFER,
})

export const IlustrasiAuth = () => {
  const [fase, setFase] = useState<FaseIngatkan>('siap')
  const [data, setData] = useState<DataDemo>(DATA_AWAL)
  const [ulang, setUlang] = useState(false)

  useEffect(() => {
    // Gerakan dikurangi: tombol dan angka tetap diam seperti mockup
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let batal = false
    const timer = new Set<number>()
    const tunda = (ms: number) => new Promise<void>((selesai) => {
      const id = window.setTimeout(() => { timer.delete(id); selesai() }, ms)
      timer.add(id)
    })

    const jalankan = async () => {
      await tunda(JEDA_AWAL_MS)
      let siklus = 0
      while (!batal) {
        setFase('ditekan')
        await tunda(LAMA_TEKAN_MS)
        setFase('mengirim')
        await tunda(LAMA_MENGIRIM_MS)
        setFase('siap')
        await tunda(JEDA_SEBELUM_ANGKA_MS)

        if (siklus < SIKLUS_SEBELUM_ULANG) {
          siklus += 1
          const ke = siklus
          setData((d) => satuPembayaran(d, ke))
        } else {
          siklus = 0
          setUlang(true)
          await tunda(320)
          setData(DATA_AWAL)
          await tunda(60)
          setUlang(false)
        }
        await tunda(JEDA_ANTAR_KLIK_MS)
      }
    }
    jalankan()

    // Timer yang dibatalkan tidak pernah selesai, jadi perulangan berhenti di tunda berikutnya
    return () => {
      batal = true
      timer.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  return (
    <div className="auth-ilustrasi">
      <div className="auth-sambutan">
        <p className="auth-sambutan-judul">Selamat datang,<br />Bendahara Sekolah.</p>
        <span className="auth-garis-kuning" aria-hidden="true" />
        <p className="auth-sambutan-sub">semua data pembayaran tersaji satu dasbor,<br />tanpa yang terlewat</p>
      </div>

      <div aria-hidden="true">
        <MockupDasbor data={data} ulang={ulang} />

        <div className="auth-apung auth-apung--transfer">
          <div className="auth-apung-gerak">
            <div className="auth-apung-miring"><KartuTransfer /></div>
          </div>
        </div>

        <div className="auth-apung auth-apung--wa">
          <div className="auth-apung-gerak auth-apung-gerak--balik">
            <div className="auth-apung-miring"><GelembungWA /></div>
          </div>
        </div>

        <div className="auth-apung auth-apung--ingatkan">
          <div className="auth-apung-gerak">
            <div className="auth-apung-miring"><TombolIngatkanDemo fase={fase} /></div>
          </div>
        </div>

        <div className="auth-logo">
          <Image src="/image/SimbolSiKuTerang.png" width={69} height={71} alt="" priority />
        </div>
      </div>
    </div>
  )
}
