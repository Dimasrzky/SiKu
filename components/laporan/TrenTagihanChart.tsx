'use client'

import { useEffect, useRef, useState } from 'react'
import { BarChart2, Table } from 'lucide-react'
import { BULAN_PENDEK, BULAN_PANJANG, formatRupiah as fmt, formatRingkas, formatPersen } from '@/lib/formatLaporan'
import type { TitikTren } from '@/lib/metrikLaporan'

// Warna diuji dengan validator palet dataviz (ordinal, permukaan terang):
// batang sisa = langkah terang dari ramp biru yang sama dengan terbayar.
const WARNA_TERBAYAR = '#1A2C4E'
const WARNA_SISA     = '#7FB0EE'

/** Jumlah bulan di tampilan ringkas untuk sekolah yang baru mulai memakai SiKu */
const BULAN_RINGKAS = 5

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

/** Kolom dengan ujung atas membulat 4px dan pangkal persegi di garis dasar. */
function pathKolom(x: number, yAtas: number, w: number, h: number, bulatAtas: boolean): string {
  if (h <= 0) return ''
  const r = bulatAtas ? Math.min(4, h, w / 2) : 0
  const yBawah = yAtas + h
  return `M${x},${yBawah} V${yAtas + r} Q${x},${yAtas} ${x + r},${yAtas} H${x + w - r} Q${x + w},${yAtas} ${x + w},${yAtas + r} V${yBawah} Z`
}

/**
 * Satu kolom per bulan jatuh tempo: tinggi kolom = tagihan bulan itu ditambah
 * tunggakan bulan-bulan sebelumnya yang masih belum dibayar, bagian gelap = yang
 * sudah terbayar, bagian terang = sisanya — yang masih harus ditagih sampai bulan
 * itu. Satu sumbu, tanpa dua skala. Ketepatan waktu per bulan (satuan berbeda)
 * tidak digambar di sumbu yang sama; ia ada di tooltip dan tabel.
 */
export function TrenTagihanChart({ data, ringkasAwalPakai = false }: {
  data: TitikTren[]
  /**
   * Untuk sekolah yang baru mulai; hanya dinyalakan di halaman Laporan utama.
   * - Tabel: dimulai dari bulan pertama bertagihan (bulan awal pakai), berapa pun rentangnya.
   * - Grafik: kalau rentang dari bulan awal pakai sampai bulan terakhir paling lama 5 bulan,
   *   hanya memuat 5 bulan mulai dari bulan awal pakai.
   */
  ringkasAwalPakai?: boolean
}) {
  const [aktif,     setAktif]     = useState<number | null>(null)
  const [modeTabel, setModeTabel] = useState(false)

  // Tinggi isi (grafik atau tabel) — diukur terus supaya wadah bisa beranimasi ke
  // tinggi barunya, termasuk saat grafik ikut berubah ukuran bersama lebar layar
  const isiRef = useRef<HTMLDivElement>(null)
  const [tinggiIsi, setTinggiIsi] = useState<number | null>(null)
  useEffect(() => {
    const el = isiRef.current
    if (!el) return
    const ro = new ResizeObserver(([entri]) => setTinggiIsi(entri.contentRect.height))
    ro.observe(el)
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

  const W = 640; const H = 214; const KIRI = 42; const KANAN = 6; const ATAS = 10; const BAWAH = 38
  const lebarPlot  = W - KIRI - KANAN
  const tinggiPlot = H - ATAS - BAWAH
  const pita       = lebarPlot / slotGrafik.length
  // Batang dibatasi 24 supaya tidak memenuhi pita. Tampilan ringkas sengaja 2× lebih
  // tebal (keputusan produk): di 5 pita, batang 24 terlalu kurus di tengah ruang kosong.
  const lebarBtg   = Math.min(ringkas ? 48 : 24, pita * 0.6)
  const dasar      = ATAS + tinggiPlot
  const CELAH      = 2
  const tinggi     = (v: number) => (tinggiPlot * v) / maks

  const titikAktif = aktif === null ? null : slotGrafik[aktif]?.titik ?? null
  const pelunasan  = (d: TitikTren) => (d.tagihan > 0 ? `${Math.round((d.terbayar / d.tagihan) * 100)}%` : '—')

  const legenda = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#475569' }}>
      {[{ warna: WARNA_TERBAYAR, label: 'Terbayar' }, { warna: WARNA_SISA, label: 'Tagihan' }].map(l => (
        <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: l.warna }} />
          {l.label}
        </span>
      ))}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {legenda}
        <button
          onClick={() => setModeTabel(m => !m)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', fontWeight: 700, color: '#1D4ED8', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span key={modeTabel ? 'grafik' : 'tabel'} className="tren-ganti" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {modeTabel ? <BarChart2 size={13} /> : <Table size={13} />}
            {modeTabel ? 'Lihat grafik' : 'Lihat tabel'}
          </span>
        </button>
      </div>

      {/* Wadah bertinggi eksplisit supaya kartu memanjang/menyusut halus saat mode berganti;
          tingginya mengikuti isi yang diukur ResizeObserver */}
      <div className="tren-wadah" style={{ height: tinggiIsi ?? 'auto', overflow: 'hidden' }}>
      <div ref={isiRef}>
      {/* key berganti setiap mode → React memasang ulang isinya, animasi masuk berjalan lagi */}
      <div key={modeTabel ? 'tabel' : 'grafik'} className="tren-ganti">
      {!adaData ? (
        <div style={{ fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center', padding: '2.5rem 0' }}>
          Belum ada tagihan dalam 12 bulan ini.
        </div>
      ) : modeTabel ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ color: '#64748B', textAlign: 'right' }}>
              <th style={{ textAlign: 'left', padding: '0.35rem 0', fontWeight: 600 }}>Bulan jatuh tempo</th>
              <th style={{ padding: '0.35rem 0', fontWeight: 600 }}>Tagihan</th>
              <th style={{ padding: '0.35rem 0', fontWeight: 600 }}>Terbayar</th>
              <th style={{ padding: '0.35rem 0', fontWeight: 600 }}>Pelunasan</th>
              <th style={{ padding: '0.35rem 0', fontWeight: 600 }}>Tepat waktu</th>
            </tr>
          </thead>
          <tbody>
            {barisTabel.map((d, i) => (
              <tr key={`${d.tahun}-${d.bulan}`} className="tren-baris"
                style={{ borderTop: '1px solid #F1F5F9', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0F172A', animationDelay: `${i * 25}ms` }}>
                <td style={{ textAlign: 'left', padding: '0.35rem 0' }}>
                  {BULAN_PANJANG[d.bulan]} {d.tahun}{d.berjalan ? ' (berjalan)' : ''}
                </td>
                <td style={{ padding: '0.35rem 0' }}>
                  {fmt(d.tagihan)}
                  {d.tunggakanLama > 0 && (
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#B45309' }}>
                      termasuk tunggakan {fmt(d.tunggakanLama)}
                    </div>
                  )}
                </td>
                <td style={{ padding: '0.35rem 0' }}>{fmt(d.terbayar)}</td>
                <td style={{ padding: '0.35rem 0', fontWeight: 700 }}>{pelunasan(d)}</td>
                <td style={{ padding: '0.35rem 0', fontWeight: 700 }}>{formatPersen(d.ketepatanWaktu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ position: 'relative' }} onMouseLeave={() => setAktif(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
            role="img" aria-label={`Tagihan dan realisasi per bulan jatuh tempo, ${slotGrafik.length} bulan`}>
            {aktif !== null && (
              <rect x={KIRI + aktif * pita} y={ATAS} width={pita} height={tinggiPlot} fill="#F1F5F9" />
            )}

            {[0, 0.5, 1].map(t => {
              const y = dasar - tinggiPlot * t
              return (
                <g key={t}>
                  <line x1={KIRI} y1={y} x2={W - KANAN} y2={y} stroke="#E8EDF3" strokeWidth={1} />
                  <text x={KIRI - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill="#94A3B8" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatRingkas(maks * t)}
                  </text>
                </g>
              )
            })}

            {slotGrafik.map((s, i) => {
              const d      = s.titik
              const x      = KIRI + i * pita + (pita - lebarBtg) / 2
              const hTotal = d ? tinggi(d.tagihan) : 0
              const hBayar = d ? tinggi(d.terbayar) : 0
              const hSisa  = hTotal - hBayar
              const adaSisa = hSisa > CELAH
              return (
                <g key={`${s.tahun}-${s.bulan}`}>
                  {/* Kedua segmen tumbuh bersama dari garis dasar, supaya tumpukannya tetap utuh selama animasi */}
                  {d && (
                    <g className="tren-kolom" style={{ transformOrigin: `${x + lebarBtg / 2}px ${dasar}px`, animationDelay: `${i * 30}ms` }}>
                      {/* Terbayar dari garis dasar; ujungnya membulat hanya kalau tidak ada sisa di atasnya */}
                      <path d={pathKolom(x, dasar - (adaSisa ? hBayar : hTotal), lebarBtg, adaSisa ? hBayar : hTotal, !adaSisa)} fill={WARNA_TERBAYAR} />
                      {adaSisa && (
                        <path
                          d={pathKolom(x, dasar - hTotal, lebarBtg, hBayar > 0 ? hSisa - CELAH : hSisa, true)}
                          fill={WARNA_SISA} />
                      )}
                    </g>
                  )}
                  {/* Bulan yang belum berjalan diredupkan */}
                  <text x={x + lebarBtg / 2} y={dasar + 15} textAnchor="middle" fontSize={11}
                    fill={d?.berjalan ? '#0F172A' : d ? '#64748B' : '#94A3B8'} fontWeight={d?.berjalan ? 700 : 400}>
                    {BULAN_PENDEK[s.bulan]}
                  </text>
                  {(i === 0 || s.bulan === 1) && (
                    <text x={x + lebarBtg / 2} y={dasar + 29} textAnchor="middle" fontSize={9.5} fill="#94A3B8">
                      {s.tahun}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Area sorot selebar pita bulan — lebih besar dari batangnya sendiri.
                Bulan yang belum berjalan tidak punya data, jadi tidak diberi tooltip. */}
            {slotGrafik.map((s, i) => {
              const d = s.titik
              return d && (
                <rect key={`hit-${s.tahun}-${s.bulan}`}
                  x={KIRI + i * pita} y={ATAS} width={pita} height={tinggiPlot + BAWAH}
                  fill="transparent" tabIndex={0} style={{ outline: 'none', cursor: 'default' }}
                  aria-label={`${BULAN_PANJANG[d.bulan]} ${d.tahun}: tagihan ${fmt(d.tagihan)}${d.tunggakanLama > 0 ? ` termasuk tunggakan ${fmt(d.tunggakanLama)}` : ''}, terbayar ${fmt(d.terbayar)}, pelunasan ${pelunasan(d)}, tepat waktu ${formatPersen(d.ketepatanWaktu)}`}
                  onMouseEnter={() => setAktif(i)} onFocus={() => setAktif(i)} onBlur={() => setAktif(null)} />
              )
            })}
          </svg>

          {titikAktif && aktif !== null && (
            <div style={{
              position: 'absolute', top: 0, pointerEvents: 'none',
              left: `${((KIRI + (aktif + 0.5) * pita) / W) * 100}%`,
              transform: aktif < 2 ? 'translateX(-12%)' : aktif > slotGrafik.length - 3 ? 'translateX(-88%)' : 'translateX(-50%)',
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 6px 18px rgba(15,23,42,0.12)',
              padding: '0.55rem 0.7rem', minWidth: 190, fontSize: '0.75rem', zIndex: 5,
            }}>
              <div style={{ color: '#64748B', marginBottom: 6 }}>
                {BULAN_PANJANG[titikAktif.bulan]} {titikAktif.tahun}{titikAktif.berjalan ? ' · bulan berjalan' : ''}
              </div>
              {[
                { warna: WARNA_TERBAYAR, nilai: fmt(titikAktif.terbayar), label: 'terbayar' },
                { warna: WARNA_SISA,     nilai: fmt(titikAktif.tagihan),  label: 'tagihan' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ width: 12, height: 2, borderRadius: 1, background: r.warna, flexShrink: 0 }} />
                  <strong style={{ color: '#0F172A' }}>{r.nilai}</strong>
                  <span style={{ color: '#64748B' }}>{r.label}</span>
                </div>
              ))}
              {/* Sejajar dengan nilai di baris "tagihan" tepat di atasnya (lebar kunci 12 + jarak 6) */}
              {titikAktif.tunggakanLama > 0 && (
                <div style={{ marginLeft: 18, marginBottom: 3, fontSize: '0.68rem', fontWeight: 600, color: '#B45309' }}>
                  termasuk tunggakan {fmt(titikAktif.tunggakanLama)}
                </div>
              )}
              <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #F1F5F9', color: '#64748B', display: 'flex', gap: '0.75rem' }}>
                <span>Pelunasan <strong style={{ color: '#0F172A' }}>{pelunasan(titikAktif)}</strong></span>
                <span>Tepat waktu <strong style={{ color: '#0F172A' }}>{formatPersen(titikAktif.ketepatanWaktu)}</strong></span>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      </div>
      </div>
    </div>
  )
}
