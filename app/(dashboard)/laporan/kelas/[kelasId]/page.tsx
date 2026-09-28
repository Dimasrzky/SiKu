'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { ArrowDown, ArrowUp, Database, GraduationCap } from 'lucide-react'
import {
  hitungRingkasan, hitungPemasukan, nilaiSiswa, URUTAN_STATUS_SISWA,
  type StatusSiswa, type PenilaianSiswa,
} from '@/lib/metrikLaporan'
import { formatRupiah as fmt, formatPersen } from '@/lib/formatLaporan'
import { tautanPengingatTunggakan, tunggakanSiswa } from '@/lib/pengingatTunggakan'
import { useDataLaporan, type TagihanLaporan } from '@/lib/useDataLaporan'
import { useFilterLaporan } from '@/lib/useFilterLaporan'
import { HeaderLaporan } from '@/components/laporan/HeaderLaporan'
import { FilterLaporan } from '@/components/laporan/FilterLaporan'
import { KartuRingkasan } from '@/components/laporan/KartuRingkasan'
import { HeatmapSiswa } from '@/components/laporan/HeatmapSiswa'
import { StatusSiswaBadge, STATUS_SISWA_UI } from '@/components/laporan/StatusSiswaBadge'
import { sKartu, sBingkai, sJudulPanel, sSubjudulPanel } from '@/components/laporan/gayaLaporan'

// Level Kelas drill-down (Draft Pengembangan Fitur Laporan, Prioritas 2):
// distribusi status siswa, heatmap siswa × bulan, daftar siswa yang bisa diurutkan
// dan disaring per status, serta pengingat per siswa. Siswa kelas ini dibaca dari
// snapshot tagihan.kelas_id — untuk tahun ajaran arsip, isinya siswa kelas ini
// pada tahun itu, meski sekarang mereka sudah naik kelas.

type KolomUrut = 'nama' | 'status' | 'ketepatan' | 'telat' | 'tunggakan'

interface BarisSiswa extends PenilaianSiswa {
  siswaId:  string
  nama:     string
  nis:      string | null
  noWa:     string | null
  namaWali: string
  isAlumni: boolean
  tagihan:  TagihanLaporan[]
  tunggakan: TagihanLaporan[]
}

const peringkatStatus = (s: StatusSiswa) => URUTAN_STATUS_SISWA.indexOf(s)
const sisa = (t: TagihanLaporan) => Math.max(0, t.total_nominal - t.terbayar)

// useSearchParams (lewat useFilterLaporan) wajib berada di bawah batas Suspense
export default function LaporanKelasPage() {
  return (
    <Suspense fallback={
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Memuat data...</div>
      </div>
    }>
      <LaporanKelasContent />
    </Suspense>
  )
}

function LaporanKelasContent() {
  const { kelasId } = useParams<{ kelasId: string }>()

  const { loading, rows, kelas, activeTA, archivedTAs, sekarang, namaSekolah } = useDataLaporan()
  const filter = useFilterLaporan(activeTA, archivedTAs, sekarang)
  const { selectedFilter, dalamPeriode, qsFilter } = filter

  const infoKelas = kelas.get(kelasId)
  const namaKelas = infoKelas?.nama ?? '—'
  const jenjang   = infoKelas?.jenjang ?? ''

  const [saring,   setSaring]   = useState<StatusSiswa | 'semua'>('semua')
  const [urut,     setUrut]     = useState<{ kolom: KolomUrut; naik: boolean }>({ kolom: 'status', naik: true })
  const [terkirim, setTerkirim] = useState<Set<string>>(new Set())

  const periodRows = useMemo(() => rows.filter(t => t.kelas_id === kelasId && dalamPeriode(t)), [rows, kelasId, dalamPeriode])
  const ringkasan  = useMemo(() => hitungRingkasan(periodRows, sekarang), [periodRows, sekarang])
  const pemasukan  = useMemo(() => hitungPemasukan(periodRows), [periodRows])

  // Penilaian per siswa memakai tagihan dalam filter — status yang sama dengan kartu di atas
  const perSiswa = useMemo<BarisSiswa[]>(() => {
    const grup = new Map<string, TagihanLaporan[]>()
    for (const t of periodRows) {
      const daftar = grup.get(t.siswa_id)
      if (daftar) daftar.push(t)
      else grup.set(t.siswa_id, [t])
    }
    return [...grup].map(([siswaId, daftar]) => {
      const s = daftar[0].siswa
      return {
        siswaId,
        nama:     s?.nama ?? '—',
        nis:      s?.nis ?? null,
        noWa:     s?.no_wa ?? null,
        namaWali: s?.nama_wali ?? '',
        isAlumni: daftar[0].is_alumni,
        tagihan:  daftar,
        ...nilaiSiswa(daftar, sekarang),
      }
    })
  }, [periodRows, sekarang])

  // Pengingat memuat SEMUA tunggakan siswa, dari tahun ajaran mana pun — orang tua
  // perlu tahu total kewajibannya, bukan hanya bagian yang masuk filter laporan
  const tagihanSemuaPerSiswa = useMemo(() => {
    const ids  = new Set(perSiswa.map(s => s.siswaId))
    const peta = new Map<string, TagihanLaporan[]>()
    for (const t of rows) {
      if (!ids.has(t.siswa_id)) continue
      const daftar = peta.get(t.siswa_id)
      if (daftar) daftar.push(t)
      else peta.set(t.siswa_id, [t])
    }
    return peta
  }, [rows, perSiswa])

  const distribusi = useMemo(() => {
    const jumlah: Record<StatusSiswa, number> = { tertunggak: 0, perlu_perhatian: 0, lancar: 0, belum_dinilai: 0 }
    for (const s of perSiswa) jumlah[s.status] += 1
    return jumlah
  }, [perSiswa])

  const siswaTampil = useMemo(() => {
    const arah = urut.naik ? 1 : -1
    const nilai = (s: BarisSiswa): number | string | null => {
      switch (urut.kolom) {
        case 'nama':      return s.nama
        case 'status':    return peringkatStatus(s.status)
        case 'ketepatan': return s.ringkasan.ketepatanWaktu
        case 'telat':     return s.ringkasan.rataHariTelat
        case 'tunggakan': return s.ringkasan.tunggakanBerjalan
      }
    }
    return perSiswa
      .filter(s => saring === 'semua' || s.status === saring)
      .sort((a, b) => {
        const va = nilai(a)
        const vb = nilai(b)
        if (va === null && vb !== null) return 1
        if (vb === null && va !== null) return -1
        const beda = va === null || vb === null ? 0
          : typeof va === 'string' ? va.localeCompare(vb as string, 'id') : va - (vb as number)
        // Seri: tunggakan terbesar dulu, lalu nama — supaya yang paling butuh perhatian naik
        return beda * arah || b.ringkasan.tunggakanBerjalan - a.ringkasan.tunggakanBerjalan || a.nama.localeCompare(b.nama, 'id')
      })
  }, [perSiswa, saring, urut])

  // Heatmap memakai bulan-bulan periode terpilih yang sudah datang
  const bulanHeatmap = useMemo(() => {
    const kini = sekarang.getFullYear() * 12 + sekarang.getMonth() + 1
    return selectedFilter.months.filter(m => m.tahun * 12 + m.bulan <= kini)
  }, [selectedFilter, sekarang])

  const barisHeatmap = useMemo(() => siswaTampil.map(s => ({
    siswaId:  s.siswaId,
    nama:     s.nama,
    nis:      s.nis,
    perBulan: new Map(s.tagihan.map(t => [`${t.tahun}-${t.bulan}`, t])),
  })), [siswaTampil])

  const gantiUrut = (kolom: KolomUrut) =>
    setUrut(u => (u.kolom === kolom ? { kolom, naik: !u.naik } : { kolom, naik: kolom === 'nama' || kolom === 'status' }))

  const kirimPengingat = (s: BarisSiswa) => {
    const tautan = tautanPengingatTunggakan({
      tagihan:   tagihanSemuaPerSiswa.get(s.siswaId) ?? [],
      sekarang,
      noWa:      s.noWa,
      namaWali:  s.namaWali,
      namaSiswa: s.nama,
      kelasNama: namaKelas,
      namaSekolah,
      origin:    window.location.origin,
    })
    if (!tautan) return
    window.open(tautan, '_blank', 'noopener,noreferrer')
    setTerkirim(prev => new Set(prev).add(s.siswaId))
  }

  const kolomTabel: { kolom: KolomUrut | null; label: string; kanan?: boolean }[] = [
    { kolom: 'nama',      label: 'Siswa' },
    { kolom: 'status',    label: 'Status' },
    { kolom: 'ketepatan', label: 'Tepat waktu',     kanan: true },
    { kolom: 'telat',     label: 'Rata-rata telat', kanan: true },
    { kolom: 'tunggakan', label: 'Tunggakan',       kanan: true },
    { kolom: null,        label: 'Pengingat',       kanan: true },
  ]

  const judul = `Kelas ${namaKelas}`

  return (
    <div className="dashboard-content">
      <HeaderLaporan
        judul={judul}
        subjudul={`${jenjang ? `Jenjang ${jenjang} · ` : ''}${selectedFilter.label} · ${selectedFilter.sublabel}`}
        jejak={[
          { label: 'Laporan', href: `/laporan${qsFilter}` },
          ...(jenjang ? [{ label: `Jenjang ${jenjang}`, href: `/laporan/jenjang/${encodeURIComponent(jenjang)}${qsFilter}` }] : []),
          { label: namaKelas },
        ]}
        kanan={!loading && <FilterLaporan filter={filter} activeTAId={activeTA?.id ?? null} />}
      />

      {loading ? (
        <div style={{ ...sBingkai, borderLeft: '28px solid #E2E8F0', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.875rem', minHeight: 220 }}>
          Memuat data...
        </div>
      ) : periodRows.length === 0 ? (
        <div style={{ ...sBingkai, alignItems: 'center', justifyContent: 'center', minHeight: 300, textAlign: 'center' }}>
          <Database size={48} strokeWidth={1.2} color="#CBD5E1" />
          <div style={{ fontWeight: 700, color: '#0F172A' }}>Belum ada tagihan kelas ini pada periode terpilih</div>
          <Link href={`/laporan${qsFilter}`} style={{ fontSize: '0.85rem', color: '#3C75B7', fontWeight: 600 }}>Kembali ke laporan sekolah</Link>
        </div>
      ) : (
        <div style={sBingkai}>
          <KartuRingkasan ringkasan={ringkasan} pemasukan={pemasukan} />

          {/* Distribusi status siswa — sekaligus penyaring heatmap dan daftar */}
          <div style={sKartu}>
            <div style={sJudulPanel}>Status siswa</div>
            <div style={sSubjudulPanel}>
              Tertunggak: ≥2 tagihan menunggak atau tunggakan &gt;60 hari · Lancar: tepat waktu ≥90% tanpa tunggakan · klik untuk menyaring
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
              {URUTAN_STATUS_SISWA.map(st => {
                const ui    = STATUS_SISWA_UI[st]
                const aktif = saring === st
                const n     = distribusi[st]
                return (
                  <button key={st} onClick={() => setSaring(aktif ? 'semua' : st)} aria-pressed={aktif}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      background: aktif ? ui.bg : '#fff', border: `1.5px solid ${aktif ? ui.solid : '#E2E8F0'}`, borderRadius: 10, padding: '0.75rem 0.9rem',
                    }}>
                    <span style={{ width: 34, height: 34, borderRadius: 8, background: ui.bg, color: ui.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ui.Ikon size={18} />
                    </span>
                    <span>
                      <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
                        {n} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6F788A' }}>siswa · {perSiswa.length > 0 ? Math.round((n / perSiswa.length) * 100) : 0}%</span>
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: ui.color }}>{ui.label}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Heatmap siswa × bulan — visual utama level kelas */}
          <div style={sKartu}>
            <div style={sJudulPanel}>Pola bayar per bulan</div>
            <div style={sSubjudulPanel}>
              {saring === 'semua' ? `${perSiswa.length} siswa` : `${siswaTampil.length} siswa ${STATUS_SISWA_UI[saring].label.toLowerCase()}`} · {selectedFilter.label} {selectedFilter.sublabel}
            </div>
            <HeatmapSiswa baris={barisHeatmap} bulan={bulanHeatmap} sekarang={sekarang} />
          </div>

          {/* Daftar siswa — juga versi tabel dari heatmap */}
          <div style={{ ...sKartu, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={sJudulPanel}>Daftar siswa</div>
              {saring !== 'semua' && (
                <button onClick={() => setSaring('semua')}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.78rem', fontWeight: 700, color: '#1D4ED8', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Tampilkan semua siswa
                </button>
              )}
            </div>
            <div style={sSubjudulPanel}>Klik nama untuk profil siswa · pengingat WA merangkum semua tunggakan siswa, termasuk dari tahun ajaran lain</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 760 }}>
                <thead>
                  <tr>
                    {kolomTabel.map(k => {
                      const aktif = k.kolom !== null && urut.kolom === k.kolom
                      return (
                        <th key={k.label} aria-sort={aktif ? (urut.naik ? 'ascending' : 'descending') : undefined}
                          style={{ textAlign: k.kanan ? 'right' : 'left', padding: '0.5rem 0.6rem', borderBottom: '1.5px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          {k.kolom === null ? (
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748B' }}>{k.label}</span>
                          ) : (
                            <button onClick={() => gantiUrut(k.kolom as KolomUrut)}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.76rem', fontWeight: 700, color: aktif ? '#1A2C4E' : '#64748B', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {k.label}
                              {aktif && (urut.naik ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                            </button>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {siswaTampil.map(s => {
                    const r = s.ringkasan
                    const semuaTunggakan = tunggakanSiswa(tagihanSemuaPerSiswa.get(s.siswaId) ?? [], sekarang)
                    const sudahKirim = terkirim.has(s.siswaId)
                    return (
                      <tr key={s.siswaId} style={{ borderBottom: '1px solid #F1F5F9', fontVariantNumeric: 'tabular-nums' }}>
                        <td style={{ padding: '0.65rem 0.6rem' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Link href={`/laporan/siswa/${s.siswaId}${qsFilter}`} style={{ color: '#1A2C4E', textDecoration: 'none' }}>
                              {s.nama}
                            </Link>
                            {s.isAlumni && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#EDE9FE', color: '#6D28D9', fontSize: '0.66rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                                <GraduationCap size={11} /> Alumni
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>NIS {s.nis ?? '—'}</div>
                        </td>
                        <td style={{ padding: '0.65rem 0.6rem' }}><StatusSiswaBadge status={s.status} /></td>
                        <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: '#0F172A' }}>{formatPersen(r.ketepatanWaktu)}</div>
                          {r.ketepatanWaktu !== null && <div style={{ fontSize: '0.7rem', color: '#6F788A' }}>{r.jumlahTepatWaktu} dari {r.jumlahDinilai}</div>}
                        </td>
                        <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#374151' }}>
                          {r.rataHariTelat === null ? '—' : `${Math.round(r.rataHariTelat)} hari`}
                        </td>
                        <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: r.tunggakanBerjalan > 0 ? '#B91C1C' : '#0F172A' }}>{fmt(r.tunggakanBerjalan)}</div>
                          {s.tunggakan.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#6F788A' }}>{s.tunggakan.length} bulan · tertua {s.umurTertuaHari} hari</div>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right' }}>
                          {semuaTunggakan.length === 0 ? (
                            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>—</span>
                          ) : !s.noWa ? (
                            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Tidak ada no. WA</span>
                          ) : (
                            <button onClick={() => kirimPengingat(s)}
                              title={`Total tunggakan ${fmt(semuaTunggakan.reduce((sum, t) => sum + sisa(t), 0))} · ${semuaTunggakan.length} bulan`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: sudahKirim ? '#BBF7D0' : '#DCFCE7', color: '#15803D', borderRadius: 8, padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                              <Image src="/icons/IconWA.png" width={16} height={16} alt="" />
                              {sudahKirim ? 'Dibuka' : 'Ingatkan'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
