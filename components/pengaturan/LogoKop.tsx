'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { ImagePlus } from 'lucide-react'
import { JENIS_LOGO, LABEL_LOGO, type JenisLogo } from '@/lib/logoSekolah'
import { FORMAT_LOGO, hapusLogoSekolah, siapkanLogo, simpanLogoSidebar, unggahLogoSekolah, type IsiLogo } from '@/lib/logoSekolahKlien'

// Dua kotak unggah logo untuk kop laporan di Profil Sekolah (Pengaturan). Logo langsung
// tersimpan begitu dipilih — tidak menunggu tombol Simpan profil.

const POSISI: Record<JenisLogo, string> = {
  yayasan: 'Tampil di sisi kiri kop laporan',
  sekolah: 'Tampil di sisi kanan kop laporan',
}

const sTombol: CSSProperties = {
  padding: '0.35rem 0.8rem', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem',
  fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
}

export const LogoKop = ({ logo, memuat, galatMuat, onBerubah, onTersimpan }: {
  logo:        IsiLogo
  /** Pratinjau logo masih dimuat */
  memuat:      boolean
  galatMuat:   string
  onBerubah:   (jenis: JenisLogo, dataUrl: string | null) => void
  onTersimpan: () => void
}) => {
  const [proses,  setProses]  = useState<JenisLogo | null>(null)
  const [yakin,   setYakin]   = useState<JenisLogo | null>(null)
  const [galat,   setGalat]   = useState('')
  const masukan = useRef<Record<JenisLogo, HTMLInputElement | null>>({ yayasan: null, sekolah: null })

  const unggah = async (jenis: JenisLogo, berkas: File | undefined) => {
    if (!berkas) return
    setGalat('')
    setYakin(null)
    setProses(jenis)
    try {
      const siap = await siapkanLogo(berkas)
      if (siap.error !== null) { setGalat(siap.error); return }
      const hasil = await unggahLogoSekolah(jenis, siap.data)
      if (hasil.error !== null) { setGalat(hasil.error); return }
      onBerubah(jenis, hasil.data.dataUrl)
      // Logo sekolah juga tampil di sidebar — langsung ikut berganti
      if (jenis === 'sekolah') await simpanLogoSidebar(hasil.data.path, hasil.data.dataUrl)
      onTersimpan()
    } finally {
      setProses(null)
    }
  }

  const hapus = async (jenis: JenisLogo) => {
    setGalat('')
    setProses(jenis)
    try {
      const hasil = await hapusLogoSekolah(jenis)
      if (hasil.error !== null) { setGalat(hasil.error); return }
      setYakin(null)
      onBerubah(jenis, null)
      if (jenis === 'sekolah') await simpanLogoSidebar(null, null)
      onTersimpan()
    } finally {
      setProses(null)
    }
  }

  const pesanGalat = galat || galatMuat

  return (
    <div style={{ gridColumn: '1 / -1', marginBottom: '0.25rem' }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 6 }}>
        Logo Kop Laporan
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
        {JENIS_LOGO.map(jenis => {
          const isi   = logo[jenis]
          const sibuk = proses === jenis
          const kunci = proses !== null || memuat
          return (
            <div key={jenis} style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.75rem', border: '1.5px solid var(--border)', borderRadius: 10, background: '#F9FAFB' }}>
              <div style={{
                width: 72, height: 72, flexShrink: 0, borderRadius: 8, padding: 6, background: '#fff',
                border: isi ? '1.5px solid var(--border)' : '1.5px dashed #CBD5E1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: sibuk || memuat ? 0.5 : 1, transition: 'opacity 0.15s',
              }}>
                {isi ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={isi} alt={LABEL_LOGO[jenis]} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <ImagePlus size={22} color="#94A3B8" />
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-dark)' }}>{LABEL_LOGO[jenis]}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {memuat ? 'Memuat logo...' : sibuk ? 'Memproses...' : POSISI[jenis]}
                </div>

                {yakin === jenis ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#B91C1C' }}>Hapus logo ini?</span>
                    <button type="button" onClick={() => hapus(jenis)} disabled={kunci}
                      style={{ ...sTombol, background: '#DC2626', color: '#fff', border: '1.5px solid #DC2626', opacity: kunci ? 0.6 : 1 }}>
                      Ya, hapus
                    </button>
                    <button type="button" onClick={() => setYakin(null)} disabled={kunci}
                      style={{ ...sTombol, background: '#fff', color: 'var(--text-mid)', border: '1.5px solid var(--border)' }}>
                      Batal
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button type="button" onClick={() => masukan.current[jenis]?.click()} disabled={kunci}
                      style={{ ...sTombol, background: '#fff', color: 'var(--navy)', border: '1.5px solid var(--navy)', opacity: kunci && !sibuk ? 0.6 : 1 }}>
                      {sibuk ? 'Mengunggah...' : isi ? 'Ganti' : 'Unggah Logo'}
                    </button>
                    {isi && (
                      <button type="button" onClick={() => { setGalat(''); setYakin(jenis) }} disabled={kunci}
                        style={{ ...sTombol, background: '#fff', color: '#DC2626', border: '1.5px solid #FECACA', opacity: kunci ? 0.6 : 1 }}>
                        Hapus
                      </button>
                    )}
                  </div>
                )}
              </div>

              <input
                ref={el => { masukan.current[jenis] = el }}
                type="file" accept={FORMAT_LOGO.join(',')} hidden
                onChange={e => {
                  const berkas = e.target.files?.[0]
                  // Dikosongkan supaya memilih berkas yang sama lagi tetap memicu unggah
                  e.target.value = ''
                  void unggah(jenis, berkas)
                }}
              />
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
        PNG, JPG, atau WEBP. Tepi putih/transparan dipangkas otomatis. Kedua logo wajib ada untuk mengunduh laporan.
      </div>
      {pesanGalat && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#DC2626', padding: '0.5rem 0.75rem', background: '#FEF2F2', borderRadius: 6 }}>
          {pesanGalat}
        </div>
      )}
    </div>
  )
}
