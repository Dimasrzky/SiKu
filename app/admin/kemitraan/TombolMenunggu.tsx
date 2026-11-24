'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck, UserRound } from 'lucide-react'
import ModalAdmin from '../ModalAdmin'
import { formatNomor } from './pengirim'
import TeksEmail from './TeksEmail'
import type { SekolahAdmin } from '../dataSekolah'

/**
 * Tombol ikon user di kanan atas halaman Kemitraan: angka merah = sekolah yang menunggu
 * konfirmasi kemitraan. Membuka popup daftar sekolah tersebut; Konfirmasi membuka popup
 * persetujuan (tanpa Tolak — keputusan user 17 Okt 2026). `bukaAwal` dari tautan
 * ?menunggu=1 di Beranda.
 */
export default function TombolMenunggu({ daftar, bukaAwal }: { daftar: SekolahAdmin[]; bukaAwal: boolean }) {
  const router = useRouter()
  const [buka, setBuka] = useState(bukaAwal)
  const [dipilih, setDipilih] = useState<SekolahAdmin | null>(null)
  const [memproses, setMemproses] = useState(false)
  const [galat, setGalat] = useState('')

  const tutupDaftar = () => {
    setBuka(false)
    // Tautan ?menunggu=1 dibuang, supaya muat ulang halaman tidak membuka popup lagi
    if (bukaAwal) router.replace('/admin/kemitraan', { scroll: false })
  }

  const pilih = (s: SekolahAdmin) => {
    setGalat('')
    setDipilih(s)
  }

  const konfirmasi = async () => {
    if (!dipilih || memproses) return
    setMemproses(true)
    setGalat('')
    try {
      const res = await fetch(`/api/admin/kemitraan/${dipilih.id}`, { method: 'POST' })
      const json = await res.json().catch(() => null) as { error?: string | null } | null
      if (!res.ok) {
        setGalat(json?.error ?? 'Gagal mengonfirmasi, coba lagi.')
        return
      }
      // Kembali ke daftar menunggu; sekolah ini pindah ke Sekolah Mitra sesudah refresh
      setDipilih(null)
      router.refresh()
    } catch {
      setGalat('Gagal menghubungi server. Coba lagi.')
    } finally {
      setMemproses(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="admin-tombol-ikon"
        onClick={() => setBuka(true)}
        aria-label={`Sekolah menunggu konfirmasi: ${daftar.length}`}
        title="Sekolah menunggu konfirmasi"
      >
        <UserRound size={20} />
        {daftar.length > 0 && <span className="admin-hitung">{daftar.length > 99 ? '99+' : daftar.length}</span>}
      </button>

      {buka && !dipilih && (
        <ModalAdmin judul="Menunggu Konfirmasi" ikon={<UserRound size={22} />} lebar={680} onTutup={tutupDaftar}>
          <p>Sekolah yang baru mendaftar.</p>
          {daftar.length === 0 ? (
            <div className="admin-kosong">
              Tidak ada pendaftaran sekolah yang menunggu konfirmasi.
            </div>
          ) : (
            <ul className="admin-antrean">
              {daftar.map(s => (
                <li key={s.id}>
                  <div className="admin-antrean-teks">
                    <div className="admin-sel-utama">{s.namaSekolah}</div>
                    <div className="admin-sel-sub">
                      {[s.jenjang, `Daftar ${s.terdaftar}`].filter(Boolean).join(' · ')}
                    </div>
                    <div className="admin-sel-sub">Bendahara: <strong>{s.namaBendahara ?? '-'}</strong></div>
                    {(s.email || s.noWa) && (
                      <div className="admin-sel-sub">
                        {s.email && <TeksEmail alamat={s.email} />}
                        {s.email && s.noWa && ' · '}
                        {s.noWa && (
                          <a className="admin-antrean-wa" href={`https://wa.me/${s.noWa}`} target="_blank" rel="noopener noreferrer">
                            {s.noWa.startsWith('62') ? formatNomor(s.noWa) : `+${s.noWa}`}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <button type="button" className="admin-tombol admin-tombol--utama admin-tombol--kecil" onClick={() => pilih(s)}>
                    <BadgeCheck size={14} /> Konfirmasi
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ModalAdmin>
      )}

      {dipilih && (
        <ModalAdmin
          judul="Konfirmasi kemitraan sekolah"
          nada="sukses"
          ikon={<BadgeCheck size={22} />}
          sibuk={memproses}
          onTutup={() => setDipilih(null)}
          kaki={<>
            <button type="button" className="admin-tombol admin-tombol--garis" onClick={() => setDipilih(null)} disabled={memproses}>
              Batal
            </button>
            <button type="button" className="admin-tombol admin-tombol--utama" onClick={konfirmasi} disabled={memproses}>
              {memproses ? 'Memproses...' : 'Ya, konfirmasi'}
            </button>
          </>}
        >
          <p>
            Pastikan <strong>{dipilih.namaSekolah}</strong> terdaftar sebagai mitra Equanusa.
            Setelah dikonfirmasi, {dipilih.namaBendahara ? <strong>{dipilih.namaBendahara}</strong> : 'bendahara'} langsung
            bisa membuka dashboard SiKu. Tindakan ini tidak dapat dibatalkan.
          </p>
          {galat && <div className="admin-galat">{galat}</div>}
        </ModalAdmin>
      )}
    </>
  )
}
