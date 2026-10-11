'use client'

import { useMemo, useState } from 'react'
import { Receipt, Scissors, Award, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { MAKS_CATATAN_WALI, bagiPerUnit, kunciUnit, labelUnit, type UnitBayar } from '@/lib/rincianKomponen'
import { BULAN_NAMES, formatRp, formatTanggalWIB } from './format'
import type { BeasiswaBadge, BlokTagihan, KomponenPilih, Pengajuan } from './page'

/** Baris potongan dan pembayaran yang sudah masuk bernilai negatif */
const formatBaris = (n: number) => (n < 0 ? `−${formatRp(-n)}` : formatRp(n))

/** Isian rupiah: hanya angka, dengan titik ribuan */
const formatRibuan = (val: string) => {
  const digits = val.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13)
  return digits ? Number(digits).toLocaleString('id-ID') : ''
}
const bacaAngka = (val: string) => Number(val.replace(/\D/g, '') || '0')

const getInitials = (nama: string): string => {
  const parts = nama.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return nama.slice(0, 2).toUpperCase()
}

/** Yang bisa dicentang di satu bulan */
const kunciBlok = (b: BlokTagihan): string[] =>
  b.komponen ? b.komponen.filter(k => k.sisa > 0).map(k => k.kunci) : [b.kunciUtuh]

const UKURAN_KECIL = 'clamp(0.62rem, 2.2vw, 0.72rem)'
const UKURAN_BARIS = 'clamp(0.75rem, 2.6vw, 0.85rem)'

const sJudulBagian: React.CSSProperties = {
  fontWeight: 700, fontSize: 'clamp(0.78rem, 2.8vw, 0.9rem)', color: '#1A2C4E', letterSpacing: 0.5,
}
const sCentang: React.CSSProperties = {
  width: 18, height: 18, margin: '1px 0 0', accentColor: '#1A2C4E', flexShrink: 0, cursor: 'inherit',
}
const sIsian: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '0.7rem 0.9rem', borderRadius: 10, border: '2px solid #E2E8F0',
  fontSize: 'clamp(0.8rem, 2.8vw, 0.95rem)', color: '#1A2C4E', fontFamily: 'inherit', outline: 'none', background: '#fff',
}

interface Props {
  namaSiswa:      string
  nis:            string
  kelasNama:      string
  blok:           BlokTagihan[]
  units:          UnitBayar[]
  lunasDiTautan:  { bulan: number; tahun: number } | null
  rentangRencana: { awal: string; akhir: string }
  badges:         BeasiswaBadge[]
  /** Pilihan sebelumnya, kalau wali kembali dari langkah 2 */
  awal:           Pengajuan | null
  onLanjut:       (p: Pengajuan) => void
}

export default function TagihanReview({
  namaSiswa, nis, kelasNama, blok, units, lunasDiTautan, rentangRencana, badges, awal, onLanjut,
}: Props) {
  const semuaKunci = useMemo(() => new Set(units.map(kunciUnit)), [units])

  // Awalnya semua tercentang — tanpa mengubah apa pun, wali membayar seluruh tagihan
  const [dipilih, setDipilih] = useState<Set<string>>(() => {
    const sebelumnya = awal?.kunci.filter(k => semuaKunci.has(k)) ?? []
    return new Set(sebelumnya.length > 0 ? sebelumnya : semuaKunci)
  })
  const [jenis, setJenis]          = useState<'lunas' | 'cicilan'>(awal?.jenis ?? 'lunas')
  const [nominalIsian, setNominal] = useState(awal?.jenis === 'cicilan' ? awal.nominal.toLocaleString('id-ID') : '')
  const [rencana, setRencana]      = useState(awal?.rencana ?? '')
  const [catatan, setCatatan]      = useState(awal?.catatan ?? '')

  // `units` sudah dalam urutan pembagian (bulan terlama dulu), jadi yang tercentang juga
  const unitDipilih  = units.filter(u => dipilih.has(kunciUnit(u)))
  const totalDipilih = unitDipilih.reduce((s, u) => s + u.sisa, 0)
  const cicil        = jenis === 'cicilan'
  const nominalCicil = bacaAngka(nominalIsian)

  const galat =
    unitDipilih.length === 0      ? 'Centang minimal satu komponen yang ingin dibayar.'
    : !cicil                      ? null
    : nominalCicil <= 0           ? 'Isi nominal yang dibayar sekarang.'
    : nominalCicil >= totalDipilih ? `Nominal cicilan harus kurang dari ${formatRp(totalDipilih)}. Untuk membayar penuh, pilih Bayar lunas.`
    : !rencana                    ? 'Isi tanggal rencana pelunasan sisa.'
    : rencana < rentangRencana.awal || rencana > rentangRencana.akhir
      ? `Pilih tanggal antara ${formatTanggalWIB(rentangRencana.awal)} dan ${formatTanggalWIB(rentangRencana.akhir)}.`
    : null

  // Aturan pembagian yang sama dengan saat bukti diverifikasi
  const pembagian = cicil && nominalCicil > 0 && nominalCicil < totalDipilih ? bagiPerUnit(unitDipilih, nominalCicil) : []

  const ubah = (kunci: string[], centang: boolean) => setDipilih(prev => {
    const baru = new Set(prev)
    for (const k of kunci) {
      if (centang) baru.add(k)
      else baru.delete(k)
    }
    return baru
  })

  const lanjut = () => {
    if (galat) return
    onLanjut({
      kunci:        [...dipilih],
      pilihan:      unitDipilih.map(u => ({ tagihan_id: u.tagihan_id, tagihan_item_id: u.tagihan_item_id })),
      jenis,
      nominal:      cicil ? nominalCicil : totalDipilih,
      totalDipilih,
      rencana:      cicil ? rencana : null,
      catatan:      cicil ? catatan.trim() : '',
    })
  }

  const diTautan  = blok.find(b => b.diTautan) ?? null
  const tunggakan = blok.filter(b => !b.diTautan)

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 0 6px #21386b7b', marginBottom: '1.8rem' }}>

        {/* Card header */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '2px solid #C1C6CF' }}>
          <div style={{ width: 40, height: 40, background: '#FEF3C7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Receipt size={20} color="#D97706" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 'clamp(0.82rem, 3vw, 0.95rem)', color: '#1A2C4E' }}>Rincian tagihan</div>
            <div style={{ fontSize: 'clamp(0.68rem, 2.4vw, 0.78rem)', color: '#94A3B8', marginTop: 1 }}>Centang komponen yang ingin dibayar sekarang</div>
          </div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>

          {/* Info siswa + badge beasiswa/potongan */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', background: '#F0F7FF', border: '3px solid #E3F0FF', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontWeight: 800, fontSize: 'clamp(0.7rem, 2.4vw, 0.8rem)' }}>
                {getInitials(namaSiswa || '-')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 'clamp(0.8rem, 2.8vw, 0.9rem)', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {namaSiswa || '-'}
                </div>
                <div style={{ fontSize: 'clamp(0.68rem, 2.4vw, 0.78rem)', color: '#64748B', marginTop: 1 }}>
                  {kelasNama || '-'} {nis && <>&middot; NIS {nis}</>}
                </div>
              </div>
            </div>

            {badges.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {badges.map((b, i) => (
                  <span key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '0.25rem 0.6rem', borderRadius: 20, fontSize: 'clamp(0.6rem, 2vw, 0.68rem)', fontWeight: 700,
                    background: b.label === 'beasiswa' ? '#DCFCE7' : '#FFEDD5',
                    color:      b.label === 'beasiswa' ? '#15803D' : '#C2410C',
                  }}>
                    {b.label === 'beasiswa' ? <Award size={11} /> : <Scissors size={11} />}
                    {b.nama} &middot; {b.nilai}
                  </span>
                ))}
              </div>
            )}
          </div>

          {lunasDiTautan && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#F0FDF4', border: '2px solid #BBF7D0', borderRadius: 8, padding: '0.65rem 0.9rem', marginBottom: '1.25rem', fontSize: UKURAN_BARIS, color: '#166534', lineHeight: 1.5 }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Tagihan <strong>{BULAN_NAMES[lunasDiTautan.bulan]} {lunasDiTautan.tahun}</strong> sudah lunas. Masih ada tunggakan bulan sebelumnya di bawah ini.
              </span>
            </div>
          )}

          {/* Tagihan yang ditunjuk tautan ini */}
          {diTautan && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={sJudulBagian}>Tagihan {BULAN_NAMES[diTautan.bulan]} {diTautan.tahun}</span>
                <TombolSemua kunci={kunciBlok(diTautan)} dipilih={dipilih} ubah={ubah} warna="#1A2C4E" />
              </div>
              <div style={{ border: '2px solid #BABFC7', borderRadius: 8, padding: '0.25rem 1rem', boxShadow: '0 2px 10px #babfc76f' }}>
                <IsiBlok b={diTautan} dipilih={dipilih} ubah={ubah} warnaTeks="#374151" garis="1px dashed #E2E8F0" />
              </div>
            </div>
          )}

          {/* Tunggakan periode sebelumnya — dipilih dengan cara yang sama */}
          {tunggakan.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <AlertTriangle size={14} color="#D97706" />
                <span style={{ ...sJudulBagian, color: '#92400E' }}>Tunggakan bulan sebelumnya</span>
              </div>
              <div style={{ border: '2px solid #FDE68A', background: '#FFFBEB', borderRadius: 8, padding: '0.25rem 1rem', maxHeight: 360, overflowY: 'auto' }}>
                {tunggakan.map((b, i) => (
                  <div key={b.tagihan_id} style={{ padding: '0.35rem 0', borderTop: i > 0 ? '1.5px solid #FDE68A' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, paddingTop: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: UKURAN_BARIS, color: '#92400E' }}>
                        {BULAN_NAMES[b.bulan]} {b.tahun} <span style={{ fontWeight: 600 }}>&middot; sisa {formatRp(b.sisa)}</span>
                      </span>
                      <TombolSemua kunci={kunciBlok(b)} dipilih={dipilih} ubah={ubah} warna="#92400E" />
                    </div>
                    <IsiBlok b={b} dipilih={dipilih} ubah={ubah} warnaTeks="#92400E" garis="1px dashed #FDE68A" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cara bayar */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ ...sJudulBagian, marginBottom: 8 }}>Cara bayar</div>
            <div role="radiogroup" aria-label="Cara bayar" style={{ display: 'flex', gap: 8 }}>
              {(['lunas', 'cicilan'] as const).map(j => {
                const aktif = jenis === j
                return (
                  <button key={j} type="button" role="radio" aria-checked={aktif} onClick={() => setJenis(j)}
                    style={{ flex: 1, padding: '0.65rem', borderRadius: 10, border: `2px solid ${aktif ? '#1A2C4E' : '#E2E8F0'}`, background: aktif ? '#1A2C4E' : '#F8FAFC', color: aktif ? '#fff' : '#64748B', fontWeight: 700, fontSize: 'clamp(0.78rem, 2.8vw, 0.88rem)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {j === 'lunas' ? 'Bayar lunas' : 'Cicil'}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: UKURAN_KECIL, color: '#94A3B8', marginTop: 6, lineHeight: 1.5 }}>
              {cicil
                ? 'Bayar sebagian dulu, sisanya dilunasi sesuai rencana. Rencana dan catatan Anda diteruskan ke bendahara.'
                : 'Bayar penuh semua komponen yang dicentang.'}
            </div>
          </div>

          {cicil && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.1rem' }}>
              <Isian label="Nominal yang dibayar sekarang" htmlFor="nominal-cicil"
                bantuan={totalDipilih > 0 ? `Kurang dari ${formatRp(totalDipilih)}` : undefined}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#1A2C4E', fontWeight: 700, pointerEvents: 'none', fontSize: 'clamp(0.8rem, 2.8vw, 0.95rem)' }}>Rp</span>
                  <input id="nominal-cicil" type="text" inputMode="numeric" autoComplete="off" placeholder="0"
                    value={nominalIsian} onChange={e => setNominal(formatRibuan(e.target.value))}
                    style={{ ...sIsian, paddingLeft: '2.5rem', fontWeight: 700 }} />
                </div>
              </Isian>

              <Isian label="Rencana pelunasan sisa" htmlFor="rencana-lunas">
                <input id="rencana-lunas" type="date" min={rentangRencana.awal} max={rentangRencana.akhir}
                  value={rencana} onChange={e => setRencana(e.target.value)} style={sIsian} />
              </Isian>

              <Isian label="Catatan untuk bendahara" opsional htmlFor="catatan-wali" bantuan={`${catatan.length}/${MAKS_CATATAN_WALI}`}>
                <textarea id="catatan-wali" rows={2} maxLength={MAKS_CATATAN_WALI} placeholder="Contoh: sisanya saya lunasi setelah gajian"
                  value={catatan} onChange={e => setCatatan(e.target.value)}
                  style={{ ...sIsian, resize: 'vertical', fontWeight: 500 }} />
              </Isian>

              {pembagian.length > 0 && (
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '0.65rem 0.9rem' }}>
                  <div style={{ fontWeight: 700, fontSize: UKURAN_KECIL, color: '#1A2C4E', marginBottom: 4 }}>Cicilan ini dicatat untuk</div>
                  {pembagian.map(({ unit, jumlah }) => (
                    <div key={kunciUnit(unit)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: UKURAN_KECIL, color: '#475569', padding: '2px 0' }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{labelUnit(unit)}</span>
                      <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {formatRp(jumlah)}{jumlah >= unit.sisa ? ' · lunas' : ` dari ${formatRp(unit.sisa)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ height: 1.5, background: '#C1C6CF', margin: '0 0 0.9rem' }} />
          {cicil ? (
            <>
              <BarisTotal label="Total dipilih" nilai={formatRp(totalDipilih)} />
              <BarisTotal label="Sisa sesudah cicilan ini" nilai={formatRp(Math.max(0, totalDipilih - nominalCicil))} />
              <BarisTotal label="Dibayar sekarang" nilai={formatRp(nominalCicil)} utama />
            </>
          ) : (
            <BarisTotal label="Total yang harus dibayar" nilai={formatRp(totalDipilih)} utama />
          )}
          <div style={{ height: 1.5, background: '#C1C6CF', margin: '0.75rem 0 1rem' }} />

          {galat && (
            <div role="alert" style={{ fontSize: UKURAN_KECIL, color: '#B91C1C', fontWeight: 600, lineHeight: 1.5, marginBottom: '0.6rem' }}>
              {galat}
            </div>
          )}

          <button
            onClick={lanjut}
            disabled={galat !== null}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.9rem', background: galat ? '#CBD5E1' : '#1A2C4E', color: '#fff', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 'clamp(0.85rem, 3vw, 1rem)', cursor: galat ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            Lanjutkan Pembayaran
          </button>
        </div>
      </div>
    </div>
  )
}

/** Centang semua / kosongkan untuk satu bulan — hanya kalau ada lebih dari satu pilihan */
function TombolSemua({ kunci, dipilih, ubah, warna }: {
  kunci: string[]; dipilih: Set<string>; ubah: (kunci: string[], centang: boolean) => void; warna: string
}) {
  if (kunci.length < 2) return null
  const semua = kunci.every(k => dipilih.has(k))
  return (
    <button type="button" onClick={() => ubah(kunci, !semua)}
      style={{ background: 'none', border: 'none', padding: 0, color: warna, fontWeight: 700, fontSize: UKURAN_KECIL, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
      {semua ? 'Kosongkan' : 'Pilih semua'}
    </button>
  )
}

function IsiBlok({ b, dipilih, ubah, warnaTeks, garis }: {
  b: BlokTagihan; dipilih: Set<string>; ubah: (kunci: string[], centang: boolean) => void; warnaTeks: string; garis: string
}) {
  if (!b.komponen) {
    return <BarisUtuh b={b} dipilih={dipilih.has(b.kunciUtuh)} onUbah={c => ubah([b.kunciUtuh], c)} warnaTeks={warnaTeks} />
  }
  return (
    <>
      {b.komponen.map((k, i) => (
        <BarisKomponen key={k.kunci} k={k} dipilih={dipilih.has(k.kunci)} onUbah={c => ubah([k.kunci], c)}
          warnaTeks={warnaTeks} garis={i < b.komponen!.length - 1 ? garis : null} />
      ))}
    </>
  )
}

function BarisKomponen({ k, dipilih, onUbah, warnaTeks, garis }: {
  k: KomponenPilih; dipilih: boolean; onUbah: (centang: boolean) => void; warnaTeks: string; garis: string | null
}) {
  const lunas = k.sisa <= 0
  const keterangan = lunas ? '' : [
    k.potongan > 0 ? `${formatRp(k.nominal)} − potongan beasiswa ${formatRp(k.potongan)}` : null,
    k.terbayar > 0 ? `sudah dibayar ${formatRp(k.terbayar)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.55rem 0', borderBottom: garis ?? 'none', cursor: lunas ? 'default' : 'pointer', fontSize: UKURAN_BARIS, color: warnaTeks }}>
      {/* Komponen yang sudah lunas tampil tercentang dan terkunci: sudah selesai */}
      <input type="checkbox" checked={lunas || dipilih} disabled={lunas} onChange={e => onUbah(e.target.checked)} style={sCentang} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, opacity: lunas ? 0.55 : 1 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: k.warna, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.nama}</span>
          </span>
          {lunas ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: UKURAN_KECIL, fontWeight: 700, color: '#15803D', background: '#DCFCE7', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
              <CheckCircle2 size={11} /> Lunas
            </span>
          ) : (
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatRp(k.sisa)}</span>
          )}
        </span>
        {keterangan && (
          <span style={{ display: 'block', fontSize: UKURAN_KECIL, color: '#94A3B8', marginTop: 2, paddingLeft: 16 }}>{keterangan}</span>
        )}
      </span>
    </label>
  )
}

/** Tagihan yang hanya bisa dibayar sekaligus: satu centang, rinciannya sebagai keterangan */
function BarisUtuh({ b, dipilih, onUbah, warnaTeks }: {
  b: BlokTagihan; dipilih: boolean; onUbah: (centang: boolean) => void; warnaTeks: string
}) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.55rem 0', cursor: 'pointer', fontSize: UKURAN_BARIS, color: warnaTeks }}>
        <input type="checkbox" checked={dipilih} onChange={e => onUbah(e.target.checked)} style={sCentang} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: 700 }}>Seluruh tagihan {BULAN_NAMES[b.bulan]} {b.tahun}</span>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatRp(b.sisa)}</span>
          </span>
          <span style={{ display: 'block', fontSize: UKURAN_KECIL, color: '#94A3B8', marginTop: 2 }}>Tagihan ini dibayar sekaligus</span>
        </span>
      </label>
      <div style={{ paddingLeft: 28, paddingBottom: '0.45rem' }}>
        {b.rincian.map((i, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: UKURAN_KECIL, color: '#64748B', padding: '2px 0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: i.warna, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.nama_komponen}</span>
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>{formatBaris(i.nominal)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Isian({ label, htmlFor, opsional, bantuan, children }: {
  label: string; htmlFor: string; opsional?: boolean; bantuan?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} style={{ display: 'block', fontWeight: 700, fontSize: 'clamp(0.74rem, 2.6vw, 0.84rem)', color: '#1A2C4E', marginBottom: 6 }}>
        {label}{opsional && <span style={{ fontWeight: 500, color: '#94A3B8' }}> (opsional)</span>}
      </label>
      {children}
      {bantuan && <div style={{ fontSize: UKURAN_KECIL, color: '#94A3B8', marginTop: 4 }}>{bantuan}</div>}
    </div>
  )
}

function BarisTotal({ label, nilai, utama }: { label: string; nilai: string; utama?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: utama ? 4 : 0, marginBottom: utama ? 0 : 4 }}>
      <span style={{ fontSize: utama ? 'clamp(0.8rem, 3vw, 1rem)' : 'clamp(0.72rem, 2.5vw, 0.82rem)', color: utama ? '#1A2C4E' : '#64748B', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: utama ? 'clamp(1.05rem, 4vw, 1.3rem)' : 'clamp(0.78rem, 2.8vw, 0.9rem)', color: '#1A2C4E', fontWeight: 800, whiteSpace: 'nowrap' }}>{nilai}</span>
    </div>
  )
}
