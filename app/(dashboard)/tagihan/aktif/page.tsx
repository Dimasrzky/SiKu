'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

function detectSemester(
  ganjilMulai?:  string, ganjilSelesai?:  string,
  genapMulai?:   string, genapSelesai?:   string,
): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (ganjilMulai && ganjilSelesai) {
    const s = new Date(ganjilMulai); s.setHours(0, 0, 0, 0)
    const e = new Date(ganjilSelesai); e.setHours(23, 59, 59, 999)
    if (today >= s && today <= e) return 'Ganjil'
  }
  if (genapMulai && genapSelesai) {
    const s = new Date(genapMulai); s.setHours(0, 0, 0, 0)
    const e = new Date(genapSelesai); e.setHours(23, 59, 59, 999)
    if (today >= s && today <= e) return 'Genap'
  }
  return today.getMonth() + 1 >= 7 ? 'Ganjil' : 'Genap'
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TagihanRow {
  id:            string
  jenis:         string
  bulan:         string
  tahun:         number
  nominal:       number
  kelas_jenjang: string | null
  nama:          string | null
  jatuh_tempo:   string | null
  status:        'draft' | 'aktif' | 'selesai'
  total_siswa:   number
  sudah_bayar:   number
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  aktif:   { label: 'Aktif',   bg: '#FEF3C7', color: '#D97706' },
  selesai: { label: 'Selesai', bg: '#DCFCE7', color: '#15803D' },
  draft:   { label: 'Draft',   bg: '#F1F5F9', color: '#64748B' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TagihanAktifPage() {
  const [loading,      setLoading]      = useState(true)
  const [tahunAjaran,  setTahunAjaran]  = useState('')
  const [autoSemester, setAutoSemester] = useState('')
  const [tagihanList,  setTagihanList]  = useState<TagihanRow[]>([])
  const [filterBulan,  setFilterBulan]  = useState('Semua')
  const [filterStatus, setFilterStatus] = useState('Semua')

  useEffect(() => {
    ;(async () => {
      const [{ data: taData }, { data: rows }] = await Promise.all([
        supabase
          .from('tahun_ajaran')
          .select('nama, semester_ganjil_mulai, semester_ganjil_selesai, semester_genap_mulai, semester_genap_selesai')
          .eq('is_aktif', true)
          .maybeSingle(),
        supabase
          .from('tagihan')
          .select('id, jenis, bulan, tahun, nominal, kelas_jenjang, nama, jatuh_tempo, status, total_siswa, sudah_bayar')
          .order('tahun', { ascending: false })
          .order('bulan')
          .limit(200),
      ])

      type TaRow = {
        nama: string
        semester_ganjil_mulai:  string; semester_ganjil_selesai:  string
        semester_genap_mulai:   string; semester_genap_selesai:   string
      }
      const ta = taData as TaRow | null
      if (ta?.nama) setTahunAjaran(ta.nama)
      setAutoSemester(detectSemester(
        ta?.semester_ganjil_mulai, ta?.semester_ganjil_selesai,
        ta?.semester_genap_mulai,  ta?.semester_genap_selesai,
      ))

      setTagihanList((rows ?? []) as TagihanRow[])
      setLoading(false)
    })()
  }, [])

  const periodeOptions = ['Semua', ...Array.from(new Set(tagihanList.map(t => `${t.bulan} ${t.tahun}`)))]

  const filtered = tagihanList.filter(t =>
    (filterBulan  === 'Semua' || `${t.bulan} ${t.tahun}` === filterBulan) &&
    (filterStatus === 'Semua' || t.status === filterStatus)
  )

  const totalTarget    = filtered.reduce((s, t) => s + t.nominal * t.total_siswa, 0)
  const totalTerkumpul = filtered.reduce((s, t) => s + t.nominal * t.sudah_bayar, 0)
  const totalSiswa     = filtered.reduce((s, t) => s + t.total_siswa, 0)
  const totalLunas     = filtered.reduce((s, t) => s + t.sudah_bayar, 0)

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-content">

      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Tagihan Aktif</h1>
          <p className="dashboard-subtitle">
            {tahunAjaran ? `${tahunAjaran} · Semester ${autoSemester}` : 'Kelola tagihan per kelas per bulan'}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'TOTAL TARGET',  value: formatRp(totalTarget),               sub: `${filtered.length} tagihan`, border: 'var(--navy)', icon: '📋' },
          { label: 'TERKUMPUL',     value: formatRp(totalTerkumpul),             sub: 'Sudah masuk ke kas',         border: '#16A34A',     icon: '💰' },
          { label: 'SISWA LUNAS',   value: `${totalLunas}/${totalSiswa}`,        sub: 'Dari tagihan terpilih',      border: '#2563EB',     icon: '👥' },
          { label: 'SISA TAGIHAN',  value: formatRp(totalTarget - totalTerkumpul), sub: 'Belum terkumpul',          border: '#D97706',     icon: '⏳' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', borderLeft: `4px solid ${card.border}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>{card.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1.2 }}>{card.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{card.sub}</div>
            <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '2rem', opacity: 0.12 }}>{card.icon}</span>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
          style={{ ...sInput, width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.82rem', appearance: 'auto' }}>
          {periodeOptions.map(o => <option key={o}>{o}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ ...sInput, width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.82rem', appearance: 'auto' }}>
          {['Semua Status', 'aktif', 'selesai', 'draft'].map(o => (
            <option key={o} value={o === 'Semua Status' ? 'Semua' : o}>
              {o === 'aktif' ? 'Aktif' : o === 'selesai' ? 'Selesai' : o === 'draft' ? 'Draft' : o}
            </option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {filtered.length} tagihan
        </span>
      </div>

      {/* Table */}
      {tagihanList.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>Belum ada tagihan</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Tagihan akan tersedia setelah paket per kelas selesai dikonfigurasi.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th><th>PERIODE</th><th>JENIS</th><th>KELAS</th>
                <th>NOMINAL/SISWA</th><th>PROGRESS</th><th>JATUH TEMPO</th>
                <th>STATUS</th><th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">Tidak ada tagihan sesuai filter</td></tr>
              ) : filtered.map((t, idx) => {
                const pct     = t.total_siswa > 0 ? Math.round(t.sudah_bayar / t.total_siswa * 100) : 0
                const badge   = STATUS_BADGE[t.status] ?? STATUS_BADGE.draft
                const shortId = `T${String(idx + 1).padStart(3, '0')}`
                return (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)' }}>{shortId}</td>
                    <td style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.bulan} {t.tahun}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-mid)' }}>{t.jenis}{t.nama ? ` — ${t.nama}` : ''}</td>
                    <td>
                      {t.kelas_jenjang
                        ? <span style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Kelas {t.kelas_jenjang}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{formatRp(t.nominal)}</td>
                    <td style={{ minWidth: 160 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        {t.sudah_bayar}/{t.total_siswa} siswa ({pct}%)
                      </div>
                      <div style={{ background: '#F1F5F9', borderRadius: 100, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#16A34A' : '#1D4ED8', borderRadius: 100, transition: 'width 0.4s ease' }} />
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-mid)' }}>
                      {t.jatuh_tempo ? new Date(t.jatuh_tempo).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      <span style={{ background: badge.bg, color: badge.color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                        {badge.label}
                      </span>
                    </td>
                    <td>
                      <button style={{ background: '#EFF6FF', color: '#1D4ED8', border: 'none', borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Detail
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sInput: React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', outline: 'none', background: '#fff' }
