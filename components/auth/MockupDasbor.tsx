'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { AlertTriangle, Calendar, ChevronRight, Download, Gift, History, TrendingDown, TrendingUp, Users, type LucideIcon } from 'lucide-react'
import { useAngkaBergerak } from '@/lib/useAngkaBergerak'
import { IkonWidget } from './IkonAuth'
import { u, ukuranIkon } from './satuan'

// Tiruan dasbor di sisi kiri halaman login & daftar. Posisi dan ukuran diukur dari
// mockup Figma (px desain, relatif ke bingkai — lihat auth.css). Bagian kanan yang
// tertutup panel ikut digambar mengikuti dasbor asli.

export interface DataDemo {
  /** Total Tunggakan Aktif (Rp) */
  tunggakan: number
  belumBayar: number
  /** Siswa yang memiliki tunggakan */
  menunggak: number
  /** Isi bar "Terkumpul bulan ini" (%) */
  persen: number
  /** Nominal kartu "Terkumpul bulan ini" (Rp) — juga angka di tengah donat */
  terkumpul: number
  /** Nominal kartu "Belum dibayar" (Rp) */
  belumDibayar: number
}

/** Angka awal = angka di mockup */
export const DATA_AWAL: DataDemo = {
  tunggakan: 14_200_000, belumBayar: 68, menunggak: 5, persen: 76,
  terkumpul: 34_750_000, belumDibayar: 18_200_000,
}

const TOTAL_SISWA = 162

// Angka bulan lalu untuk keterangan perbandingan di kartu keuangan, dipilih supaya
// keadaan awal sama dengan mockup: +12% (terkumpul) dan "Naik Rp 2,4 jt" (belum dibayar)
const TERKUMPUL_BULAN_LALU = 31_030_000
const BELUM_DIBAYAR_BULAN_LALU = 15_800_000

// Kartu terakhir tiap baris melebar sampai tepi kanan bingkai (jarak sama dengan tepi kiri),
// jadi di layar yang sangat lebar tidak ada ruang kosong di kanan mockup
const TEPI_KANAN = 18.1

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

/** Jutaan dengan dua desimal seperti di mockup: 34_750_000 → "34, 75" (per Rp 10.000) */
const jutaan = (n: number) => {
  const [bulat, desimal] = (Math.round(n / 10_000) / 100).toFixed(2).split('.')
  return `${bulat}, ${desimal}`
}

/** Selisih dalam juta satu desimal: 2_400_000 → "2,4" */
const jutaSingkat = (n: number) => (Math.abs(n) / 1_000_000).toFixed(1).replace('.', ',')

/** Angka yang baru berubah masuk dari bawah (key baru = elemen baru = animasi diputar ulang) */
const Angka = ({ nilai }: { nilai: number | string }) => (
  <span key={nilai} className="auth-m-angka">{nilai}</span>
)

type JenisStat = 'siswa' | 'kelas' | 'tahun'

const IkonStat = ({ jenis, ukuran, tebal }: { jenis: JenisStat; ukuran: number; tebal: number }) => {
  if (jenis === 'kelas') return <IkonWidget style={ukuranIkon(ukuran)} tebal={tebal} />
  const Ikon: LucideIcon = jenis === 'siswa' ? Users : Calendar
  return <Ikon style={ukuranIkon(ukuran)} strokeWidth={tebal} aria-hidden="true" />
}

// geser = selisih posisi angka dari tengah kartu di mockup (px desain).
// Tahun ajaran rata kiri tanpa tanda air: angkanya lebar, seperti di dasbor asli.
const STAT: { judul: string; nilai: string; jenis: JenisStat; kiri: number; lebar: number; geser: number; rataKiri?: number }[] = [
  { judul: 'Total siswa aktif',  nilai: '162',     jenis: 'siswa', kiri: 18.1, lebar: 158.6, geser: -5.6 },
  { judul: 'Kelas aktif',        nilai: '9',       jenis: 'kelas', kiri: 192,  lebar: 151.7, geser: -1.4 },
  { judul: 'Tahun ajaran aktif', nilai: '2026/27', jenis: 'tahun', kiri: 359,  lebar: 158,   geser: 0, rataKiri: 32.4 },
]

// Batang hijau (terkumpul) & merah (tunggakan); x = tepi kiri batang hijau
const BATANG = [
  { bulan: 'Jan', x: 11.1,  hijau: 58.4, merah: 29.2 },
  { bulan: 'Feb', x: 54.3,  hijau: 41.7, merah: 13.9 },
  { bulan: 'Mar', x: 98.8,  hijau: 48.7, merah: 25.0 },
  { bulan: 'Apr', x: 140.5, hijau: 34.8, merah: 48.7 },
  { bulan: 'Mei', x: 183.7, hijau: 39.0, merah: 19.5 },
  { bulan: 'Jun', x: 226.8, hijau: 54.3, merah: 39.0 },
]
const DASAR_BATANG = 129.3

// Donat: sudut dihitung searah jarum jam dari segmen biru muda (yang di gambar mulai di 339°)
const JARI_DONAT = 44.9
const KELILING_DONAT = 2 * Math.PI * JARI_DONAT
const DONAT = [
  { warna: '#A3CDFE', dari: 0,   sampai: 54 },
  { warna: '#1B6C64', dari: 56,  sampai: 110 },
  { warna: '#69C183', dari: 112, sampai: 167 },
  { warna: '#7D7ADC', dari: 169, sampai: 252 },
  { warna: '#1A2C4E', dari: 254, sampai: 358 },
]

const KOMPOSISI = [
  { nama: 'SPP',     persen: 29, warna: '#1A2C4E' },
  { nama: 'Kegiatan', persen: 24, warna: '#7D7ADC' },
  { nama: 'Ekskul',  persen: 16, warna: '#69C183' },
  { nama: 'Seragam', persen: 16, warna: '#1B6C64' },
  { nama: 'Buku',    persen: 15, warna: '#A3CDFE' },
]

const KELAS = [
  { nama: 'Kelas 9A', siswa: 28, persen: 92, warna: '#69C183' },
  { nama: 'Kelas 8B', siswa: 30, persen: 81, warna: '#A3CDFE' },
  { nama: 'Kelas 7C', siswa: 27, persen: 70, warna: '#7D7ADC' },
]

interface MockupDasborProps {
  data: DataDemo
  /** true sebentar saat angka kembali ke awal: angka memudar lalu muncul lagi */
  ulang: boolean
}

export const MockupDasbor = ({ data, ulang }: MockupDasborProps) => {
  // Nominal bergerak perlahan; dibulatkan per Rp 10.000 supaya hitungannya tetap rapi
  const tunggakan    = useAngkaBergerak(data.tunggakan, 1200, ulang)
  const terkumpul    = useAngkaBergerak(data.terkumpul, 1200, ulang)
  const belumDibayar = useAngkaBergerak(data.belumDibayar, 1200, ulang)
  const sudahBayar = TOTAL_SISWA - data.belumBayar
  const persenSudah = Math.round((sudahBayar / TOTAL_SISWA) * 100)

  // Keterangan perbandingan bulan lalu dihitung seperti di dasbor asli
  const naikTerkumpul = Math.round(((data.terkumpul - TERKUMPUL_BULAN_LALU) / TERKUMPUL_BULAN_LALU) * 100)
  const selisihBelum  = data.belumDibayar - BELUM_DIBAYAR_BULAN_LALU
  const belumNaik     = selisihBelum > 0

  const kartuUang: { judul: string; nilai: string; warna: string; Ikon: LucideIcon; warnaInfo: string; info: ReactNode; persen: number; kiri: number; lebar?: number }[] = [
    {
      judul: 'Terkumpul bulan ini', nilai: `Rp ${jutaan(terkumpul)} jt`, warna: '#69C183',
      Ikon: naikTerkumpul >= 0 ? TrendingUp : TrendingDown, warnaInfo: naikTerkumpul >= 0 ? '#69C183' : '#DE6666',
      info: <>{naikTerkumpul >= 0 ? '+' : '−'}<Angka nilai={Math.abs(naikTerkumpul)} />% siswa sudah lunas</>,
      persen: data.persen, kiri: 18.1, lebar: 261.6,
    },
    {
      judul: 'Belum dibayar', nilai: `Rp ${jutaan(belumDibayar)} jt`, warna: '#DE6666',
      Ikon: belumNaik ? TrendingUp : TrendingDown, warnaInfo: belumNaik ? '#DE6666' : '#69C183',
      info: <>{belumNaik ? 'Naik' : 'Turun'} Rp <Angka nilai={jutaSingkat(selisihBelum)} /> jt dari bulan lalu</>,
      persen: 100 - data.persen, kiri: 295, lebar: 261.6,
    },
    {
      judul: 'Total beasiswa', nilai: 'Rp 4, 50 jt', warna: '#BB8848',
      Ikon: Gift, warnaInfo: '#BB8848', info: '12 penerima aktif',
      persen: 9, kiri: 571.9,
    },
  ]

  return (
    <div className={`auth-mockup${ulang ? ' auth-mockup--ulang' : ''}`}>
      {/* ── Header sambutan ── */}
      <div className="auth-m-header">
        <span className="auth-m-abs auth-m-header-judul">Selamat Datang Sri Wahyuni, S.Pd.</span>
        <span className="auth-m-abs auth-m-header-titik" />
        <span className="auth-m-abs auth-m-header-sub">Bendahara - SMP Harapan Indah</span>
        <div className="auth-m-abs auth-m-header-aksi">
          <span className="auth-m-pil auth-m-pil--tanggal"><Calendar style={ukuranIkon(11)} aria-hidden="true" />Senin, 13 Juli 2026</span>
          <span className="auth-m-pil auth-m-pil--ekspor"><Download style={ukuranIkon(11)} aria-hidden="true" />Export Laporan</span>
          <span className="auth-m-pil auth-m-pil--wa">
            <Image src="/icons/IconWA.png" width={27} height={21} alt="" loading="eager" style={{ width: u(26.9), height: u(21.1) }} />
            Ingatkan
          </span>
        </div>
      </div>

      {/* ── Total Tunggakan Aktif ── */}
      <div className="auth-m-kartu auth-m-tunggakan">
        <div className="auth-m-abs auth-m-badge">
          <span className="auth-m-titik-merah" />
          Total Tunggakan Aktif
        </div>

        <div className="auth-m-abs auth-m-nominal" data-pudar>
          {rupiah(Math.round(tunggakan / 10_000) * 10_000)}
        </div>

        <Users className="auth-m-ikon" style={{ left: u(25.1), top: u(111.1), ...ukuranIkon(17) }} strokeWidth={3} aria-hidden="true" />
        <span className="auth-m-abs auth-m-info" style={{ left: u(50.8) }} data-pudar>
          <Angka nilai={data.belumBayar} /> Siswa belum bayar
        </span>
        <History className="auth-m-ikon" style={{ left: u(199.2), top: u(112.1), transform: 'scaleX(-1)', ...ukuranIkon(15) }} strokeWidth={3} aria-hidden="true" />
        <span className="auth-m-abs auth-m-info" style={{ left: u(220.3) }}>Baru Saja Diperbarui</span>

        <div className="auth-m-abs auth-m-persen">
          <span className="auth-m-persen-angka" data-pudar><Angka nilai={persenSudah} />%</span>
          <span>Siswa sudah bayar</span>
          <span data-pudar>{sudahBayar} dari {TOTAL_SISWA} siswa</span>
        </div>

        <div className="auth-m-strip">
          <AlertTriangle className="auth-m-ikon" style={{ left: u(26.3), top: u(1.9), ...ukuranIkon(21) }} strokeWidth={2.6} aria-hidden="true" />
          <span className="auth-m-abs auth-m-strip-teks" data-pudar>
            <Angka nilai={data.menunggak} /> Siswa memiliki tunggakan
          </span>
          <span className="auth-m-abs auth-m-strip-aksi">Ingatkan sekarang <ChevronRight style={ukuranIkon(16)} aria-hidden="true" /></span>
        </div>
      </div>

      {/* ── Kartu statistik ── */}
      {STAT.map((s) => (
        <div key={s.judul} className="auth-m-kartu auth-m-stat" style={{ left: u(s.kiri), width: u(s.lebar) }}>
          <div className="auth-m-stat-kepala" />
          <span className="auth-m-stat-ikon"><IkonStat jenis={s.jenis} ukuran={17} tebal={2.4} /></span>
          <span className="auth-m-abs auth-m-stat-judul">{s.judul}</span>
          <span
            className="auth-m-abs auth-m-stat-nilai"
            style={s.rataKiri === undefined ? { left: u(2 * s.geser) } : { left: u(s.rataKiri), textAlign: 'left' }}
          >
            {s.nilai}
          </span>
          {s.rataKiri === undefined && (
            <span className="auth-m-stat-tanda"><IkonStat jenis={s.jenis} ukuran={31} tebal={2.6} /></span>
          )}
        </div>
      ))}

      <div className="auth-m-kartu auth-m-stat" style={{ left: u(532.3), right: u(TEPI_KANAN) }}>
        <span className="auth-m-abs auth-m-target-judul">
          <Image src="/icons/IconTarget.png" width={20} height={20} alt="" loading="eager" style={ukuranIkon(16)} />
          Target Pembayaran – Juli 2026
        </span>
        <div className="auth-m-target-jalur">
          <div className="auth-m-target-isi" style={{ width: `${persenSudah}%` }} />
        </div>
        <div className="auth-m-abs auth-m-target-catatan" data-pudar>
          <span>{sudahBayar} siswa sudah lunas</span>
          <span>Tersisa {data.belumBayar}</span>
        </div>
      </div>

      {/* ── Kartu keuangan ── */}
      {kartuUang.map((k) => (
        <div key={k.judul} className="auth-m-kartu auth-m-uang" style={k.lebar ? { left: u(k.kiri), width: u(k.lebar) } : { left: u(k.kiri), right: u(TEPI_KANAN) }}>
          <span className="auth-m-abs auth-m-uang-judul">{k.judul}</span>
          <span className="auth-m-abs auth-m-uang-info" style={{ color: k.warnaInfo }} data-pudar>
            <k.Ikon style={ukuranIkon(10)} strokeWidth={2.5} aria-hidden="true" />
            <span>{k.info}</span>
          </span>
          <span className="auth-m-abs auth-m-uang-nilai" style={{ color: k.warna }} data-pudar>{k.nilai}</span>
          <span className="auth-m-uang-tab" />
          <div className="auth-m-uang-jalur">
            <div className="auth-m-uang-isi" style={{ width: `${k.persen}%`, background: k.warna }} />
          </div>
          <span className="auth-m-abs auth-m-uang-label" data-pudar><Angka nilai={k.persen} />%</span>
        </div>
      ))}

      {/* ── Grafik 6 bulan ── */}
      <div className="auth-m-kartu auth-m-grafik" style={{ left: u(18.1), width: u(265.7) }}>
        <span className="auth-m-abs auth-m-grafik-sub">6 bulan terakhir</span>
        <span className="auth-m-abs auth-m-grafik-aksi">Laporan →</span>
        {BATANG.map((b) => (
          <span key={b.bulan}>
            <span className="auth-m-batang" style={{ left: u(b.x), top: u(DASAR_BATANG - b.hijau), height: u(b.hijau), background: '#69C183' }} />
            <span className="auth-m-batang" style={{ left: u(b.x + 15.3), top: u(DASAR_BATANG - b.merah), height: u(b.merah), background: '#DE6666' }} />
            <span className="auth-m-abs auth-m-bulan" style={{ left: u(b.x + 13.9) }}>{b.bulan}</span>
          </span>
        ))}
        <span className="auth-m-abs auth-m-legenda" style={{ left: u(12) }}>
          <span className="auth-m-kotak-warna" style={{ background: '#69C183' }} />Terkumpul
        </span>
        <span className="auth-m-abs auth-m-legenda" style={{ left: u(100) }}>
          <span className="auth-m-kotak-warna" style={{ background: '#DE6666' }} />Tunggakan
        </span>
      </div>

      {/* ── Komposisi pemasukan (donat) ── */}
      <div className="auth-m-kartu auth-m-grafik" style={{ left: u(299.2), width: u(265.7) }}>
        <span className="auth-m-abs auth-m-grafik-sub">Per komponen tagihan</span>
        <span className="auth-m-abs auth-m-grafik-aksi">Juli</span>
        <div className="auth-m-donat">
          <svg viewBox="0 0 103 103" width="100%" height="100%" aria-hidden="true">
            <g transform="rotate(249 51.5 51.5)">
              {DONAT.map((s) => {
                const panjang = ((s.sampai - s.dari) / 360) * KELILING_DONAT
                return (
                  <circle
                    key={s.warna}
                    cx="51.5" cy="51.5" r={JARI_DONAT}
                    fill="none" stroke={s.warna} strokeWidth="13.2"
                    strokeDasharray={`${panjang} ${KELILING_DONAT - panjang}`}
                    strokeDashoffset={-(s.dari / 360) * KELILING_DONAT}
                  />
                )
              })}
            </g>
          </svg>
          <div className="auth-m-donat-teks" data-pudar><span>{jutaan(terkumpul)}</span><span>juta</span></div>
        </div>
        <div className="auth-m-abs auth-m-komposisi">
          {KOMPOSISI.map((k) => (
            <span key={k.nama} className="auth-m-komposisi-baris">
              <span className="auth-m-kotak-warna" style={{ background: k.warna }} />
              {k.nama}
              <b>{k.persen}%</b>
            </span>
          ))}
        </div>
      </div>

      {/* ── Pembayaran per kelas ── */}
      <div className="auth-m-kartu auth-m-grafik" style={{ left: u(580.2), right: u(TEPI_KANAN) }}>
        <span className="auth-m-abs auth-m-grafik-sub">% siswa lunas bulan ini</span>
        <div className="auth-m-abs auth-m-kelas">
          {KELAS.map((k) => (
            <div key={k.nama}>
              <div className="auth-m-kelas-atas"><span>{k.nama}</span><span>{k.siswa} siswa</span></div>
              <div className="auth-m-kelas-jalur">
                <div className="auth-m-kelas-isi" style={{ width: `${k.persen}%`, background: k.warna }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
