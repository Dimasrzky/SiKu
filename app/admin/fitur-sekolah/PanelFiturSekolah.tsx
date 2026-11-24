'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Puzzle, Search, X } from 'lucide-react'
import { KATALOG_FITUR, infoFitur, type KodeFitur } from '@/lib/fiturSekolah'
import ModalAdmin from '../ModalAdmin'

export interface SekolahFitur {
  id:    string
  nama:  string
  fitur: KodeFitur[]
}

type Dialog =
  | { jenis: 'tambah'; sekolah: SekolahFitur }
  | { jenis: 'cabut'; sekolah: SekolahFitur; fitur: KodeFitur }

const KOLOM = ['No', 'Sekolah', 'Subfitur aktif', 'Aksi'] as const

export default function PanelFiturSekolah({ daftar }: { daftar: SekolahFitur[] }) {
  const router = useRouter()
  const [cari, setCari] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [pilihan, setPilihan] = useState<KodeFitur | null>(null)
  const [memproses, setMemproses] = useState(false)
  const [galat, setGalat] = useState('')

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return q ? daftar.filter(s => s.nama.toLowerCase().includes(q)) : daftar
  }, [daftar, cari])

  const belumDipasang = (s: SekolahFitur) => KATALOG_FITUR.filter(f => !s.fitur.includes(f.kode))

  const bukaTambah = (s: SekolahFitur) => {
    setGalat('')
    setPilihan(belumDipasang(s)[0]?.kode ?? null)
    setDialog({ jenis: 'tambah', sekolah: s })
  }

  const bukaCabut = (s: SekolahFitur, fitur: KodeFitur) => {
    setGalat('')
    setDialog({ jenis: 'cabut', sekolah: s, fitur })
  }

  const tutup = () => { if (!memproses) setDialog(null) }

  const kirim = async () => {
    if (!dialog || memproses) return
    const fitur = dialog.jenis === 'tambah' ? pilihan : dialog.fitur
    if (!fitur) return
    setMemproses(true)
    setGalat('')
    try {
      const res = await fetch(`/api/admin/fitur/${dialog.sekolah.id}`, {
        method:  dialog.jenis === 'tambah' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fitur }),
      })
      const json = await res.json().catch(() => null) as { error?: string | null } | null
      if (!res.ok) {
        setGalat(json?.error ?? 'Gagal menyimpan, coba lagi.')
        return
      }
      setDialog(null)
      router.refresh()
    } catch {
      setGalat('Gagal menghubungi server. Coba lagi.')
    } finally {
      setMemproses(false)
    }
  }

  return (
    <>
      {/* Katalog subfitur yang sudah dibuat */}
      <section className="admin-panel" aria-labelledby="judul-katalog-fitur">
        <div className="admin-panel-kepala">
          <span className="admin-panel-ikon"><Puzzle size={20} /></span>
          <div className="admin-panel-teks">
            <h2 id="judul-katalog-fitur" className="admin-panel-judul">Subfitur tersedia</h2>
            <p className="admin-panel-sub">
              Subfitur hanya muncul di sekolah yang ditambahkan. Mencabut subfitur tidak menghapus data yang sudah dicatat sekolah.
            </p>
          </div>
        </div>
        <div className="admin-katalog">
          {KATALOG_FITUR.map(f => (
            <div key={f.kode} className="admin-katalog-kartu">
              <span className="admin-panel-ikon admin-panel-ikon--hijau"><Puzzle size={18} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="admin-sel-utama" style={{ fontSize: '0.9rem', fontWeight: 800 }}>{f.nama}</div>
                <div className="admin-sel-sub" style={{ color: '#3C75B7', fontWeight: 700 }}>Menu {f.menu}</div>
                <div className="admin-sel-sub" style={{ fontSize: '0.78rem', marginTop: 4 }}>{f.deskripsi}</div>
                <div className="admin-sel-sub" style={{ color: '#0F172A', fontWeight: 700, marginTop: 6 }}>
                  Dipakai {daftar.filter(s => s.fitur.includes(f.kode)).length} sekolah
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Daftar sekolah */}
      <section className="admin-panel" aria-labelledby="judul-sekolah-fitur">
        <div className="admin-panel-kepala">
          <div className="admin-panel-teks">
            <h2 id="judul-sekolah-fitur" className="admin-panel-judul">
              Sekolah <span className="admin-jumlah">{daftar.length} sekolah</span>
            </h2>
            <p className="admin-panel-sub">Sekolah yang kemitraannya sudah dikonfirmasi</p>
          </div>
          <div className="admin-panel-alat">
            <label className="admin-cari">
              <Search size={15} />
              <input
                value={cari}
                onChange={e => setCari(e.target.value)}
                placeholder="Cari nama sekolah..."
                aria-label="Cari nama sekolah"
              />
            </label>
          </div>
        </div>

        {tersaring.length === 0 ? (
          <div className="admin-kosong">
            {daftar.length === 0 ? 'Belum ada sekolah yang dikonfirmasi.' : 'Tidak ada sekolah yang cocok.'}
          </div>
        ) : (
          <div className="admin-tabel-gulir">
            <table className="admin-tabel" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  {KOLOM.map(h => <th key={h} className={h === 'Aksi' ? 'kanan' : undefined}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tersaring.map((s, idx) => {
                  const sisa = belumDipasang(s)
                  return (
                    <tr key={s.id}>
                      <td className="admin-no">{idx + 1}</td>
                      <td className="admin-sel-utama">{s.nama}</td>
                      <td>
                        {s.fitur.length === 0 ? (
                          <span className="admin-sel-redup">Belum ada</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {s.fitur.map(k => (
                              <span key={k} className="admin-chip-fitur">
                                {infoFitur(k).nama}
                                <button
                                  type="button"
                                  onClick={() => bukaCabut(s, k)}
                                  aria-label={`Cabut ${infoFitur(k).nama} dari ${s.nama}`}
                                  title="Cabut subfitur"
                                >
                                  <X size={11} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ width: 200 }}>
                        <div className="admin-sel-aksi">
                          <button
                            type="button"
                            className="admin-tombol admin-tombol--utama admin-tombol--kecil"
                            onClick={() => bukaTambah(s)}
                            disabled={sisa.length === 0}
                            title={sisa.length === 0 ? 'Semua subfitur sudah ditambahkan' : undefined}
                          >
                            <Plus size={14} /> Tambah Subfitur
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog && (
        <ModalAdmin
          judul={dialog.jenis === 'tambah' ? 'Tambah subfitur' : `Cabut subfitur ${infoFitur(dialog.fitur).nama}?`}
          nada={dialog.jenis === 'tambah' ? 'utama' : 'bahaya'}
          ikon={dialog.jenis === 'tambah' ? <Plus size={21} /> : <X size={21} />}
          lebar={460}
          sibuk={memproses}
          onTutup={tutup}
          kaki={<>
            <button type="button" className="admin-tombol admin-tombol--garis" onClick={tutup} disabled={memproses}>
              Batal
            </button>
            <button
              type="button"
              className={`admin-tombol ${dialog.jenis === 'cabut' ? 'admin-tombol--bahaya' : 'admin-tombol--utama'}`}
              onClick={kirim}
              disabled={memproses || (dialog.jenis === 'tambah' && !pilihan)}
            >
              {memproses ? 'Memproses...' : dialog.jenis === 'tambah' ? 'Tambahkan' : 'Ya, cabut'}
            </button>
          </>}
        >
          {dialog.jenis === 'tambah' ? (
            <>
              <p>
                Pilih subfitur untuk <strong>{dialog.sekolah.nama}</strong>. Menunya langsung muncul di dashboard sekolah ini.
              </p>
              <div role="radiogroup" aria-label="Subfitur" className="admin-pilihan">
                {belumDipasang(dialog.sekolah).map(f => (
                  <button
                    key={f.kode}
                    type="button"
                    role="radio"
                    aria-checked={pilihan === f.kode}
                    onClick={() => setPilihan(f.kode)}
                  >
                    <div className="admin-sel-utama">
                      {f.nama} <span style={{ color: '#3C75B7', fontSize: '0.72rem' }}>· Menu {f.menu}</span>
                    </div>
                    <div className="admin-sel-sub" style={{ fontSize: '0.76rem' }}>{f.deskripsi}</div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>
              Menu {infoFitur(dialog.fitur).nama} hilang dari dashboard <strong>{dialog.sekolah.nama}</strong>.
              Data yang sudah dicatat tetap tersimpan dan muncul lagi kalau subfitur ini ditambahkan kembali.
            </p>
          )}

          {galat && <div className="admin-galat">{galat}</div>}
        </ModalAdmin>
      )}
    </>
  )
}
