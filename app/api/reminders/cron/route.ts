import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { antrekanOtomatis } from '@/lib/pengingat/otomatis'
import { alamatAplikasi, rahasiaCocok } from '@/lib/pengingat/permintaan'

// Menerbitkan tagihan dan menilai siswa tiap sekolah yang memakai antrean — bisa melewati
// batas bawaan fungsi Vercel
export const maxDuration = 60

/**
 * Pengingat otomatis harian: dipanggil pg_cron pukul 07.55 WIB. Menerbitkan tagihan bulan
 * berjalan yang belum ada, lalu membuat job untuk tagihan yang jatuh tempo 7, 3, atau 1
 * hari lagi — hanya hari yang dinyalakan sekolah di Pengaturan. Tidak mengirim apa pun —
 * itu tugas worker.
 * Pemanggilnya mesin, dikenali dari CRON_SECRET (jalur publik di proxy.ts).
 */
export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ data: null, error: 'CRON_SECRET belum diisi di server.' }, { status: 503 })
  }
  if (!rahasiaCocok(req.headers.get('Authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const hasil = await antrekanOtomatis(createServiceClient(), { origin: alamatAplikasi(req) })
  if (hasil.error !== null) return NextResponse.json({ data: null, error: hasil.error }, { status: 500 })

  return NextResponse.json({ data: hasil.data, error: null })
}
