'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Bell, Check, ChevronRight, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ambilSemua } from '@/lib/ambilSemua'
import { Blok, giliran } from './skeleton/Blok'

// Modal "Ingatkan orang tua" di dashboard: memilih kelas mana yang orang tuanya
// menerima pengingat H-7. Pilihannya disimpan di pengaturan.pengingat_kelas_ids.
// Modal ini hanya menyimpan daftar kelasnya — pengirim terjadwalnya belum ada.

interface KelasPengingat   { id: string; nama: string; jumlahSiswa: number }
interface JenjangPengingat { jenjang: string; kelas: KelasPengingat[]; jumlahSiswa: number }

type StatusCentang = 'penuh' | 'sebagian' | 'kosong'

const NAVY  = '#1A2C4E'
const ABU   = '#6F788A'
const GARIS = '#E7E9EC'
// Huruf di desain lebih rapat dari bawaan DM Sans. Teks biasa dirapatkan lewat
// .pengingat-kartu di dashboard.css; judul butuh lebih rapat lagi.
const RAPAT_JUDUL = '-0.045em'

/** Kolom pengingat_kelas_ids belum dibuat (SQL belum dijalankan) — petunjuk, bukan galat */
const kolomBelumAda = (e: { code?: string; message?: string } | null): boolean =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || (e.message ?? '').includes('pengingat_kelas_ids'))

// "7" < "10", dan "7-A" < "7-B" < "7-10"
const urut = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true })

const labelKelas = (nama: string) => (nama.startsWith('Kelas') ? nama : `Kelas ${nama}`)

async function muatPengingat(sekolahId: string): Promise<{
  data:  { jenjang: JenjangPengingat[]; dipilih: string[] } | null
  error: string | null
}> {
  const [kelasRes, siswaRes, pengaturanRes] = await Promise.all([
    supabase.from('kelas').select('id, nama, jenjang').eq('sekolah_id', sekolahId).limit(500),
    // Diambil bertahap: satu .limit() bisa diam-diam terpotong di batas baris PostgREST
    ambilSemua<{ kelas_id: string | null }>((dari, sampai) => supabase
      .from('siswa').select('id, kelas_id')
      .eq('sekolah_id', sekolahId).eq('status', 'aktif')
      .order('id').range(dari, sampai)),
    supabase.from('pengaturan').select('pengingat_kelas_ids').eq('sekolah_id', sekolahId).maybeSingle(),
  ])

  if (kelasRes.error || siswaRes.error || (pengaturanRes.error && !kolomBelumAda(pengaturanRes.error))) {
    return { data: null, error: 'Daftar kelas gagal dimuat. Tutup lalu buka lagi.' }
  }

  // Dasar hitungnya sama dengan kartu "Total siswa aktif": siswa berstatus aktif saja
  const siswaPerKelas = new Map<string, number>()
  for (const s of siswaRes.data) {
    if (s.kelas_id) siswaPerKelas.set(s.kelas_id, (siswaPerKelas.get(s.kelas_id) ?? 0) + 1)
  }

  const kelasPerJenjang = new Map<string, KelasPengingat[]>()
  for (const k of (kelasRes.data ?? []) as { id: string; nama: string; jenjang: string }[]) {
    const daftar = kelasPerJenjang.get(k.jenjang) ?? []
    daftar.push({ id: k.id, nama: k.nama, jumlahSiswa: siswaPerKelas.get(k.id) ?? 0 })
    kelasPerJenjang.set(k.jenjang, daftar)
  }

  const jenjang: JenjangPengingat[] = [...kelasPerJenjang.entries()]
    .sort(([a], [b]) => urut(a, b))
    .map(([nama, kelas]) => ({
      jenjang:     nama,
      kelas:       kelas.sort((a, b) => urut(a.nama, b.nama)),
      jumlahSiswa: kelas.reduce((s, k) => s + k.jumlahSiswa, 0),
    }))

  // null = belum pernah disimpan → semua kelas tercentang. Kelas yang sudah dihapus
  // sejak penyimpanan terakhir ikut terbuang karena hanya kelas yang masih ada yang dibaca.
  const tersimpan = (pengaturanRes.data as { pengingat_kelas_ids?: string[] | null } | null)?.pengingat_kelas_ids ?? null
  const semuaId   = jenjang.flatMap(j => j.kelas.map(k => k.id))
  const dipilih   = tersimpan === null ? semuaId : semuaId.filter(id => tersimpan.includes(id))

  return { data: { jenjang, dipilih }, error: null }
}

// Ikon PNG satu warna dari public/icons, diwarnai lewat mask supaya bisa dipakai
// di atas latar terang maupun gelap
const sIkon = (src: string, ukuran: number, warna: string): CSSProperties => ({
  display: 'inline-block', width: ukuran, height: ukuran, flexShrink: 0, background: warna,
  WebkitMask: `url(${src}) center / contain no-repeat`,
  mask:       `url(${src}) center / contain no-repeat`,
})

// Warna latar tombol ada di dashboard.css (.pengingat-tombol-*) supaya :hover tidak
// tertimpa style inline
const sTombolGaris: CSSProperties = {
  border: `1.5px solid ${NAVY}`, color: NAVY, borderRadius: 8,
  fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(26, 44, 78, 0.18)',
}

const sPesan: CSSProperties = { padding: '2rem 1rem', textAlign: 'center', fontSize: 14, color: '#94A3B8' }

const KotakCentang = ({ status, ukuran }: { status: StatusCentang; ukuran: number }) => (
  <span aria-hidden style={{
    width: ukuran, height: ukuran, borderRadius: 5, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: status === 'kosong' ? '#fff' : '#69C183',
    border: status === 'kosong' ? '1.5px solid #D2D7DE' : 'none',
    boxShadow: '0 1px 2px rgba(26, 44, 78, 0.12)',
  }}>
    {status === 'penuh'    && <Check size={Math.round(ukuran * 0.72)} color="#fff" strokeWidth={2.5} />}
    {status === 'sebagian' && <Minus size={Math.round(ukuran * 0.72)} color="#fff" strokeWidth={2.5} />}
  </span>
)

interface Props {
  sekolahId: string
  onTutup:   () => void
}

export const ModalIngatkanOrangTua = ({ sekolahId, onTutup }: Props) => {
  const [daftar,      setDaftar]      = useState<JenjangPengingat[] | null>(null)
  const [galatMuat,   setGalatMuat]   = useState('')
  const [dipilih,     setDipilih]     = useState<Set<string>>(new Set())
  // Hanya satu jenjang yang terbuka pada satu waktu; null = semua tertutup
  const [terbuka,     setTerbuka]     = useState<string | null>(null)
  const [menyimpan,   setMenyimpan]   = useState(false)
  const [galatSimpan, setGalatSimpan] = useState('')

  useEffect(() => {
    let batal = false
    const muat = async () => {
      const { data, error } = await muatPengingat(sekolahId)
      if (batal) return
      if (error || !data) { setGalatMuat(error ?? 'Daftar kelas gagal dimuat.'); return }
      setDaftar(data.jenjang)
      setDipilih(new Set(data.dipilih))
      setTerbuka(data.jenjang[0]?.jenjang ?? null)
    }
    muat()
    return () => { batal = true }
  }, [sekolahId])

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape' && !menyimpan) onTutup() }
    document.addEventListener('keydown', tekan)
    return () => document.removeEventListener('keydown', tekan)
  }, [menyimpan, onTutup])

  const tutup = () => { if (!menyimpan) onTutup() }

  const ubahKelas = (id: string) => setDipilih(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // Jenjang yang belum penuh → centang semua kelasnya; yang sudah penuh → kosongkan
  const ubahJenjang = (j: JenjangPengingat) => setDipilih(prev => {
    const next  = new Set(prev)
    const penuh = j.kelas.every(k => next.has(k.id))
    for (const k of j.kelas) { if (penuh) next.delete(k.id); else next.add(k.id) }
    return next
  })

  // Membuka jenjang lain otomatis menutup yang sedang terbuka; klik pada yang terbuka menutupnya
  const ubahBuka = (jenjang: string) => setTerbuka(prev => (prev === jenjang ? null : jenjang))

  const statusJenjang = (j: JenjangPengingat): StatusCentang => {
    const n = j.kelas.filter(k => dipilih.has(k.id)).length
    return n === 0 ? 'kosong' : n === j.kelas.length ? 'penuh' : 'sebagian'
  }

  // 1 siswa = 1 orang tua, jadi angkanya selalu sama dengan jumlah "N Siswa" yang dicentang
  const totalPenerima = (daftar ?? []).reduce(
    (s, j) => s + j.kelas.reduce((t, k) => t + (dipilih.has(k.id) ? k.jumlahSiswa : 0), 0),
    0,
  )

  const simpan = async () => {
    if (!daftar) return
    setMenyimpan(true)
    setGalatSimpan('')
    // Baris pengaturan pasti sudah ada — dashboard baru tampil setelah setup selesai —
    // jadi cukup update. Upsert akan ikut memvalidasi kolom wajib lain yang tidak dikirim.
    const { data, error } = await supabase
      .from('pengaturan')
      .update({ pengingat_kelas_ids: [...dipilih] })
      .eq('sekolah_id', sekolahId)
      .select('sekolah_id')
    setMenyimpan(false)
    if (error || !data?.length) {
      setGalatSimpan(kolomBelumAda(error) ? 'Kolom pengingat di tabel pengaturan belum dibuat.' : 'Pilihan kelas gagal disimpan. Coba lagi.')
      return
    }
    onTutup()
  }

  const siap = !!daftar && daftar.length > 0

  return (
    <div
      className="pengingat-latar"
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={tutup}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="judul-pengingat"
        className="pengingat-kartu"
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 732, minWidth: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', fontFamily: 'var(--font-dm-sans), sans-serif' }}
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 13px', flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 9, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span aria-hidden style={sIkon('/icons/WABiru.png', 24, '#fff')} />
          </div>
          <div>
            <div id="judul-pengingat" style={{ fontSize: 21, fontWeight: 600, color: NAVY, lineHeight: '25px', letterSpacing: RAPAT_JUDUL }}>Ingatkan orang tua</div>
            <div style={{ fontSize: 17, color: ABU, lineHeight: '24px' }}>Tagihan sudah memasuki H-7 jatuh tempo</div>
          </div>
        </div>
        <div style={{ height: 1, background: GARIS, margin: '0 14px', flexShrink: 0 }} />

        {/* Judul daftar + Hapus Semua */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '24px 26px 11px 27px', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 500, color: NAVY, lineHeight: '22px', letterSpacing: RAPAT_JUDUL }}>Pilih kelas yang diingatkan</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13.5, color: ABU, lineHeight: '20px', marginTop: 2 }}>
              <Bell size={11} style={{ flexShrink: 0 }} /> Notifikasi H-7 dikirimkan otomatis per siswa
            </div>
          </div>
          <button
            type="button" className="pengingat-tombol-garis"
            onClick={() => setDipilih(new Set())}
            disabled={!siap || dipilih.size === 0}
            style={{ ...sTombolGaris, height: 33, padding: '0 13px', fontSize: 14, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Hapus Semua
          </button>
        </div>

        {/* Daftar jenjang → kelas */}
        <div style={{ margin: '0 16px', background: '#fff', borderRadius: 12, boxShadow: '0 0 12px rgba(90, 120, 170, 0.24)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ overflowY: 'auto', padding: '13px 11px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {galatMuat ? (
              <div role="alert" style={{ ...sPesan, color: '#DC2626' }}>{galatMuat}</div>
            ) : !daftar ? (
              // Kerangka bar jenjang (tertutup) selama daftar kelas dimuat
              <>
                <span role="status" className="skeleton-sr">Memuat daftar kelas…</span>
                {[0, 1, 2].map(i => (
                  <div key={i} aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 11, minHeight: 50, padding: '0 10px 0 14px', borderRadius: 10, flexShrink: 0, background: NAVY, boxShadow: '0 3px 8px rgba(26, 44, 78, 0.16)' }}>
                    <Blok gelap lebar={25} tinggi={25} sudut={5} />
                    <Blok gelap lebar={giliran([96, 108, 88], i)} tinggi={14} sudut={4} />
                    <Blok gelap lebar={120} tinggi={12} sudut={4} style={{ marginLeft: 'auto' }} />
                    <ChevronRight size={30} strokeWidth={2} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0 }} />
                  </div>
                ))}
              </>
            ) : daftar.length === 0 ? (
              <div style={sPesan}>Belum ada kelas.</div>
            ) : daftar.map((j, i) => {
              const buka   = terbuka === j.jenjang
              const status = statusJenjang(j)
              return (
                // Sudut membulat dipotong di wadah ini, bukan di bar, supaya bar dan panel
                // tetap menyatu selama panel masih bergerak menutup
                <div key={j.jenjang} className="pengingat-grup" style={{ borderRadius: 10, overflow: 'hidden', flexShrink: 0, boxShadow: buka ? '0 1px 8px rgba(90, 120, 170, 0.3)' : '0 3px 8px rgba(26, 44, 78, 0.16)' }}>
                  <div className="pengingat-jenjang" style={{ display: 'flex', alignItems: 'stretch', minHeight: 50, background: buka ? '#315497' : NAVY }}>
                    <button
                      type="button" role="checkbox"
                      aria-checked={status === 'penuh' ? true : status === 'sebagian' ? 'mixed' : false}
                      aria-label={`Semua kelas jenjang ${j.jenjang}`}
                      onClick={() => ubahJenjang(j)}
                      style={{ display: 'flex', alignItems: 'center', padding: '0 10px 0 14px', background: 'none', border: 'none', borderRadius: 10 }}
                    >
                      <KotakCentang status={status} ukuran={25} />
                    </button>
                    <button
                      type="button"
                      aria-expanded={buka} aria-controls={`pengingat-panel-${i}`}
                      onClick={() => ubahBuka(j.jenjang)}
                      style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0 10px 0 11px', background: 'none', border: 'none', color: '#fff', fontFamily: 'inherit', borderRadius: 10 }}
                    >
                      <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: RAPAT_JUDUL, whiteSpace: 'nowrap' }}>Jenjang {j.jenjang}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 14, lineHeight: 1.25, textAlign: 'right' }}>
                          {j.kelas.length} Kelas <span style={{ margin: '0 2px' }}>•</span> {j.jumlahSiswa} Siswa
                        </span>
                        {/* Diputar 90° saat terbuka — bentuknya sama persis dengan chevron bawah */}
                        <ChevronRight className="pengingat-chevron" size={30} strokeWidth={2} style={{ flexShrink: 0, transform: buka ? 'rotate(90deg)' : 'none' }} />
                      </span>
                    </button>
                  </div>

                  {/* Panel selalu dirender supaya menutupnya juga beranimasi; tingginya
                      diatur .pengingat-panel (grid 0fr ↔ 1fr). inert mencegah baris yang
                      tersembunyi ikut terfokus lewat Tab. */}
                  <div id={`pengingat-panel-${i}`} className="pengingat-panel" data-buka={buka} inert={!buka} style={{ background: '#fff' }}>
                    <div className="pengingat-panel-isi">
                      {/* Padding di lapisan terdalam: di lapisan atasnya ia tetap memakan tinggi saat tertutup */}
                      <div style={{ padding: '4px 11px 11px' }}>
                        {j.kelas.map((k, n) => (
                          <button
                            key={k.id}
                            type="button" role="checkbox" aria-checked={dipilih.has(k.id)}
                            className="pengingat-baris"
                            onClick={() => ubahKelas(k.id)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 24, height: 44, padding: '0 14px 0 6px', border: 'none', borderTop: n > 0 ? `1px solid ${GARIS}` : 'none', fontFamily: 'inherit', color: ABU }}
                          >
                            <KotakCentang status={dipilih.has(k.id) ? 'penuh' : 'kosong'} ukuran={21} />
                            <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5 }}>{labelKelas(k.nama)}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, whiteSpace: 'nowrap' }}>
                              <span aria-hidden style={sIkon('/icons/IconGroup.png', 15, ABU)} />
                              {k.jumlahSiswa} Siswa
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '20px 31px 17px 28px', color: ABU, flexShrink: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 17 }}>
              <span aria-hidden style={sIkon('/icons/IconGroup.png', 20, ABU)} />
              Total penerima pesan pengingat
            </span>
            {daftar || galatMuat
              ? <span style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{totalPenerima} Orang Tua</span>
              : <Blok lebar={84} tinggi={12} sudut={4} />}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '12px 26px', padding: '21px 27px 19px', flexShrink: 0 }}>
          {galatSimpan && (
            <span role="alert" style={{ marginRight: 'auto', fontSize: 13, color: '#DC2626' }}>{galatSimpan}</span>
          )}
          <button
            type="button" className="pengingat-tombol-garis"
            onClick={tutup} disabled={menyimpan}
            style={{ ...sTombolGaris, borderWidth: 2, minWidth: 134, height: 42, fontSize: 14 }}
          >
            Batal
          </button>
          <button
            type="button" className="pengingat-tombol-isi"
            onClick={simpan} disabled={!siap || menyimpan}
            style={{ color: '#fff', border: 'none', borderRadius: 8, minWidth: 172, height: 42, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', boxShadow: '0 3px 6px rgba(26, 44, 78, 0.3)' }}
          >
            {menyimpan ? 'Menyimpan...' : 'Simpan Siswa'}
          </button>
        </div>
      </div>
    </div>
  )
}
