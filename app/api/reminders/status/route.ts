import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { statusPengingat } from '@/lib/pengingat/antrean'
import { bacaSiswaIds, sekolahPemanggil } from '@/lib/pengingat/permintaan'

// Satu id memakan ±37 karakter di URL — 100 id masih jauh di bawah batas panjang URL.
// Halaman yang barisnya lebih banyak memanggil endpoint ini beberapa kali.
const MAKS_SISWA = 100

/**
 * Tampilan tombol Ingatkan untuk siswa di `?siswa_ids=a,b,c`. Dipakai saat halaman dibuka
 * dan untuk polling selama masih ada baris "Mengirim...". Tanpa `siswa_ids` hanya
 * menjawab apakah sekolah ini sudah memakai antrean.
 */
export async function GET(req: NextRequest) {
  const db    = createServiceClient()
  const akses = await sekolahPemanggil(db, req.headers.get('Authorization'))
  if (akses.error !== null) return NextResponse.json({ data: null, error: akses.error }, { status: akses.status })

  const param    = req.nextUrl.searchParams.get('siswa_ids')?.trim()
  const siswaIds = param ? bacaSiswaIds(param.split(','), MAKS_SISWA) : []
  if (!siswaIds) {
    return NextResponse.json({ data: null, error: `siswa_ids harus berisi paling banyak ${MAKS_SISWA} id siswa.` }, { status: 400 })
  }

  const hasil = await statusPengingat(db, { sekolahId: akses.sekolahId, siswaIds })
  if (hasil.error !== null) return NextResponse.json({ data: null, error: hasil.error }, { status: 500 })

  return NextResponse.json({ data: hasil.data, error: null })
}
