import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Folder, ShieldCheck } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import AdminLogoutButton from '../AdminLogoutButton'
import NotificationBell from './NotificationBell'
import KonfirmasiKemitraan, { type PendaftaranSekolah } from './KonfirmasiKemitraan'

export const metadata: Metadata = {
  title: 'Verifikasi Pembayaran',
}

type SekolahJoin = { id: string; nama: string } | null
type VerifRow    = { sekolah: SekolahJoin }

type ProfilJoin     = { nama: string | null; jabatan: string | null; email: string | null }
type PengaturanJoin = { jenjang_sekolah: string | null }
type PendaftaranRow = {
  id:         string
  nama:       string
  no_wa:      string | null
  created_at: string
  // Relasi balik: profiles selalu daftar; pengaturan bisa objek kalau sekolah_id-nya unik
  profiles:   ProfilJoin[] | ProfilJoin | null
  pengaturan: PengaturanJoin[] | PengaturanJoin | null
}

interface SekolahFolder {
  id:    string
  nama:  string
  count: number
}

const pertama = <T,>(v: T[] | T | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

const formatTerdaftar = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB'

export default async function VerifikasiPembayaranPage() {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/')
  }

  const supabase = createServiceClient()

  // Sekolah yang belum dikonfirmasi tidak bisa membuat tagihan, jadi tidak punya folder bukti
  const [{ data: sekolahData }, { data }, { data: pendaftaranData }] = await Promise.all([
    supabase.from('sekolah').select('id, nama').eq('status_kemitraan', 'aktif').order('nama').limit(2000),
    supabase
      .from('verifikasi_pembayaran')
      .select('sekolah:sekolah_id(id, nama)')
      .eq('status', 'menunggu')
      .limit(2000),
    supabase
      .from('sekolah')
      .select('id, nama, no_wa, created_at, profiles(nama, jabatan, email), pengaturan(jenjang_sekolah)')
      .eq('status_kemitraan', 'menunggu')
      .order('created_at', { ascending: true })
      .limit(200),
  ])

  const pendaftaran: PendaftaranSekolah[] = ((pendaftaranData ?? []) as unknown as PendaftaranRow[]).map(s => {
    const profil = pertama(s.profiles)
    const noWa   = s.no_wa?.replace(/\D/g, '') || null
    return {
      id:            s.id,
      namaSekolah:   s.nama,
      jenjang:       pertama(s.pengaturan)?.jenjang_sekolah ?? null,
      noWa,
      namaBendahara: profil?.nama ?? null,
      jabatan:       profil?.jabatan ?? null,
      email:         profil?.email ?? null,
      terdaftar:     formatTerdaftar(s.created_at),
    }
  })

  const sekolahList = (sekolahData ?? []) as { id: string; nama: string }[]
  const rows = (data ?? []) as unknown as VerifRow[]

  const folderMap = new Map<string, SekolahFolder>()
  for (const s of sekolahList) {
    folderMap.set(s.id, { id: s.id, nama: s.nama, count: 0 })
  }
  for (const r of rows) {
    if (!r.sekolah) continue
    const existing = folderMap.get(r.sekolah.id)
    if (existing) {
      existing.count += 1
    } else {
      folderMap.set(r.sekolah.id, { id: r.sekolah.id, nama: r.sekolah.nama, count: 1 })
    }
  }

  const folders = Array.from(folderMap.values()).sort((a, b) => b.count - a.count || a.nama.localeCompare(b.nama, 'id'))

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{ width: 48, height: 48, background: '#1A2C4E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1A2C4E', margin: 0 }}>Verifikasi Pembayaran</h1>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.15rem 0 0' }}>
                Pilih sekolah untuk memverifikasi bukti transfer yang masuk
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <NotificationBell
              pending={folders.filter(f => f.count > 0)}
              pendaftaran={pendaftaran.map(p => ({ id: p.id, nama: p.namaSekolah }))}
            />
            <AdminLogoutButton />
          </div>
        </div>

        <KonfirmasiKemitraan daftar={pendaftaran} />

        {/* Folder grid */}
        {folders.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '3.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.9rem' }}>
            Belum ada sekolah terdaftar.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {folders.map(f => (
              <Link
                key={f.id}
                href={`/admin/verifikasi-pembayaran/${f.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  position: 'relative', background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.5rem', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', textAlign: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s',
                  opacity: f.count > 0 ? 1 : 0.65,
                }}>
                  {f.count > 0 && (
                    <span style={{
                      position: 'absolute', top: 10, right: 10, minWidth: 22, height: 22, padding: '0 6px',
                      background: '#DC2626', color: '#fff', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {f.count}
                    </span>
                  )}
                  <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Folder size={52} color={f.count > 0 ? '#F5B942' : '#CBD5E1'} fill={f.count > 0 ? '#FEF3C7' : '#F8FAFC'} strokeWidth={1.5} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', lineHeight: 1.3 }}>{f.nama}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    {f.count > 0 ? `${f.count} bukti menunggu` : 'Tidak ada bukti menunggu'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
