'use client'

import { School } from 'lucide-react'
import ModalAdmin from '../ModalAdmin'
import TeksEmail from './TeksEmail'
import { formatNomor } from './pengirim'
import type { SekolahAdmin } from '../dataSekolah'

/**
 * Popup tombol mata di tabel sekolah: keterangan yang tidak dimuat di tabel supaya
 * tabelnya tidak menumpuk (permintaan user 24 Nov 2026) — mitra sejak, waktu daftar,
 * email sekolah, dan WhatsApp sekolah.
 */
export default function ModalDetailSekolah({ sekolah, onTutup }: { sekolah: SekolahAdmin; onTutup: () => void }) {
  const kosong = (teks: string) => <span className="admin-sel-redup">{teks}</span>

  const rincian: { label: string; isi: React.ReactNode }[] = [
    {
      label: 'Mitra sejak',
      isi: sekolah.mitraSejak ?? kosong(sekolah.demo ? 'Akun demo' : 'Sebelum konfirmasi kemitraan dicatat'),
    },
    { label: 'Terdaftar', isi: sekolah.terdaftar },
    {
      label: 'Email sekolah',
      isi: sekolah.emailSekolah
        ? <a href={`mailto:${sekolah.emailSekolah}`} className="admin-tautan"><TeksEmail alamat={sekolah.emailSekolah} /></a>
        : kosong('Belum diisi di Pengaturan → Profil Sekolah'),
    },
    {
      label: 'WhatsApp sekolah',
      isi: sekolah.noWa
        ? (
          <a href={`https://wa.me/${sekolah.noWa}`} target="_blank" rel="noopener noreferrer" className="admin-antrean-wa">
            {sekolah.noWa.startsWith('62') ? formatNomor(sekolah.noWa) : `+${sekolah.noWa}`}
          </a>
        )
        : kosong('Belum diisi'),
    },
  ]

  return (
    <ModalAdmin
      judul={sekolah.namaSekolah}
      ikon={<School size={21} />}
      lebar={460}
      onTutup={onTutup}
      kaki={<button type="button" className="admin-tombol admin-tombol--garis" onClick={onTutup}>Tutup</button>}
    >
      {sekolah.jenjang && <p>{[sekolah.jenjang, sekolah.kota].filter(Boolean).join(' · ')}</p>}
      <dl className="admin-rincian">
        {rincian.map(r => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.isi}</dd>
          </div>
        ))}
      </dl>
    </ModalAdmin>
  )
}
