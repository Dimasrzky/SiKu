'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellOff, BellRing, CircleAlert, CircleCheck, MessageCircle } from 'lucide-react'

export interface SekolahTerkonfirmasi {
  id:            string
  namaSekolah:   string
  jenjang:       string | null
  namaBendahara: string | null
  email:         string | null
  /** Waktu konfirmasi kemitraan, sudah diformat (WIB); null untuk sekolah lama */
  dikonfirmasi:  string | null
  /** pengaturan.pengingat_wa_aktif; null = baris pengaturan belum ada */
  pengingatAktif: boolean | null
}

/** Nomor pengirim bersama (wa_sender tanpa sekolah_id) — null kalau belum disiapkan */
export interface StatusPengirim {
  /** Nomor dengan awalan 62, tanpa tanda + */
  phone:    string
  provider: 'uji' | 'fonnte' | 'waba'
  status:   'aktif' | 'pause' | 'nonaktif'
  pauseReason: string | null
  /** FONNTE_TOKEN terisi di server (nilainya tidak pernah dikirim ke browser) */
  tokenAda: boolean
}

const KOLOM = ['No', 'Sekolah', 'Bendahara', 'Dikonfirmasi', 'Notifikasi WA', 'Aksi'] as const

/** "6282260400408" → "+62 822-6040-0408" */
const formatNomor = (n: string) => {
  const lokal = n.replace(/^62/, '')
  return `+62 ${lokal.slice(0, 3)}-${lokal.slice(3, 7)}-${lokal.slice(7)}`
}

/** Apakah pesan benar-benar keluar, dan kalau tidak, kenapa */
function bacaPengirim(p: StatusPengirim | null): { siap: boolean; teks: string } {
  if (!p) return { siap: false, teks: 'Nomor pengirim belum disiapkan di tabel wa_sender — pengingat tidak bisa diantrekan.' }
  if (p.status === 'nonaktif') return { siap: false, teks: 'Nomor pengirim dinonaktifkan — pengingat tidak bisa diantrekan.' }
  if (p.status === 'pause') return { siap: false, teks: `Pengiriman dihentikan sementara (circuit breaker)${p.pauseReason ? `: ${p.pauseReason}` : ''}. Buka lagi lewat SQL setelah device diperiksa.` }
  if (p.provider === 'uji') return { siap: false, teks: 'Masih mode uji — pesan hanya dicatat, tidak dikirim ke wali.' }
  if (p.provider === 'fonnte' && !p.tokenAda) return { siap: false, teks: 'FONNTE_TOKEN belum diisi di server — pesan akan gagal terkirim.' }
  return { siap: true, teks: 'Siap mengirim' }
}

export default function SaklarPengingat({ daftar, pengirim }: { daftar: SekolahTerkonfirmasi[]; pengirim: StatusPengirim | null }) {
  const router = useRouter()
  const [dipilih, setDipilih] = useState<SekolahTerkonfirmasi | null>(null)
  const [memproses, setMemproses] = useState(false)
  const [galat, setGalat] = useState('')

  const kondisi = bacaPengirim(pengirim)
  const jumlahAktif = daftar.filter(s => s.pengingatAktif).length
  const menyalakan = !dipilih?.pengingatAktif

  const buka = (s: SekolahTerkonfirmasi) => {
    setGalat('')
    setDipilih(s)
  }

  const simpan = async () => {
    if (!dipilih || memproses) return
    setMemproses(true)
    setGalat('')
    try {
      const res = await fetch(`/api/admin/pengingat/${dipilih.id}`, { method: menyalakan ? 'POST' : 'DELETE' })
      const json = await res.json().catch(() => null) as { error?: string | null } | null
      if (!res.ok) {
        setGalat(json?.error ?? 'Gagal menyimpan, coba lagi.')
        return
      }
      setDipilih(null)
      router.refresh()
    } catch {
      setGalat('Gagal menghubungi server. Coba lagi.')
    } finally {
      setMemproses(false)
    }
  }

  return (
    <section style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginTop: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem' }}>
        <div style={{ width: 38, height: 38, background: '#DCFCE7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CircleCheck size={19} color="#15803D" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1A2C4E', margin: 0 }}>Sekolah Terkonfirmasi</h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
              {daftar.length} sekolah · {jumlahAktif} notifikasi WA menyala
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0.15rem 0 0' }}>
            Nyalakan notifikasi agar sekolah mendapat pengingat WhatsApp otomatis. Hari pengirimannya
            (H-7/H-3/H-1) tetap mengikuti Pengaturan Notifikasi di dashboard sekolah.
          </p>
        </div>
      </div>

      {/* Nomor pengirim bersama — supaya admin tahu pesan benar-benar keluar atau belum */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 1.25rem 1rem', padding: '0.65rem 0.9rem', borderRadius: 10,
        background: kondisi.siap ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${kondisi.siap ? '#BBF7D0' : '#FECACA'}`,
      }}>
        <MessageCircle size={17} color={kondisi.siap ? '#15803D' : '#DC2626'} style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.8rem', color: '#0F172A', lineHeight: 1.5 }}>
          <strong>Nomor pengirim</strong>{' '}
          {pengirim ? <>{formatNomor(pengirim.phone)} · {pengirim.provider === 'fonnte' ? 'Fonnte' : pengirim.provider === 'uji' ? 'Mode uji' : 'WABA'}</> : '—'}
          {' · '}
          <span style={{ color: kondisi.siap ? '#15803D' : '#DC2626', fontWeight: 700 }}>{kondisi.teks}</span>
        </div>
      </div>

      {daftar.length === 0 ? (
        <div style={{ padding: '1.25rem', borderTop: '1px solid #F1F5F9', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
          Belum ada sekolah yang dikonfirmasi.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ background: '#1A2C4E' }}>
                {KOLOM.map(h => (
                  <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daftar.map((s, idx) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #F8FAFC', verticalAlign: 'middle' }}>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: '#64748B', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{s.namaSekolah}</div>
                    {s.jenjang && <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>{s.jenjang}</div>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#0F172A' }}>{s.namaBendahara ?? '-'}</div>
                    {s.email && <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2, wordBreak: 'break-all' }}>{s.email}</div>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>{s.dikonfirmasi ?? '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {s.pengingatAktif === null ? (
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Pengaturan belum ada</span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
                        background: s.pengingatAktif ? '#DCFCE7' : '#F1F5F9', color: s.pengingatAktif ? '#15803D' : '#64748B',
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.pengingatAktif ? '#22C55E' : '#94A3B8' }} />
                        {s.pengingatAktif ? 'Menyala' : 'Mati'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {s.pengingatAktif !== null && (
                      <button
                        onClick={() => buka(s)}
                        style={s.pengingatAktif
                          ? { display: 'flex', alignItems: 'center', gap: 5, padding: '0.4rem 0.75rem', background: '#fff', color: '#B91C1C', border: '1.5px solid #FCA5A5', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }
                          : { display: 'flex', alignItems: 'center', gap: 5, padding: '0.4rem 0.75rem', background: '#15803D', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {s.pengingatAktif ? <><BellOff size={13} /> Matikan notifikasi</> : <><BellRing size={13} /> Nyalakan notifikasi</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dipilih && (
        <div
          onClick={() => !memproses && setDipilih(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            role="dialog" aria-modal="true" aria-labelledby="judul-saklar-pengingat"
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', padding: '1.5rem' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 48, height: 48, background: menyalakan ? '#D1FAE5' : '#FEE2E2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              {menyalakan ? <BellRing size={24} color="#059669" /> : <BellOff size={24} color="#DC2626" />}
            </div>

            <div id="judul-saklar-pengingat" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A', marginBottom: 6 }}>
              {menyalakan ? 'Nyalakan notifikasi WhatsApp' : 'Matikan notifikasi WhatsApp'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6, marginBottom: '1rem' }}>
              {menyalakan ? (
                <>
                  Wali murid <strong style={{ color: '#0F172A' }}>{dipilih.namaSekolah}</strong> akan menerima pengingat tagihan
                  otomatis dari nomor {pengirim ? <strong style={{ color: '#0F172A' }}>{formatNomor(pengirim.phone)}</strong> : 'pengirim SiKu'},
                  pada hari yang dinyalakan bendahara di Pengaturan Notifikasi. Tombol Ingatkan di dashboard sekolah juga mengirim lewat antrean ini.
                </>
              ) : (
                <>
                  Pengingat otomatis untuk <strong style={{ color: '#0F172A' }}>{dipilih.namaSekolah}</strong> berhenti, termasuk
                  yang sudah masuk antrean. Tombol Ingatkan di dashboard sekolah kembali membuka WhatsApp bendahara (wa.me).
                </>
              )}
            </div>

            {menyalakan && !kondisi.siap && (
              <div style={{ display: 'flex', gap: 6, fontSize: '0.78rem', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.55rem 0.7rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                <CircleAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{kondisi.teks} Saklar tetap bisa dinyalakan; pengiriman berjalan setelah nomor pengirim siap.</span>
              </div>
            )}

            {galat && <div style={{ fontSize: '0.78rem', color: '#DC2626', marginBottom: '1rem' }}>{galat}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setDipilih(null)}
                disabled={memproses}
                style={{ flex: 1, padding: '0.65rem', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: memproses ? 'default' : 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={simpan}
                disabled={memproses}
                style={{ flex: 1, padding: '0.65rem', background: menyalakan ? '#15803D' : '#DC2626', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: memproses ? 'default' : 'pointer', opacity: memproses ? 0.7 : 1 }}
              >
                {memproses ? 'Menyimpan...' : menyalakan ? 'Ya, nyalakan' : 'Ya, matikan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
