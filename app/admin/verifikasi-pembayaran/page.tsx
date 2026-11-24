import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Folder } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase-service'
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import HalamanAdmin from '../HalamanAdmin'

export const metadata: Metadata = {
  title: 'Verifikasi Pembayaran',
}

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

  // Sekolah yang belum dikonfirmasi tidak bisa membuat tagihan, jadi tidak punya folder bukti
  const [{ data: sekolahData }, { data }] = await Promise.all([
    supabase.from('sekolah').select('id, nama').eq('status_kemitraan', 'aktif').order('nama').limit(2000),
    supabase
      .from('verifikasi_pembayaran')
      .select('sekolah:sekolah_id(id, nama)')
      .eq('status', 'menunggu')
      .limit(2000),
  ])

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
  const totalMenunggu = folders.reduce((n, f) => n + f.count, 0)

  return (
    <HalamanAdmin
      judul="Verifikasi Pembayaran"
      subjudul={totalMenunggu > 0
        ? `${totalMenunggu} bukti transfer menunggu verifikasi`
        : 'Pilih sekolah untuk memverifikasi bukti transfer yang masuk'}
    >
      {folders.length === 0 ? (
        <div className="admin-panel">
          <div className="admin-kosong admin-kosong--tunggal">Belum ada sekolah terdaftar.</div>
        </div>
      ) : (
        <div className="admin-folder-grid">
          {folders.map(f => (
            <Link key={f.id} href={`/admin/verifikasi-pembayaran/${f.id}`} className={`admin-folder${f.count > 0 ? '' : ' admin-folder--sepi'}`}>
              {f.count > 0 && <span className="admin-hitung">{f.count}</span>}
              <span className="admin-folder-ikon">
                <Folder size={24} fill="currentColor" fillOpacity={0.18} strokeWidth={1.8} />
              </span>
              <div>
                <div className="admin-folder-nama">{f.nama}</div>
                <div className="admin-folder-sub">
                  {f.count > 0 ? `${f.count} bukti menunggu` : 'Tidak ada bukti menunggu'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </HalamanAdmin>
  )
}
