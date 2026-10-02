import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { alamatAplikasi, rahasiaCocok } from '@/lib/pengingat/permintaan'
import { jalankanWorker } from '@/lib/pengingat/worker'

// Satu pemanggilan bisa menunggu jeda acak sampai 35 detik, lalu mengecek device dan
// mengirim satu pesan — jauh di atas batas bawaan fungsi Vercel
export const maxDuration = 60

/**
 * Worker antrean pengingat: dipanggil pg_cron tiap 30 detik dan mengirim paling banyak
 * satu pesan per nomor pengirim. Tidak memakai sesi login — pemanggilnya mesin, dikenali dari
 * CRON_SECRET (route ini didaftarkan sebagai jalur publik di proxy.ts).
 */
export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ data: null, error: 'CRON_SECRET belum diisi di server.' }, { status: 503 })
  }
  if (!rahasiaCocok(req.headers.get('Authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const hasil = await jalankanWorker(createServiceClient(), { origin: alamatAplikasi(req) })
  if (hasil.error !== null) return NextResponse.json({ data: null, error: hasil.error }, { status: 500 })

  return NextResponse.json({ data: hasil.data, error: null })
}
