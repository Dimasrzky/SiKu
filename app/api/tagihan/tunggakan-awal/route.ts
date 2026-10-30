import { NextRequest, NextResponse } from 'next/server'
import { sekolahPemanggil } from '@/lib/pengingat/permintaan'
import { createServiceClient } from '@/lib/supabase-service'
import { bacaTunggakanAwal, simpanTunggakanAwal } from '@/lib/tunggakanAwalServer'

// Tunggakan awal (lihat lib/tunggakanAwal): GET membaca bulan-bulan yang bisa diisi untuk
// satu siswa, POST menyimpan isiannya. Logikanya di lib/tunggakanAwalServer; di sini hanya
// siapa pemanggilnya. Terbuka untuk semua sekolah sejak 30 Okt 2026 (sebelumnya khusus
// sekolah demo). Setiap query di lib dibatasi ke sekolah akun yang login.

/** Bulan-bulan yang bisa diisi untuk satu siswa: ?siswa_id= */
export async function GET(req: NextRequest) {
  const db    = createServiceClient()
  const akses = await sekolahPemanggil(db, req.headers.get('Authorization'))
  if (akses.error !== null) return NextResponse.json({ data: null, error: akses.error }, { status: akses.status })

  const hasil = await bacaTunggakanAwal(db, akses.sekolahId, req.nextUrl.searchParams.get('siswa_id'))
  if (hasil.error !== null) return NextResponse.json({ data: null, error: hasil.error }, { status: hasil.status })
  return NextResponse.json({ data: hasil.data, error: null })
}

/** Simpan isian tunggakan awal satu siswa (SimpanTunggakanAwal) */
export async function POST(req: NextRequest) {
  const db    = createServiceClient()
  const akses = await sekolahPemanggil(db, req.headers.get('Authorization'))
  if (akses.error !== null) return NextResponse.json({ data: null, error: akses.error }, { status: akses.status })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Isian tidak valid.' }, { status: 400 })
  }

  const hasil = await simpanTunggakanAwal(db, akses.sekolahId, body)
  if (hasil.error !== null) return NextResponse.json({ data: null, error: hasil.error }, { status: hasil.status })
  return NextResponse.json({ data: hasil.data, error: null })
}
