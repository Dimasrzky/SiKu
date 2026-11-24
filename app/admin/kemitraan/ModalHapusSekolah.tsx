'use client'

import { useEffect, useState } from 'react'
import { CircleAlert, Trash2 } from 'lucide-react'
import { samakanNama, type RingkasanHapusSekolah } from '@/lib/akunSekolah'
import ModalAdmin from '../ModalAdmin'
import type { SekolahAdmin } from '../dataSekolah'

const RINCIAN: { kunci: keyof RingkasanHapusSekolah['jumlah']; label: string }[] = [
  { kunci: 'siswa',         label: 'Siswa' },
  { kunci: 'tagihan',       label: 'Tagihan' },
  { kunci: 'pembayaran',    label: 'Pembayaran' },
  { kunci: 'pengeluaran',   label: 'Pengeluaran' },
  { kunci: 'buktiTransfer', label: 'Bukti transfer' },
]

/**
 * Popup Hapus akun sekolah: menampilkan apa saja yang ikut terhapus, lalu tombol
 * "Hapus permanen" baru aktif setelah admin mengetik nama sekolah persis (server
 * mencocokkannya lagi). Keputusan user 24 Nov 2026.
 */
export default function ModalHapusSekolah({ sekolah, onTutup, onTerhapus }: {
  sekolah:    SekolahAdmin
  onTutup:    () => void
  onTerhapus: (namaSekolah: string) => void
}) {
  const [ringkasan, setRingkasan] = useState<RingkasanHapusSekolah | null>(null)
  const [galatMuat, setGalatMuat] = useState('')
  const [ketikan, setKetikan] = useState('')
  const [memproses, setMemproses] = useState(false)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    let batal = false
    const muat = async () => {
      try {
        const res = await fetch(`/api/admin/sekolah/${sekolah.id}`)
        const json = await res.json().catch(() => null) as { data?: RingkasanHapusSekolah | null; error?: string | null } | null
        if (batal) return
        if (res.ok && json?.data) setRingkasan(json.data)
        else setGalatMuat(json?.error ?? 'Jumlah data gagal dihitung.')
      } catch {
        if (!batal) setGalatMuat('Gagal menghubungi server.')
      }
    }
    muat()
    return () => { batal = true }
  }, [sekolah.id])

  const cocok = samakanNama(ketikan) === samakanNama(sekolah.namaSekolah)
  const akun  = ringkasan ? ringkasan.akun : sekolah.email ? [sekolah.email] : []

  const hapus = async () => {
    if (!cocok || memproses) return
    setMemproses(true)
    setGalat('')
    try {
      const res = await fetch(`/api/admin/sekolah/${sekolah.id}`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ konfirmasiNama: ketikan }),
      })
      const json = await res.json().catch(() => null) as { error?: string | null } | null
      if (!res.ok) {
        setGalat(json?.error ?? 'Gagal menghapus, coba lagi.')
        return
      }
      onTerhapus(sekolah.namaSekolah)
    } catch {
      setGalat('Gagal menghubungi server. Coba lagi.')
    } finally {
      setMemproses(false)
    }
  }

  return (
    <ModalAdmin
      judul="Hapus akun sekolah?"
      nada="bahaya"
      ikon={<Trash2 size={21} />}
      lebar={520}
      sibuk={memproses}
      onTutup={onTutup}
      kaki={<>
        <button type="button" className="admin-tombol admin-tombol--garis" onClick={onTutup} disabled={memproses}>
          Batal
        </button>
        <button type="button" className="admin-tombol admin-tombol--bahaya" onClick={hapus} disabled={!cocok || memproses}>
          <Trash2 size={15} /> {memproses ? 'Menghapus...' : 'Hapus permanen'}
        </button>
      </>}
    >
      <p>
        Semua data <strong>{sekolah.namaSekolah}</strong> dihapus permanen dan <strong>tidak dapat dikembalikan</strong>:
      </p>

      <ul className="admin-rincian-hapus" aria-busy={!ringkasan && !galatMuat}>
        {RINCIAN.map(({ kunci, label }) => {
          const n = ringkasan?.jumlah[kunci]
          return (
            <li key={kunci} className={ringkasan || galatMuat ? undefined : 'memuat'}>
              <b>{ringkasan ? (n === null || n === undefined ? '—' : n.toLocaleString('id-ID')) : galatMuat ? '—' : ''}</b>
              <span>{label}</span>
            </li>
          )
        })}
      </ul>

      {galatMuat && (
        <div className="admin-info admin-info--kuning" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>{galatMuat} Penghapusan tetap bisa dilanjutkan.</span>
        </div>
      )}

      <p>
        {akun.length > 0
          ? <>Akun login <strong>{akun.join(', ')}</strong> ikut dihapus: bendahara tidak bisa masuk lagi, dan emailnya bisa dipakai mendaftar ulang. </>
          : <>Sekolah ini tidak punya akun login. </>}
        File bukti transfer, foto nota, dan logo kop juga dihapus.
      </p>

      <label className="admin-label-isian" htmlFor="ketik-nama-sekolah">
        Ketik <strong>{sekolah.namaSekolah}</strong> untuk mengonfirmasi
      </label>
      <input
        id="ketik-nama-sekolah"
        className="admin-isian"
        value={ketikan}
        onChange={e => setKetikan(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') hapus() }}
        disabled={memproses}
        autoComplete="off"
        spellCheck={false}
        autoFocus
      />

      {memproses && (
        <div className="admin-sel-sub" style={{ marginTop: 10 }}>
          Sedang menghapus data, file, dan akun login — jangan tutup halaman ini.
        </div>
      )}
      {galat && <div className="admin-galat">{galat}</div>}
    </ModalAdmin>
  )
}
