'use client'

import { useState } from 'react'
import { MOCK_USER } from '@/lib/mockData'

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'1.5rem', marginBottom:'1rem' }}>
      <div style={{ marginBottom:'1.25rem', paddingBottom:'1rem', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ fontWeight:700, fontSize:'0.95rem', color:'var(--navy-dark)' }}>{title}</div>
        {desc && <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:3 }}>{desc}</div>}
      </div>
      {children}
    </div>
  )
}

function FormField({ label, defaultValue, type='text', disabled=false }: {
  label: string; defaultValue: string; type?: string; disabled?: boolean
}) {
  return (
    <div style={{ marginBottom:'1rem' }}>
      <label style={{ display:'block', fontSize:'0.78rem', fontWeight:600, color:'var(--text-mid)', marginBottom:4 }}>{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        disabled={disabled}
        style={{
          width:'100%', padding:'0.65rem 0.9rem',
          border:'1.5px solid var(--border)', borderRadius:8,
          fontSize:'0.875rem', color: disabled ? '#9CA3AF' : 'var(--text-dark)',
          background: disabled ? '#F9FAFB' : '#fff',
          fontFamily:'inherit', outline:'none',
        }}
      />
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

export default function PengaturanPage() {
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Pengaturan</h1>
          <p className="dashboard-subtitle">Kelola profil sekolah dan preferensi sistem</p>
        </div>
        {saved && (
          <div style={{
            background:'var(--emerald-bg)', border:'1px solid rgba(5,150,105,0.3)',
            color:'var(--emerald)', padding:'0.6rem 1.25rem', borderRadius:8,
            fontSize:'0.85rem', fontWeight:600, display:'flex', alignItems:'center', gap:6,
          }}>
            ✓ Perubahan tersimpan!
          </div>
        )}
      </div>

      {/* Profil Sekolah */}
      <Section title="Profil Sekolah" desc="Informasi dasar sekolah yang ditampilkan di laporan dan tagihan">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1.5rem' }}>
          <FormField label="Nama Sekolah"      defaultValue={MOCK_USER.sekolah} />
          <FormField label="NPSN"              defaultValue={MOCK_USER.npsn} />
          <FormField label="Nama Yayasan"      defaultValue={MOCK_USER.yayasan} />
          <FormField label="No. WhatsApp Resmi" defaultValue="(+62) 812-3456-7890" />
          <div style={{ gridColumn:'1 / -1' }}>
            <FormField label="Alamat Sekolah"  defaultValue={MOCK_USER.alamat} />
          </div>
        </div>

        {/* SPP per kelas */}
        <div style={{ marginTop:'0.5rem', paddingTop:'1rem', borderTop:'1px solid #F1F5F9' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.75rem' }}>
            Nominal SPP per Jenjang
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0 1.5rem' }}>
            <FormField label="Kelas VII"  defaultValue="450000" type="number" />
            <FormField label="Kelas VIII" defaultValue="475000" type="number" />
            <FormField label="Kelas IX"   defaultValue="500000" type="number" />
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:'0.5rem' }}>
          <button
            onClick={handleSave}
            style={{ background:'var(--navy)', color:'#fff', border:'none', padding:'0.65rem 1.75rem', borderRadius:8, fontWeight:700, fontSize:'0.875rem', cursor:'pointer', fontFamily:'inherit' }}
          >
            Simpan Perubahan
          </button>
        </div>
      </Section>

      {/* Akun Pengguna */}
      <Section title="Akun Pengguna" desc="Data login akun bendahara sekolah Anda">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1.5rem' }}>
          <FormField label="Nama Lengkap" defaultValue={MOCK_USER.nama} />
          <FormField label="Jabatan"      defaultValue={MOCK_USER.jabatan} />
          <FormField label="Email"        defaultValue={MOCK_USER.email} type="email" />
          <FormField label="No. WhatsApp" defaultValue="0812-3456-7890" />
        </div>

        <div style={{ paddingTop:'0.75rem', borderTop:'1px solid #F1F5F9' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.75rem' }}>
            Ubah Password
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1.5rem' }}>
            <FormField label="Password Lama" defaultValue="" type="password" />
            <FormField label="Password Baru" defaultValue="" type="password" />
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:'0.5rem' }}>
          <button
            onClick={handleSave}
            style={{ background:'var(--navy)', color:'#fff', border:'none', padding:'0.65rem 1.75rem', borderRadius:8, fontWeight:700, fontSize:'0.875rem', cursor:'pointer', fontFamily:'inherit' }}
          >
            Update Akun
          </button>
        </div>
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
          📌 Notifikasi WA dikirim menggunakan Fonnte API. Pastikan nomor WhatsApp resmi sekolah sudah terdaftar.
        </div>
      </Section>

      {/* Info paket demo */}
      <div style={{ background:'var(--navy-dark)', borderRadius:12, padding:'1.5rem', color:'#fff' }}>
        <div style={{ fontWeight:700, marginBottom:'0.5rem', color:'var(--emerald-light)' }}>🚀 Paket Demo Aktif</div>
        <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:'1rem' }}>
          Anda menggunakan SiKu versi demo gratis (sisa <strong>82 hari</strong>). Semua fitur tersedia penuh.
          Setelah masa demo, Anda dapat berlangganan sesuai jumlah siswa.
        </div>
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
          {[
            ['Paket Kecil',   'S/d 150 siswa',  'Rp 299.000/bln'],
            ['Paket Menengah','S/d 400 siswa',  'Rp 499.000/bln'],
            ['Paket Besar',   'S/d 1000 siswa', 'Rp 799.000/bln'],
          ].map(([nama, siswa, harga]) => (
            <div key={nama} style={{ flex:'1 1 160px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'1rem', textAlign:'center' }}>
              <div style={{ fontWeight:700, fontSize:'0.85rem', marginBottom:4 }}>{nama}</div>
              <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.5)', marginBottom:8 }}>{siswa}</div>
              <div style={{ fontFamily:'var(--font-serif,Georgia,serif)', fontSize:'1.1rem', fontWeight:700, color:'var(--emerald-light)' }}>{harga}</div>
            </div>
          ))}
        </div>
        <button
          style={{ marginTop:'1rem', background:'var(--emerald)', color:'#fff', border:'none', padding:'0.75rem 1.75rem', borderRadius:8, fontWeight:700, fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit' }}
          onClick={() => alert('Tim SiKu akan menghubungi Anda untuk upgrade!')}
        >
          Upgrade Sekarang →
        </button>
      </div>
    </div>
  )
}