'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Save, Tags, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/formatLaporan'
import { tanggalWIB } from '@/lib/metrikLaporan'
import {
  MAKS_KETERANGAN, MAKS_NAMA_SATUAN, angkaKeIsian, bacaAngkaIsian, hitungJumlah, rupiahKeIsian, tanggalKeIso,
  urutkanKategori, type KategoriPengeluaran, type Pengeluaran,
} from '@/lib/pengeluaran'
import {
  hapusFotoPengeluaran, periksaFoto, tautanFotoPengeluaran, unggahFotoPengeluaran,
} from '@/lib/fotoPengeluaran'
import {
  sBidang, sGalat, sInput, sIsi, sJudulKepala, sKepala, sKotak, sLabel, sLatar, sOpsional, sSubjudulKepala,
  sTombolKedua, sTombolTutup, sTombolUtama,
} from './gayaPengeluaran'

/** Pesan galat Postgres yang bisa dipahami bendahara */
function pesanGalat(kode: string | undefined): string {
  if (kode === '42501') return 'Fitur Pengeluaran belum aktif untuk sekolah ini.'
  if (kode === '23503') return 'Kategori tidak ditemukan. Muat ulang halaman, lalu coba lagi.'
  if (kode === '23514') return 'Isian tidak sesuai aturan. Periksa kembali angka dan panjang teksnya.'
  return 'Pengeluaran gagal disimpan. Coba lagi.'
}

/** Angka + nama satuan dalam satu baris, misalnya [18] [hari] */
const IsianBesaran = ({ label, angka, satuan, contohSatuan, onAngka, onSatuan }: {
  label:        string
  angka:        string
  satuan:       string
  contohSatuan: string
  onAngka:      (v: string) => void
  onSatuan:     (v: string) => void
}) => (
  <div style={{ flex: 1, minWidth: 0 }}>
    <label style={sLabel}>{label} <span style={sOpsional}>(opsional)</span></label>
    <div style={{ display: 'flex', gap: 6 }}>
      <input value={angka} onChange={e => onAngka(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="0"
        aria-label={`Angka ${label}`} style={{ ...sInput, width: '45%', textAlign: 'right' }} />
      <input value={satuan} onChange={e => onSatuan(e.target.value)} maxLength={MAKS_NAMA_SATUAN} placeholder={contohSatuan}
        aria-label={`Satuan ${label}`} style={{ ...sInput, width: '55%' }} />
    </div>
  </div>
)

const IsianRupiah = ({ nilai, onUbah, label }: { nilai: string; onUbah: (digit: string) => void; label: string }) => (
  <div style={{ position: 'relative' }}>
    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#64748B', fontWeight: 700 }}>Rp</span>
    <input type="text" inputMode="numeric" value={rupiahKeIsian(nilai)} onChange={e => onUbah(e.target.value.replace(/\D/g, ''))} placeholder="0"
      aria-label={label} style={{ ...sInput, paddingLeft: 36, fontWeight: 700 }} />
  </div>
)

export const ModalPengeluaran = ({ sekolahId, kategori, awal, tanggalAwal, onTutup, onTersimpan, onKelolaKategori }: {
  sekolahId:        string
  kategori:         KategoriPengeluaran[]
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
  const jumlahAwalOtomatis = awal ? hitungJumlah(awal.volume, awal.kuantitas, awal.biaya_satuan) : null

  const [tanggal,         setTanggal]         = useState(awal ? tanggalWIB(new Date(awal.tanggal)) : tanggalAwal)
  const [kategoriId,      setKategoriId]      = useState(awal?.kategori_id ?? daftarKategori[0]?.id ?? '')
  const [keterangan,      setKeterangan]      = useState(awal?.keterangan ?? '')
  const [volume,          setVolume]          = useState(angkaKeIsian(awal?.volume ?? null))
  const [volumeSatuan,    setVolumeSatuan]    = useState(awal?.volume_satuan ?? '')
  const [kuantitas,       setKuantitas]       = useState(angkaKeIsian(awal?.kuantitas ?? null))
  const [kuantitasSatuan, setKuantitasSatuan] = useState(awal?.kuantitas_satuan ?? '')
  const [biaya,           setBiaya]           = useState(awal?.biaya_satuan != null ? String(awal.biaya_satuan) : '')
  const [jumlah,          setJumlah]          = useState(awal ? String(awal.jumlah) : '')
  // Jumlah diisi tangan: tidak lagi mengikuti Volume × Satuan × Biaya Satuan. Di format
  // laporan sekolah, Jumlah tidak selalu sama dengan hasil perkaliannya.
  const [jumlahManual,    setJumlahManual]    = useState(jumlahAwalOtomatis !== null && awal !== null && jumlahAwalOtomatis !== awal.jumlah)

  const [foto,            setFoto]            = useState<File | null>(null)
  const [pratinjau,       setPratinjau]       = useState<string | null>(null)
  const [hapusFotoLama,   setHapusFotoLama]   = useState(false)
  const [tautanFotoLama,  setTautanFotoLama]  = useState<string | null>(null)
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

  const angkaVolume    = bacaAngkaIsian(volume)
  const angkaKuantitas = bacaAngkaIsian(kuantitas)
  const angkaBiaya     = biaya ? Number(biaya) : null
  const jumlahOtomatis = hitungJumlah(
    angkaVolume !== null && !Number.isNaN(angkaVolume) ? angkaVolume : null,
    angkaKuantitas !== null && !Number.isNaN(angkaKuantitas) ? angkaKuantitas : null,
    angkaBiaya,
  )
  const jumlahEfektif = !jumlahManual && jumlahOtomatis !== null ? String(jumlahOtomatis) : jumlah
  // Kategori bisa dibuat atau dihapus lewat Kelola Kategori selagi modal ini terbuka
  const kategoriEfektif = daftarKategori.some(k => k.id === kategoriId) ? kategoriId : daftarKategori[0]?.id ?? ''

  const pilihFoto = (berkas: File | undefined) => {
    if (!berkas) return
    const salah = periksaFoto(berkas)
    if (salah) { setGalat(salah); return }
    setGalat('')
    setFoto(berkas)
    setPratinjau(URL.createObjectURL(berkas))
    setHapusFotoLama(false)
  }

  const buangFotoBaru = () => {
    setFoto(null)
    setPratinjau(null)
    if (inputFotoRef.current) inputFotoRef.current.value = ''
  }

  const simpan = async () => {
    if (menyimpan) return
    const ket = keterangan.trim()
    const nilaiJumlah = Number(jumlahEfektif || 0)
    if (!tanggal)                                          return setGalat('Tanggal pengeluaran wajib diisi.')
    if (!kategoriEfektif)                                  return setGalat('Pilih kategori pengeluaran.')
    if (!ket)                                              return setGalat('Keterangan barang wajib diisi.')
    if (ket.length > MAKS_KETERANGAN)                      return setGalat(`Keterangan maksimal ${MAKS_KETERANGAN} karakter.`)
    if (Number.isNaN(angkaVolume) || angkaVolume === 0)    return setGalat('Angka Volume harus lebih dari 0, maksimal 2 angka di belakang koma.')
    if (Number.isNaN(angkaKuantitas) || angkaKuantitas === 0) return setGalat('Angka Satuan harus lebih dari 0, maksimal 2 angka di belakang koma.')
    if (!(nilaiJumlah > 0))                                return setGalat('Jumlah wajib diisi dan lebih dari 0.')

    setMenyimpan(true)
    setGalat('')
    const isian = {
      kategori_id:      kategoriEfektif,
      tanggal:          tanggalKeIso(tanggal),
      keterangan:       ket,
      volume:           angkaVolume,
      volume_satuan:    volumeSatuan.trim() || null,
      kuantitas:        angkaKuantitas,
      kuantitas_satuan: kuantitasSatuan.trim() || null,
      biaya_satuan:     angkaBiaya,
      jumlah:           nilaiJumlah,
    }

    try {
      let id = awal?.id ?? ''
      if (awal) {
        const { error } = await supabase
          .from('pengeluaran')
          .update({ ...isian, updated_at: new Date().toISOString() })
          .eq('id', awal.id)
          .eq('sekolah_id', sekolahId)
        if (error) { setGalat(pesanGalat(error.code)); return }
      } else {
        const { data, error } = await supabase
          .from('pengeluaran')
          .insert({ sekolah_id: sekolahId, ...isian })
          .select('id')
          .single()
        if (error || !data) { setGalat(pesanGalat(error?.code)); return }
        id = (data as { id: string }).id
      }

      // Pengeluarannya sudah tersimpan; foto yang gagal hanya jadi peringatan
      let peringatan: string | null = null
      if (foto) {
        const h = await unggahFotoPengeluaran(id, foto)
        if (h.error !== null) peringatan = `Pengeluaran tersimpan, tetapi foto nota gagal diunggah: ${h.error}`
      } else if (hapusFotoLama && awal?.foto_path) {
        const h = await hapusFotoPengeluaran(id)
        if (h.error !== null) peringatan = `Pengeluaran tersimpan, tetapi foto nota gagal dihapus: ${h.error}`
      }
      onTersimpan(isian.tanggal, peringatan)
    } finally {
      setMenyimpan(false)
    }
  }

  const adaFotoLama = !!awal?.foto_path && !hapusFotoLama && !foto

  return (
    <div style={sLatar} onClick={() => { if (!menyimpan) onTutup() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="judul-modal-pengeluaran" style={sKotak(520)} onClick={e => e.stopPropagation()}>
        <div style={sKepala}>
          <div>
            <div id="judul-modal-pengeluaran" style={sJudulKepala}>{awal ? 'Ubah Pengeluaran' : 'Tambah Pengeluaran'}</div>
            <div style={sSubjudulKepala}>Catat sesuai nota atau bukti belanja</div>
          </div>
          <button onClick={onTutup} disabled={menyimpan} aria-label="Tutup" style={sTombolTutup}><X size={16} /></button>
        </div>

        <div style={sIsi}>
          {daftarKategori.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Belum ada kategori pengeluaran</div>
              <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6, marginBottom: '1rem' }}>
                Buat kategori dulu, misalnya ATK Kantor, Operasional, atau Konsumsi.
              </div>
              <button onClick={onKelolaKategori} style={sTombolKedua}><Tags size={14} /> Kelola Kategori</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', ...sBidang }}>
                <div style={{ flex: '1 1 160px' }}>
                  <label htmlFor="pengeluaran-tanggal" style={sLabel}>Tanggal</label>
                  <input id="pengeluaran-tanggal" type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} style={sInput} />
                </div>
                <div style={{ flex: '2 1 220px' }}>
                  <label htmlFor="pengeluaran-kategori" style={{ ...sLabel, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Jenis</span>
                    <button type="button" onClick={onKelolaKategori} style={{ background: 'none', border: 'none', padding: 0, color: '#3C75B7', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Kelola kategori
                    </button>
                  </label>
                  <select id="pengeluaran-kategori" value={kategoriEfektif}onChange={e => setKategoriId(e.target.value)} style={sInput}>
                    {daftarKategori.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                  </select>
                </div>
              </div>

              <div style={sBidang}>
                <label htmlFor="pengeluaran-keterangan" style={sLabel}>Keterangan Barang</label>
                <input id="pengeluaran-keterangan" value={keterangan} onChange={e => setKeterangan(e.target.value)} maxLength={MAKS_KETERANGAN}
                  placeholder="Contoh: tinta spidol refill" style={sInput} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', ...sBidang }}>
                <IsianBesaran label="Volume" angka={volume} satuan={volumeSatuan} contohSatuan="hari"
                  onAngka={setVolume} onSatuan={setVolumeSatuan} />
                <IsianBesaran label="Satuan" angka={kuantitas} satuan={kuantitasSatuan} contohSatuan="buah"
                  onAngka={setKuantitas} onSatuan={setKuantitasSatuan} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={sLabel}>Biaya Satuan <span style={sOpsional}>(opsional)</span></label>
                  <IsianRupiah nilai={biaya} onUbah={setBiaya} label="Biaya satuan" />
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={sLabel}>Jumlah</label>
                  <IsianRupiah nilai={jumlahEfektif} label="Jumlah"
                    onUbah={v => { setJumlah(v); setJumlahManual(true) }} />
                </div>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', lineHeight: 1.5, marginBottom: '0.875rem', minHeight: '1.1rem' }}>
                {jumlahOtomatis === null
                  ? 'Isi Biaya Satuan supaya Jumlah dihitung otomatis dari Volume × Satuan × Biaya Satuan.'
                  : jumlahManual && Number(jumlah || 0) !== jumlahOtomatis
                    ? <>Jumlah diisi sendiri. Hasil hitung: <strong>{formatRupiah(jumlahOtomatis)}</strong>{' '}
                        <button type="button" onClick={() => setJumlahManual(false)} style={{ background: 'none', border: 'none', padding: 0, color: '#3C75B7', fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Pakai hasil hitung
                        </button></>
                    : 'Dihitung otomatis dari Volume × Satuan × Biaya Satuan. Bisa diubah kalau berbeda dengan nota.'}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={sLabel}>Foto Nota <span style={sOpsional}>(opsional, JPG/PNG maks. 5MB)</span></label>
                <input ref={inputFotoRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }}
                  onChange={e => pilihFoto(e.target.files?.[0])} />
                {pratinjau || adaFotoLama ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0.6rem', background: '#F8FAFC' }}>
                    {(pratinjau ?? tautanFotoLama) ? (
                      <a href={pratinjau ?? tautanFotoLama ?? undefined} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pratinjau ?? tautanFotoLama ?? ''} alt="Foto nota" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                      </a>
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 8, background: '#E2E8F0' }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: '#374151', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {foto ? foto.name : 'Foto nota tersimpan'}
                    </div>
                    <button type="button" onClick={() => inputFotoRef.current?.click()} style={sTombolKedua}>Ganti</button>
                    <button type="button" aria-label="Hapus foto"
                      onClick={() => { if (foto) buangFotoBaru(); else setHapusFotoLama(true) }}
                      style={{ ...sTombolKedua, color: '#DC2626', padding: '0.45rem 0.55rem' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => inputFotoRef.current?.click()}
                    style={{ width: '100%', border: '1.5px dashed #CBD5E1', borderRadius: 10, padding: '0.9rem', background: '#F8FAFC', color: '#64748B', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                    <Camera size={16} /> {hapusFotoLama ? 'Foto akan dihapus — pilih foto baru' : 'Pilih foto nota'}
                  </button>
                )}
              </div>

              {galat && <div style={sGalat}>{galat}</div>}

              <button onClick={simpan} disabled={menyimpan} style={sTombolUtama(menyimpan)}>
                {menyimpan ? 'Menyimpan...' : <><Save size={16} /> Simpan Pengeluaran</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
