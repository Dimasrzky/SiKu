'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronRight, Frown, Info, Lock, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BlokTeks, giliran } from '@/components/skeleton/Blok'
import {
  labelBulan, NOMINAL_MAKS,
  type BulanTunggakanAwal, type DataTunggakanAwal, type HasilSimpanTunggakanAwal, type SimpanTunggakanAwal,
} from '@/lib/tunggakanAwal'

// Modal "Input Tunggakan" di Tagihan Aktif: bendahara memilih siswa, mencentang bulan-bulan
// sebelum sekolah memakai SiKu yang belum dibayar, dan mengisi sisanya per komponen.
// Aturan dan penyimpanannya di /api/tagihan/tunggakan-awal (lihat lib/tunggakanAwal).

export interface SiswaTunggakan {
  id:          string
  nama:        string
  nis:         string | null
  kelas_nama:  string | null
}

type IsianBulan = { dipilih: boolean; nominal: Record<string, string> }
type Isian      = Record<string, IsianBulan>
type Balasan<T> = { data: T | null; error: string | null }

const NAVY       = '#1A2C4E'
const ABU_PANEL  = '#E7E9EC'
const GARIS      = '#C5CAD1'
const TEKS_REDUP = '#8A94A6'
/** Warna avatar siswa di modal ini, sama dengan mockup */
const WARNA_AVATAR = '#B7791F'
const WARNA_KOMPONEN = '#94A3B8'

// ── Animasi ───────────────────────────────────────────────────────────────────
// Hanya opacity, transform, tinggi satu pembungkus, dan baris grid rincian — sifat yang
// murah dihitung ulang, supaya geraknya tidak patah-patah. Satu kurva untuk semuanya:
// cepat di awal, mendarat pelan.
const KURVA         = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DURASI_TINGGI = 340
const DURASI_LIPAT  = 320

const CSS_ANIMASI = `
@keyframes tg-masuk  { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
@keyframes tg-muncul { from { opacity: 0; transform: scale(0.97) } to { opacity: 1; transform: none } }
@keyframes tg-latar  { from { opacity: 0 } to { opacity: 1 } }
.tg-masuk  { animation: tg-masuk 300ms ${KURVA} both }
.tg-muncul { animation: tg-muncul 280ms ${KURVA} both }
.tg-latar  { animation: tg-latar 200ms ease-out both }
.tg-baris-siswa { transition: background-color 160ms ease }
.tg-baris-siswa:hover { background-color: #DDE0E4 !important }
@media (prefers-reduced-motion: reduce) {
  .tg-masuk, .tg-muncul, .tg-latar { animation: none }
  .tg-gerak, .tg-gerak * { transition: none !important }
}
`

const kunciBulan = (b: { bulan: number; tahun: number }): string => `${b.tahun}-${b.bulan}`
const formatRp   = (n: number): string => 'Rp ' + n.toLocaleString('id-ID')
/** Isian nominal (angka saja) sebagai bilangan; kosong = 0 */
const nilai      = (s: string | undefined): number => !s ? 0 : Number(s)
const bisaDiubah = (b: BulanTunggakanAwal): boolean => b.keadaan !== 'sistem' && !b.terkunci

const inisial = (nama: string): string => {
  const kata = nama.trim().split(' ').filter(Boolean)
  return (kata.length >= 2 ? kata[0][0] + kata[1][0] : nama.slice(0, 2)).toUpperCase()
}

function isianAwal(data: DataTunggakanAwal): Isian {
  const isian: Isian = {}
  for (const b of data.bulan) {
    if (b.keadaan === 'sistem') continue
    const manual = b.keadaan === 'manual'
    isian[kunciBulan(b)] = {
      dipilih: manual,
      // Komponen rutin terisi dari paket kelas. Per semester / sekali bayar mulai dari 0 —
      // hanya boleh ditagih di satu bulan, jadi bendahara sendiri yang mengisinya.
      nominal: Object.fromEntries(b.komponen.map(k => [k.komponen_id,
        String(manual ? (k.tersimpan ? k.nominal : 0) : k.jenis === 'rutin_bulanan' ? k.nominal : 0)])),
    }
  }
  return isian
}

/** Yang dikirim ke server: bulan tercentang yang masih bisa diubah beserta komponen bernominal */
function susunKiriman(data: DataTunggakanAwal, isian: Isian): SimpanTunggakanAwal {
  return {
    siswa_id: data.siswa.id,
    bulan: data.bulan
      .filter(b => bisaDiubah(b) && isian[kunciBulan(b)]?.dipilih)
      .map(b => ({
        bulan: b.bulan, tahun: b.tahun,
        komponen: b.komponen
          .map(k => ({ komponen_id: k.komponen_id, nominal: nilai(isian[kunciBulan(b)].nominal[k.komponen_id]) }))
          .filter(k => k.nominal > 0),
      })),
  }
}

/** Nominal tiap komponen bulan itu: isian untuk bulan yang bisa diubah, yang tersimpan untuk yang terkunci */
const nominalBulan = (b: BulanTunggakanAwal, isi: IsianBulan | undefined) =>
  b.komponen.map(k => ({ k, nominal: isi ? nilai(isi.nominal[k.komponen_id]) : k.tersimpan ? k.nominal : 0 }))

const totalBulan = (b: BulanTunggakanAwal, isi: IsianBulan | undefined): number =>
  nominalBulan(b, isi).reduce((s, x) => s + (Number.isFinite(x.nominal) ? x.nominal : 0), 0)

async function tokenSesi(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

/** Bulan-bulan yang bisa diisi untuk satu siswa, dari server */
async function ambilData(siswaId: string): Promise<Balasan<DataTunggakanAwal>> {
  const res  = await fetch(`/api/tagihan/tunggakan-awal?siswa_id=${encodeURIComponent(siswaId)}`, {
    headers: { Authorization: `Bearer ${await tokenSesi()}` },
  }).catch(() => null)
  const json = res ? await res.json().catch(() => null) as Balasan<DataTunggakanAwal> | null : null
  if (!res?.ok || !json?.data) return { data: null, error: json?.error ?? null }
  return { data: json.data, error: null }
}

export function ModalTunggakanAwal({ tahunAjaran, daftarSiswa, onTutup, onTersimpan }: {
  tahunAjaran: string
  /** Siswa aktif yang bisa dipilih — dari tabel Tagihan Aktif */
  daftarSiswa: SiswaTunggakan[]
  onTutup:     () => void
  /** Dipanggil sesudah ada yang tertulis — halaman memuat ulang tabelnya */
  onTersimpan: () => void
}) {
  const [query,     setQuery]     = useState('')
  const [siswa,     setSiswa]     = useState<SiswaTunggakan | null>(null)
  const [muat,      setMuat]      = useState<'memuat' | 'siap' | 'gagal'>('memuat')
  const [galatMuat, setGalatMuat] = useState('')
  const [data,      setData]      = useState<DataTunggakanAwal | null>(null)
  const [isian,     setIsian]     = useState<Isian>({})
  // Bulan yang rinciannya sedang dibuka
  const [terbuka,   setTerbuka]   = useState<Set<string>>(new Set())
  // Kiriman saat dimuat — tombol Simpan aktif hanya kalau ada yang berubah
  const [kirimanAwal, setKirimanAwal] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)
  const [galat,     setGalat]     = useState('')
  const [sukses,    setSukses]    = useState('')
  // Hasil muat untuk siswa sebelumnya yang datang belakangan tidak boleh menimpa pilihan sekarang
  const urutanRef = useRef(0)

  // ── Pilih siswa ────────────────────────────────────────────────────────────

  // Daftar baru muncul setelah bendahara mengetik nama atau NIS
  const kata  = query.trim().toLowerCase()
  const hasil = kata
    ? daftarSiswa.filter(s => s.nama.toLowerCase().includes(kata) || (s.nis ?? '').toLowerCase().includes(kata))
    : []

  const muatData = async (siswaId: string) => {
    const urutan = ++urutanRef.current
    const hasilMuat = await ambilData(siswaId)
    if (urutan !== urutanRef.current) return
    if (!hasilMuat.data) {
      setGalatMuat(hasilMuat.error ?? 'Data tunggakan siswa ini gagal dimuat. Periksa koneksi lalu coba lagi.')
      setMuat('gagal')
      return
    }
    const awal = isianAwal(hasilMuat.data)
    setData(hasilMuat.data)
    setIsian(awal)
    setTerbuka(new Set())
    setKirimanAwal(JSON.stringify(susunKiriman(hasilMuat.data, awal)))
    setMuat('siap')
  }

  const pilihSiswa = (s: SiswaTunggakan) => {
    setSiswa(s)
    setData(null)
    setIsian({})
    setGalat('')
    setSukses('')
    setMuat('memuat')
    void muatData(s.id)
  }

  const lepasSiswa = () => {
    urutanRef.current++
    setSiswa(null)
    setData(null)
    setIsian({})
    setGalat('')
  }

  // ── Isian ──────────────────────────────────────────────────────────────────

  // Mencentang tidak membuka rincian — rincian hanya dibuka lewat tombol Rincian
  const ubahBulan = (b: BulanTunggakanAwal, dipilih: boolean) => {
    const kunci = kunciBulan(b)
    setIsian(prev => ({ ...prev, [kunci]: { ...prev[kunci], dipilih } }))
    setGalat('')
    setSukses('')
  }

  const ubahNominal = (b: BulanTunggakanAwal, komponenId: string, ketikan: string) => {
    const kunci = kunciBulan(b)
    const angka = ketikan.replace(/\D/g, '').slice(0, 10)
    // Mengisi nominal berarti bulan itu memang menunggak — ikut tercentang
    setIsian(prev => ({
      ...prev,
      [kunci]: { dipilih: true, nominal: { ...prev[kunci].nominal, [komponenId]: angka ? String(Number(angka)) : '' } },
    }))
    setGalat('')
    setSukses('')
  }

  const ubahTerbuka = (kunci: string) => setTerbuka(prev => {
    const baru = new Set(prev)
    if (baru.has(kunci)) baru.delete(kunci)
    else baru.add(kunci)
    return baru
  })

  // ── Simpan ─────────────────────────────────────────────────────────────────

  const kiriman      = data ? susunKiriman(data, isian) : null
  const berubah      = !!kiriman && JSON.stringify(kiriman) !== kirimanAwal
  const bulanDipilih = data ? data.bulan.filter(b => bisaDiubah(b) && isian[kunciBulan(b)]?.dipilih) : []
  const totalDipilih = bulanDipilih.reduce((s, b) => s + totalBulan(b, isian[kunciBulan(b)]), 0)
  const akanDihapus  = data ? data.bulan.filter(b => b.keadaan === 'manual' && bisaDiubah(b) && !isian[kunciBulan(b)]?.dipilih) : []
  // Bulan yang sudah ditagih SiKu tidak ditampilkan — cukup bulan yang bisa diisi tunggakan
  const bulanTampil  = data ? data.bulan.filter(b => b.keadaan !== 'sistem') : []
  const jumlahBulan  = bulanTampil.length

  /** Pesan kalau isian belum bisa dikirim, selain itu null */
  const periksaIsian = (d: DataTunggakanAwal, k: SimpanTunggakanAwal): string | null => {
    for (const b of k.bulan) {
      if (b.komponen.some(x => !Number.isInteger(x.nominal) || x.nominal > NOMINAL_MAKS)) {
        return `Nominal di ${labelBulan(b)} paling banyak ${formatRp(NOMINAL_MAKS)}.`
      }
      if (b.komponen.length === 0) return `Isi nominal tunggakan ${labelBulan(b)}, atau hapus centang bulannya.`
    }
    // Komponen per semester / sekali bayar hanya boleh diisi di satu bulan dalam cakupannya
    const dipakai = new Map<string, { nama: string; jenis: string; bulan: string[] }>()
    for (const b of k.bulan) {
      const bd = d.bulan.find(x => x.bulan === b.bulan && x.tahun === b.tahun)
      for (const x of b.komponen) {
        const info = bd?.komponen.find(c => c.komponen_id === x.komponen_id)
        if (!info?.kunciCakupan) continue
        const catatan = dipakai.get(info.kunciCakupan) ?? { nama: info.nama, jenis: info.jenis, bulan: [] }
        catatan.bulan.push(labelBulan(b))
        dipakai.set(info.kunciCakupan, catatan)
      }
    }
    for (const c of dipakai.values()) {
      if (c.bulan.length > 1) {
        const cakupan = c.jenis === 'per_semester' ? 'semester' : 'tahun ajaran'
        return `${c.nama} hanya ditagih sekali per ${cakupan}. Isi di satu bulan saja (sekarang di ${c.bulan.join(' dan ')}).`
      }
    }
    return null
  }

  const simpan = async () => {
    if (!siswa) { setGalat('Pilih siswa dulu dari daftar di atas.'); return }
    if (!data || !kiriman || menyimpan || muat !== 'siap') return
    if (!berubah) {
      setGalat(bulanDipilih.length === 0 ? 'Centang bulan yang belum dibayar dulu.' : 'Belum ada perubahan untuk disimpan.')
      return
    }
    const salah = periksaIsian(data, kiriman)
    if (salah) { setGalat(salah); return }

    setMenyimpan(true)
    setGalat('')
    const res  = await fetch('/api/tagihan/tunggakan-awal', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenSesi()}` },
      body:    JSON.stringify(kiriman),
    }).catch(() => null)
    const json = res ? await res.json().catch(() => null) as Balasan<HasilSimpanTunggakanAwal> | null : null
    setMenyimpan(false)

    if (!res?.ok || !json?.data) {
      setGalat(json?.error ?? 'Tunggakan gagal disimpan. Periksa koneksi lalu coba lagi.')
      // Galat server bisa terjadi sesudah sebagian bulan tertulis: tampilkan keadaan terbarunya.
      // Penolakan isian (4xx) tidak menulis apa pun, jadi isiannya dibiarkan untuk diperbaiki.
      if (!res || res.status >= 500) {
        onTersimpan()
        void muatData(data.siswa.id)
      }
      return
    }

    onTersimpan()
    // Kembali ke daftar siswa tanpa menutup modal — biasanya banyak siswa diisi sekaligus
    setSukses(`Tunggakan ${data.siswa.nama} tersimpan. Pilih siswa berikutnya, atau tutup.`)
    lepasSiswa()
  }

  // ── Tinggi modal yang mengalir ─────────────────────────────────────────────
  // Saat tampilan berganti (pilih siswa, kembali ke pencarian, data selesai dimuat, hasil
  // cari berubah) tinggi isi melompat. Tinggi lama dikunci dulu, lalu dialirkan ke tinggi
  // baru — hanya `height` di satu elemen, sementara isinya sendiri muncul memudar.
  // Perubahan di dalam satu tampilan (buka-tutup rincian) dianimasikan rinciannya sendiri.
  const tampilan = [
    siswa ? `siswa:${muat}` : `cari:${kata ? hasil.length : '-'}`,
    sukses ? 'sukses' : '', galat ? 'galat' : '',
  ].join('|')
  const luarRef   = useRef<HTMLDivElement>(null)
  const dalamRef  = useRef<HTMLDivElement>(null)
  const tinggiRef = useRef(0)
  const selesaiRef = useRef<((e: TransitionEvent) => void) | null>(null)

  // Tinggi terakhir yang terlihat, untuk titik awal animasi berikutnya
  useEffect(() => {
    const dalam = dalamRef.current
    if (!dalam) return
    const ro = new ResizeObserver(() => { if (!luarRef.current?.style.height) tinggiRef.current = dalam.offsetHeight })
    ro.observe(dalam)
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    const luar = luarRef.current, dalam = dalamRef.current
    if (!luar || !dalam) return
    const ke   = dalam.offsetHeight
    // Animasi sebelumnya yang belum selesai dilanjutkan dari posisinya sekarang
    const dari = luar.style.height ? luar.getBoundingClientRect().height : tinggiRef.current
    tinggiRef.current = ke
    if (!dari || Math.abs(dari - ke) < 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    if (selesaiRef.current) luar.removeEventListener('transitionend', selesaiRef.current)
    luar.style.transition = 'none'
    luar.style.overflow = 'hidden'
    luar.style.height = `${dari}px`
    void luar.offsetHeight // terapkan tinggi awal sebelum transisi dimulai
    luar.style.transition = `height ${DURASI_TINGGI}ms ${KURVA}`
    luar.style.height = `${ke}px`
    const selesai = (e: TransitionEvent) => {
      if (e.target !== luar || e.propertyName !== 'height') return
      luar.style.height = ''
      luar.style.transition = ''
      luar.style.overflow = ''
      luar.removeEventListener('transitionend', selesai)
      selesaiRef.current = null
    }
    selesaiRef.current = selesai
    luar.addEventListener('transitionend', selesai)
  }, [tampilan])

  // ── Tampilan ───────────────────────────────────────────────────────────────

  return (
    <div className="tg-latar" style={sBackdrop} onClick={onTutup}>
      <style>{CSS_ANIMASI}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="judul-tunggakan-awal"
        className="tg-muncul" style={sModal} onClick={e => e.stopPropagation()}>

        {/* Judul */}
        <div id="judul-tunggakan-awal" style={{ fontWeight: 700, fontSize: '1.08rem', color: NAVY, lineHeight: 1.3 }}>Input Tunggakan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.84rem', color: '#64748B' }}>
          <CalendarDays size={15} strokeWidth={1.8} /> Tahun ajaran {data?.tahunAjaran ?? tahunAjaran}
        </div>
        <div style={sGarisPenuh} />

        {/* Isi — tingginya mengalir saat tampilan berganti */}
        {/* Selebar modal (margin negatif) supaya garis tepi-ke-tepi tidak terpotong saat beranimasi */}
        <div ref={luarRef} style={{ margin: '0 -1.5rem' }}><div ref={dalamRef} style={{ display: 'flow-root', padding: '0 1.5rem' }}>

        {sukses && (
          <div role="status" className="tg-masuk" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 8, padding: '0.55rem 0.85rem', marginBottom: '0.9rem', fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} /> {sukses}
          </div>
        )}

        {!siswa ? (
          // ── Pilih siswa ───────────────────────────────────────────────────
          <div key="cari" className="tg-masuk">
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: NAVY, marginBottom: '0.6rem' }}>Cari siswa</div>
            <div style={sKotakCari}>
              <Search size={16} color="#64748B" style={{ flexShrink: 0 }} />
              <input
                autoFocus
                placeholder="Cari nama atau NIS..."
                value={query}
                onChange={e => { setQuery(e.target.value); setSukses(''); setGalat('') }}
                aria-label="Cari nama atau NIS siswa"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.8rem', color: NAVY, fontFamily: 'inherit', letterSpacing: 'inherit' }}
              />
            </div>

            {kata && <div className="tg-masuk" style={{ ...sPanel, marginTop: '0.5rem' }}>
              {hasil.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '1.4rem 1rem 1.5rem', color: '#AEB4BE', fontSize: '0.8rem', textAlign: 'center' }}>
                  <Frown size={30} strokeWidth={1.4} color="#B4BAC4" />
                  tidak ditemukan siswa “{query.trim()}”
                </div>
              ) : (
                <div style={{ maxHeight: 236, overflowY: 'auto' }}>
                  {hasil.map((s, i) => (
                    <div key={s.id}>
                      {i > 0 && <div style={{ height: 1.5, background: '#fff', margin: '0 0.9rem' }} />}
                      <button type="button" onClick={() => pilihSiswa(s)} className="tg-baris-siswa" style={sBarisSiswa}>
                        <span style={sAvatar}>{inisial(s.nama)}</span>
                        <span style={{ minWidth: 0, textAlign: 'left' }}>
                          <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: NAVY }}>{s.nama}</span>
                          <span style={{ display: 'block', fontSize: '0.8rem', color: TEKS_REDUP, marginTop: 1 }}>
                            {s.kelas_nama ?? '—'} &bull; NIS {s.nis ?? '-'}
                          </span>
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>}
          </div>
        ) : (
          // ── Siswa terpilih ────────────────────────────────────────────────
          <div key="siswa">
            <div className="tg-muncul" style={{ ...sPanel, display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.8rem' }}>
              <span style={sAvatar}>{inisial(siswa.nama)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: NAVY }}>{siswa.nama}</span>
                <span style={{ display: 'block', fontSize: '0.78rem', color: TEKS_REDUP, marginTop: 1 }}>Kelas {siswa.kelas_nama ?? '—'}</span>
              </span>
              <button type="button" onClick={lepasSiswa} aria-label="Ganti siswa" title="Ganti siswa"
                style={{ width: 34, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #D5D9DF', borderRadius: 6, cursor: 'pointer', color: '#475569', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
            <div style={sGarisPenuh} />

            {muat === 'memuat' && (
              <div aria-busy="true" className="tg-masuk">
                <span role="status" className="skeleton-sr">Memuat bulan tunggakan…</span>
                <div style={sBarisJudul}><span>Bulan yang belum dibayar</span><BlokTeks lebar={110} ukuran="0.75rem" /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} aria-hidden style={{ ...sKartu, display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.9rem' }}>
                      <BlokTeks lebar={20} ukuran="1.1rem" />
                      <span style={{ flex: 1 }}>
                        <BlokTeks lebar={giliran([72, 88, 96], i)} ukuran="0.78rem" />
                        <BlokTeks lebar={giliran([120, 104, 132], i)} ukuran="0.6rem" />
                      </span>
                      <BlokTeks lebar={112} ukuran="0.85rem" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {muat === 'gagal' && (
              <div className="tg-masuk" style={{ ...sPanel, padding: '1.25rem 1rem', textAlign: 'center', color: '#B91C1C', fontSize: '0.82rem', fontWeight: 600 }}>
                {galatMuat}
                <div>
                  <button type="button" onClick={() => { setMuat('memuat'); void muatData(siswa.id) }}
                    style={{ marginTop: 8, background: 'none', border: 'none', color: '#B91C1C', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Coba lagi
                  </button>
                </div>
              </div>
            )}

            {muat === 'siap' && data && (
              bulanTampil.length === 0 ? (
                <div className="tg-masuk" style={sCatatanKosong}>
                  <Frown size={28} strokeWidth={1.4} color="#B4BAC4" />
                  {data.bulan.length === 0
                    ? `Tahun ajaran ${data.tahunAjaran} dimulai bulan ini, jadi belum ada bulan sebelumnya untuk diisi.`
                    : 'Semua bulan sebelumnya sudah ditagih SiKu untuk siswa ini, jadi tidak ada tunggakan yang perlu diisi di sini.'}
                </div>
              ) : (
                <div className="tg-masuk">
                  <div style={sBarisJudul}>
                    <span>Bulan yang belum dibayar</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748B' }}>
                      <CalendarDays size={13} strokeWidth={1.8} /> {jumlahBulan} bulan belum dibayar
                    </span>
                  </div>

                  {data.tanpaPaket && (
                    <div style={{ ...sCatatanKosong, marginBottom: '0.6rem' }}>
                      <Frown size={28} strokeWidth={1.4} color="#B4BAC4" />
                      Kelas siswa ini belum masuk paket tahun ajaran {data.tahunAjaran}, jadi belum ada komponen yang bisa diisi.
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 360, overflowY: 'auto', padding: 4, margin: -4 }}>
                    {bulanTampil.map((b, i) => (
                      // Kartu muncul berurutan, sedikit bergiliran
                      <div key={kunciBulan(b)} className="tg-masuk" style={{ animationDelay: `${60 + i * 45}ms` }}>
                        <KartuBulan b={b} isi={isian[kunciBulan(b)]} terbuka={terbuka.has(kunciBulan(b))}
                          ubahBulan={ubahBulan} ubahNominal={ubahNominal} ubahTerbuka={() => ubahTerbuka(kunciBulan(b))} />
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: '0.85rem', fontSize: '0.72rem', color: TEKS_REDUP, lineHeight: 1.45 }}>
                    <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      Nominal diisi otomatis dari <strong style={{ color: '#475569' }}>paket kelas</strong> siswa.
                      Klik <strong style={{ color: '#475569' }}>rincian</strong> untuk lihat atau ubah per komponen.
                    </span>
                  </div>
                  {akanDihapus.length > 0 && (
                    <div style={{ fontSize: '0.74rem', color: '#B91C1C', fontWeight: 600, marginTop: '0.4rem' }}>
                      Tunggakan {akanDihapus.map(labelBulan).join(', ')} akan dihapus saat disimpan.
                    </div>
                  )}

                  <div style={{ borderTop: '1.5px dashed #E2E5EA', margin: '0.9rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <span>
                      <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 500, color: NAVY }}>Total tunggakan</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: TEKS_REDUP, marginTop: 2 }}>{bulanDipilih.length} bulan dipilih</span>
                    </span>
                    <span style={{ fontSize: '0.98rem', fontWeight: 600, color: NAVY, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      Total: {formatRp(totalDipilih)}
                    </span>
                  </div>
                </div>
              )
            )}

          </div>
        )}

        {galat && (
          <div role="alert" className="tg-masuk" style={{ background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, padding: '0.55rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.9rem' }}>
            {galat}
          </div>
        )}
        {siswa && <div style={{ ...sGarisPenuh, marginTop: '0.9rem' }} />}

        </div></div>

        {/* Tombol */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: siswa ? 0 : '1.6rem' }}>
          <button type="button" onClick={onTutup} style={sBtnBatal}>Batal</button>
          <button type="button" onClick={simpan} disabled={menyimpan}
            style={{ ...sBtnSimpan, opacity: menyimpan ? 0.6 : 1, cursor: menyimpan ? 'progress' : 'pointer' }}>
            {menyimpan ? 'Menyimpan...' : siswa ? 'Simpan Siswa' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Satu bulan ────────────────────────────────────────────────────────────────

function KartuBulan({ b, isi, terbuka, ubahBulan, ubahNominal, ubahTerbuka }: {
  b:           BulanTunggakanAwal
  isi:         IsianBulan | undefined
  terbuka:     boolean
  ubahBulan:   (b: BulanTunggakanAwal, dipilih: boolean) => void
  ubahNominal: (b: BulanTunggakanAwal, komponenId: string, ketikan: string) => void
  ubahTerbuka: () => void
}) {
  if (b.keadaan === 'sistem') {
    return (
      <div style={{ ...sKartu, display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.9rem', background: '#F8FAFC', boxShadow: 'none' }}>
        <CheckCircle2 size={20} color="#B4BAC4" strokeWidth={1.8} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8' }}>{labelBulan(b)}</span>
        <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>Sudah ditagih SiKu</span>
      </div>
    )
  }

  const terkunci  = !!b.terkunci
  const dipilih   = !!isi?.dipilih
  const tanpaIsi  = b.komponen.length === 0
  const nominal   = nominalBulan(b, isi)
  const total     = totalBulan(b, isi)
  const chip      = nominal.filter(x => x.nominal > 0)

  return (
    <div className="tg-gerak" style={{
      ...sKartu, opacity: tanpaIsi ? 0.7 : 1,
      // Kartu yang dicentang sedikit lebih tegas, berpindahnya halus
      borderColor: dipilih ? '#D5DAE2' : '#EEF0F3',
      boxShadow: dipilih ? '0 2px 10px rgba(26,44,78,0.16)' : sKartu.boxShadow,
      transition: 'border-color 200ms ease, box-shadow 200ms ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.9rem' }}>
        {terkunci ? (
          <span title={b.terkunci ?? ''} style={{ width: 20, height: 20, borderRadius: 4, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lock size={12} color="#475569" />
          </span>
        ) : (
          <input type="checkbox" checked={dipilih} disabled={tanpaIsi} aria-label={labelBulan(b)}
            onChange={e => ubahBulan(b, e.target.checked)} style={sCentang} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: NAVY }}>{labelBulan(b)}</span>
            {terkunci && <span style={{ ...sLencana, color: '#475569', background: '#E2E8F0' }}>{b.terkunci}</span>}
            {!terkunci && b.keadaan === 'manual' && (dipilih
              ? <span style={{ ...sLencana, color: '#92400E', background: '#FEF3C7' }}>Tersimpan</span>
              : <span style={{ ...sLencana, color: '#B91C1C', background: '#FEE2E2' }}>Akan dihapus</span>)}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4, minHeight: 15 }}>
            {tanpaIsi
              ? <span style={{ fontSize: '0.68rem', color: TEKS_REDUP }}>Tidak ada komponen</span>
              : chip.length === 0
                ? <span style={{ fontSize: '0.68rem', color: TEKS_REDUP }}>Belum ada nominal</span>
                : chip.map(({ k }) => (
                    <span key={k.komponen_id} style={{ fontSize: '0.62rem', fontWeight: 600, color: '#fff', background: k.warna ?? WARNA_KOMPONEN, borderRadius: 20, padding: '1px 8px', lineHeight: 1.5, whiteSpace: 'nowrap' }}>
                      {k.nama}
                    </span>
                  ))}
          </div>
        </div>

        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: NAVY, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          Total: {formatRp(total)}
        </span>
        {!tanpaIsi && (
          <button type="button" onClick={ubahTerbuka} aria-expanded={terbuka}
            style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: '2px 0 2px 6px', cursor: 'pointer', color: TEKS_REDUP, fontSize: '0.72rem', fontFamily: 'inherit', letterSpacing: 'inherit' }}>
            Rincian
            <ChevronRight size={14} className="tg-gerak"
              style={{ transition: `transform ${DURASI_LIPAT}ms ${KURVA}`, transform: terbuka ? 'rotate(90deg)' : 'none' }} />
          </button>
        )}
      </div>

      {/* Rincian selalu ada di DOM supaya bisa dilipat: tinggi baris grid 0fr ↔ 1fr dianimasikan,
          isinya memudar. Saat tertutup `inert`, jadi kolom nominalnya tidak bisa dijangkau Tab. */}
      {!tanpaIsi && (
        <div className="tg-gerak" style={{ display: 'grid', gridTemplateRows: terbuka ? '1fr' : '0fr', transition: `grid-template-rows ${DURASI_LIPAT}ms ${KURVA}` }}>
        <div style={{ minHeight: 0, overflow: 'hidden' }} inert={!terbuka}>
        <div style={{
          borderTop: '1px solid #EEF0F3', padding: '0.55rem 0.9rem 0.8rem',
          opacity: terbuka ? 1 : 0, transform: terbuka ? 'none' : 'translateY(-4px)',
          transition: `opacity ${terbuka ? 260 : 160}ms ease, transform ${DURASI_LIPAT}ms ${KURVA}`,
        }}>
          <div style={{ fontSize: '0.68rem', color: TEKS_REDUP, marginBottom: '0.45rem' }}>Rincian komponen</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem 0.65rem' }}>
            {/* Bulan terkunci hanya menampilkan yang tersimpan */}
            {nominal.filter(x => !terkunci || x.nominal > 0).map(({ k, nominal: n }) => {
              const warna = k.warna ?? WARNA_KOMPONEN
              return (
                <label key={k.komponen_id} title={k.nama}
                  style={{ display: 'flex', height: 28, border: `2px solid ${warna}`, borderRadius: 4, overflow: 'hidden', background: warna, cursor: terkunci ? 'default' : 'text' }}>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '0 0.3rem 0 0.4rem', color: '#fff', fontSize: '0.66rem', fontWeight: 500 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.nama}</span>
                  </span>
                  <span style={{ width: '45%', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, background: '#fff', padding: '0 0.3rem', borderRadius: 2 }}>
                    <span style={{ fontSize: '0.66rem', color: '#64748B' }}>Rp</span>
                    <input
                      type="text" inputMode="numeric"
                      value={isi ? (isi.nominal[k.komponen_id] ? Number(isi.nominal[k.komponen_id]).toLocaleString('id-ID') : '') : n.toLocaleString('id-ID')}
                      placeholder="0"
                      disabled={terkunci}
                      aria-label={`Nominal ${k.nama} ${labelBulan(b)}`}
                      onChange={e => ubahNominal(b, k.komponen_id, e.target.value)}
                      style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: 0, fontSize: '0.68rem', color: NAVY, fontFamily: 'inherit', letterSpacing: 'inherit', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </span>
                </label>
              )
            })}
          </div>
          {terkunci && (
            <div style={{ fontSize: '0.68rem', color: TEKS_REDUP, marginTop: '0.45rem' }}>
              Sudah tidak bisa diubah. Sisanya dibayar lewat Catat Pembayaran.
            </div>
          )}
        </div>
        </div>
        </div>
      )}
    </div>
  )
}

// ── Gaya ──────────────────────────────────────────────────────────────────────

const sBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(18,47,102,0.45)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem',
}

// Mockup Figma memakai DM Sans dengan jarak huruf rapat
const sModal: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '1.25rem 1.5rem 1.4rem', width: '100%', maxWidth: 600,
  boxShadow: '0 24px 64px rgba(18,47,102,0.22)', position: 'relative', maxHeight: '92vh', overflowY: 'auto',
  fontFamily: 'var(--font-dm-sans), sans-serif', letterSpacing: '-0.02em',
}

const sGarisPenuh: React.CSSProperties = { borderTop: '1.5px solid #E7E9EC', margin: '0.9rem -1.5rem 1rem' }

const sKotakCari: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 0.75rem',
  background: '#fff', border: '1.5px solid #E2E5EA', borderRadius: 8, boxShadow: '0 2px 6px rgba(26,44,78,0.10)',
}

const sPanel: React.CSSProperties = {
  background: ABU_PANEL, border: `1.5px solid ${GARIS}`, borderRadius: 8, overflow: 'hidden',
}

const sBarisSiswa: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.9rem',
  background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 'inherit',
}

const sAvatar: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%', background: WARNA_AVATAR, color: '#fff', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.86rem', letterSpacing: 0,
}

const sBarisJudul: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
  fontSize: '0.78rem', fontWeight: 500, color: NAVY, marginBottom: '0.6rem',
}

const sKartu: React.CSSProperties = {
  background: '#fff', border: '1px solid #EEF0F3', borderRadius: 10, boxShadow: '0 1px 6px rgba(26,44,78,0.12)',
}

const sCentang: React.CSSProperties = {
  width: 20, height: 20, margin: 0, accentColor: NAVY, flexShrink: 0, cursor: 'pointer',
}

const sLencana: React.CSSProperties = {
  fontSize: '0.62rem', fontWeight: 700, borderRadius: 20, padding: '1px 7px', whiteSpace: 'nowrap',
}

const sCatatanKosong: React.CSSProperties = {
  ...sPanel, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  padding: '1.3rem 1rem 1.4rem', color: '#AEB4BE', fontSize: '0.8rem', textAlign: 'center', lineHeight: 1.5,
}

const sBtnDasar: React.CSSProperties = {
  minWidth: 104, height: 34, padding: '0 1.1rem', borderRadius: 7, fontWeight: 700, fontSize: '0.82rem',
  fontFamily: 'inherit', letterSpacing: 'inherit', boxShadow: '0 2px 4px rgba(26,44,78,0.12)',
}

const sBtnBatal: React.CSSProperties = {
  ...sBtnDasar, background: '#fff', color: NAVY, border: '1.5px solid #BABFC9', cursor: 'pointer',
}

const sBtnSimpan: React.CSSProperties = {
  ...sBtnDasar, background: NAVY, color: '#fff', border: 'none',
}
