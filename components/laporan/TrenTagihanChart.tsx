'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChartColumnBig, Table } from 'lucide-react'
import { BULAN_PENDEK, BULAN_PANJANG, formatRupiah as fmt, formatPersen, formatRingkasSpasi, formatRupiahRingkas } from '@/lib/formatLaporan'
import type { TitikTren } from '@/lib/metrikLaporan'
import { KartuTab } from './KartuTab'
import { PADDING_KARTU, WARNA_LAPORAN as WARNA } from './gayaLaporan'

// Warna mengikuti mockup Laporan (Okt 2026), palet yang sama dengan Dashboard:
// terbayar hijau, sisa tagihan kuning.
const WARNA_TERBAYAR = WARNA.hijau
const WARNA_SISA     = WARNA.kuning
/** Angka "Total tagihan" di tooltip — kuning mockup terlalu pucat untuk teks di atas putih */
const WARNA_TEKS_TAGIHAN = '#E2BC4B'

/** Jumlah bulan di tampilan ringkas untuk sekolah yang baru mulai memakai SiKu */
const BULAN_RINGKAS = 5
const LEBAR_TOOLTIP = 272

/** Satu pita di sumbu grafik. `titik` null = bulan yang belum berjalan: tanpa batang dan tooltip. */
interface SlotGrafik {
  bulan: number
  tahun: number
  titik: TitikTren | null
}

/** Batas atas sumbu yang rapi (1/2/5 × 10ⁿ), supaya garis tengahnya juga angka bulat */
function batasSumbu(maks: number): number {
  if (maks <= 0) return 1
  const pangkat = 10 ** Math.floor(Math.log10(maks))
  const langkah = [1, 2, 5, 10].find(k => k * pangkat >= maks) ?? 10
  return langkah * pangkat
}

/** Kolom dengan ujung atas sedikit membulat dan pangkal persegi di garis dasar. */
function pathKolom(x: number, yAtas: number, w: number, h: number, bulatAtas: boolean): string {
  if (h <= 0) return ''
  const r = bulatAtas ? Math.min(2.5, h, w / 2) : 0
  const yBawah = yAtas + h
  return `M${x},${yBawah} V${yAtas + r} Q${x},${yAtas} ${x + r},${yAtas} H${x + w - r} Q${x + w},${yAtas} ${x + w},${yAtas + r} V${yBawah} Z`
}

/**
 * Satu bulan seperti tabel dan tooltip menampilkannya: tagihan yang jatuh tempo di
 * bulan itu sendiri dipisah dari tunggakan lama. Realisasi tetap terbayar ÷ (tagihan
 * bulan itu + tunggakan lama), rumus 1 Okt 2026 — `titik.tagihan` sudah gabungan keduanya.
 */
function rincianBulan(d: TitikTren) {
  const tagihanBulan = d.tagihan - d.tunggakanLama
  return { tagihanBulan, sisa: Math.max(0, tagihanBulan - d.terbayar) }
}

/** 0–100; 100 hanya kalau benar-benar lunas, supaya pembulatan tidak menulis 100% di samping "Sebagian" */
function persenRealisasi(d: TitikTren): number | null {
  if (d.tagihan <= 0) return null
  if (d.terbayar >= d.tagihan) return 100
  if (d.terbayar <= 0) return 0
  return Math.min(99, Math.max(1, Math.round((d.terbayar / d.tagihan) * 100)))
}

type StatusBulan = 'lunas' | 'sebagian' | 'belum'

const BADGE_BULAN: Record<StatusBulan, { label: string; isi: string; garis: string; teks: string }> = {
  lunas:    { label: 'Lunas',       isi: '#8CDEA5',         garis: WARNA.hijau,  teks: '#ffffff' },
  sebagian: { label: 'Sebagian',    isi: WARNA.oranyeMuda,  garis: WARNA.oranye, teks: WARNA.oranye },
  belum:    { label: 'Belum bayar', isi: '#FBE3E3',         garis: WARNA.merah,  teks: '#C46060' },
}

const statusBulan = (d: TitikTren): StatusBulan =>
  persenRealisasi(d) === 100 ? 'lunas' : d.terbayar > 0 ? 'sebagian' : 'belum'

/** Batang realisasi tipis + persennya, untuk sel tabel */
const BatangRealisasi = ({ persen }: { persen: number | null }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <div style={{ width: 46, height: 4, borderRadius: 99, background: WARNA.track, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: `${persen ?? 0}%`, height: '100%', borderRadius: 99, background: WARNA_TERBAYAR }} />
    </div>
    <span style={{ minWidth: 26, fontSize: '0.62rem', color: WARNA.abuLabel, textAlign: 'left' }}>{formatPersen(persen)}</span>
  </div>
)

const BarisTooltip = ({ kotak, label, nilai, warna }: { kotak?: string; label: string; nilai: number; warna: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
    {kotak && <span style={{ width: 18, height: 18, borderRadius: 4, background: kotak, flexShrink: 0 }} />}
    <span style={{ flex: 1, fontSize: '0.85rem', color: WARNA.abuLabel }}>{label}</span>
    <strong style={{ fontSize: '0.85rem', fontWeight: 700, color: warna, whiteSpace: 'nowrap' }}>{formatRupiahRingkas(nilai)}</strong>
  </div>
)

const TooltipBulan = ({ titik, style }: { titik: TitikTren; style: CSSProperties }) => {
  const { tagihanBulan, sisa } = rincianBulan(titik)
  const persen = persenRealisasi(titik)
  const badge  = BADGE_BULAN[statusBulan(titik)]
  return (
    <div className="tren-tooltip" style={{
      position: 'absolute', zIndex: 5, pointerEvents: 'none', background: '#fff', borderRadius: 16,
      boxShadow: '0 10px 28px rgba(15, 23, 42, 0.16)', padding: '1.05rem 0 1rem', ...style,
    }}>
      <div style={{ padding: '0 1.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingBottom: '0.65rem', borderBottom: `1px solid ${WARNA.garis}` }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 500, color: WARNA.navy }}>{BULAN_PANJANG[titik.bulan]} {titik.tahun}</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 500, lineHeight: 1.5, color: badge.teks, background: badge.isi, border: `1.5px solid ${badge.garis}`, borderRadius: 99, padding: '0 0.6rem', whiteSpace: 'nowrap' }}>
            {badge.label}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.8rem' }}>
          <BarisTooltip kotak={WARNA_SISA} label="Total tagihan" nilai={tagihanBulan} warna={WARNA_TEKS_TAGIHAN} />
          <BarisTooltip kotak={WARNA_TERBAYAR} label="Terbayar" nilai={titik.terbayar} warna={WARNA_TERBAYAR} />
        </div>
        <div style={{ borderTop: `1.5px dashed ${WARNA.garis}`, margin: '0.8rem 0 0.7rem' }} />
        <BarisTooltip label="Sisa belum bayar" nilai={sisa} warna={WARNA.merah} />
      </div>
      {/* Tunggakan lama bulan itu — angka yang sama dengan kolom Tunggakan Lama di tabel */}
      {titik.tunggakanLama > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.55rem', padding: '0.45rem 1.35rem', background: WARNA.oranyeMuda, color: WARNA.oranye, fontSize: '0.85rem' }}>
          <span>Dengan tunggakan</span>
          <strong style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatRupiahRingkas(titik.tunggakanLama)}</strong>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.75rem', padding: '0 1.35rem' }}>
        <div style={{ flex: 1, height: 9, borderRadius: 99, background: WARNA.track, overflow: 'hidden' }}>
          <div style={{ width: `${persen ?? 0}%`, height: '100%', borderRadius: 99, background: WARNA_TERBAYAR }} />
        </div>
        <span style={{ fontSize: '0.75rem', color: WARNA.abuLabel }}>{formatPersen(persen)}</span>
      </div>
    </div>
  )
}

/** Sel tabel: garis pemisah bawah tidak masuk ke padding tepi kartu, seperti mockup */
function selTabel(kolom: number, jumlahKolom: number, adaGaris: boolean, vertikal = '0.45rem'): CSSProperties {
  const awal  = kolom === 0
  const akhir = kolom === jumlahKolom - 1
  return {
    padding: `${vertikal} ${akhir ? PADDING_KARTU : '0.75rem'} ${vertikal} ${awal ? PADDING_KARTU : '0.75rem'}`,
    ...(adaGaris && {
      backgroundImage:    `linear-gradient(${WARNA.garis}, ${WARNA.garis})`,
      backgroundRepeat:   'no-repeat',
      backgroundSize:     awal || akhir ? `calc(100% - ${PADDING_KARTU}) 1px` : '100% 1px',
      backgroundPosition: awal ? 'right bottom' : 'left bottom',
    }),
  }
}

/**
 * Satu kolom per bulan jatuh tempo: tinggi kolom = tagihan bulan itu ditambah
 * tunggakan bulan-bulan sebelumnya yang masih belum dibayar, bagian hijau = yang
 * sudah terbayar, bagian kuning = sisanya. Tabel dan tooltip memisahkan tagihan bulan
 * itu dari tunggakan lamanya.
 */
export function TrenTagihanChart({ data, ringkasAwalPakai = false, judul }: {
  data: TitikTren[]
  /**
   * Untuk sekolah yang baru mulai; hanya dinyalakan di halaman Laporan utama.
   * - Tabel: dimulai dari bulan pertama bertagihan (bulan awal pakai), berapa pun rentangnya.
   * - Grafik: kalau rentang dari bulan awal pakai sampai bulan terakhir paling lama 5 bulan,
   *   hanya memuat 5 bulan mulai dari bulan awal pakai.
   */
  ringkasAwalPakai?: boolean
  /** Laporan utama: grafik tampil dalam KartuTab berjudul ini. Tanpa judul (halaman
   *  Jenjang) hanya isinya — judul dan kartunya ditulis halaman. */
  judul?: string
}) {
  const [aktif,     setAktif]     = useState<number | null>(null)
  const [modeTabel, setModeTabel] = useState(false)

  // Tinggi isi (grafik atau tabel) — diukur terus supaya wadah bisa beranimasi ke
  // tinggi barunya. Lebar bingkai dipakai untuk menaruh tooltip di samping batang.
  const isiRef     = useRef<HTMLDivElement>(null)
  const bingkaiRef = useRef<HTMLDivElement>(null)
  const [tinggiIsi,   setTinggiIsi]   = useState<number | null>(null)
  const [lebarGrafik, setLebarGrafik] = useState(0)
  useEffect(() => {
    const isi = isiRef.current
    const bingkai = bingkaiRef.current
    if (!isi || !bingkai) return
    const ro = new ResizeObserver(entri => {
      for (const e of entri) {
        if (e.target === isi) setTinggiIsi(e.contentRect.height)
        else setLebarGrafik(e.contentRect.width)
      }
    })
    ro.observe(isi)
    ro.observe(bingkai)
    return () => ro.disconnect()
  }, [])

  const adaData = data.some(d => d.tagihan > 0)
  const maks    = batasSumbu(Math.max(0, ...data.map(d => d.tagihan)))

  // Tampilan ringkas: batang pertama sekolah baru tidak terhimpit di antara bulan-bulan
  // kosong sebelum mereka memakai SiKu. Syaratnya rentang, bukan jumlah batang, supaya
  // semua batang pasti masuk ke 5 slot.
  const iAwal    = data.findIndex(d => d.tagihan > 0)
  const rentang  = iAwal < 0 ? 0 : data.length - iAwal
  const ringkas  = ringkasAwalPakai && rentang > 0 && rentang <= BULAN_RINGKAS
  const terakhir = data[data.length - 1]
  const keSlot   = (titik: TitikTren): SlotGrafik => ({ bulan: titik.bulan, tahun: titik.tahun, titik })
  const slotGrafik: SlotGrafik[] = !ringkas
    ? data.map(keSlot)
    : terakhir?.berjalan
      // Mulai dari bulan awal pakai; sisa slot = bulan-bulan berikutnya yang belum berjalan
      ? [
          ...data.slice(iAwal).map(keSlot),
          ...Array.from({ length: BULAN_RINGKAS - rentang }, (_, k): SlotGrafik => {
            const d = new Date(Date.UTC(terakhir.tahun, terakhir.bulan + k, 1))
            return { bulan: d.getUTCMonth() + 1, tahun: d.getUTCFullYear(), titik: null }
          }),
        ]
      // Arsip tahun ajaran: bulan sesudah akhir tahun ajaran bukan "bulan depan",
      // jadi kelima slot diambil mundur dari bulan terakhir data
      : data.slice(-BULAN_RINGKAS).map(keSlot)

  // Tabel tidak dibatasi 5 bulan: cukup buang bulan-bulan kosong sebelum awal pakai,
  // sisanya tetap sampai bulan terakhir seperti biasa
  const barisTabel = ringkasAwalPakai && iAwal > 0 ? data.slice(iAwal) : data

  // Ukuran dalam piksel layar: viewBox selebar wadahnya, jadi huruf dan tinggi grafik
  // sama di kartu sempit (Laporan utama) maupun kartu selebar halaman (Jenjang).
  // Seperti mockup: label sumbu di tepi kiri, garis bantu mulai sesudahnya, dan pita
  // batang masuk lebih dalam lagi (KIRI).
  const LEBAR = lebarGrafik > 0 ? lebarGrafik : 520
  const TINGGI = 220; const ATAS = 20; const BAWAH = 45
  const X_LABEL = 28; const X_GARIS = 52; const KIRI = 83; const KANAN = 10
  const lebarPlot  = LEBAR - KIRI - KANAN
  const tinggiPlot = TINGGI - ATAS - BAWAH
  const pita       = lebarPlot / slotGrafik.length
  // Tampilan ringkas selebar batang di mockup (±56 px); 12 bulan lebih ramping supaya
  // tidak memenuhi pita
  const lebarBtg   = ringkas ? Math.min(56, pita * 0.69) : Math.min(36, pita * 0.55)
  const dasar      = ATAS + tinggiPlot
  const CELAH      = 2
  const tinggi     = (v: number) => (tinggiPlot * v) / maks

  const titikAktif = aktif === null ? null : slotGrafik[aktif]?.titik ?? null

  /**
   * Di samping batang, tidak pernah menutupinya: di kanan atau di kiri, mana yang paling
   * sedikit keluar dari area grafik. Tooltip selebar mockup tidak selalu muat — sisanya
   * boleh melewati tepi kartu, tooltip melayang di atas isi halaman.
   */
  const posisiTooltip = (i: number): CSSProperties => {
    const tengah     = KIRI + (i + 0.5) * pita
    const jarak      = lebarBtg / 2 + 14
    const diKanan    = tengah + jarak
    const diKiri     = tengah - jarak - LEBAR_TOOLTIP
    const lebihKanan = Math.max(0, diKanan + LEBAR_TOOLTIP - lebarGrafik)
    const lebihKiri  = Math.max(0, -diKiri)
    return { left: lebihKanan <= lebihKiri ? diKanan : diKiri, top: 0, width: LEBAR_TOOLTIP }
  }

  // Hanya bulan bertagihan yang punya tooltip
  const tooltip = !modeTabel && aktif !== null && titikAktif && titikAktif.tagihan > 0 && lebarGrafik > 0
    ? <TooltipBulan titik={titikAktif} style={posisiTooltip(aktif)} />
    : null

  const tombolGanti = (
    <button
      onClick={() => { setModeTabel(m => !m); setAktif(null) }}
      style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.85rem', fontWeight: 500, color: WARNA.navy, cursor: 'pointer', fontFamily: 'inherit' }}>
      <span key={modeTabel ? 'grafik' : 'tabel'} className="tren-ganti" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {modeTabel ? <ChartColumnBig size={17} aria-hidden /> : <Table size={17} aria-hidden />}
        {modeTabel ? 'Lihat grafik' : 'Lihat tabel'}
      </span>
    </button>
  )

  const kepala = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem 1.1rem', flexWrap: 'wrap' }}>
      {!modeTabel && [{ warna: WARNA_TERBAYAR, label: 'Terbayar' }, { warna: WARNA_SISA, label: 'Tagihan' }].map(l => (
        <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: WARNA.abuMuda }}>
          <span style={{ width: 11, height: 11, borderRadius: 2, background: l.warna }} />
          {l.label}
        </span>
      ))}
      {tombolGanti}
    </div>
  )

  const JUMLAH_KOLOM = 5
  const sTh = (kolom: number): CSSProperties => ({
    ...selTabel(kolom, JUMLAH_KOLOM, false, '0.6rem'),
    fontSize: '0.82rem', fontWeight: 400, whiteSpace: 'nowrap',
    textAlign: kolom === 0 ? 'left' : kolom === JUMLAH_KOLOM - 1 ? 'center' : 'right',
  })

  const tabel = (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
      <colgroup>
        <col style={{ width: '24%' }} /><col style={{ width: '18%' }} /><col style={{ width: '22%' }} /><col style={{ width: '17%' }} /><col style={{ width: '19%' }} />
      </colgroup>
      <thead>
        <tr style={{ background: WARNA.navy, color: '#fff' }}>
          <th style={sTh(0)}>Bulan</th>
          <th style={sTh(1)}>Total Tagihan</th>
          <th style={sTh(2)}>Tunggakan Lama</th>
          <th style={sTh(3)}>Terbayar</th>
          <th style={sTh(4)}>Realisasi</th>
        </tr>
      </thead>
      <tbody>
        {barisTabel.map((d, i) => {
          const { tagihanBulan } = rincianBulan(d)
          const garis = i < barisTabel.length - 1
          const sel = (kolom: number) => selTabel(kolom, JUMLAH_KOLOM, garis)
          return (
            <tr key={`${d.tahun}-${d.bulan}`} className="tren-baris" style={{ animationDelay: `${i * 25}ms` }}>
              <td style={{ ...sel(0), color: WARNA.abu }}>{BULAN_PANJANG[d.bulan]} {d.tahun}</td>
              <td style={{ ...sel(1), textAlign: 'right', fontWeight: 600, color: WARNA.abu }} title={fmt(tagihanBulan)}>
                {formatRupiahRingkas(tagihanBulan)}
              </td>
              <td style={{ ...sel(2), textAlign: 'right' }}>
                {d.tunggakanLama > 0
                  ? <span title={fmt(d.tunggakanLama)} style={{ fontWeight: 600, color: WARNA.oranye }}>{formatRupiahRingkas(d.tunggakanLama)}</span>
                  : <span style={{ color: '#D9D9D9' }}>—</span>}
              </td>
              <td style={{ ...sel(3), textAlign: 'right', fontWeight: 600, color: d.terbayar > 0 ? WARNA_TERBAYAR : '#D5D8DE' }} title={fmt(d.terbayar)}>
                {formatRupiahRingkas(d.terbayar)}
              </td>
              <td style={sel(4)}><BatangRealisasi persen={persenRealisasi(d)} /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  const grafik = (
    <svg viewBox={`0 0 ${LEBAR} ${TINGGI}`} style={{ width: '100%', height: TINGGI, display: 'block' }}
      role="img" aria-label={`Tagihan dan realisasi per bulan jatuh tempo, ${slotGrafik.length} bulan`}>
      {aktif !== null && slotGrafik[aktif]?.titik && (
        <rect x={KIRI + aktif * pita} y={ATAS} width={pita} height={tinggiPlot} fill="#F4F6FA" />
      )}

      {[0, 0.5, 1].map(t => {
        const y = dasar - tinggiPlot * t
        return (
          <g key={t}>
            <line x1={X_GARIS} y1={y} x2={LEBAR - 4} y2={y} stroke="#E5E7EB" strokeWidth={1} />
            <text x={X_LABEL} y={y + 3.5} textAnchor="end" fontSize={10} fill={WARNA.abuLabel} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatRingkasSpasi(maks * t)}
            </text>
          </g>
        )
      })}

      {slotGrafik.map((s, i) => {
        const d       = s.titik
        const x       = KIRI + i * pita + (pita - lebarBtg) / 2
        const hTotal  = d ? tinggi(d.tagihan) : 0
        const hBayar  = d ? tinggi(d.terbayar) : 0
        const hSisa   = hTotal - hBayar
        const adaSisa = hSisa > CELAH
        // Bulan berjalan tebal, bulan yang belum berjalan diredupkan
        const warnaLabel = d?.berjalan ? WARNA.navy : d ? WARNA.abuLabel : '#D5D8DE'
        const tebal      = d?.berjalan ? 700 : 400
        return (
          <g key={`${s.tahun}-${s.bulan}`}>
            {/* Kedua segmen tumbuh bersama dari garis dasar, supaya tumpukannya tetap utuh selama animasi */}
            {d && (
              <g className="tren-kolom" style={{ transformOrigin: `${x + lebarBtg / 2}px ${dasar}px`, animationDelay: `${i * 30}ms` }}>
                {/* Terbayar dari garis dasar; ujungnya membulat hanya kalau tidak ada sisa di atasnya */}
                <path d={pathKolom(x, dasar - (adaSisa ? hBayar : hTotal), lebarBtg, adaSisa ? hBayar : hTotal, !adaSisa)} fill={adaSisa || hBayar > 0 ? WARNA_TERBAYAR : WARNA_SISA} />
                {adaSisa && (
                  <path d={pathKolom(x, dasar - hTotal, lebarBtg, hBayar > 0 ? hSisa - CELAH : hSisa, true)} fill={WARNA_SISA} />
                )}
              </g>
            )}
            <text x={x + lebarBtg / 2} y={dasar + 24} textAnchor="middle" fontSize={11} fill={warnaLabel} fontWeight={tebal}>
              {BULAN_PENDEK[s.bulan]}
            </text>
            <text x={x + lebarBtg / 2} y={dasar + 38} textAnchor="middle" fontSize={10} fill={warnaLabel} fontWeight={tebal}>
              {s.tahun}
            </text>
          </g>
        )
      })}

      {/* Area sorot selebar pita bulan — lebih besar dari batangnya sendiri. Bulan tanpa
          tagihan atau yang belum berjalan tidak diberi tooltip. */}
      {slotGrafik.map((s, i) => {
        const d = s.titik
        if (!d || d.tagihan <= 0) return null
        const { tagihanBulan } = rincianBulan(d)
        return (
          <rect key={`hit-${s.tahun}-${s.bulan}`}
            x={KIRI + i * pita} y={ATAS} width={pita} height={tinggiPlot + BAWAH}
            fill="transparent" tabIndex={0} style={{ outline: 'none', cursor: 'default' }}
            aria-label={`${BULAN_PANJANG[d.bulan]} ${d.tahun}: total tagihan ${fmt(tagihanBulan)}, tunggakan lama ${fmt(d.tunggakanLama)}, terbayar ${fmt(d.terbayar)}, realisasi ${formatPersen(persenRealisasi(d))}`}
            onMouseEnter={() => setAktif(i)} onFocus={() => setAktif(i)} onBlur={() => setAktif(null)} />
        )
      })}
    </svg>
  )

  const isi = (
    <div ref={bingkaiRef} style={{ position: 'relative' }} onMouseLeave={() => setAktif(null)}>
      {/* Wadah bertinggi eksplisit supaya kartu memanjang/menyusut halus saat mode berganti;
          tingginya mengikuti isi yang diukur ResizeObserver. Wadah dibentangkan sampai
          tepi kartu supaya header tabel menyentuh kedua sisinya. */}
      <div className="tren-wadah" style={{ height: tinggiIsi ?? 'auto', overflow: 'hidden', margin: `0 calc(-1 * ${PADDING_KARTU})` }}>
        <div ref={isiRef}>
          {/* key berganti setiap mode → React memasang ulang isinya, animasi masuk berjalan lagi */}
          <div key={modeTabel ? 'tabel' : 'grafik'} className="tren-ganti">
            {!adaData ? (
              <div style={{ fontSize: '0.8rem', color: WARNA.abuMuda, textAlign: 'center', padding: '2.5rem 0' }}>
                Belum ada tagihan dalam 12 bulan ini.
              </div>
            ) : modeTabel ? tabel : (
              <div style={{ padding: `0 ${PADDING_KARTU}` }}>{grafik}</div>
            )}
          </div>
        </div>
      </div>
      {/* Di luar wadah: tooltip lebih tinggi dari grafik dan tidak boleh terpotong */}
      {tooltip}
    </div>
  )

  if (judul) return <KartuTab judul={judul} aksi={kepala}>{isi}</KartuTab>
  return (
    <div>
      <div style={{ marginBottom: '0.75rem' }}>{kepala}</div>
      {isi}
    </div>
  )
}
