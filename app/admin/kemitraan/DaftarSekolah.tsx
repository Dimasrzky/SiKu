'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellOff, BellRing, CircleAlert, CircleCheck, Eye, Lock, MessageCircle, Presentation, School, Search, Trash2 } from 'lucide-react'
import { LANGKAH_SETUP } from '@/lib/langkahSetup'
import ModalAdmin from '../ModalAdmin'
import ModalDetailSekolah from './ModalDetailSekolah'
import ModalHapusSekolah from './ModalHapusSekolah'
import { bacaPengirim, formatNomor, namaProvider, type StatusPengirim } from './pengirim'
import type { SekolahAdmin } from '../dataSekolah'

type Saringan = 'semua' | 'setup' | 'selesai'

const SARINGAN: { nilai: Saringan; label: string }[] = [
  { nilai: 'semua',   label: 'Semua' },
  { nilai: 'setup',   label: 'Tahap setup' },
  { nilai: 'selesai', label: 'Selesai setup' },
]

// Lebar kolom tabel sekolah (table-layout: fixed). Diukur dari teks terpanjang tiap kolom:
// "23 Nov 2026, 14.05" ±105 px, label "Tahap setup 3/5" ±115 px, saklar + "Menyala" ±101 px,
// "Yogyakarta" ±75 px, tombol mata + Hapus ±124 px. Muat tanpa geser mulai layar 1366 px.
const KOLOM: { label: string; lebar: string }[] = [
  { label: 'No',             lebar: '56px' },
  { label: 'Sekolah',        lebar: '15%' },
  { label: 'Bendahara',      lebar: '15%' },
  { label: 'Kota',           lebar: '11%' },
  { label: 'Status',         lebar: '15%' },
  { label: 'Terakhir Login', lebar: '14%' },
  { label: 'Notifikasi WA',  lebar: '13%' },
  { label: 'Aksi',           lebar: '17%' },
]

const StatusSetup = ({ s }: { s: SekolahAdmin }) => {
  if (s.setup.selesai) return <span className="admin-label admin-label--hijau">Selesai setup</span>
  return (
    <div title={s.setup.berikutnya ? `Langkah berikutnya: ${s.setup.berikutnya}` : undefined}>
      <span className="admin-label admin-label--kuning">Tahap setup {s.setup.jumlah}/{LANGKAH_SETUP.length}</span>
      <div className="admin-langkah" aria-hidden>
        {LANGKAH_SETUP.map((l, i) => <span key={l.kunci} className={i < s.setup.jumlah ? 'isi' : undefined} />)}
      </div>
      {s.setup.berikutnya && <div className="admin-sel-sub">Lanjut: {s.setup.berikutnya}</div>}
    </div>
  )
}

/** Tabel sekolah — sama untuk Sekolah Mitra dan Akun Demo; demo tanpa tombol Hapus */
const TabelSekolah = ({ daftar, loginGagal, onSaklar, onDetail, onHapus }: {
  daftar:     SekolahAdmin[]
  loginGagal: boolean
  onSaklar:   (s: SekolahAdmin) => void
  onDetail:   (s: SekolahAdmin) => void
  onHapus?:   (s: SekolahAdmin) => void
}) => (
  <div className="admin-tabel-gulir">
    <table className="admin-tabel admin-tabel--sekolah">
      <colgroup>
        {KOLOM.map(k => <col key={k.label} style={{ width: k.lebar }} />)}
      </colgroup>
      <thead>
        <tr>
          {KOLOM.map(k => <th key={k.label} className={k.label === 'Aksi' ? 'kanan' : undefined}>{k.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {daftar.map((s, idx) => (
          <tr key={s.id}>
            <td className="admin-no">{idx + 1}</td>
            <td>
              <div className="admin-sel-utama">{s.namaSekolah}</div>
            </td>
            <td>
              <div className="admin-sel-utama" style={{ fontWeight: 600 }}>{s.namaBendahara ?? '-'}</div>
            </td>
            <td>
              {s.kota
                ? s.kota
                : <span className="admin-sel-redup" title="Belum diisi bendahara di Pengaturan → Profil Sekolah">—</span>}
            </td>
            <td><StatusSetup s={s} /></td>
            <td>
              {s.loginRelatif ? (
                <div title={`${s.loginLengkap} WIB`}>
                  <div className="admin-sel-utama" style={{ fontWeight: 600 }}>{s.loginRelatif}</div>
                  <div className="admin-sel-sub admin-nowrap">{s.loginLengkap}</div>
                </div>
              ) : (
                <span className="admin-sel-redup">{loginGagal ? '—' : 'Belum pernah'}</span>
              )}
            </td>
            <td>
              {s.pengingatAktif === null ? (
                <span className="admin-sel-redup">Belum ada pengaturan</span>
              ) : (
                <div className={`admin-saklar-baris${s.pengingatAktif ? ' menyala' : ''}`}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.pengingatAktif}
                    aria-label={`Notifikasi WhatsApp ${s.namaSekolah}`}
                    className="admin-saklar"
                    onClick={() => onSaklar(s)}
                  />
                  {s.pengingatAktif ? 'Menyala' : 'Mati'}
                </div>
              )}
            </td>
            <td>
              <div className="admin-sel-aksi">
                <button
                  type="button"
                  className="admin-tombol-ikon admin-tombol-ikon--kecil"
                  onClick={() => onDetail(s)}
                  aria-label={`Detail ${s.namaSekolah}`}
                  title="Detail sekolah"
                >
                  <Eye size={16} />
                </button>
                {onHapus ? (
                  <button type="button" className="admin-tombol admin-tombol--bahaya-garis admin-tombol--kecil" onClick={() => onHapus(s)}>
                    <Trash2 size={14} /> Hapus
                  </button>
                ) : (
                  <span className="admin-terkunci" title="Akun demo dipakai ulang di setiap sesi demo">
                    <Lock size={13} /> Dilindungi
                  </span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const cocokCari = (s: SekolahAdmin, q: string) =>
  [s.namaSekolah, s.kota, s.namaBendahara, s.jenjang].some(v => v?.toLowerCase().includes(q))

/**
 * Isi halaman Kemitraan Sekolah: kartu Akun Demo di atas (tanpa Hapus), lalu kartu Sekolah
 * Mitra (cari, saring status setup, saklar notifikasi WA, Hapus).
 */
export default function DaftarSekolah({ mitra, demo, pengirim, loginGagal }: {
  mitra:      SekolahAdmin[]
  demo:       SekolahAdmin[]
  pengirim:   StatusPengirim | null
  loginGagal: boolean
}) {
  const router = useRouter()
  const [cari, setCari] = useState('')
  const [saring, setSaring] = useState<Saringan>('semua')

  const [saklar, setSaklar] = useState<SekolahAdmin | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)
  const [galatSaklar, setGalatSaklar] = useState('')

  const [detail, setDetail] = useState<SekolahAdmin | null>(null)
  const [hapus, setHapus] = useState<SekolahAdmin | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const pewaktuPesan = useRef<number | null>(null)

  const kondisi     = bacaPengirim(pengirim)
  const menyalakan  = !saklar?.pengingatAktif

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return mitra.filter(s =>
      (saring === 'semua' || (saring === 'selesai') === s.setup.selesai)
      && (!q || cocokCari(s, q)))
  }, [mitra, cari, saring])

  const bukaSaklar = (s: SekolahAdmin) => {
    setGalatSaklar('')
    setSaklar(s)
  }

  const simpanSaklar = async () => {
    if (!saklar || menyimpan) return
    setMenyimpan(true)
    setGalatSaklar('')
    try {
      const res = await fetch(`/api/admin/pengingat/${saklar.id}`, { method: menyalakan ? 'POST' : 'DELETE' })
      const json = await res.json().catch(() => null) as { error?: string | null } | null
      if (!res.ok) {
        setGalatSaklar(json?.error ?? 'Gagal menyimpan, coba lagi.')
        return
      }
      setSaklar(null)
      router.refresh()
    } catch {
      setGalatSaklar('Gagal menghubungi server. Coba lagi.')
    } finally {
      setMenyimpan(false)
    }
  }

  const sesudahHapus = (nama: string) => {
    setHapus(null)
    setPesan(`${nama} sudah dihapus.`)
    if (pewaktuPesan.current) window.clearTimeout(pewaktuPesan.current)
    pewaktuPesan.current = window.setTimeout(() => setPesan(null), 4500)
    router.refresh()
  }

  return (
    <>
      <section className="admin-panel" aria-labelledby="judul-akun-demo">
        <div className="admin-panel-kepala">
          <span className="admin-panel-ikon admin-panel-ikon--kuning"><Presentation size={20} /></span>
          <div className="admin-panel-teks">
            <h2 id="judul-akun-demo" className="admin-panel-judul">
              Akun Demo <span className="admin-jumlah">{demo.length} akun</span>
            </h2>
            <p className="admin-panel-sub">
              Dipakai tim untuk demo ke calon sekolah.
            </p>
          </div>
        </div>
        {demo.length === 0 ? (
          <div className="admin-kosong">Belum ada akun demo.</div>
        ) : (
          <TabelSekolah daftar={demo} loginGagal={loginGagal} onSaklar={bukaSaklar} onDetail={setDetail} />
        )}
      </section>

      <section className="admin-panel" aria-labelledby="judul-sekolah-mitra">
        <div className="admin-panel-kepala">
          <span className="admin-panel-ikon"><School size={20} /></span>
          <div className="admin-panel-teks">
            <h2 id="judul-sekolah-mitra" className="admin-panel-judul">
              Sekolah Mitra <span className="admin-jumlah">{mitra.length} sekolah</span>
            </h2>
          </div>
          <div className="admin-panel-alat">
            <div className="admin-saring" role="group" aria-label="Saring status setup">
              {SARINGAN.map(o => (
                <button key={o.nilai} type="button" aria-pressed={saring === o.nilai} onClick={() => setSaring(o.nilai)}>
                  {o.label}
                </button>
              ))}
            </div>
            <label className="admin-cari">
              <Search size={15} />
              <input
                value={cari}
                onChange={e => setCari(e.target.value)}
                placeholder="Cari sekolah, kota, bendahara..."
                aria-label="Cari sekolah"
              />
            </label>
          </div>
        </div>

        {/* Nomor pengirim bersama — supaya admin tahu pesan benar-benar keluar atau belum */}
        <div className={`admin-info admin-info--${kondisi.siap ? 'hijau' : 'merah'}`}>
          <MessageCircle size={17} />
          <div>
            <strong>Nomor pengirim WhatsApp</strong>{' '}
            {pengirim ? <>{formatNomor(pengirim.phone)} · {namaProvider(pengirim.provider)}</> : '—'}
            {' · '}
            <span className="admin-info-status">{kondisi.teks}</span>
          </div>
        </div>

        {loginGagal && (
          <div className="admin-info admin-info--kuning">
            <CircleAlert size={16} />
            <span>Waktu login terakhir gagal dibaca dari Supabase Auth. Muat ulang halaman untuk mencoba lagi.</span>
          </div>
        )}

        {tersaring.length === 0 ? (
          <div className="admin-kosong">
            {mitra.length === 0 ? 'Belum ada sekolah yang dikonfirmasi.' : 'Tidak ada sekolah yang cocok dengan pencarian atau saringan.'}
          </div>
        ) : (
          <TabelSekolah daftar={tersaring} loginGagal={loginGagal} onSaklar={bukaSaklar} onDetail={setDetail} onHapus={setHapus} />
        )}
      </section>

      {saklar && (
        <ModalAdmin
          judul={menyalakan ? 'Nyalakan notifikasi WhatsApp' : 'Matikan notifikasi WhatsApp'}
          nada={menyalakan ? 'sukses' : 'bahaya'}
          ikon={menyalakan ? <BellRing size={21} /> : <BellOff size={21} />}
          lebar={460}
          sibuk={menyimpan}
          onTutup={() => setSaklar(null)}
          kaki={<>
            <button type="button" className="admin-tombol admin-tombol--garis" onClick={() => setSaklar(null)} disabled={menyimpan}>
              Batal
            </button>
            <button
              type="button"
              className={`admin-tombol ${menyalakan ? 'admin-tombol--hijau' : 'admin-tombol--bahaya'}`}
              onClick={simpanSaklar}
              disabled={menyimpan}
            >
              {menyimpan ? 'Menyimpan...' : menyalakan ? 'Ya, nyalakan' : 'Ya, matikan'}
            </button>
          </>}
        >
          {menyalakan ? (
            <p>
              Wali murid <strong>{saklar.namaSekolah}</strong> akan menerima pengingat tagihan otomatis dari
              nomor {pengirim ? <strong>{formatNomor(pengirim.phone)}</strong> : 'pengirim SiKu'}, pada hari yang
              dinyalakan bendahara di Pengaturan Notifikasi. Tombol Ingatkan di dashboard sekolah juga mengirim lewat antrean ini.
            </p>
          ) : (
            <p>
              Pengingat otomatis untuk <strong>{saklar.namaSekolah}</strong> berhenti, termasuk yang sudah masuk
              antrean. Tombol Ingatkan di dashboard sekolah kembali membuka WhatsApp bendahara (wa.me).
            </p>
          )}
          {menyalakan && !kondisi.siap && (
            <div className="admin-info admin-info--kuning">
              <CircleAlert size={16} />
              <span>{kondisi.teks} Saklar tetap bisa dinyalakan; pengiriman berjalan setelah nomor pengirim siap.</span>
            </div>
          )}
          {galatSaklar && <div className="admin-galat">{galatSaklar}</div>}
        </ModalAdmin>
      )}

      {detail && <ModalDetailSekolah sekolah={detail} onTutup={() => setDetail(null)} />}

      {hapus && <ModalHapusSekolah sekolah={hapus} onTutup={() => setHapus(null)} onTerhapus={sesudahHapus} />}

      {pesan && (
        <div className="admin-toast" role="status">
          <CircleCheck size={18} /> {pesan}
        </div>
      )}
    </>
  )
}
