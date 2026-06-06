'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Pencil, Trash2, Users, BookOpen, GraduationCap, Award, Search, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { MOCK_USER, type Siswa, type StatusBayar } from '@/lib/mockData'
import { supabase } from '@/lib/supabase'
import { TagihanCard, type TagihanCardData, type JenisTagihan } from '@/components/TagihanCard'
import * as XLSX from 'xlsx-js-style'

const KELAS_OPTIONS = ['Semua Kelas','VII-A','VII-B','VII-C','VIII-A','VIII-B','VIII-C','IX-A','IX-B','IX-C']

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

// ─── Types ────────────────────────────────────────────────────────────────────

interface SiswaAdded {
  id: string
  nama: string
  nis: string
  kelas: string
  namaWali: string
  noWa: string
}

interface KelasOption {
  id: string
  nama: string
  jenjang: string
  warna: string
}

interface ImportRow {
  nama: string
  kelas: string
  namaWali: string
  noWa: string
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  const STEPS = [
    { n: 1, label: 'Identitas' },
    { n: 2, label: 'Tagihan' },
    { n: 3, label: 'Info Wali' },
  ]
  const items: React.ReactNode[] = []
  STEPS.forEach((s, i) => {
    items.push(
      <div key={s.n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.2s',
          background: s.n < step ? 'var(--emerald)' : s.n === step ? 'var(--navy)' : '#E2E8F0',
          color: s.n <= step ? '#fff' : '#94A3B8',
        }}>
          {s.n < step ? <Check size={14} /> : s.n}
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: s.n === step ? 700 : 400,
          color: s.n === step ? 'var(--navy)' : 'var(--text-muted)',
        }}>
          {s.label}
        </span>
      </div>
    )
    if (i < STEPS.length - 1) {
      items.push(
        <div key={`line-${s.n}`} style={{
          height: 2, width: 52, marginBottom: 18, transition: 'background 0.2s',
          background: s.n < step ? 'var(--emerald)' : '#E2E8F0',
        }} />
      )
    }
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.75rem' }}>
      {items}
    </div>
  )
}

// ─── 3-Step Tambah Siswa Wizard ───────────────────────────────────────────────

interface WizardProps {
  kelasOptions: KelasOption[]
  komponenTagihan: TagihanCardData[]
  sekolahId: string
  onSave: (siswa: SiswaAdded) => void
  onClose: () => void
}

function TambahSiswaWizard({ kelasOptions, komponenTagihan, sekolahId, onSave, onClose }: WizardProps) {
  const [step, setStep]                   = useState<1 | 2 | 3>(1)
  const [nama, setNama]                   = useState('')
  const [nis, setNis]                     = useState('')
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedTambahan, setSelectedTambahan] = useState<string[]>([])
  const [namaWali, setNamaWali]           = useState('')
  const [noWa, setNoWa]                   = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')
  const [successBanner, setSuccessBanner] = useState('')
  const [hasBeasiswa, setHasBeasiswa]     = useState(false)

  const selectedKelasOption  = kelasOptions.find(k => k.nama === selectedKelas)
  const jenjang              = selectedKelasOption?.jenjang ?? ''
  const wajibKomponen        = komponenTagihan.filter(c => c.jenis === 'wajib' && c.kelasJenjang === jenjang)
  const beasiswaKomponen     = komponenTagihan.filter(c => c.jenis === 'beasiswa')
  const nonBeasiswaKomponen  = komponenTagihan.filter(c => c.jenis !== 'wajib' && c.jenis !== 'beasiswa')

  const toggleTambahan = (id: string) =>
    setSelectedTambahan(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const goStep2 = () => {
    if (!nama.trim()) { setError('Nama siswa wajib diisi.'); return }
    if (!nis.trim()) { setError('NIS wajib diisi.'); return }
    if (!selectedKelas) { setError('Pilih kelas siswa.'); return }
    setError('')
    setStep(2)
  }

  const goStep3 = () => {
    setError('')
    setStep(3)
  }

  const handleSave = async () => {
    if (!namaWali.trim()) { setError('Nama wali murid wajib diisi.'); return }
    if (!noWa.trim()) { setError('Nomor WhatsApp wali wajib diisi.'); return }
    setSaving(true)
    setError('')

    const noWaClean = noWa.replace(/[^\d]/g, '').replace(/^0/, '62')

    const { data: inserted, error: saveError } = await supabase
      .from('siswa')
      .insert({
        sekolah_id: sekolahId,
        nama:       nama.trim(),
        nis:        nis.trim(),
        kelas:      selectedKelas,
        nama_wali:  namaWali.trim(),
        no_wa:      noWaClean,
        aktif:      true,
      })
      .select('id')
      .single()

    if (saveError || !inserted) {
      setError('Gagal menyimpan: ' + (saveError?.message ?? 'Tidak ada data kembali'))
      setSaving(false)
      return
    }

    onSave({ id: inserted.id, nama: nama.trim(), nis: nis.trim(), kelas: selectedKelas, namaWali: namaWali.trim(), noWa: noWaClean })

    // Tampilkan success banner lalu reset ke step 1
    const savedNama = nama.trim()
    setSuccessBanner(savedNama)
    setTimeout(() => setSuccessBanner(''), 5000)

    setStep(1)
    setNama('')
    setNis('')
    setSelectedKelas('')
    setSelectedTambahan([])
    setHasBeasiswa(false)
    setNamaWali('')
    setNoWa('')
    setSaving(false)
  }

  const JENIS_COLOR: Record<JenisTagihan, string> = {
    wajib: 'var(--navy)', beasiswa: '#B45309', ekskul: '#047857', aktivitas: '#7C3AED',
  }
  const JENIS_LABEL: Record<JenisTagihan, string> = {
    wajib: 'Tagihan Wajib', beasiswa: 'Beasiswa', ekskul: 'Ekskul', aktivitas: 'Aktivitas',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, maxWidth: 540 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-serif,Georgia,serif)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
            Tambah Siswa Baru
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Step indicator */}
        <StepDots step={step} />

        {/* Success banner */}
        {successBanner && (
          <div style={{
            background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8,
            padding: '0.6rem 0.875rem', marginBottom: '1.25rem',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: '0.82rem', color: '#15803D', fontWeight: 600,
          }}>
            <Check size={14} />
            <strong>{successBanner}</strong> berhasil ditambahkan! Formulir sudah direset — silahkan tambahkan siswa berikutnya.
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>
        )}

        {/* ─── STEP 1 : Identitas ─────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Nama Lengkap Siswa <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  type="text"
                  placeholder="cth: Ahmad Fauzi"
                  value={nama}
                  onChange={e => setNama(e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div style={{ width: 130 }}>
                <label style={labelStyle}>NIS <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="cth: 2401001"
                  value={nis}
                  onChange={e => setNis(e.target.value.replace(/\D/g, ''))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Kelas yang Ditetapkan <span style={{ color: '#EF4444' }}>*</span></label>

              {kelasOptions.length === 0 ? (
                <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.75rem', fontSize: '0.82rem', color: '#92400E' }}>
                  ⚠️ Belum ada kelas. Selesaikan setup <strong>Kelas &amp; Tahun Ajaran</strong> terlebih dahulu.
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                    background: selectedKelasOption?.warna ?? '#CBD5E1',
                    transition: 'background 0.2s',
                    border: '1.5px solid rgba(0,0,0,0.08)',
                  }} />
                  <select
                    value={selectedKelas}
                    onChange={e => setSelectedKelas(e.target.value)}
                    style={{ ...inputStyle, appearance: 'auto' }}
                  >
                    <option value="">— Pilih Kelas —</option>
                    {kelasOptions.map(k => (
                      <option key={k.id} value={k.nama}>{k.nama}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedKelasOption && (
                <p style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Jenjang: <strong>{selectedKelasOption.jenjang}</strong>
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={btnSecondary}>Batal</button>
              <button
                onClick={goStep2}
                disabled={!nama.trim() || !selectedKelas}
                style={{ ...btnPrimary, opacity: (!nama.trim() || !selectedKelas) ? 0.5 : 1 }}
              >
                Lanjut →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2 : Tagihan ───────────────────────────────────── */}
        {step === 2 && (
          <div>
            {/* Tagihan Wajib — read-only validation */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-dark)' }}>Tagihan Wajib</span>
                <span style={{
                  background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.68rem',
                  fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                }}>
                  otomatis
                </span>
              </div>

              {wajibKomponen.length === 0 ? (
                <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.75rem', fontSize: '0.82rem', color: '#92400E' }}>
                  ⚠️ Belum ada komponen tagihan wajib untuk jenjang <strong>{jenjang || selectedKelas}</strong>.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {wajibKomponen.map(c => (
                    <TagihanCard key={c.id} card={c} readonly />
                  ))}
                </div>
              )}

              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Check size={12} color="var(--emerald)" />
                Siswa ini otomatis mendapatkan tagihan wajib di atas
              </div>
            </div>

            {/* ── Toggle Beasiswa — standalone ── */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{
                border: `1.5px solid ${hasBeasiswa ? '#B45309' : 'var(--border)'}`,
                borderRadius: 10, padding: '0.875rem 1rem',
                background: hasBeasiswa ? '#FFFBEB' : '#fff', transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                      Apakah siswa ini memiliki beasiswa?
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Aktifkan jika siswa mendapat keringanan biaya dari program beasiswa
                    </div>
                  </div>
                  {/* Toggle pill */}
                  <button
                    type="button"
                    onClick={() => {
                      if (hasBeasiswa) {
                        setSelectedTambahan(prev => prev.filter(id => !beasiswaKomponen.some(c => c.id === id)))
                      }
                      setHasBeasiswa(prev => !prev)
                    }}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none',
                      background: hasBeasiswa ? '#B45309' : '#CBD5E1',
                      cursor: 'pointer', position: 'relative', flexShrink: 0,
                      transition: 'background 0.2s', padding: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3,
                      left: hasBeasiswa ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>

                {/* Checklist beasiswa — muncul saat toggle ON */}
                {hasBeasiswa && (
                  <div style={{ marginTop: '0.875rem', borderTop: '1px solid #FDE68A', paddingTop: '0.75rem' }}>
                    {beasiswaKomponen.length === 0 ? (
                      <div style={{ fontSize: '0.82rem', color: '#92400E' }}>
                        Belum ada program beasiswa yang dikonfigurasi.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {beasiswaKomponen.map(c => {
                          const isSelected = selectedTambahan.includes(c.id)
                          const total      = c.items.reduce((s, item) => s + item.nominal, 0)
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleTambahan(c.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.6rem 0.875rem', borderRadius: 8,
                                border: `2px solid ${isSelected ? '#B45309' : '#FDE68A'}`,
                                background: isSelected ? '#B4530912' : '#fff',
                                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                                transition: 'all 0.15s', width: '100%',
                              }}
                            >
                              <div style={{
                                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                                border: `2px solid ${isSelected ? '#B45309' : '#CBD5E1'}`,
                                background: isSelected ? '#B45309' : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}>
                                {isSelected && <Check size={11} color="#fff" />}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                                  {c.nama ?? 'Beasiswa'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#B45309', marginTop: 1 }}>
                                  Beasiswa · {c.items.length} item
                                </div>
                              </div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? '#B45309' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                – {formatRp(total)}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tagihan Tambahan — hanya ekskul & aktivitas */}
            {nonBeasiswaKomponen.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.75rem' }}>
                  Tagihan Tambahan
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 6 }}>
                    (opsional — pilih yang berlaku)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {nonBeasiswaKomponen.map(c => {
                    const isSelected = selectedTambahan.includes(c.id)
                    const color      = JENIS_COLOR[c.jenis]
                    const label      = JENIS_LABEL[c.jenis]
                    const total      = c.items.reduce((s, item) => s + item.nominal, 0)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleTambahan(c.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.65rem 0.875rem', borderRadius: 10,
                          border: `2px solid ${isSelected ? color : 'var(--border)'}`,
                          background: isSelected ? `${color}12` : '#fff',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          transition: 'all 0.15s', width: '100%',
                        }}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          border: `2px solid ${isSelected ? color : '#CBD5E1'}`,
                          background: isSelected ? color : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {isSelected && <Check size={11} color="#fff" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                            {c.nama ?? label}
                          </div>
                          <div style={{ fontSize: '0.72rem', color, marginTop: 1 }}>
                            {label} · {c.items.length} item
                          </div>
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? color : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatRp(total)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setStep(1); setError('') }} style={btnSecondary}>← Kembali</button>
              <button onClick={goStep3} style={btnPrimary}>Lanjut →</button>
            </div>
          </div>
        )}

        {/* ─── STEP 3 : Info Wali ─────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Nama Orang Tua / Wali Murid <span style={{ color: '#EF4444' }}>*</span></label>
              <input
                type="text"
                placeholder="cth: Bapak Ahmad Fauzi"
                value={namaWali}
                onChange={e => setNamaWali(e.target.value)}
                style={inputStyle}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>No. WhatsApp Wali <span style={{ color: '#EF4444' }}>*</span></label>
              <input
                type="text"
                placeholder="cth: 08123456789"
                value={noWa}
                onChange={e => setNoWa(e.target.value)}
                style={inputStyle}
              />
              <p style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Digunakan untuk pengiriman notifikasi tagihan via WhatsApp
              </p>
            </div>

            {/* Ringkasan */}
            <div style={{ background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
                RINGKASAN DATA SISWA
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[
                  { label: 'Nama', value: nama },
                  { label: 'NIS', value: nis },
                  { label: 'Kelas', value: selectedKelas },
                  { label: 'Tagihan Wajib', value: wajibKomponen.length > 0 ? `${wajibKomponen.length} komponen` : 'Belum ada' },
                  { label: 'Tagihan Tambahan', value: selectedTambahan.length > 0 ? `${selectedTambahan.length} dipilih` : 'Tidak ada' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setStep(2); setError('') }} style={btnSecondary}>← Kembali</button>
              <button
                onClick={handleSave}
                disabled={saving || !namaWali.trim() || !noWa.trim()}
                style={{ ...btnPrimary, opacity: (saving || !namaWali.trim() || !noWa.trim()) ? 0.6 : 1 }}
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Import Excel Modal ───────────────────────────────────────────────────────

interface ImportModalProps {
  sekolahId: string
  onImport: (count: number) => void
  onClose: () => void
}

function ImportExcelModal({ sekolahId, onImport, onClose }: ImportModalProps) {
  const [preview, setPreview]     = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError]         = useState('')
  const [dragging, setDragging]   = useState(false)
  const fileRef                   = useRef<HTMLInputElement>(null)

  const parseFile = async (file: File) => {
    setError('')
    try {
      const buffer = await file.arrayBuffer()
      const wb     = XLSX.read(buffer)
      const ws     = wb.Sheets[wb.SheetNames[0]]
      const rows   = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      const parsed: ImportRow[] = rows
        .map(row => {
          const vals = Object.values(row).map(v => String(v).trim())
          return {
            nama:      String(row['Nama Lengkap'] || row['Nama'] || row['NAMA'] || vals[0] || '').trim(),
            kelas:     String(row['Kelas'] || row['KELAS'] || vals[1] || '').trim(),
            namaWali:  String(row['Nama Wali'] || row['NAMA WALI'] || row['Nama Orang Tua'] || vals[2] || '').trim(),
            noWa:      String(row['No. WA'] || row['No WA'] || row['NO WA'] || row['WhatsApp'] || vals[3] || '').trim(),
          }
        })
        .filter(r => r.nama)

      setPreview(parsed)
    } catch {
      setError('Gagal membaca file. Pastikan format .xlsx atau .xls yang valid.')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) parseFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) parseFile(f)
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nama Lengkap', 'Kelas', 'Nama Wali', 'No. WA'],
      ['Ahmad Fauzi', 'VII-A', 'Bapak Fauzi', '08123456789'],
      ['Siti Aminah', 'VIII-B', 'Ibu Aminah', '08234567890'],
    ])
    ws['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 22 }, { wch: 15 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa')
    XLSX.writeFile(wb, 'Template Import Siswa.xlsx')
  }

  const handleConfirm = async () => {
    if (preview.length === 0) return
    setImporting(true)
    setError('')

    const year = new Date().getFullYear()
    const rows = preview.map((r, i) => ({
      sekolah_id: sekolahId,
      nama:       r.nama,
      nis:        `${year}${String(Date.now() + i).slice(-5)}`,
      kelas:      r.kelas,
      nama_wali:  r.namaWali,
      no_wa:      r.noWa.replace(/[^\d]/g, '').replace(/^0/, '62'),
      aktif:      true,
    }))

    const { error: insertError } = await supabase.from('siswa').insert(rows)
    if (insertError) {
      setError('Gagal import: ' + insertError.message)
      setImporting(false)
      return
    }

    onImport(rows.length)
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, maxWidth: 600 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-serif,Georgia,serif)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
            Import Data Siswa via Excel
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Download template */}
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1D4ED8', marginBottom: 2 }}>Download Template</div>
            <div style={{ fontSize: '0.75rem', color: '#3B82F6' }}>File .xlsx dengan 4 kolom: Nama Lengkap, Kelas, Nama Wali, No. WA</div>
          </div>
          <button onClick={downloadTemplate} style={{ background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 7, padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            ↓ Template
          </button>
        </div>

        {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Upload area */}
        {preview.length === 0 ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--navy)' : 'var(--border)'}`,
              borderRadius: 12, padding: '3rem 2rem', textAlign: 'center',
              cursor: 'pointer', background: dragging ? '#EFF6FF' : '#FAFBFC',
              transition: 'all 0.2s', marginBottom: '1.25rem',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
            <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.35rem' }}>
              Seret file ke sini atau klik untuk memilih
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Format yang didukung: .xlsx, .xls
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} style={{ display: 'none' }} />
          </div>
        ) : (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                Preview — {preview.length} siswa akan diimport
              </div>
              <button
                onClick={() => { setPreview([]); if (fileRef.current) fileRef.current.value = '' }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit' }}
              >
                ✕ Ganti File
              </button>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                    {['No', 'Nama Lengkap', 'Kelas', 'Nama Wali', 'No. WA'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>{r.nama || <span style={{ color: '#EF4444' }}>—</span>}</td>
                      <td style={{ padding: '0.45rem 0.75rem' }}>{r.kelas || '—'}</td>
                      <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>{r.namaWali || '—'}</td>
                      <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.noWa || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Batal</button>
          {preview.length > 0 && (
            <button
              onClick={handleConfirm}
              disabled={importing}
              style={{ ...btnPrimary, background: '#16A34A', opacity: importing ? 0.6 : 1 }}
            >
              {importing ? 'Mengimpor...' : `✓ Import ${preview.length} Siswa`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal Edit Siswa ─────────────────────────────────────────────────────────

function EditSiswaModal({ siswa, onClose }: { siswa: Siswa; onClose: () => void }) {
  const [saved, setSaved] = useState(false)

  if (saved) return (
    <div style={overlay}>
      <div style={modalBox}>
        <div style={{ textAlign:'center', padding:'1rem' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
          <div style={{ fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.2rem', fontWeight:700, color:'var(--navy-dark)', marginBottom:'0.5rem' }}>
            Data Berhasil Diperbarui!
          </div>
          <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1.5rem' }}>
            Perubahan data siswa tersimpan (demo).
          </p>
          <button onClick={onClose} style={btnPrimary}>Tutup</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalBox}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <h2 style={{ fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.2rem', fontWeight:700, color:'var(--navy-dark)' }}>
            Edit Data Siswa
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
          {[
            { label:'Nama Lengkap', placeholder:'cth: Ahmad Fauzi', defaultValue: siswa.nama, required:true },
            { label:'NIS', placeholder:'cth: 2401021', defaultValue: siswa.nis, required:true },
            { label:'Nama Wali Murid', placeholder:'cth: Bapak Fauzi', defaultValue: siswa.namaWali, required:true },
            { label:'No. WhatsApp Wali', placeholder:'cth: 08123456789', defaultValue: siswa.noWa, required:true },
          ].map((f) => (
            <div key={f.label}>
              <label style={labelStyle}>{f.label} {f.required && <span style={{ color:'#EF4444' }}>*</span>}</label>
              <input type="text" placeholder={f.placeholder} defaultValue={f.defaultValue} style={inputStyle} />
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'1rem' }}>
          <div>
            <label style={labelStyle}>Kelas <span style={{ color:'#EF4444' }}>*</span></label>
            <select style={{ ...inputStyle, appearance: 'auto' }} defaultValue={siswa.kelas}>
              {['VII-A','VII-B','VII-C','VIII-A','VIII-B','VIII-C','IX-A','IX-B','IX-C'].map(k=>(
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Nominal SPP</label>
            <select style={{ ...inputStyle, appearance: 'auto' }}>
              <option>Rp 450.000 (Kelas VII)</option>
              <option>Rp 475.000 (Kelas VIII)</option>
              <option>Rp 500.000 (Kelas IX)</option>
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:'0.75rem', marginTop:'1.5rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Batal</button>
          <button onClick={() => setSaved(true)} style={btnPrimary}>Simpan Perubahan</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Konfirmasi Hapus ───────────────────────────────────────────────────

function HapusSiswaModal({ siswa, onClose, onConfirm }: { siswa: Siswa; onClose: () => void; onConfirm: () => void }) {
  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, maxWidth:420 }}>
        <div style={{ textAlign:'center', padding:'0.5rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🗑️</div>
          <h2 style={{ fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.1rem', fontWeight:700, color:'var(--navy-dark)', marginBottom:'0.5rem' }}>
            Hapus Data Siswa?
          </h2>
          <p style={{ fontSize:'0.875rem', color:'var(--text-muted)', marginBottom:'1.5rem', lineHeight:1.6 }}>
            Anda akan menghapus data <strong>{siswa.nama}</strong> ({siswa.nis}).
            Tindakan ini tidak dapat dibatalkan.
          </p>
          <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center' }}>
            <button onClick={onClose} style={btnSecondary}>Batal</button>
            <button onClick={onConfirm} style={{ ...btnPrimary, background:'#DC2626', borderColor:'#DC2626' }}>
              Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SiswaPage() {
  const router = useRouter()

  // Normal mode state
  const [search, setSearch]           = useState('')
  const [kelas, setKelas]             = useState('Semua Kelas')
  const [showModal, setShowModal]     = useState(false)
  const [editSiswa, setEditSiswa]     = useState<Siswa | null>(null)
  const [deleteSiswa, setDeleteSiswa] = useState<Siswa | null>(null)
  const [siswaList, setSiswaList]     = useState<Siswa[]>([])

  // Setup mode state
  const [setupMode, setSetupMode]           = useState<'loading' | 'setup' | 'normal'>('loading')
  const [sekolahId, setSekolahId]           = useState('')
  const [kelasOptions, setKelasOptions]     = useState<KelasOption[]>([])
  const [komponenTagihan, setKomponenTagihan] = useState<TagihanCardData[]>([])
  const [addedSiswa, setAddedSiswa]         = useState<SiswaAdded[]>([])
  const [importedCount, setImportedCount]   = useState(0)
  const [showWizard, setShowWizard]         = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    async function checkSetup() {
      const [{ data: peng }, { data: kData }, { data: kompData }] = await Promise.all([
        supabase.from('pengaturan').select('sekolah_id, setup_steps').maybeSingle(),
        supabase.from('kelas').select('id, nama, jenjang, warna').order('jenjang'),
        supabase
          .from('komponen_tagihan')
          .select('id, jenis, nama, kelas_jenjang, kelas_warna, kelas_jumlah, kelas_ref, scope, komponen_tagihan_item(id, nama, nominal, urutan)')
          .order('created_at'),
      ])

      const steps = (peng?.setup_steps ?? {}) as Record<string, boolean>

      if (peng?.sekolah_id) setSekolahId(peng.sekolah_id)

      // Load kelas options (always)
      setKelasOptions((kData ?? []) as KelasOption[])

      // Load komponen tagihan (always, for wizard step 2)
      type KompRow = {
        id: string; jenis: string; nama: string | null
        kelas_jenjang: string | null; kelas_warna: string | null
        kelas_jumlah: number | null; kelas_ref: string | null
        scope: string | null
        komponen_tagihan_item: { id: string; nama: string; nominal: number; urutan: number }[]
      }
      const cards: TagihanCardData[] = ((kompData ?? []) as KompRow[]).map(row => ({
        id:           row.id,
        jenis:        row.jenis as JenisTagihan,
        nama:         row.nama         ?? undefined,
        kelasJenjang: row.kelas_jenjang ?? undefined,
        kelasWarna:   row.kelas_warna   ?? undefined,
        kelasJumlah:  row.kelas_jumlah  ?? undefined,
        kelasRef:     row.kelas_ref     ?? undefined,
        scope:        (row.scope as 'semua' | 'perorangan' | null) ?? undefined,
        items: (row.komponen_tagihan_item ?? [])
          .sort((a, b) => a.urutan - b.urutan)
          .map(item => ({ id: item.id, nama: item.nama, nominal: item.nominal })),
      }))
      setKomponenTagihan(cards)

      const isNormal = steps.import_siswa === true

      if (isNormal) {
        const { data: siswaData } = await supabase
          .from('siswa')
          .select('id, nama, nis, kelas, nama_wali, no_wa, aktif')
          .eq('aktif', true)
          .order('nama')
          .limit(500)

        if (siswaData && siswaData.length > 0) {
          type SiswaRow = { id: string; nama: string; nis: string; kelas: string; nama_wali: string; no_wa: string; aktif: boolean }
          setSiswaList((siswaData as SiswaRow[]).map(s => ({
            id:           s.id,
            nama:         s.nama,
            nis:          s.nis,
            kelas:        s.kelas,
            noWa:         s.no_wa,
            namaWali:     s.nama_wali,
            nominal:      0,
            status:       'belum' as StatusBayar,
            tanggalBayar: null,
            aktif:        s.aktif,
          })))
        }
      }

      setSetupMode(isNormal ? 'normal' : 'setup')
    }
    checkSetup()
  }, [])

  // ── Computed (normal mode) ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return siswaList.filter(s =>
      (s.nama.toLowerCase().includes(q) || s.nis.includes(search)) &&
      (kelas === 'Semua Kelas' || s.kelas === kelas)
    )
  }, [search, kelas, siswaList])

  const sendWA = (nama: string, noWa: string) => {
    const msg = encodeURIComponent(`Halo Wali Murid ${nama}, kami dari ${MOCK_USER.sekolah} menghubungi Anda terkait data siswa. Terima kasih.`)
    window.open(`https://wa.me/${noWa}?text=${msg}`, '_blank')
  }

  const handleDelete = async (siswa: Siswa) => {
    await supabase.from('siswa').delete().eq('id', siswa.id)
    setSiswaList(prev => prev.filter(s => s.id !== siswa.id))
    setDeleteSiswa(null)
  }

  const exportExcel = () => {
    const headers = ['No', 'NIS', 'Nama Siswa', 'Kelas', 'Nama Wali', 'No. WA']
    const rows = filtered.map((s, i) => [i + 1, s.nis, s.nama, s.kelas, s.namaWali, s.noWa])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 26 }, { wch: 8 }, { wch: 22 }, { wch: 17 }]
    const headerStyle = {
      fill:      { fgColor: { rgb: 'BFDBFE' } },
      font:      { bold: true, color: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    { bottom: { style: 'medium', color: { rgb: '93C5FD' } } },
    }
    headers.forEach((_, ci) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: ci })
      if (!ws[addr]) ws[addr] = {}
      ws[addr].s = headerStyle
    })
    rows.forEach((_, ri) => {
      const isEven = (ri + 1) % 2 === 0
      headers.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
        if (!ws[addr]) ws[addr] = {}
        ws[addr].s = {
          alignment: { horizontal: 'center', vertical: 'center' },
          ...(isEven ? { fill: { fgColor: { rgb: 'EFF6FF' } } } : {}),
        }
      })
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa')
    XLSX.writeFile(wb, `Rekap Siswa ${MOCK_USER.sekolah}.xlsx`)
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (setupMode === 'loading') {
    return (
      <div className="dashboard-content">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Memuat data...</span>
        </div>
      </div>
    )
  }

  // ── SETUP MODE ──────────────────────────────────────────────────────────────

  if (setupMode === 'setup') {
    const totalAdded = addedSiswa.length + importedCount
    return (
      <div className="dashboard-content">

        {showWizard && (
          <TambahSiswaWizard
            kelasOptions={kelasOptions}
            komponenTagihan={komponenTagihan}
            sekolahId={sekolahId}
            onSave={s => setAddedSiswa(prev => [s, ...prev])}
            onClose={() => setShowWizard(false)}
          />
        )}

        {showImportModal && (
          <ImportExcelModal
            sekolahId={sekolahId}
            onImport={count => { setImportedCount(prev => prev + count); setShowImportModal(false) }}
            onClose={() => setShowImportModal(false)}
          />
        )}

        {/* Header */}
        <div className="dashboard-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{
                background: 'var(--navy)', color: '#fff', fontSize: '0.68rem',
                fontWeight: 700, padding: '2px 10px', borderRadius: 20, letterSpacing: '0.05em',
              }}>
                SETUP MODE
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Langkah 4 dari 4</span>
            </div>
            <h1 className="dashboard-title">Import Data Siswa</h1>
            <p className="dashboard-subtitle">Tambahkan data siswa satu per satu atau impor massal via Excel</p>
          </div>
          {totalAdded > 0 && (
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                background: 'var(--emerald)', color: '#fff', border: 'none',
                padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Check size={15} /> Selesai &amp; Lihat Dashboard
            </button>
          )}
        </div>

        {/* Import success banner */}
        {importedCount > 0 && (
          <div style={{
            background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 10,
            padding: '0.875rem 1.25rem', marginBottom: '1.25rem',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.875rem',
          }}>
            <Check size={16} color="#15803D" />
            <span style={{ color: '#15803D', fontWeight: 600 }}>
              {importedCount} siswa berhasil diimport dari Excel!
            </span>
          </div>
        )}

        {/* Action cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Tambah Manual */}
          <div style={{
            background: '#fff', border: '2px solid var(--border)',
            borderRadius: 14, padding: '1.5rem',
            transition: 'border-color 0.15s', cursor: 'default',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📝</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.35rem' }}>
              Tambah Manual
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              Isi data siswa satu per satu menggunakan formulir langkah demi langkah — nama, kelas, tagihan, info wali.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.55rem 1.25rem' }}
            >
              + Tambah Siswa
            </button>
          </div>

          {/* Import Excel */}
          <div style={{
            background: '#fff', border: '2px solid var(--border)',
            borderRadius: 14, padding: '1.5rem',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📊</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.35rem' }}>
              Import Excel
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              Upload file .xlsx untuk mengimpor banyak siswa sekaligus. Download template terlebih dahulu.
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                background: '#16A34A', color: '#fff', border: 'none',
                padding: '0.55rem 1.25rem', borderRadius: 8, fontWeight: 700,
                fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ↑ Upload File
            </button>
          </div>
        </div>

        {/* Daftar siswa yang sudah ditambahkan */}
        {addedSiswa.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem 2rem',
            background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👥</div>
            <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.35rem' }}>
              Belum ada siswa ditambahkan
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Gunakan salah satu pilihan di atas untuk mulai mengisi data siswa.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              {addedSiswa.length} siswa ditambahkan sesi ini
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No</th><th>Nama Siswa</th><th>Kelas</th><th>Nama Wali</th>
                  </tr>
                </thead>
                <tbody>
                  {addedSiswa.map((s, i) => (
                    <tr key={i}>
                      <td className="td-no">{i + 1}</td>
                      <td className="td-nama">{s.nama}</td>
                      <td><span className="kelas-pill">{s.kelas}</span></td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{s.namaWali}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={btnSecondary}
          >
            ← Kembali ke Dashboard
          </button>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {totalAdded > 0
              ? `${totalAdded} siswa berhasil ditambahkan — klik Selesai untuk melanjutkan`
              : 'Tambahkan minimal 1 siswa untuk menyelesaikan setup'
            }
          </p>
        </div>
      </div>
    )
  }

  // ── NORMAL MODE ─────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-content">
      {showModal    && <TambahSiswaWizard kelasOptions={kelasOptions} komponenTagihan={komponenTagihan} sekolahId={sekolahId} onSave={s => setSiswaList(prev => [{ id: s.id, nama: s.nama, nis: s.nis, kelas: s.kelas, namaWali: s.namaWali, noWa: s.noWa, nominal: 0, status: 'belum' as StatusBayar, tanggalBayar: null, aktif: true }, ...prev])} onClose={() => setShowModal(false)} />}
      {editSiswa    && <EditSiswaModal   siswa={editSiswa}   onClose={() => setEditSiswa(null)} />}
      {deleteSiswa  && <HapusSiswaModal  siswa={deleteSiswa} onClose={() => setDeleteSiswa(null)} onConfirm={() => handleDelete(deleteSiswa)} />}

      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Data Siswa</h1>
          <p className="dashboard-subtitle">Total {siswaList.length} siswa terdaftar aktif</p>
        </div>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button className="btn-export btn-export--success" onClick={exportExcel}>
            ↓ Export Excel
          </button>
          <button
            className="btn-export"
            style={{ background:'var(--navy)', color:'#fff', borderColor:'var(--navy)' }}
            onClick={() => setShowModal(true)}
          >
            + Tambah Siswa
          </button>
        </div>
      </div>

      {/* Stats ringkas */}
      <div className="stats-grid" style={{ marginBottom:'1.25rem' }}>
        {[
          { label:'Total Siswa',  value: siswaList.length,                                          sub:'Aktif semua jenjang', cls:'',                 icon: Users         },
          { label:'Kelas VII',    value: siswaList.filter(s=>s.kelas.startsWith('VII-')).length,    sub:'3 kelas',             cls:'stat-card-info',    icon: BookOpen      },
          { label:'Kelas VIII',   value: siswaList.filter(s=>s.kelas.startsWith('VIII-')).length,   sub:'3 kelas',             cls:'stat-card-success', icon: GraduationCap },
          { label:'Kelas IX',     value: siswaList.filter(s=>s.kelas.startsWith('IX-')).length,     sub:'3 kelas',             cls:'stat-card-warning', icon: Award         },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-card-label">{s.label}</div>
            <div className="stat-card-value">{s.value}</div>
            <div className="stat-card-sub">{s.sub}</div>
            <s.icon className="stat-card-bg-icon" />
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <div className="filter-search-wrap">
          <span className="filter-search-icon"><Search size={15} /></span>
          <input className="filter-search" placeholder="Cari nama siswa atau NIS..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={kelas} onChange={e=>setKelas(e.target.value)}>
          {KELAS_OPTIONS.map(k=><option key={k}>{k}</option>)}
        </select>
        <div className="filter-count">{filtered.length} siswa</div>
      </div>

      {/* Tabel */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th><th>NIS</th><th>Nama Siswa</th><th>Nama Wali</th>
              <th>Kelas</th><th className="th-aksi">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id}>
                <td className="td-no">{i+1}</td>
                <td className="td-nis">{s.nis}</td>
                <td className="td-nama">{s.nama}</td>
                <td style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{s.namaWali}</td>
                <td><span className="kelas-pill">{s.kelas}</span></td>
                <td className="td-aksi">
                  <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                    <button className="btn-wa" onClick={() => sendWA(s.nama, s.noWa)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WA
                    </button>
                    <button className="btn-edit" onClick={() => setEditSiswa(s)}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn-hapus" onClick={() => setDeleteSiswa(s)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Style helpers ─────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem',
}
const modalBox: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: '2rem', width: '100%',
  maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600,
  color: 'var(--text-mid)', marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid var(--border)',
  borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem',
  color: 'var(--text-dark)', outline: 'none', background: '#fff', appearance: 'auto',
  boxSizing: 'border-box',
}
const btnPrimary: React.CSSProperties = {
  background: 'var(--navy)', color: '#fff', border: 'none',
  padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700,
  fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
}
const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: 'var(--navy)',
  border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem',
  borderRadius: 8, fontWeight: 600, fontSize: '0.875rem',
  cursor: 'pointer', fontFamily: 'inherit',
}
