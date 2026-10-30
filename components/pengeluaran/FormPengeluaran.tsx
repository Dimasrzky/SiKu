'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Plus, Upload, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatRupiah, formatRupiahRingkas } from '@/lib/formatLaporan'
import { tanggalWIB } from '@/lib/metrikLaporan'
import { kunciKomponen, statusSumberDana, type StatusSumberDana } from '@/lib/kasKomponen'
import {
  MAKS_KETERANGAN, MAKS_NAMA_SATUAN, angkaKeIsian, bacaAngkaIsian, formatLama, hitungJumlah, rupiahKeIsian, tanggalKeIso,
  urutkanKategori, type KategoriPengeluaran, type Pengeluaran,
} from '@/lib/pengeluaran'
import {
  hapusFotoPengeluaran, periksaFoto, tautanFotoPengeluaran, unggahFotoPengeluaran,
} from '@/lib/fotoPengeluaran'
import { FONT_PENGELUARAN, NAVY } from './BagianPengeluaran'

// Form Catat Pengeluaran (mockup user 27 Okt 2026) — kartu di dalam halaman yang turun
// membuka di atas konten, seperti form di halaman Komponen Tagihan (bukan modal; lipatan
// tingginya diatur halaman). Kiri: jenis, tanggal, nama, foto nota.
// Kanan: Volume × Biaya Satuan = Jumlah total (boleh diubah kalau beda dengan nota), lalu
// sumber dana — komponen yang membiayainya, minimal satu, masing-masing dengan nominal —
// dan status: Belum lengkap / Kelebihan / Sesuai. Hanya "Sesuai" yang bisa disimpan.
// Penyimpanan lewat fungsi database simpan_pengeluaran: pengeluaran dan sumber dananya
// tersimpan bersamaan atau tidak sama sekali.

/** Satu komponen yang bisa dipilih sebagai sumber dana */
export interface PilihanSumberDana {
  kunci:       string
  nama:        string
  komponen_id: string | null
  warna:       string
  /** Sisa saldo komponen sepanjang periode terpilih, sudah dikurangi semua pengeluaran yang tercatat */
  sisa:        number
}

/** Pesan galat Postgres yang bisa dipahami bendahara */
function pesanGalat(e: { code?: string; message?: string } | null): string {
  const kode = e?.code
  if (kode === 'PGRST202') return 'Database belum disiapkan untuk sumber dana (fungsi simpan_pengeluaran belum ada).'
  if (kode === '42501')    return 'Fitur Pengeluaran belum aktif untuk sekolah ini.'
  if (kode === '23503')    return 'Jenis pengeluaran tidak ditemukan. Muat ulang halaman, lalu coba lagi.'
  if (kode === 'P0002')    return 'Pengeluaran ini sudah tidak ada. Muat ulang halaman.'
  if (kode === '23514')    return 'Isian tidak sesuai aturan. Periksa kembali angka, sumber dana, dan panjang teksnya.'
  return 'Pengeluaran gagal disimpan. Coba lagi.'
}

const LABEL_STATUS: Record<StatusSumberDana, { teks: string; warna: string; isi: string }> = {
  kurang: { teks: 'Belum lengkap', warna: '#B7791F', isi: '#C08A4A' },
  lebih:  { teks: 'Kelebihan',     warna: '#DC2626', isi: '#E57373' },
  sesuai: { teks: 'Sesuai',        warna: '#16A34A', isi: '#4CC07A' },
}

const IsianRupiah = ({ nilai, onUbah, label, kecil = false, autoFocus = false, warnaBingkai }: {
  nilai: string; onUbah: (digit: string) => void; label: string; kecil?: boolean; autoFocus?: boolean; warnaBingkai?: string
}) => (
  <div style={{ position: 'relative' }}>
    <span style={{ position: 'absolute', left: kecil ? 9 : 12, top: '50%', transform: 'translateY(-50%)', fontSize: kecil ? '0.74rem' : '0.82rem', color: '#64748B', pointerEvents: 'none' }}>Rp</span>
    <input type="text" inputMode="numeric" value={rupiahKeIsian(nilai)} autoFocus={autoFocus}
      onChange={e => onUbah(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13))} placeholder="0"
      aria-label={label}
      style={{ ...sInput, height: kecil ? 32 : 40, paddingLeft: kecil ? 30 : 38, fontSize: kecil ? '0.78rem' : '0.84rem', borderColor: warnaBingkai ?? sInput.borderColor }} />
  </div>
)

export const FormPengeluaran = ({ sekolahId, kategori, pilihanSumber, awal, tanggalAwal, menutup, onTutup, onTersimpan, onKelolaKategori }: {
  /** Sedang dilipat kembali — kartunya memudar naik selagi tingginya menutup */
  menutup:          boolean
  sekolahId:        string
  kategori:         KategoriPengeluaran[]
  pilihanSumber:    PilihanSumberDana[]
  /** null = pengeluaran baru */
  awal:             Pengeluaran | null
  /** 'YYYY-MM-DD' untuk pengeluaran baru */
  tanggalAwal:      string
  onTutup:          () => void
  /** `peringatan` terisi kalau pengeluarannya tersimpan tapi fotonya gagal */
  onTersimpan:      (tanggalIso: string, peringatan: string | null) => void
  onKelolaKategori: () => void
}) => {
  const daftarKategori = useMemo(() => urutkanKategori(kategori), [kategori])

  // Format lama dua besaran (18 hari × 14 guru) digabung menjadi satu Volume (252)
  const volumeAwal = awal
    ? formatLama(awal) ? (awal.volume ?? 1) * (awal.kuantitas ?? 1) : awal.volume
    : 1
  const satuanAwal = awal ? (formatLama(awal) ? awal.kuantitas_satuan ?? awal.volume_satuan : awal.volume_satuan) ?? '' : ''
  const jumlahAwalOtomatis = awal ? hitungJumlah(volumeAwal, null, awal.biaya_satuan) : null

  const [kategoriId,   setKategoriId]   = useState(awal?.kategori_id ?? daftarKategori[0]?.id ?? '')
  const [tanggal,      setTanggal]      = useState(awal ? tanggalWIB(new Date(awal.tanggal)) : tanggalAwal)
  const [nama,         setNama]         = useState(awal?.keterangan ?? '')
  const [volume,       setVolume]       = useState(angkaKeIsian(volumeAwal))
  const [satuan,       setSatuan]       = useState(satuanAwal)
  const [biaya,        setBiaya]        = useState(awal?.biaya_satuan != null ? String(awal.biaya_satuan) : '')
  const [jumlah,       setJumlah]       = useState(awal ? String(awal.jumlah) : '')
  // Jumlah diisi tangan: tidak lagi mengikuti Volume × Biaya Satuan (nota bisa berbeda)
  const [jumlahManual, setJumlahManual] = useState(awal !== null && jumlahAwalOtomatis !== awal.jumlah)

  // Sumber dana: kunci komponen → nominal (digit) untuk yang dicentang
  const [sumber, setSumber] = useState<Record<string, string>>(() =>
    Object.fromEntries((awal?.sumber_dana ?? []).map(s => [kunciKomponen(s.nama_komponen), String(s.nominal)])))
  // Kolom nominal yang baru muncul karena dicentang langsung difokus (bukan saat form dibuka)
  const [fokusKunci, setFokusKunci] = useState<string | null>(null)

  const [foto,           setFoto]           = useState<File | null>(null)
  const [pratinjau,      setPratinjau]      = useState<string | null>(null)
  const [hapusFotoLama,  setHapusFotoLama]  = useState(false)
  const [tautanFotoLama, setTautanFotoLama] = useState<string | null>(null)
  const [seret,          setSeret]          = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  const [menyimpan, setMenyimpan] = useState(false)
  const [galat,     setGalat]     = useState('')

  // Foto yang sudah tersimpan ditampilkan sebagai gambar kecil
  useEffect(() => {
    if (!awal?.foto_path) return
    let batal = false
    tautanFotoPengeluaran(awal.id).then(h => { if (!batal && h.error === null) setTautanFotoLama(h.data) })
    return () => { batal = true }
  }, [awal])

  useEffect(() => () => { if (pratinjau) URL.revokeObjectURL(pratinjau) }, [pratinjau])

  // Esc menutup, kecuali saat menyimpan
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape' && !menyimpan) onTutup() }
    document.addEventListener('keydown', tekan)
    return () => document.removeEventListener('keydown', tekan)
  }, [menyimpan, onTutup])

  // Pilihan sumber dana: komponen periode ini, ditambah sumber lama pengeluaran ini yang
  // namanya sudah tidak ada. Sisa saldo ditambah kembali bagian pengeluaran ini sendiri —
  // saat diubah, uang yang dulu diambilnya dihitung tersedia lagi.
  const pilihan = useMemo(() => {
    const milikSendiri = new Map((awal?.sumber_dana ?? []).map(s => [kunciKomponen(s.nama_komponen), s]))
    const hasil = pilihanSumber.map(p => ({ ...p, sisa: p.sisa + (milikSendiri.get(p.kunci)?.nominal ?? 0) }))
    for (const [kunci, s] of milikSendiri) {
      if (!hasil.some(p => p.kunci === kunci)) {
        hasil.push({ kunci, nama: s.nama_komponen, komponen_id: s.komponen_id, warna: '#94A3B8', sisa: s.nominal })
      }
    }
    return hasil
  }, [pilihanSumber, awal])

  const angkaVolume    = bacaAngkaIsian(volume)
  const angkaBiaya     = biaya ? Number(biaya) : null
  const jumlahOtomatis = hitungJumlah(angkaVolume !== null && !Number.isNaN(angkaVolume) ? angkaVolume : null, null, angkaBiaya)
  const jumlahEfektif  = !jumlahManual && jumlahOtomatis !== null ? String(jumlahOtomatis) : jumlah
  const nilaiJumlah    = Number(jumlahEfektif || 0)
  // Jenis bisa dibuat atau dihapus lewat Kelola Kategori selagi form ini terbuka
  const kategoriEfektif = daftarKategori.some(k => k.id === kategoriId) ? kategoriId : daftarKategori[0]?.id ?? ''

  const dipilih = pilihan.filter(p => p.kunci in sumber)
  const diambil = dipilih.reduce((s, p) => s + Number(sumber[p.kunci] || 0), 0)
  // Form yang belum diisi (jumlah 0, belum ada sumber dana) belum lengkap, bukan "sesuai"
  const status  = nilaiJumlah > 0 && dipilih.length > 0 ? statusSumberDana(nilaiJumlah, diambil) : 'kurang'
  const gaya    = LABEL_STATUS[status]
  const isiBar  = nilaiJumlah > 0 ? Math.min(100, (diambil / nilaiJumlah) * 100) : 0

  const centang = (p: PilihanSumberDana, ya: boolean) => {
    setGalat('')
    setFokusKunci(ya ? p.kunci : null)
    setSumber(lama => {
      const baru = { ...lama }
      if (!ya) { delete baru[p.kunci]; return baru }
      // Langsung terisi kekurangannya — kalau cukup satu komponen, bendahara tinggal menyimpan
      const lainnya = Object.entries(lama).reduce((s, [, v]) => s + Number(v || 0), 0)
      const kurang  = Math.max(0, nilaiJumlah - lainnya)
      baru[p.kunci] = kurang > 0 ? String(kurang) : ''
      return baru
    })
  }

  const pilihFoto = (berkas: File | undefined) => {
    if (!berkas) return
    const salah = periksaFoto(berkas)
    if (salah) { setGalat(salah); return }
    setGalat('')
    setFoto(berkas)
    setPratinjau(URL.createObjectURL(berkas))
    setHapusFotoLama(false)
  }

  const buangFoto = () => {
    if (foto) {
      setFoto(null)
      setPratinjau(null)
      if (inputFotoRef.current) inputFotoRef.current.value = ''
    } else {
      setHapusFotoLama(true)
    }
  }

  const simpan = async () => {
    if (menyimpan) return
    const ket = nama.trim()
    if (!kategoriEfektif)                          return setGalat('Pilih jenis pengeluaran. Belum ada? Tambah lewat tombol +.')
    if (!tanggal)                                  return setGalat('Tanggal pengeluaran wajib diisi.')
    if (!ket)                                      return setGalat('Nama pengeluaran wajib diisi.')
    if (ket.length > MAKS_KETERANGAN)              return setGalat(`Nama pengeluaran maksimal ${MAKS_KETERANGAN} karakter.`)
    if (angkaVolume === null || Number.isNaN(angkaVolume) || angkaVolume <= 0) {
      return setGalat('Volume harus angka lebih dari 0, paling banyak 2 angka di belakang koma.')
    }
    if (!(nilaiJumlah > 0))                        return setGalat('Jumlah total wajib diisi dan lebih dari 0.')
    if (dipilih.length === 0)                      return setGalat('Pilih minimal satu sumber dana.')
    const kosong = dipilih.find(p => !(Number(sumber[p.kunci] || 0) > 0))
    if (kosong)                                    return setGalat(`Isi nominal yang diambil dari ${kosong.nama}.`)
    if (status !== 'sesuai') {
      return setGalat(status === 'kurang'
        ? `Sumber dana masih kurang ${formatRupiah(nilaiJumlah - diambil)} dari jumlah total.`
        : `Sumber dana kelebihan ${formatRupiah(diambil - nilaiJumlah)} dari jumlah total.`)
    }

    setMenyimpan(true)
    setGalat('')
    const tanggalIso = tanggalKeIso(tanggal)
    try {
      const { data, error } = await supabase.rpc('simpan_pengeluaran', {
        p_id:         awal?.id ?? null,
        p_sekolah_id: sekolahId,
        p_data: {
          kategori_id:   kategoriEfektif,
          tanggal:       tanggalIso,
          keterangan:    ket,
          volume:        angkaVolume,
          volume_satuan: satuan.trim() || null,
          biaya_satuan:  angkaBiaya,
          jumlah:        nilaiJumlah,
        },
        p_sumber: dipilih.map(p => ({ komponen_id: p.komponen_id, nama_komponen: p.nama, nominal: Number(sumber[p.kunci]) })),
      })
      if (error || typeof data !== 'string') { setGalat(pesanGalat(error)); return }
      const id = data

      // Pengeluarannya sudah tersimpan; foto yang gagal hanya jadi peringatan
      let peringatan: string | null = null
      if (foto) {
        const h = await unggahFotoPengeluaran(id, foto)
        if (h.error !== null) peringatan = `Pengeluaran tersimpan, tetapi foto nota gagal diunggah: ${h.error}`
      } else if (hapusFotoLama && awal?.foto_path) {
        const h = await hapusFotoPengeluaran(id)
        if (h.error !== null) peringatan = `Pengeluaran tersimpan, tetapi foto nota gagal dihapus: ${h.error}`
      }
      onTersimpan(tanggalIso, peringatan)
    } finally {
      setMenyimpan(false)
    }
  }

  const adaFotoLama  = !!awal?.foto_path && !hapusFotoLama && !foto
  const gambarFoto   = pratinjau ?? (adaFotoLama ? tautanFotoLama : null)

  return (
      <div role="region" aria-label={awal ? 'Ubah pengeluaran' : 'Catat pengeluaran'}
        className={menutup ? 'pg-naik' : 'pg-turun'} style={sKotak}>

        {/* ── Kiri ── */}
        <div style={{ flex: '1 1 270px', padding: '1.5rem 1.6rem', borderRight: '1.5px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.15rem', minWidth: 0 }}>
          <div>
            <label htmlFor="pg-jenis" style={sLabel}>Jenis pengeluaran</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select id="pg-jenis" value={kategoriEfektif} onChange={e => setKategoriId(e.target.value)}
                style={{ ...sInput, flex: 1, minWidth: 0, color: kategoriEfektif ? '#0F172A' : '#94A3B8', cursor: 'pointer' }}>
                {daftarKategori.length === 0 && <option value="">Belum ada jenis — klik +</option>}
                {daftarKategori.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
              <button type="button" onClick={onKelolaKategori} aria-label="Kelola jenis pengeluaran" title="Tambah atau ubah jenis pengeluaran"
                className="fp-tekan" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 8, border: 'none', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Plus size={19} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="pg-tanggal" style={sLabel}>Tanggal</label>
            <input id="pg-tanggal" type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} style={sInput} />
          </div>

          <div>
            <label htmlFor="pg-nama" style={sLabel}>Nama pengeluaran</label>
            <input id="pg-nama" value={nama} onChange={e => setNama(e.target.value)} maxLength={MAKS_KETERANGAN}
              placeholder="e.g. WiFi, ATK, Seragam..." style={sInput} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 210 }}>
            <span style={sLabel}>Foto Nota <span style={sOpsional}>(Opsional)</span></span>
            <input ref={inputFotoRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }}
              onChange={e => pilihFoto(e.target.files?.[0])} />
            <div
              role="button" tabIndex={0}
              onClick={() => inputFotoRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputFotoRef.current?.click() } }}
              onDragOver={e => { e.preventDefault(); setSeret(true) }}
              onDragLeave={() => setSeret(false)}
              onDrop={e => { e.preventDefault(); setSeret(false); pilihFoto(e.dataTransfer.files?.[0]) }}
              aria-label="Pilih foto nota"
              style={{
                flex: 1, border: `2px dashed ${seret ? '#3C75B7' : '#CBD5E1'}`, borderRadius: 12, background: seret ? '#EFF6FF' : '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '1rem',
                cursor: 'pointer', textAlign: 'center', transition: 'border-color 150ms ease, background-color 150ms ease', position: 'relative', overflow: 'hidden',
              }}
            >
              {gambarFoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={gambarFoto} alt="Foto nota" style={{ maxWidth: '100%', maxHeight: 170, objectFit: 'contain', borderRadius: 8 }} />
              ) : adaFotoLama ? (
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Foto nota tersimpan</span>
              ) : (
                <>
                  <Upload size={30} color="#94A3B8" strokeWidth={1.8} />
                  <span style={{ fontSize: '0.84rem', color: '#64748B', marginTop: 6 }}>
                    {hapusFotoLama ? 'Foto akan dihapus — pilih foto baru' : 'Drag & drop file PNG/JPG'}
                  </span>
                  <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>atau klik untuk pilih file</span>
                </>
              )}
            </div>
            {(foto || adaFotoLama) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6, fontSize: '0.72rem', color: '#64748B' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{foto ? foto.name : 'Foto nota tersimpan'}</span>
                <button type="button" onClick={buangFoto} style={{ background: 'none', border: 'none', padding: 0, color: '#DC2626', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Hapus foto
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Kanan ── */}
        <div style={{ flex: '1.75 1 420px', padding: '1.5rem 1.6rem', display: 'flex', flexDirection: 'column', gap: '1.15rem', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 1 110px', minWidth: 80 }}>
              <label htmlFor="pg-volume" style={sLabel}>Volume</label>
              <input id="pg-volume" value={volume} onChange={e => setVolume(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="1" style={sInput} />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 110 }}>
              <label htmlFor="pg-satuan" style={sLabel}>Satuan <span style={sOpsional}>(Opsional)</span></label>
              <input id="pg-satuan" value={satuan} onChange={e => setSatuan(e.target.value)} maxLength={MAKS_NAMA_SATUAN} placeholder="Buah" style={sInput} />
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 140 }}>
              <span style={sLabel}>Biaya Satuan</span>
              <IsianRupiah nilai={biaya} onUbah={setBiaya} label="Biaya satuan" />
            </div>
          </div>

          <div>
            <span style={sLabel}>Jumlah total</span>
            <IsianRupiah nilai={jumlahEfektif} label="Jumlah total" onUbah={v => { setJumlah(v); setJumlahManual(true) }} />
            <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 4, minHeight: '1rem' }}>
              {jumlahOtomatis === null
                ? 'Isi Biaya Satuan supaya Jumlah total dihitung dari Volume × Biaya Satuan.'
                : jumlahManual && Number(jumlah || 0) !== jumlahOtomatis
                  ? <>Diisi sendiri. Hasil hitung: <strong>{formatRupiah(jumlahOtomatis)}</strong>{' '}
                      <button type="button" onClick={() => setJumlahManual(false)} style={{ background: 'none', border: 'none', padding: 0, color: '#3C75B7', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Pakai hasil hitung
                      </button></>
                  : 'Volume × Biaya Satuan. Bisa diubah kalau berbeda dengan nota.'}
            </div>
          </div>

          <div>
            <span style={sLabel}>Sumber dana</span>
            {pilihan.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: '#92400E', background: '#FEF3C7', borderRadius: 8, padding: '0.65rem 0.8rem', lineHeight: 1.5 }}>
                Belum ada komponen tagihan. Buat komponen di menu Tagihan › Komponen Tagihan dulu.
              </div>
            ) : (
              <div className="pg-gulir" style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', padding: '4px 4px 10px', margin: '0 -4px', scrollSnapType: 'x proximity' }}>
                {pilihan.map(p => {
                  const ya       = p.kunci in sumber
                  const nominal  = Number(sumber[p.kunci] || 0)
                  const melebihi = ya && nominal > Math.max(0, p.sisa)
                  return (
                    <div key={p.kunci} style={{
                      flex: '0 0 calc((100% - 1.5rem) / 3)', minWidth: 160, scrollSnapAlign: 'start',
                      background: '#fff', borderRadius: 10, padding: '0.65rem 0.75rem 0.75rem',
                      boxShadow: ya ? '0 2px 10px rgba(26,44,78,0.22)' : '0 2px 8px rgba(26,44,78,0.13)',
                      border: `1.5px solid ${ya ? '#CBD5E1' : 'transparent'}`, transition: 'box-shadow 160ms ease, border-color 160ms ease',
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.warna, flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: '0.76rem', fontWeight: 500, color: p.warna, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nama}</span>
                        <input type="checkbox" checked={ya} onChange={e => centang(p, e.target.checked)}
                          aria-label={`Ambil dari ${p.nama}`} style={{ width: 16, height: 16, margin: 0, accentColor: NAVY, cursor: 'pointer', flexShrink: 0 }} />
                      </label>
                      <div style={{ fontSize: '0.7rem', color: p.sisa < 0 ? '#DC2626' : '#6B7280', margin: '0.3rem 0 0' }}>
                        Sisa: {p.sisa < 0 ? `−${formatRupiahRingkas(-p.sisa)}` : formatRupiahRingkas(p.sisa)}
                      </div>
                      {ya && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <IsianRupiah kecil autoFocus={fokusKunci === p.kunci} nilai={sumber[p.kunci]} label={`Nominal dari ${p.nama}`}
                            warnaBingkai={melebihi ? '#F59E0B' : '#93B4E8'}
                            onUbah={v => { setGalat(''); setSumber(s => ({ ...s, [p.kunci]: v })) }} />
                          {melebihi && (
                            <div style={{ fontSize: '0.64rem', color: '#B45309', marginTop: 4, lineHeight: 1.35 }}>
                              Melebihi sisa — saldo {p.nama} jadi minus
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Status: yang diambil dibanding jumlah total */}
          <div role="status" style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 10px rgba(26,44,78,0.14)', padding: '0.8rem 1rem 0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', fontWeight: 500, color: gaya.warna }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: gaya.warna }} /> {gaya.teks}
              </span>
              {status !== 'sesuai' && nilaiJumlah > 0 && (
                <span style={{ fontSize: '0.72rem', color: gaya.warna }}>
                  {status === 'kurang' ? 'kurang' : 'lebih'} {formatRupiah(Math.abs(nilaiJumlah - diambil))}
                </span>
              )}
            </div>
            <div style={{ height: 11, borderRadius: 11, background: '#D9DEE5', margin: '0.55rem 0 0.5rem', overflow: 'hidden' }}>
              <div style={{ width: `${isiBar}%`, height: '100%', borderRadius: 11, background: gaya.isi, transition: 'width 320ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease' }} />
            </div>
            <div style={{ fontSize: '0.86rem', color: '#6B7280' }}>
              <strong style={{ color: NAVY, fontWeight: 600 }}>{formatRupiah(diambil)}</strong>
              <span style={{ margin: '0 0.4rem', fontSize: '0.76rem' }}>dari</span>
              {formatRupiah(nilaiJumlah)}
            </div>
          </div>

          {galat && (
            <div role="alert" style={{ background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>
              {galat}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '0.25rem' }}>
            <button type="button" onClick={onTutup} disabled={menyimpan} className="fp-tekan" style={sTombolKuning}>
              Batalkan Pencatatan <XCircle size={17} />
            </button>
            <button type="button" onClick={simpan} disabled={menyimpan} className="fp-tekan"
              style={{ ...sTombolKuning, minWidth: 130, opacity: menyimpan ? 0.7 : 1, cursor: menyimpan ? 'progress' : 'pointer' }}>
              {menyimpan ? 'Menyimpan...' : <>Simpan <ArrowRight size={17} /></>}
            </button>
          </div>
        </div>
      </div>
  )
}

// ── Gaya ──────────────────────────────────────────────────────────────────────

// Kartu di dalam halaman, sama dengan form di halaman Komponen Tagihan
const sKotak: React.CSSProperties = {
  background: '#fff', borderRadius: 15, width: '100%',
  borderLeft: `28px solid ${NAVY}`, boxShadow: '6px 6px 14px rgba(18, 47, 102, 0.20)',
  display: 'flex', flexWrap: 'wrap', fontFamily: FONT_PENGELUARAN, letterSpacing: '-0.01em',
}

const sLabel: React.CSSProperties = { display: 'block', fontSize: '0.86rem', fontWeight: 700, color: NAVY, marginBottom: 7 }
const sOpsional: React.CSSProperties = { color: '#94A3B8', fontWeight: 400 }

const sInput: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 0.8rem', border: '1.5px solid #D5DBE5', borderRadius: 8, fontSize: '0.84rem',
  boxSizing: 'border-box', outline: 'none', background: '#fff', fontFamily: 'inherit', letterSpacing: 'inherit', color: '#0F172A',
  boxShadow: '0 1px 4px rgba(26,44,78,0.10)',
}

const sTombolKuning: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 42, padding: '0 1.2rem',
  background: '#F7DE7C', color: NAVY, border: 'none', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700,
  fontFamily: 'inherit', letterSpacing: 'inherit', cursor: 'pointer', boxShadow: '0 3px 8px rgba(0,0,0,0.14)', whiteSpace: 'nowrap',
}
