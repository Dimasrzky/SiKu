import type { CSSProperties, ReactNode } from 'react'
import { JABATAN } from '@/lib/jabatan'
import { HARI_PENGINGAT } from '@/lib/pengingat/jadwal'
import { Blok, BlokTeks, KepalaHalaman, KerangkaHalaman } from './Blok'

// Kerangka Pengaturan — meniru app/(dashboard)/pengaturan/page.tsx: rekening, profil
// sekolah, akun pengguna, notifikasi. Ubah bersama halamannya.

const sLabel: CSSProperties = { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 4 }
const sKotak: CSSProperties = { padding: '0.65rem 0.9rem', border: '1.5px solid var(--border)', borderRadius: 8, background: '#F9FAFB' }

const Bagian = ({ judul, keterangan, aksi, children }: { judul: string; keterangan: string; aksi?: ReactNode; children: ReactNode }) => (
  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', marginBottom: '1rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #F1F5F9' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>{judul}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>{keterangan}</div>
      </div>
      {aksi && <div style={{ flexShrink: 0 }}>{aksi}</div>}
    </div>
    {children}
  </div>
)

/** Isian baca-saja: label asli, nilainya blok */
const Isian = ({ label, lebar, penuh = false }: { label: string; lebar: number | string; penuh?: boolean }) => (
  <div style={{ marginBottom: '1rem', gridColumn: penuh ? '1 / -1' : undefined }}>
    <span style={sLabel}>{label}</span>
    <div style={sKotak}><BlokTeks lebar={lebar} ukuran="0.875rem" /></div>
  </div>
)

/** Isian yang nilainya sudah pasti sebelum data dimuat — tampil seperti ViewField `muted` */
const IsianTetap = ({ label, nilai }: { label: string; nilai: string }) => (
  <div style={{ marginBottom: '1rem' }}>
    <span style={sLabel}>{label}</span>
    <div style={{ ...sKotak, fontSize: '0.875rem', fontWeight: 500, color: '#9CA3AF' }}>{nilai}</div>
  </div>
)

const IkonPengaturan = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

export const SkeletonPengaturan = () => (
  <KerangkaHalaman label="Pengaturan">
    <KepalaHalaman ikon={<IkonPengaturan />} judul="Pengaturan" subjudul="Kelola profil sekolah dan preferensi sistem" jarakBawah="2rem" />

    <Bagian judul="Rekening Resmi Sekolah" keterangan="Rekening yang digunakan untuk menerima pembayaran dari orang tua"
      aksi={<Blok lebar={34} tinggi={34} sudut={8} />}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Blok lebar={64} tinggi={64} sudut={10} />
        <div>
          <BlokTeks lebar={90} ukuran="0.95rem" />
          <BlokTeks lebar={150} ukuran="0.875rem" style={{ marginTop: 2 }} />
          <BlokTeks lebar={130} ukuran="0.8rem" style={{ marginTop: 2 }} />
        </div>
      </div>
      {/* "Terakhir diubah oleh … · …" */}
      <BlokTeks lebar={250} ukuran="0.75rem" style={{ marginTop: '0.9rem' }} />
    </Bagian>

    <Bagian judul="Profil Sekolah" keterangan="Informasi dasar sekolah yang ditampilkan di laporan dan tagihan"
      aksi={<Blok lebar={116} tinggi={38} sudut={8} />}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={sLabel}>ID Sekolah</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ ...sKotak, flex: 1 }}><BlokTeks lebar="70%" ukuran="0.875rem" /></div>
            <Blok lebar={50} tinggi={44} sudut={8} />
          </div>
        </div>
        <Isian label="Nama Sekolah" lebar="60%" />
        <Isian label="Jenjang Sekolah" lebar={80} />
        <Isian label="No. WhatsApp Resmi" lebar={150} />
        <Isian label="Yayasan" lebar="50%" />
        <Isian label="Alamat Sekolah" lebar="45%" penuh />
      </div>
    </Bagian>

    <Bagian judul="Akun Pengguna" keterangan="Data pribadi pengelola keuangan sekolah"
      aksi={<Blok lebar={110} tinggi={38} sudut={8} />}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
        <Isian label="Nama Lengkap" lebar="55%" />
        <IsianTetap label="Jabatan" nilai={JABATAN} />
        <Isian label="Email" lebar="60%" />
        <Isian label="No. WhatsApp" lebar={130} />
        <Isian label="NPSN" lebar={90} />
      </div>
    </Bagian>

    <Bagian judul="Pengaturan Notifikasi WhatsApp" keterangan="Konfigurasi kapan dan bagaimana pesan otomatis dikirim ke orang tua">
      {HARI_PENGINGAT.map(({ kolom, hari }) => (
        <div key={kolom} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--navy-dark)' }}>Reminder H-{hari} sebelum jatuh tempo</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Kirim WA {hari} hari sebelum tanggal jatuh tempo</div>
          </div>
          <Blok lebar={44} tinggi={24} sudut={100} />
        </div>
      ))}
      <div style={{ padding: '0.75rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Pesan dikirim dari nomor WhatsApp yang disiapkan tim SiKu. No. WhatsApp di Akun Pengguna dicantumkan sebagai kontak sekolah di pesan.
      </div>
    </Bagian>
  </KerangkaHalaman>
)
