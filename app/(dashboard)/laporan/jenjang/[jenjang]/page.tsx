'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronRight, Database } from 'lucide-react'
import { hitungRingkasan, hitungPemasukan, trenTagihanRealisasi, type RingkasanMetrik } from '@/lib/metrikLaporan'
import { formatRupiah as fmt, formatRingkas, formatPersen } from '@/lib/formatLaporan'
import { useDataLaporan, type TagihanLaporan } from '@/lib/useDataLaporan'
import { useFilterLaporan } from '@/lib/useFilterLaporan'
import { HeaderLaporan } from '@/components/laporan/HeaderLaporan'
import { FilterLaporan } from '@/components/laporan/FilterLaporan'
import { KartuRingkasan } from '@/components/laporan/KartuRingkasan'
import { TrenTagihanChart } from '@/components/laporan/TrenTagihanChart'
import { sKartu, sBingkai, sJudulPanel, sSubjudulPanel } from '@/components/laporan/gayaLaporan'

// Level Jenjang drill-down (Draft Pengembangan Fitur Laporan, Prioritas 2):
// tren jenjang dan ranking kelas berdasarkan ketepatan waktu dan tunggakan.
// Kelas dibaca dari snapshot tagihan.kelas_id, jadi kelas 7 tahun lalu dan kelas 7
// tahun ini adalah kelompok siswa yang berbeda — sesuai prinsip "tren kelas
// dihitung per tahun ajaran".

type KolomUrut = 'kelas' | 'siswa' | 'pelunasan' | 'ketepatan' | 'telat' | 'tunggakan' | 'menunggak'

interface BarisKelas {
  kelasId:   string
  nama:      string
  siswa:     number
  ringkasan: RingkasanMetrik
}

/** Nilai kolom untuk pengurutan; null (belum bisa dihitung) selalu ditaruh paling bawah */
function nilaiKolom(b: BarisKelas, kolom: KolomUrut): number | string | null {
  switch (kolom) {
    case 'kelas':     return b.nama
    case 'siswa':     return b.siswa
    case 'pelunasan': return b.ringkasan.tingkatPelunasan
    case 'ketepatan': return b.ringkasan.ketepatanWaktu
    case 'telat':     return b.ringkasan.rataHariTelat
    case 'tunggakan': return b.ringkasan.tunggakanBerjalan
    case 'menunggak': return b.ringkasan.siswaMenunggak
  }
}

// useSearchParams (lewat useFilterLaporan) wajib berada di bawah batas Suspense
export default function LaporanJenjangPage() {
  return (
    <Suspense fallback={
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Memuat data...</div>
      </div>
    }>
      <LaporanJenjangContent />
    </Suspense>
  )
}

function LaporanJenjangContent() {
  const router  = useRouter()
  const params  = useParams<{ jenjang: string }>()
  const jenjang = decodeURIComponent(params.jenjang)

  const { loading, rows, kelas, activeTA, archivedTAs, sekarang } = useDataLaporan()
  const filter = useFilterLaporan(activeTA, archivedTAs, sekarang)
  const { taTerpilih, taArsipTerpilih, selectedFilter, dalamPeriode, qsFilter } = filter

  const [urut, setUrut] = useState<{ kolom: KolomUrut; naik: boolean }>({ kolom: 'tunggakan', naik: false })

  // Semua tagihan jenjang ini (untuk tren), lalu yang masuk periode terpilih (untuk kartu dan ranking)
  const milikJenjang = useMemo(
    () => rows.filter(t => t.kelas_id !== null && kelas.get(t.kelas_id)?.jenjang === jenjang),
    [rows, kelas, jenjang],
  )
  const periodRows = useMemo(() => milikJenjang.filter(dalamPeriode), [milikJenjang, dalamPeriode])

  const ringkasan = useMemo(() => hitungRingkasan(periodRows, sekarang), [periodRows, sekarang])
  const pemasukan = useMemo(() => hitungPemasukan(periodRows), [periodRows])

  const akhirTA = taTerpilih?.tanggal_selesai ?? null
  const tren = useMemo(
    () => trenTagihanRealisasi(milikJenjang, sekarang, akhirTA ? new Date(akhirTA) : sekarang),
    [milikJenjang, sekarang, akhirTA],
  )

  const perKelas = useMemo<BarisKelas[]>(() => {
    const grup = new Map<string, TagihanLaporan[]>()
    for (const t of periodRows) {
      if (!t.kelas_id) continue
      const daftar = grup.get(t.kelas_id)
      if (daftar) daftar.push(t)
      else grup.set(t.kelas_id, [t])
    }
    return [...grup].map(([kelasId, daftar]) => ({
      kelasId,
      nama:      kelas.get(kelasId)?.nama ?? '—',
      siswa:     new Set(daftar.map(t => t.siswa_id)).size,
      ringkasan: hitungRingkasan(daftar, sekarang),
    }))
  }, [periodRows, kelas, sekarang])

  const perKelasUrut = useMemo(() => {
    const arah = urut.naik ? 1 : -1
    return [...perKelas].sort((a, b) => {
      const va = nilaiKolom(a, urut.kolom)
      const vb = nilaiKolom(b, urut.kolom)
      if (va === null && vb === null) return a.nama.localeCompare(b.nama, 'id', { numeric: true })
      if (va === null) return 1
      if (vb === null) return -1
      const beda = typeof va === 'string'
        ? va.localeCompare(vb as string, 'id', { numeric: true })
        : va - (vb as number)
      return beda * arah || a.nama.localeCompare(b.nama, 'id', { numeric: true })
    })
  }, [perKelas, urut])

  const gantiUrut = (kolom: KolomUrut) =>
    setUrut(u => (u.kolom === kolom ? { kolom, naik: !u.naik } : { kolom, naik: kolom === 'kelas' }))

  const kolomTabel: { kolom: KolomUrut; label: string; kanan?: boolean }[] = [
    { kolom: 'kelas',     label: 'Kelas' },
    { kolom: 'siswa',     label: 'Siswa',          kanan: true },
    { kolom: 'pelunasan', label: 'Pelunasan',      kanan: true },
    { kolom: 'ketepatan', label: 'Tepat waktu',    kanan: true },
    { kolom: 'telat',     label: 'Rata-rata telat', kanan: true },
    { kolom: 'tunggakan', label: 'Tunggakan',      kanan: true },
    { kolom: 'menunggak', label: 'Siswa menunggak', kanan: true },
  ]

  const judul = `Jenjang ${jenjang}`

  return (
    <div className="dashboard-content">
      <HeaderLaporan
        judul={judul}
        subjudul={`${selectedFilter.label} · ${selectedFilter.sublabel}`}
        jejak={[{ label: 'Laporan', href: `/laporan${qsFilter}` }, { label: judul }]}
        kanan={!loading && <FilterLaporan filter={filter} activeTAId={activeTA?.id ?? null} />}
      />

      {loading ? (
        <div style={{ ...sBingkai, borderLeft: '28px solid #E2E8F0', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.875rem', minHeight: 220 }}>
          Memuat data...
        </div>
      ) : periodRows.length === 0 ? (
        <div style={{ ...sBingkai, alignItems: 'center', justifyContent: 'center', minHeight: 300, textAlign: 'center' }}>
          <Database size={48} strokeWidth={1.2} color="#CBD5E1" />
          <div style={{ fontWeight: 700, color: '#0F172A' }}>Belum ada tagihan {judul.toLowerCase()} pada periode ini</div>
          <Link href={`/laporan${qsFilter}`} style={{ fontSize: '0.85rem', color: '#3C75B7', fontWeight: 600 }}>Kembali ke laporan sekolah</Link>
        </div>
      ) : (
        <div style={sBingkai}>
          <KartuRingkasan ringkasan={ringkasan} pemasukan={pemasukan} />

          {/* Ranking kelas — perbandingan, bukan hanya tren (prinsip 2) */}
          <div style={sKartu}>
            <div style={sJudulPanel}>Perbandingan kelas</div>
            <div style={sSubjudulPanel}>Klik judul kolom untuk mengurutkan · klik kelas untuk melihat siswanya</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 720 }}>
                <thead>
                  <tr>
                    {kolomTabel.map(k => {
                      const aktif = urut.kolom === k.kolom
                      return (
                        <th key={k.kolom} aria-sort={aktif ? (urut.naik ? 'ascending' : 'descending') : 'none'}
                          style={{ textAlign: k.kanan ? 'right' : 'left', padding: '0.5rem 0.6rem', borderBottom: '1.5px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          <button onClick={() => gantiUrut(k.kolom)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.76rem', fontWeight: 700, color: aktif ? '#1A2C4E' : '#64748B', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {k.label}
                            {aktif && (urut.naik ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {perKelasUrut.map(b => {
                    const r = b.ringkasan
                    const href = `/laporan/kelas/${b.kelasId}${qsFilter}`
                    return (
                      <tr key={b.kelasId} className="laporan-baris-tautan" onClick={() => router.push(href)}
                        style={{ borderBottom: '1px solid #F1F5F9', fontVariantNumeric: 'tabular-nums' }}>
                        <td style={{ padding: '0.65rem 0.6rem' }}>
                          <Link href={href} onClick={e => e.stopPropagation()}
                            style={{ fontWeight: 700, color: '#1A2C4E', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {b.nama} <ChevronRight size={13} color="#94A3B8" />
                          </Link>
                        </td>
                        <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#374151' }}>{b.siswa}</td>
                        <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: '#0F172A' }}>{formatPersen(r.tingkatPelunasan)}</div>
                          {r.tingkatPelunasan !== null && (
                            <div style={{ fontSize: '0.7rem', color: '#6F788A' }}>Rp {formatRingkas(r.terbayarJatuhTempo)} / {formatRingkas(r.nilaiJatuhTempo)}</div>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: '#0F172A' }}>{formatPersen(r.ketepatanWaktu)}</div>
                          {r.ketepatanWaktu !== null && (
                            <div style={{ fontSize: '0.7rem', color: '#6F788A' }}>{r.jumlahTepatWaktu} dari {r.jumlahDinilai} tagihan</div>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#374151' }}>
                          {r.rataHariTelat === null ? '—' : `${Math.round(r.rataHariTelat)} hari`}
                        </td>
                        <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontWeight: 700, color: r.tunggakanBerjalan > 0 ? '#B91C1C' : '#0F172A' }}>
                          {fmt(r.tunggakanBerjalan)}
                        </td>
                        <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#374151' }}>
                          {r.siswaMenunggak} <span style={{ color: '#94A3B8' }}>/ {b.siswa}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tren jenjang — mengikuti tahun ajaran, tidak mengikuti periode */}
          <div style={{ ...sKartu, marginBottom: '1rem' }}>
            <div style={sJudulPanel}>Tagihan vs realisasi {judul.toLowerCase()}</div>
            <div style={{ ...sSubjudulPanel, marginBottom: '0.75rem' }}>
              {taArsipTerpilih
                ? `Per bulan jatuh tempo, 12 bulan terakhir ${taTerpilih?.nama} · tidak mengikuti filter periode`
                : 'Per bulan jatuh tempo, 12 bulan terakhir · tidak mengikuti filter periode'}
            </div>
            <TrenTagihanChart data={tren} />
          </div>
        </div>
      )}
    </div>
  )
}
