'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarCheck, Check, ChevronRight, Clock, IdCard, LayoutPanelLeft, Lock, LogOut, RotateCcw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { bacaStatus, simpanStatusLokal, tandaiAktivasiDilihatLokal, type StatusKemitraan } from '@/lib/kemitraan'
import { IkonDiproses, IkonPapanJam, IkonTerompet, IkonWhatsApp } from './IkonKemitraan'

/** Isi siku_auth kalau perangkat ini belum menyimpannya (sesi masih ada, localStorage sudah dibersihkan) */
export interface SesiLokal {
  email:   string
  nama:    string
  jabatan: string
  sekolah: string
  avatar:  string
  role:    string
}

interface Props {
  userId:        string
  sekolahId:     string
  namaSekolah:   string
  namaBendahara: string
  inisial:       string
  statusAwal:    StatusKemitraan
  /** "Selesai pukul 17.35": waktu sekolah terdaftar */
  selesai:       string
  /** null selama nomor tim Equanusa belum diisi di server */
  tautanWa:      string | null
  sesiLokal:     SesiLokal
}

// Selama halaman menunggu terbuka statusnya diperiksa ulang, jadi begitu admin menekan
// Konfirmasi halaman ini berganti sendiri menjadi "Akun Anda Telah Diaktifkan"
const JEDA_PERIKSA_MS = 30_000
// Ikon "Cek Status Terkini" tetap berputar sebentar walau jawabannya cepat
const MIN_PERIKSA_MS = 700

const MULAI = [
  { judul: 'Lengkapi profil sekolah', teks: 'Tambahkan logo, alamat, dan informasi kontak sekolah.' },
  { judul: 'Import data siswa',       teks: 'Upload file Excel atau tambahkan siswa satu per satu.' },
  { judul: 'Buat komponen tagihan',   teks: 'Tentukan SPP, biaya kegiatan, dan komponen lainnya.' },
]

const jeda = (ms: number) => new Promise(r => setTimeout(r, ms))

const HalamanKemitraan = ({
  userId, sekolahId, namaSekolah, namaBendahara, inisial, statusAwal, selesai, tautanWa, sesiLokal,
}: Props) => {
  const router = useRouter()
  const [status, setStatus]       = useState<StatusKemitraan>(statusAwal)
  const [memeriksa, setMemeriksa] = useState(false)
  const [membuka, setMembuka]     = useState(false)
  const [keluarProses, setKeluarProses] = useState(false)
  const sedangPeriksa = useRef(false)
  const aktif = status === 'aktif'

  // siku_auth dipakai layout dashboard; status terbarunya disimpan di sana
  useEffect(() => {
    try {
      if (!localStorage.getItem('siku_auth')) {
        localStorage.setItem('siku_auth', JSON.stringify({ ...sesiLokal, kemitraan: status }))
      }
    } catch { /* penyimpanan diblokir */ }
    simpanStatusLokal(status)
  }, [status, sesiLokal])

  const periksa = useCallback(async () => {
    if (sedangPeriksa.current) return
    sedangPeriksa.current = true
    try {
      const { data, error } = await supabase
        .from('sekolah').select('status_kemitraan').eq('id', sekolahId).maybeSingle()
      if (!error && data && bacaStatus((data as { status_kemitraan: unknown }).status_kemitraan) === 'aktif') {
        setStatus('aktif')
      }
    } finally {
      sedangPeriksa.current = false
    }
  }, [sekolahId])

  useEffect(() => {
    if (status !== 'menunggu') return
    const saatTerlihat = () => { if (document.visibilityState === 'visible') periksa() }
    const id = window.setInterval(saatTerlihat, JEDA_PERIKSA_MS)
    document.addEventListener('visibilitychange', saatTerlihat)
    window.addEventListener('focus', saatTerlihat)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', saatTerlihat)
      window.removeEventListener('focus', saatTerlihat)
    }
  }, [status, periksa])

  const cekStatus = async () => {
    if (memeriksa) return
    setMemeriksa(true)
    await Promise.all([periksa(), jeda(MIN_PERIKSA_MS)])
    setMemeriksa(false)
  }

  const bukaDashboard = async () => {
    if (membuka) return
    setMembuka(true)
    // Penanda lokal lebih dulu: kalau penanda di database gagal tersimpan, dashboard tidak
    // mengembalikan bendahara ke halaman ini lagi
    tandaiAktivasiDilihatLokal(sekolahId)
    simpanStatusLokal('aktif')
    const { error } = await supabase
      .from('profiles').update({ aktivasi_dilihat_at: new Date().toISOString() }).eq('id', userId)
    if (error) console.warn('[kemitraan] penanda halaman aktivasi gagal disimpan:', error.message)
    router.push('/dashboard')
  }

  const keluar = async () => {
    if (keluarProses) return
    setKeluarProses(true)
    await supabase.auth.signOut()
    try {
      for (const kunci of ['siku_auth', 'siku_setup_steps', 'siku_setup_done']) localStorage.removeItem(kunci)
    } catch { /* penyimpanan diblokir */ }
    router.push('/')
  }

  return (
    <div className={`km km--${aktif ? 'aktif' : 'menunggu'}`}>
      <header className="km-header">
        <div className="km-identitas">
          <span className="km-avatar" aria-hidden="true">{inisial}</span>
          <div className="km-identitas-teks">
            <p className="km-sekolah">{namaSekolah}</p>
            <p className="km-bendahara">{namaBendahara}</p>
          </div>
        </div>
        <button type="button" className="km-keluar" onClick={keluar} disabled={keluarProses}>
          <LogOut aria-hidden="true" /> Keluar
        </button>
      </header>

      <main className="km-isi">
        <section className="km-hero" aria-live="polite">
          <div className="km-hero-ikon" aria-hidden="true">
            {aktif ? <IkonTerompet /> : <Clock />}
          </div>
          <h1 className="km-hero-judul">{aktif ? 'Akun Anda Telah Diaktifkan!' : 'Menunggu Konfirmasi Kemitraan'}</h1>
          {/* Baris dipatahkan di titik yang sama dengan mockup; di layar sempit <br> disembunyikan */}
          <p className="km-hero-teks">
            {aktif
              ? <>Kemitraan sekolah Anda telah dikonfirmasi. Selamat datang di{' '}<br />SiKu, dashboard keuangan sekolah Anda siap digunakan.</>
              : <>Kami sedang memverifikasi bahwa sekolah Anda telah terdaftar{' '}<br />sebagai mitra Equanusa. Proses ini selesai dalam <strong>1x24 jam kerja.</strong></>}
          </p>
        </section>

        <section className="km-kartu km-kartu-langkah" aria-label="Tahap aktivasi akun">
          <ol className="km-langkah">
            <li className="km-langkah-item">
              <div className="km-langkah-kiri" aria-hidden="true">
                <span className="km-bulat km-bulat--selesai"><Check /></span>
                <span className="km-penghubung" />
              </div>
              <div className="km-langkah-isi">
                <p className="km-langkah-judul">Akun berhasil dibuat</p>
                {!aktif && <p className="km-langkah-teks">Akun sekolah dan bendahara telah tersimpan.</p>}
                <span className="km-badge km-badge--hijau"><Clock aria-hidden="true" />{selesai}</span>
              </div>
            </li>

            <li className="km-langkah-item">
              <div className="km-langkah-kiri" aria-hidden="true">
                {aktif
                  ? <span className="km-bulat km-bulat--selesai"><Check /></span>
                  : <span className="km-bulat km-bulat--proses"><IdCard /></span>}
                <span className="km-penghubung" />
              </div>
              <div className="km-langkah-isi">
                <p className={`km-langkah-judul${aktif ? '' : ' km-langkah-judul--samar'}`}>Konfirmasi kemitraan sekolah</p>
                {!aktif && (
                  <p className="km-langkah-teks">
                    Tim Equanusa sedang melakukan pengecekan apakah{' '}<br />sekolah Anda terdaftar sebagai mitra kami.
                  </p>
                )}
                {aktif
                  ? <span className="km-badge km-badge--hijau"><CalendarCheck aria-hidden="true" />Terverifikasi oleh tim Equanusa</span>
                  : <span className="km-badge km-badge--oranye"><IkonDiproses />Sedang diproses</span>}
              </div>
            </li>

            <li className="km-langkah-item">
              <div className="km-langkah-kiri" aria-hidden="true">
                {aktif
                  ? <span className="km-bulat km-bulat--selesai"><Check /></span>
                  : <span className="km-bulat km-bulat--kunci"><Lock /></span>}
              </div>
              <div className="km-langkah-isi">
                {/* Abu di kedua keadaan, mengikuti mockup */}
                <p className="km-langkah-judul km-langkah-judul--samar">Akses dashboard diaktifkan</p>
                {!aktif && (
                  <p className="km-langkah-teks">Setelah dikonfirmasi, Anda langsung bisa menggunakan{' '}<br />semua fitur SiKu.</p>
                )}
                {aktif
                  ? <span className="km-badge km-badge--hijau"><LayoutPanelLeft aria-hidden="true" />Siap digunakan</span>
                  : <span className="km-badge km-badge--abu"><IkonPapanJam />Menunggu langkah sebelumnya</span>}
              </div>
            </li>
          </ol>

          {aktif ? (
            <div className="km-aksi-aktif">
              <button type="button" className="km-tombol km-tombol--navy" onClick={bukaDashboard} disabled={membuka}>
                Buka Dashboard <ChevronRight aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="km-aksi">
              {tautanWa && (
                <a className="km-tombol km-tombol--wa" href={tautanWa} target="_blank" rel="noopener noreferrer">
                  <IkonWhatsApp /> Hubungi Tim Equanusa via WhatsApp
                </a>
              )}
              <button type="button" className="km-tombol km-tombol--garis" onClick={cekStatus} disabled={memeriksa}>
                <RotateCcw aria-hidden="true" className={memeriksa ? 'km-putar' : undefined} />
                {memeriksa ? 'Memeriksa…' : 'Cek Status Terkini'}
              </button>
            </div>
          )}
        </section>

        {aktif && (
          <section className="km-kartu km-mulai" aria-labelledby="km-mulai-judul">
            <h2 id="km-mulai-judul" className="km-mulai-judul">Mulai Dari Mana?</h2>
            <ol className="km-mulai-daftar">
              {MULAI.map((m, i) => (
                <li key={m.judul} className="km-mulai-item">
                  <span className="km-nomor" aria-hidden="true">{i + 1}</span>
                  <div>
                    <p className="km-mulai-nama">{m.judul}</p>
                    <p className="km-mulai-teks">{m.teks}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  )
}

export default HalamanKemitraan
