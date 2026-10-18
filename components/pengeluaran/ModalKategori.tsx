'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MAKS_NAMA_KATEGORI, urutkanKategori, type KategoriPengeluaran } from '@/lib/pengeluaran'
import {
  sGalat, sInput, sIsi, sJudulKepala, sKepala, sKotak, sLatar, sSubjudulKepala, sTombolIkon, sTombolTutup,
} from './gayaPengeluaran'

function pesanGalat(kode: string | undefined): string {
  if (kode === '23505') return 'Nama kategori sudah ada.'
  if (kode === '23503') return 'Kategori ini masih dipakai pengeluaran. Pindahkan atau hapus pengeluarannya dulu.'
  if (kode === '23514') return `Nama kategori 1–${MAKS_NAMA_KATEGORI} karakter.`
  if (kode === '42501') return 'Fitur Pengeluaran belum aktif untuk sekolah ini.'
  return 'Kategori gagal disimpan. Coba lagi.'
}

/**
 * Kategori (kolom "Jenis") dibuat sendiri oleh bendahara. Urutannya menentukan nomor
 * dan urutan baris di laporan pengeluaran.
 */
export const ModalKategori = ({ sekolahId, kategori, onTutup, onBerubah }: {
  sekolahId: string
  kategori:  KategoriPengeluaran[]
  onTutup:   () => void
  /** Muat ulang daftar kategori dari database */
  onBerubah: () => Promise<void>
}) => {
  const daftar = useMemo(() => urutkanKategori(kategori), [kategori])
  const [baru,      setBaru]      = useState('')
  const [ubahId,    setUbahId]    = useState<string | null>(null)
  const [ubahNama,  setUbahNama]  = useState('')
  const [hapusId,   setHapusId]   = useState<string | null>(null)
  const [sibuk,     setSibuk]     = useState(false)
  const [galat,     setGalat]     = useState('')

  const jalankan = async (aksi: () => PromiseLike<{ error: { code?: string } | null }>): Promise<boolean> => {
    setSibuk(true)
    setGalat('')
    try {
      const { error } = await aksi()
      if (error) { setGalat(pesanGalat(error.code)); return false }
      await onBerubah()
      return true
    } finally {
      setSibuk(false)
    }
  }

  const tambah = async () => {
    const nama = baru.trim()
    if (!nama || sibuk) return
    const urutan = daftar.reduce((m, k) => Math.max(m, k.urutan), 0) + 1
    if (await jalankan(() => supabase.from('kategori_pengeluaran').insert({ sekolah_id: sekolahId, nama, urutan }))) setBaru('')
  }

  const simpanNama = async (id: string) => {
    const nama = ubahNama.trim()
    if (!nama || sibuk) return
    const ok = await jalankan(() => supabase.from('kategori_pengeluaran')
      .update({ nama, updated_at: new Date().toISOString() })
      .eq('id', id).eq('sekolah_id', sekolahId))
    if (ok) setUbahId(null)
  }

  const hapus = async (id: string) => {
    if (sibuk) return
    const ok = await jalankan(() => supabase.from('kategori_pengeluaran').delete().eq('id', id).eq('sekolah_id', sekolahId))
    if (ok) setHapusId(null)
  }

  // Urutan ditulis ulang 1..n untuk semua yang bergeser, supaya urutan yang sama (mis.
  // dua-duanya 0) tetap bisa ditukar
  const geser = async (indeks: number, arah: -1 | 1) => {
    const tujuan = indeks + arah
    if (sibuk || tujuan < 0 || tujuan >= daftar.length) return
    const baris = [...daftar]
    ;[baris[indeks], baris[tujuan]] = [baris[tujuan], baris[indeks]]
    const kini = new Date().toISOString()
    await jalankan(async () => {
      const hasil = await Promise.all(baris
        .map((k, i) => ({ k, urutan: i + 1 }))
        .filter(({ k, urutan }) => k.urutan !== urutan)
        .map(({ k, urutan }) => supabase.from('kategori_pengeluaran')
          .update({ urutan, updated_at: kini })
          .eq('id', k.id).eq('sekolah_id', sekolahId)))
      return { error: hasil.find(h => h.error)?.error ?? null }
    })
  }

  return (
    <div style={{ ...sLatar, zIndex: 210 }} onClick={() => { if (!sibuk) onTutup() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="judul-modal-kategori" style={sKotak(480)} onClick={e => e.stopPropagation()}>
        <div style={sKepala}>
          <div>
            <div id="judul-modal-kategori" style={sJudulKepala}>Kelola Kategori</div>
            <div style={sSubjudulKepala}>Urutan kategori = urutan di laporan pengeluaran</div>
          </div>
          <button onClick={onTutup} disabled={sibuk} aria-label="Tutup" style={sTombolTutup}><X size={16} /></button>
        </div>

        <div style={sIsi}>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
            <input value={baru} onChange={e => setBaru(e.target.value)} maxLength={MAKS_NAMA_KATEGORI}
              onKeyDown={e => { if (e.key === 'Enter') void tambah() }}
              placeholder="Nama kategori baru, mis. ATK Kantor" aria-label="Nama kategori baru" style={sInput} />
            <button onClick={tambah} disabled={sibuk || !baru.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 0.9rem', background: !baru.trim() ? '#CBD5E1' : '#1A2C4E', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: sibuk || !baru.trim() ? 'default' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
              <Plus size={14} /> Tambah
            </button>
          </div>

          {galat && <div style={sGalat}>{galat}</div>}

          {daftar.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem', padding: '1.25rem 0' }}>
              Belum ada kategori. Contoh: ATK Kantor, Operasional, Kebersihan, Konsumsi, Kegiatan.
            </div>
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {daftar.map((k, i) => (
                <li key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0.45rem 0.55rem 0.45rem 0.75rem' }}>
                  <span style={{ width: 22, fontSize: '0.8rem', fontWeight: 700, color: '#64748B', flexShrink: 0 }}>{i + 1}</span>

                  {ubahId === k.id ? (
                    <>
                      <input value={ubahNama} onChange={e => setUbahNama(e.target.value)} maxLength={MAKS_NAMA_KATEGORI} autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') void simpanNama(k.id); if (e.key === 'Escape') setUbahId(null) }}
                        aria-label="Nama kategori" style={{ ...sInput, padding: '0.4rem 0.6rem' }} />
                      <button onClick={() => simpanNama(k.id)} disabled={sibuk} aria-label="Simpan nama" style={{ ...sTombolIkon, color: '#16A34A' }}><Check size={14} /></button>
                      <button onClick={() => setUbahId(null)} disabled={sibuk} aria-label="Batal ubah" style={{ ...sTombolIkon, color: '#64748B' }}><X size={14} /></button>
                    </>
                  ) : hapusId === k.id ? (
                    <>
                      <span style={{ flex: 1, fontSize: '0.8rem', color: '#B91C1C', fontWeight: 600 }}>Hapus “{k.nama}”?</span>
                      <button onClick={() => hapus(k.id)} disabled={sibuk}
                        style={{ padding: '0.35rem 0.7rem', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Hapus
                      </button>
                      <button onClick={() => setHapusId(null)} disabled={sibuk}
                        style={{ padding: '0.35rem 0.7rem', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', overflowWrap: 'anywhere' }}>{k.nama}</span>
                      <button onClick={() => geser(i, -1)} disabled={sibuk || i === 0} aria-label={`Naikkan ${k.nama}`}
                        style={{ ...sTombolIkon, color: '#475569', opacity: i === 0 ? 0.35 : 1 }}><ArrowUp size={14} /></button>
                      <button onClick={() => geser(i, 1)} disabled={sibuk || i === daftar.length - 1} aria-label={`Turunkan ${k.nama}`}
                        style={{ ...sTombolIkon, color: '#475569', opacity: i === daftar.length - 1 ? 0.35 : 1 }}><ArrowDown size={14} /></button>
                      <button onClick={() => { setGalat(''); setHapusId(null); setUbahNama(k.nama); setUbahId(k.id) }} disabled={sibuk} aria-label={`Ubah nama ${k.nama}`}
                        style={{ ...sTombolIkon, color: '#3C75B7' }}><Pencil size={14} /></button>
                      <button onClick={() => { setGalat(''); setUbahId(null); setHapusId(k.id) }} disabled={sibuk} aria-label={`Hapus ${k.nama}`}
                        style={{ ...sTombolIkon, color: '#DC2626' }}><Trash2 size={14} /></button>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
