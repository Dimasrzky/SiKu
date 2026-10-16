import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { antrekanManual } from '@/lib/pengingat/antrean'
import { alamatAplikasi, bacaSiswaIds, sekolahPemanggil } from '@/lib/pengingat/permintaan'
import { sekolahTerkonfirmasi } from '@/lib/kemitraan'

// Tabel Tagihan Aktif memuat paling banyak 500 baris, jadi "Ingatkan semua" tidak
// pernah mengirim lebih dari ini
const MAKS_SISWA = 500

/**
 * Tombol "Ingatkan" dan "Ingatkan semua": menaruh pengingat manual ke antrean. Tidak
 * ada pesan yang dikirim di sini — balasannya langsung, berisi tampilan tombol tiap siswa.
 * Siswa yang belum lewat jatuh tempo, sudah lunas, masih dalam cooldown, atau sudah punya
 * job di antrean tidak dibuatkan job baru.
 */
export async function POST(req: NextRequest) {
  const db    = createServiceClient()
  const akses = await sekolahPemanggil(db, req.headers.get('Authorization'))
  if (akses.error !== null) return NextResponse.json({ data: null, error: akses.error }, { status: akses.status })

  // Pesan dikirim lewat nomor WhatsApp platform: hanya untuk sekolah mitra yang sudah dikonfirmasi
  const terkonfirmasi = await sekolahTerkonfirmasi(db, akses.sekolahId)
  if (terkonfirmasi.error !== null) return NextResponse.json({ data: null, error: terkonfirmasi.error }, { status: 500 })
  if (!terkonfirmasi.data) {
    return NextResponse.json({ data: null, error: 'Kemitraan sekolah belum dikonfirmasi tim Equanusa.' }, { status: 403 })
  }

  let body: { siswa_ids?: unknown } | null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Request tidak valid.' }, { status: 400 })
  }

  const siswaIds = bacaSiswaIds(body?.siswa_ids, MAKS_SISWA)
  if (!siswaIds || siswaIds.length === 0) {
    return NextResponse.json({ data: null, error: `siswa_ids harus berisi 1 sampai ${MAKS_SISWA} id siswa.` }, { status: 400 })
  }

  const hasil = await antrekanManual(db, {
    sekolahId: akses.sekolahId,
    siswaIds,
    userId:    akses.userId,
    origin:    alamatAplikasi(req),
  })
  if (hasil.error !== null) return NextResponse.json({ data: null, error: hasil.error }, { status: 500 })

  // 202: pengingatnya baru masuk antrean, belum terkirim. Sekolah yang belum memakai
  // antrean tidak dibuatkan apa-apa, jadi dibalas 200 biasa.
  return NextResponse.json({ data: hasil.data, error: null }, { status: hasil.data.aktif ? 202 : 200 })
}
