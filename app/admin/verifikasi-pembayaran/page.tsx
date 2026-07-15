import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Folder, ShieldCheck, Bell } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import AdminLogoutButton from '../AdminLogoutButton'

type SekolahJoin = { id: string; nama: string } | null
type VerifRow    = { sekolah: SekolahJoin }

interface SekolahFolder {
  id:    string
  nama:  string
  count: number
}

export default async function VerifikasiPembayaranPage() {
  const cookieStore = await cookies()
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/')
  }

  const supabase = createServiceClient()

  const { data } = await supabase
    .from('verifikasi_pembayaran')
    .select('sekolah:sekolah_id(id, nama)')
    .eq('status', 'menunggu')
    .limit(2000)

  const rows = (data ?? []) as unknown as VerifRow[]

  const folderMap = new Map<string, SekolahFolder>()
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
  const totalMenunggu = rows.length

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
            <div style={{ position: 'relative', width: 44, height: 44, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} color="#1A2C4E" />
              {totalMenunggu > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, padding: '0 5px',
                  background: '#DC2626', color: '#fff', borderRadius: 20, fontSize: '0.7rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #F1F5F9',
                }}>
                  {totalMenunggu > 99 ? '99+' : totalMenunggu}
                </span>
              )}
            </div>
            <AdminLogoutButton />
          </div>
        </div>

        {/* Folder grid */}
        {folders.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '3.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.9rem' }}>
            Belum ada bukti transfer yang menunggu verifikasi.
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
                    <Folder size={52} color="#F5B942" fill="#FEF3C7" strokeWidth={1.5} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', lineHeight: 1.3 }}>{f.nama}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    {f.count} bukti menunggu
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
