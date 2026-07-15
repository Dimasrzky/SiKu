'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const BANK_LIST = ['BCA', 'BNI', 'BPD DIY', 'BRI', 'BSI', 'BTN', 'CIMB', 'MANDIRI'] as const

function bankLogoSrc(bank: string): string {
  return `/image/${encodeURIComponent(bank)}.png`
}

function maskRekening(no: string): string {
  const digits = no.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  return '•'.repeat(digits.length - 3) + ' ' + digits.slice(-3)
}

interface RekeningRow { id: string; bank: string; noRek: string; atasNama: string }

interface UserData {
  nama:         string
  jabatan:      string
  sekolah:      string
  email:        string
  namaSekolah:  string
  telepon:      string
  jenjang:      string
  idSekolah:    string
}

function formatWA(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 3) return digits
  const parts = [digits.slice(0, 3)]
  let i = 3
  while (i < digits.length) {
    parts.push(digits.slice(i, i + 4))
    i += 4
  }
  return parts.join('-')
}

function Section({ title, desc, action, children }: { title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'1.5rem', marginBottom:'1rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', paddingBottom:'1rem', borderBottom:'1px solid #F1F5F9' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:'0.95rem', color:'var(--navy-dark)' }}>{title}</div>
          {desc && <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:3 }}>{desc}</div>}
        </div>
        {action && <div style={{ flexShrink:0 }}>{action}</div>}
      </div>
      {children}
    </div>
  )
}

function ViewField({ label, value, muted=false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display:'block', fontSize:'0.78rem', fontWeight:600, color:'var(--text-mid)', marginBottom:4 }}>{label}</label>
      <div style={{
        width:'100%', padding:'0.65rem 0.9rem',
        border:'1.5px solid var(--border)', borderRadius:8,
        fontSize:'0.875rem', fontWeight:500,
        color: (muted || !value) ? '#9CA3AF' : 'var(--text-dark)',
        background:'#F9FAFB',
      }}>
        {value || '—'}
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, defaultValue='', type='text', disabled=false }: {
  label: string; value?: string; onChange?: (v: string) => void
  defaultValue?: string; type?: string; disabled?: boolean
}) {
  const controlled = value !== undefined
  return (
    <div style={{ marginBottom:'1rem' }}>
      <label style={{ display:'block', fontSize:'0.78rem', fontWeight:600, color:'var(--text-mid)', marginBottom:4 }}>{label}</label>
      <input
        type={type}
        {...(controlled ? { value, onChange: e => onChange?.(e.target.value) } : { defaultValue })}
        disabled={disabled}
        style={{
          width:'100%', padding:'0.65rem 0.9rem',
          border:'1.5px solid var(--border)', borderRadius:8,
          fontSize:'0.875rem', color: disabled ? '#9CA3AF' : 'var(--text-dark)',
          fontWeight:500,
          background: disabled ? '#F9FAFB' : '#fff',
          fontFamily:'inherit', outline:'none',
        }}
      />
    </div>
  )
}

const JABATAN_OPTIONS = ['Bendahara', 'Kepala Sekolah', 'Tata Usaha', 'Staff Administrasi', 'Operator']

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  const isCustom = value && !options.includes(value)
  return (
    <div style={{ marginBottom:'1rem' }}>
      <label style={{ display:'block', fontSize:'0.78rem', fontWeight:600, color:'var(--text-mid)', marginBottom:4 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width:'100%', padding:'0.65rem 0.9rem',
          border:'1.5px solid var(--border)', borderRadius:8,
          fontSize:'0.875rem', color:'var(--text-dark)',
          fontWeight:500, background:'#fff',
          fontFamily:'inherit', outline:'none', appearance:'auto',
        }}
      >
        {isCustom && <option value={value}>{value}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function Toggle({ label, sub, defaultOn=false }: { label: string; sub?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 0', borderBottom:'1px solid #F1F5F9' }}>
      <div>
        <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--navy-dark)' }}>{label}</div>
        {sub && <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:2 }}>{sub}</div>}
      </div>
      <button
        onClick={() => setOn(!on)}
        style={{
          width:44, height:24, borderRadius:100, border:'none', cursor:'pointer',
          background: on ? 'var(--emerald)' : '#D1D5DB', position:'relative', transition:'background 0.2s',
          flexShrink:0,
        }}
      >
        <span style={{
          position:'absolute', top:3, left: on ? 23 : 3,
          width:18, height:18, borderRadius:'50%', background:'#fff',
          transition:'left 0.2s', display:'block',
        }} />
      </button>
    </div>
  )
}

function CopyField({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
    onCopy?.()
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, padding: '0.65rem 0.9rem',
          border: '1.5px solid var(--border)', borderRadius: 8,
          fontSize: '0.875rem', color: '#9CA3AF',
          background: '#F9FAFB', fontFamily: 'monospace',
          letterSpacing: '0.03em', userSelect: 'text',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value || '—'}
        </div>
        <button
          onClick={handleCopy}
          title="Salin ID Sekolah"
          style={{
            flexShrink: 0, padding: '0.65rem 0.85rem',
            border: '1.5px solid var(--border)', borderRadius: 8,
            background: copied ? 'var(--emerald-bg)' : '#fff',
            color: copied ? 'var(--emerald)' : 'var(--text-mid)',
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
            fontFamily: 'inherit', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          {copied ? (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function PengaturanPage() {
  const [saved,        setSaved]        = useState(false)
  const [savedLeaving, setSavedLeaving] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState('')
  const [copyToast,    setCopyToast]    = useState(false)
  const [toastLeaving, setToastLeaving] = useState(false)
  const [editingProfil,  setEditingProfil]  = useState(false)
  const [profilForm,     setProfilForm]     = useState({ namaSekolah: '', jenjang: '', alamat: '', yayasan: '' })
  const [teleponInput,   setTeleponInput]   = useState('')
  const [editingAkun,    setEditingAkun]    = useState(false)
  const [akunForm,       setAkunForm]       = useState({ nama: '', jabatan: '', noWa: '', npsn: '' })
  const [savingAkun,     setSavingAkun]     = useState(false)
  const [saveAkunError,  setSaveAkunError]  = useState('')
  const [userData,       setUserData]       = useState<UserData>({
    nama: '', jabatan: '', sekolah: '', email: '',
    namaSekolah: '', telepon: '', jenjang: '', idSekolah: '',
  })
  const [rekening,          setRekening]          = useState<RekeningRow | null>(null)
  const [showRekeningModal, setShowRekeningModal] = useState(false)
  const [rekeningForm,      setRekeningForm]      = useState({ bank: '', noRek: '', atasNama: '' })
  const [savingRekening,    setSavingRekening]    = useState(false)
  const [saveRekeningError, setSaveRekeningError] = useState('')

  useEffect(() => {
    const authRaw = localStorage.getItem('siku_auth')
    const auth = authRaw
      ? (JSON.parse(authRaw) as { nama: string; jabatan: string; sekolah: string })
      : { nama: '', jabatan: '', sekolah: '' }

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null

      const [{ data: profileData }, { data: pData }] = await Promise.all([
        user ? supabase.from('profiles').select('sekolah_id, nama, jabatan, no_wa, npsn').eq('id', user.id).single() : Promise.resolve({ data: null }),
        supabase.from('pengaturan').select('jenjang_sekolah').maybeSingle(),
      ])

      type ProfileRow = { sekolah_id: string; nama: string; jabatan: string; no_wa: string; npsn: string }
      type PRow       = { jenjang_sekolah: string }
      const profile = profileData as ProfileRow | null
      const p       = pData       as PRow       | null

      const sekolahId = profile?.sekolah_id ?? ''
      const [{ data: sekolahData }, { data: rekeningData }] = sekolahId
        ? await Promise.all([
            supabase.from('sekolah').select('nama, no_wa, alamat, yayasan').eq('id', sekolahId).single(),
            supabase.from('rekening').select('id, bank, no_rek, atas_nama')
              .eq('sekolah_id', sekolahId).eq('jenis', 'transfer').eq('aktif', true)
              .order('urutan', { ascending: true }).limit(1).maybeSingle(),
          ])
        : [{ data: null }, { data: null }]

      type SekolahRow  = { nama: string; no_wa: string; alamat: string | null; yayasan: string | null }
      type RekeningDb  = { id: string; bank: string; no_rek: string; atas_nama: string }
      const sk = sekolahData as SekolahRow | null
      const rk = rekeningData as RekeningDb | null
      setRekening(rk ? { id: rk.id, bank: rk.bank, noRek: rk.no_rek, atasNama: rk.atas_nama } : null)

      const rawTelepon = (sk?.no_wa ?? '').replace(/^\+?62/, '')
      setTeleponInput(formatWA(rawTelepon))
      setProfilForm({
        namaSekolah: sk?.nama            ?? auth.sekolah ?? '',
        jenjang:     p?.jenjang_sekolah  ?? '',
        alamat:      sk?.alamat ?? '',
        yayasan:     sk?.yayasan ?? '',
      })
      setAkunForm({
        nama:    profile?.nama    ?? auth.nama    ?? '',
        jabatan: profile?.jabatan ?? auth.jabatan ?? '',
        noWa:    profile?.no_wa   ?? '',
        npsn:    profile?.npsn    ?? '',
      })

      setUserData({
        nama:        auth.nama           ?? '',
        jabatan:     auth.jabatan        ?? '',
        sekolah:     auth.sekolah        ?? '',
        email:       user?.email         ?? '',
        namaSekolah: sk?.nama            ?? auth.sekolah ?? '',
        telepon:     sk?.no_wa           ?? '',
        jenjang:     p?.jenjang_sekolah  ?? '',
        idSekolah:   sekolahId,
      })
    }
    load()
  }, [])

  const handleSave = () => {
    setSavedLeaving(false)
    setSaved(true)
    setTimeout(() => setSavedLeaving(true), 1800)
    setTimeout(() => { setSaved(false); setSavedLeaving(false) }, 2100)
  }

  const handleCopyIdSekolah = () => {
    setToastLeaving(false)
    setCopyToast(true)
    setTimeout(() => setToastLeaving(true), 1800)
    setTimeout(() => { setCopyToast(false); setToastLeaving(false) }, 2100)
  }

  const handleSaveProfil = async () => {
    if (!userData.idSekolah) {
      setSaveError('Data belum termuat, coba refresh halaman.')
      return
    }
    setSaving(true)
    setSaveError('')
    const noWaRaw = teleponInput ? '+62' + teleponInput.replace(/-/g, '') : ''

    const [{ error: errSekolah }, { error: errPengaturan }, { error: errProfiles }] = await Promise.all([
      supabase
        .from('sekolah')
        .update({ nama: profilForm.namaSekolah, no_wa: noWaRaw, alamat: profilForm.alamat, yayasan: profilForm.yayasan })
        .eq('id', userData.idSekolah),
      supabase
        .from('pengaturan')
        .upsert(
          { sekolah_id: userData.idSekolah, jenjang_sekolah: profilForm.jenjang },
          { onConflict: 'sekolah_id' }
        ),
      supabase
        .from('profiles')
        .update({ sekolah: profilForm.namaSekolah })
        .eq('sekolah_id', userData.idSekolah),
    ])

    setSaving(false)
    const err = errSekolah ?? errPengaturan ?? errProfiles
    if (err) {
      setSaveError(err.message)
    } else {
      const authRaw = localStorage.getItem('siku_auth')
      if (authRaw) {
        const newValue = JSON.stringify({ ...JSON.parse(authRaw), sekolah: profilForm.namaSekolah })
        localStorage.setItem('siku_auth', newValue)
        window.dispatchEvent(new StorageEvent('storage', { key: 'siku_auth', newValue }))
      }
      setSaveError('')
      setEditingProfil(false)
      handleSave()
    }
  }

  const handleSaveAkun = async () => {
    if (!userData.idSekolah) {
      setSaveAkunError('Data belum termuat, coba refresh halaman.')
      return
    }
    setSavingAkun(true)
    setSaveAkunError('')
    const avatar = akunForm.nama.trim().charAt(0).toUpperCase()
    const { error } = await supabase
      .from('profiles')
      .update({
        nama:    akunForm.nama.trim(),
        jabatan: akunForm.jabatan.trim(),
        no_wa:   akunForm.noWa.trim(),
        npsn:    akunForm.npsn.trim(),
        avatar,
      })
      .eq('sekolah_id', userData.idSekolah)
    setSavingAkun(false)
    if (error) {
      setSaveAkunError(error.message)
    } else {
      const authRaw = localStorage.getItem('siku_auth')
      if (authRaw) {
        const newValue = JSON.stringify({
          ...JSON.parse(authRaw),
          nama:    akunForm.nama.trim(),
          jabatan: akunForm.jabatan.trim(),
          avatar,
        })
        localStorage.setItem('siku_auth', newValue)
        window.dispatchEvent(new StorageEvent('storage', { key: 'siku_auth', newValue }))
      }
      setSaveAkunError('')
      setEditingAkun(false)
      handleSave()
    }
  }

  const handleTeleponChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTeleponInput(formatWA(e.target.value))
  }

  const openTambahRekening = () => {
    setRekeningForm({ bank: '', noRek: '', atasNama: '' })
    setSaveRekeningError('')
    setShowRekeningModal(true)
  }

  const openEditRekening = () => {
    if (!rekening) return
    setRekeningForm({ bank: rekening.bank, noRek: rekening.noRek, atasNama: rekening.atasNama })
    setSaveRekeningError('')
    setShowRekeningModal(true)
  }

  const handleSaveRekening = async () => {
    if (!userData.idSekolah) {
      setSaveRekeningError('Data belum termuat, coba refresh halaman.')
      return
    }
    if (!rekeningForm.bank) {
      setSaveRekeningError('Pilih bank terlebih dahulu.')
      return
    }
    if (!rekeningForm.noRek.trim()) {
      setSaveRekeningError('Nomor rekening wajib diisi.')
      return
    }
    if (!rekeningForm.atasNama.trim()) {
      setSaveRekeningError('Nama pemilik rekening wajib diisi.')
      return
    }
    setSavingRekening(true)
    setSaveRekeningError('')

    const payload = {
      bank:      rekeningForm.bank,
      no_rek:    rekeningForm.noRek.trim(),
      atas_nama: rekeningForm.atasNama.trim(),
    }

    const { data, error } = rekening
      ? await supabase.from('rekening').update(payload).eq('id', rekening.id)
          .select('id, bank, no_rek, atas_nama').single()
      : await supabase.from('rekening').insert({ ...payload, sekolah_id: userData.idSekolah, jenis: 'transfer' })
          .select('id, bank, no_rek, atas_nama').single()

    setSavingRekening(false)
    if (error) {
      setSaveRekeningError(error.message)
    } else {
      const row = data as { id: string; bank: string; no_rek: string; atas_nama: string }
      setRekening({ id: row.id, bank: row.bank, noRek: row.no_rek, atasNama: row.atas_nama })
      setShowRekeningModal(false)
      handleSave()
    }
  }

  return (
    <div className="dashboard-content">
      <style>{`
        @keyframes toastEnter {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.92); }
          60%  { opacity: 1; transform: translateX(-50%) translateY(4px)   scale(1.02); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
        }
        @keyframes toastLeave {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0)      scale(1);    }
          100% { opacity: 0; transform: translateX(-50%) translateY(-14px)  scale(0.94); }
        }
      `}</style>

      {copyToast && (
        <div style={{
          position: 'fixed', top: 24, left: '50%',
          zIndex: 9999, background: '#1E293B', color: '#fff',
          padding: '0.7rem 1.4rem 0.7rem 1rem', borderRadius: 12,
          fontSize: '0.875rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)',
          animation: toastLeaving
            ? 'toastLeave 0.28s cubic-bezier(0.4,0,1,1) forwards'
            : 'toastEnter 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
          willChange: 'transform, opacity',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(52,211,153,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          ID Sekolah berhasil di copy
        </div>
      )}

      {saved && (
        <div style={{
          position: 'fixed', top: 24, left: '50%',
          zIndex: 9999, background: '#1E293B', color: '#fff',
          padding: '0.7rem 1.4rem 0.7rem 1rem', borderRadius: 12,
          fontSize: '0.875rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)',
          animation: savedLeaving
            ? 'toastLeave 0.28s cubic-bezier(0.4,0,1,1) forwards'
            : 'toastEnter 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
          willChange: 'transform, opacity',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(52,211,153,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          Perubahan berhasil disimpan
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 60, height: 60, background: '#1A2C4E', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '10px 16px 14px rgba(18,47,102,0.31)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>
              Pengaturan
            </h1>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
              Kelola profil sekolah dan preferensi sistem
            </p>
          </div>
        </div>
      </div>

      {/* Rekening Resmi Sekolah */}
      <Section
        title="Rekening Resmi Sekolah"
        desc="Rekening yang digunakan untuk menerima pembayaran dari orang tua"
        action={rekening ? (
          <button onClick={openEditRekening} title="Edit Rekening"
            style={{
              width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#fff', color: 'var(--navy)', border: '1.5px solid var(--navy)',
              borderRadius: 8, cursor: 'pointer', flexShrink: 0,
            }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        ) : undefined}
      >
        {rekening ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 10, padding: 8,
              border: '1.5px solid var(--border)', background: '#F9FAFB',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Image src={bankLogoSrc(rekening.bank)} alt={rekening.bank} width={48} height={48} style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-dark)' }}>{rekening.bank}</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-mid)', fontFamily: 'monospace', letterSpacing: '0.04em', marginTop: 2 }}>
                {maskRekening(rekening.noRek)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                a.n. {rekening.atasNama}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1.25rem 1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="10" width="18" height="9" rx="1"/><path d="M3 10 12 4l9 6"/><path d="M6 14v3M12 14v3M18 14v3"/>
              </svg>
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '0.2rem' }}>
              Belum ada rekening ditambahkan
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Tambahkan rekening resmi agar orang tua bisa melakukan pembayaran
            </div>
            <button onClick={openTambahRekening}
              style={{ background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.55rem 1.2rem', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Tambah Rekening
            </button>
          </div>
        )}

        {saveRekeningError && !showRekeningModal && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#DC2626', padding: '0.5rem 0.75rem', background: '#FEF2F2', borderRadius: 6 }}>
            {saveRekeningError}
          </div>
        )}
      </Section>

      {/* Modal Tambah/Edit Rekening */}
      {showRekeningModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(18,47,102,0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
          onClick={() => setShowRekeningModal(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(18,47,102,0.22)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1A2C4E' }}>
                {rekening ? 'Edit Rekening' : 'Tambah Rekening'}
              </span>
              <button onClick={() => setShowRekeningModal(false)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B', flexShrink: 0 }}>
                <X size={17} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 8 }}>
                Pilih Bank
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {BANK_LIST.map(bank => (
                  <button
                    key={bank}
                    onClick={() => setRekeningForm(f => ({ ...f, bank }))}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '0.6rem 0.4rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                      border: rekeningForm.bank === bank ? '2px solid var(--navy)' : '1.5px solid var(--border)',
                      background: rekeningForm.bank === bank ? '#EFF6FF' : '#fff',
                    }}
                  >
                    <div style={{ width: 40, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Image src={bankLogoSrc(bank)} alt={bank} width={40} height={30} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-mid)', textAlign: 'center', lineHeight: 1.2 }}>{bank}</span>
                  </button>
                ))}
              </div>
            </div>

            <FormField
              label="Nama Pemilik Rekening"
              value={rekeningForm.atasNama}
              onChange={v => setRekeningForm(f => ({ ...f, atasNama: v }))}
            />

            <FormField
              label="Nomor Rekening"
              value={rekeningForm.noRek}
              onChange={v => setRekeningForm(f => ({ ...f, noRek: v.replace(/\D/g, '') }))}
            />

            {saveRekeningError && (
              <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: '#DC2626', padding: '0.5rem 0.75rem', background: '#FEF2F2', borderRadius: 6 }}>
                {saveRekeningError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '0.5rem' }}>
              <button onClick={() => setShowRekeningModal(false)} disabled={savingRekening}
                style={{ background: '#fff', color: 'var(--text-mid)', border: '1.5px solid var(--border)', padding: '0.6rem 1.4rem', borderRadius: 10, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', opacity: savingRekening ? 0.6 : 1 }}>
                Batal
              </button>
              <button onClick={handleSaveRekening} disabled={savingRekening}
                style={{ background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.6rem 1.4rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', cursor: savingRekening ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: savingRekening ? 0.7 : 1 }}>
                {savingRekening ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profil Sekolah */}
      <Section title="Profil Sekolah" desc="Informasi dasar sekolah yang ditampilkan di laporan dan tagihan" action={
        editingProfil ? (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { setEditingProfil(false); setSaveError('') }} disabled={saving}
              style={{ background:'#fff', color:'var(--text-mid)', border:'1.5px solid var(--border)', padding:'0.45rem 1rem', borderRadius:8, fontWeight:600, fontSize:'0.8rem', cursor:'pointer', fontFamily:'inherit', opacity: saving ? 0.6 : 1 }}>
              Batal
            </button>
            <button onClick={handleSaveProfil} disabled={saving}
              style={{ background:'var(--navy)', color:'#fff', border:'none', padding:'0.45rem 1.1rem', borderRadius:8, fontWeight:700, fontSize:'0.8rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'inherit', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditingProfil(true)}
            style={{ background:'#fff', color:'var(--navy)', border:'1.5px solid var(--navy)', padding:'0.45rem 1rem', borderRadius:8, fontWeight:700, fontSize:'0.8rem', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Profil
          </button>
        )
      }>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1.5rem' }}>
          <CopyField label="ID Sekolah" value={userData.idSekolah} onCopy={handleCopyIdSekolah} />

          {editingProfil ? (
            <FormField label="Nama Sekolah" value={profilForm.namaSekolah}
              onChange={v => setProfilForm(f => ({ ...f, namaSekolah: v }))} />
          ) : (
            <ViewField label="Nama Sekolah" value={profilForm.namaSekolah} />
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display:'block', fontSize:'0.78rem', fontWeight:600, color:'var(--text-mid)', marginBottom:4 }}>Jenjang Sekolah</label>
            <div style={{
              padding:'0.65rem 0.9rem',
              border:'1.5px solid var(--border)', borderRadius:8,
              fontSize:'0.875rem', fontWeight:500,
              color: profilForm.jenjang ? 'var(--text-dark)' : '#9CA3AF',
              background:'#F9FAFB',
            }}>
              {profilForm.jenjang || '—'}
            </div>
          </div>

          {/* No. WhatsApp Resmi */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 4 }}>
              No. WhatsApp Resmi
            </label>
            {editingProfil ? (
              <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <span style={{
                  padding: '0.65rem 0.75rem', background: '#F1F5F9',
                  fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-mid)',
                  borderRight: '1.5px solid var(--border)', whiteSpace: 'nowrap', userSelect: 'none',
                }}>+62</span>
                <input
                  type="tel"
                  value={teleponInput}
                  onChange={handleTeleponChange}
                  placeholder="812-3456-7890"
                  style={{
                    flex: 1, padding: '0.65rem 0.9rem', border: 'none', outline: 'none',
                    fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)', background: '#fff',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            ) : (
              <div style={{
                width:'100%', padding:'0.65rem 0.9rem',
                border:'1.5px solid var(--border)', borderRadius:8,
                fontSize:'0.875rem', fontWeight:500,
                color: teleponInput ? 'var(--text-dark)' : '#9CA3AF',
                background:'#F9FAFB',
              }}>
                {teleponInput ? `+62 ${teleponInput}` : '—'}
              </div>
            )}
          </div>

          {editingProfil ? (
            <FormField label="Yayasan" value={profilForm.yayasan}
              onChange={v => setProfilForm(f => ({ ...f, yayasan: v }))} />
          ) : (
            <ViewField label="Yayasan" value={profilForm.yayasan} />
          )}

          <div style={{ gridColumn:'1 / -1' }}>
            {editingProfil ? (
              <FormField label="Alamat Sekolah" value={profilForm.alamat}
                onChange={v => setProfilForm(f => ({ ...f, alamat: v }))} />
            ) : (
              <ViewField label="Alamat Sekolah" value={profilForm.alamat} />
            )}
          </div>
        </div>

        {saveError && (
          <div style={{ marginTop:'0.5rem', fontSize:'0.8rem', color:'#DC2626', padding:'0.5rem 0.75rem', background:'#FEF2F2', borderRadius:6 }}>
            {saveError}
          </div>
        )}
      </Section>

      {/* Akun Pengguna */}
      <Section title="Akun Pengguna" desc="Data pribadi pengelola keuangan sekolah" action={
        editingAkun ? (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { setEditingAkun(false); setSaveAkunError('') }} disabled={savingAkun}
              style={{ background:'#fff', color:'var(--text-mid)', border:'1.5px solid var(--border)', padding:'0.45rem 1rem', borderRadius:8, fontWeight:600, fontSize:'0.8rem', cursor:'pointer', fontFamily:'inherit', opacity: savingAkun ? 0.6 : 1 }}>
              Batal
            </button>
            <button onClick={handleSaveAkun} disabled={savingAkun}
              style={{ background:'var(--navy)', color:'#fff', border:'none', padding:'0.45rem 1.1rem', borderRadius:8, fontWeight:700, fontSize:'0.8rem', cursor: savingAkun ? 'not-allowed' : 'pointer', fontFamily:'inherit', opacity: savingAkun ? 0.7 : 1 }}>
              {savingAkun ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditingAkun(true)}
            style={{ background:'#fff', color:'var(--navy)', border:'1.5px solid var(--navy)', padding:'0.45rem 1rem', borderRadius:8, fontWeight:700, fontSize:'0.8rem', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Akun
          </button>
        )
      }>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1.5rem' }}>
          {editingAkun ? (
            <FormField label="Nama Lengkap" value={akunForm.nama}
              onChange={v => setAkunForm(f => ({ ...f, nama: v }))} />
          ) : (
            <ViewField label="Nama Lengkap" value={akunForm.nama} />
          )}

          {editingAkun ? (
            <SelectField label="Jabatan" value={akunForm.jabatan}
              onChange={v => setAkunForm(f => ({ ...f, jabatan: v }))}
              options={JABATAN_OPTIONS} />
          ) : (
            <ViewField label="Jabatan" value={akunForm.jabatan} />
          )}

          <ViewField label="Email" value={userData.email} muted />

          {editingAkun ? (
            <FormField label="No. WhatsApp" value={akunForm.noWa}
              onChange={v => setAkunForm(f => ({ ...f, noWa: v }))} />
          ) : (
            <ViewField label="No. WhatsApp" value={akunForm.noWa} />
          )}

          {editingAkun ? (
            <FormField label="NPSN" value={akunForm.npsn}
              onChange={v => setAkunForm(f => ({ ...f, npsn: v }))} />
          ) : (
            <ViewField label="NPSN" value={akunForm.npsn} />
          )}
        </div>

        {saveAkunError && (
          <div style={{ marginTop:'0.5rem', fontSize:'0.8rem', color:'#DC2626', padding:'0.5rem 0.75rem', background:'#FEF2F2', borderRadius:6 }}>
            {saveAkunError}
          </div>
        )}
      </Section>

      {/* Notifikasi */}
      <Section title="Pengaturan Notifikasi WhatsApp" desc="Konfigurasi kapan dan bagaimana pesan otomatis dikirim ke orang tua">
        <Toggle label="Reminder H-7 sebelum jatuh tempo"  sub="Kirim WA 7 hari sebelum tanggal jatuh tempo"         defaultOn={true}  />
        <Toggle label="Reminder H-3 sebelum jatuh tempo"  sub="Kirim WA 3 hari sebelum tanggal jatuh tempo"         defaultOn={true}  />
        <Toggle label="Reminder H-1 sebelum jatuh tempo"  sub="Kirim WA 1 hari sebelum tanggal jatuh tempo"         defaultOn={true}  />
        <Toggle label="Notifikasi hari jatuh tempo"       sub="Kirim WA tepat di hari jatuh tempo"                   defaultOn={false} />
        <Toggle label="Konfirmasi pembayaran otomatis"    sub="Kirim WA konfirmasi ke orang tua setelah bayar"       defaultOn={true}  />
        <Toggle label="Laporan bulanan ke kepala sekolah" sub="Kirim ringkasan keuangan tiap awal bulan"             defaultOn={true}  />
        <div style={{ padding:'0.75rem 0 0', fontSize:'0.78rem', color:'var(--text-muted)' }}>
          Notifikasi WA dikirim menggunakan api.co.id. Pastikan nomor WhatsApp resmi sekolah sudah terdaftar.
        </div>
      </Section>
    </div>
  )
}
