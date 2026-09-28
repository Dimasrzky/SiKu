import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cekAksesDemo, hapusDataDemo } from '@/lib/demoServer'
import { rancangDataDemo } from '@/lib/demoSeed'
import { tabelBelumAda } from '@/lib/catatanTindakLanjut'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEMO_SEKOLAH_ID = process.env.DEMO_SEKOLAH_ID!

// Menghapus lalu mengisi ±12.000 baris — jauh di atas batas bawaan fungsi Vercel
export const maxDuration = 60

const UKURAN_BATCH = 1000

/**
 * Ganti seluruh data operasional sekolah demo dengan data contoh 12 bulan
 * (Draft Pengembangan Fitur Laporan, 1.7). Nama sekolah, profil, dan rekening
 * yang sudah diisi tim tetap dipakai.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const akses = await cekAksesDemo(supabaseAdmin, token, DEMO_SEKOLAH_ID)
  if (akses.error !== null) return NextResponse.json({ data: null, error: akses.error }, { status: akses.status })

  const gagal = await hapusDataDemo(supabaseAdmin, DEMO_SEKOLAH_ID)
  if (gagal.length > 0) {
    return NextResponse.json({
      data:  null,
      error: `Data lama gagal dihapus: ${gagal.map(g => `${g.tabel} (${g.pesan})`).join('; ')}`,
    }, { status: 500 })
  }

  const { data: pengaturan } = await supabaseAdmin
    .from('pengaturan').select('jenjang_sekolah').eq('sekolah_id', DEMO_SEKOLAH_ID).maybeSingle()

  const rencana = rancangDataDemo({
    sekolahId:      DEMO_SEKOLAH_ID,
    jenjangSekolah: (pengaturan as { jenjang_sekolah?: string } | null)?.jenjang_sekolah ?? 'SMP/MTs',
    sekarang:       new Date(),
    noWa:           process.env.DEMO_NO_WA?.trim() || null,
  })

  // Urut dari induk ke anak — tiap tabel mengacu ke id tabel sebelumnya
  const urutan: [string, object[]][] = [
    ['tahun_ajaran',     rencana.tahunAjaran],
    ['kelas',            rencana.kelas],
    ['komponen_tagihan', rencana.komponen],
    ['paket',            rencana.paket],
    ['paket_kelas',      rencana.paketKelas],
    ['paket_komponen',   rencana.paketKomponen],
    ['siswa',            rencana.siswa],
    ['tagihan',          rencana.tagihan],
    ['tagihan_item',     rencana.tagihanItem],
    ['pembayaran',       rencana.pembayaran],
  ]

  for (const [tabel, baris] of urutan) {
    for (let i = 0; i < baris.length; i += UKURAN_BATCH) {
      const { error } = await supabaseAdmin.from(tabel).insert(baris.slice(i, i + UKURAN_BATCH))
      if (error) {
        // Sisa yang terlanjur masuk terhapus sendiri saat Isi Data Contoh atau Reset Demo berikutnya
        return NextResponse.json({ data: null, error: `Gagal mengisi ${tabel}: ${error.message}` }, { status: 500 })
      }
    }
  }

  // Catatan tindak lanjut contoh — dilewati tanpa galat kalau tabelnya belum dibuat.
  // dibuat_oleh = akun demo, supaya catatannya bisa dihapus dari halaman siswa.
  if (rencana.catatanTindakLanjut.length > 0) {
    const { error } = await supabaseAdmin.from('catatan_tindak_lanjut')
      .insert(rencana.catatanTindakLanjut.map(c => ({ ...c, dibuat_oleh: akses.userId })))
    if (error && !tabelBelumAda(error)) {
      return NextResponse.json({ data: null, error: `Gagal mengisi catatan_tindak_lanjut: ${error.message}` }, { status: 500 })
    }
  }

  // Data contoh sudah memuat semua langkah setup — checklist tidak perlu tampil lagi
  const { error: pengaturanError } = await supabaseAdmin.from('pengaturan').update({
    setup_steps: {
      profil_sekolah:   true,
      tahun_ajaran:     true,
      komponen_tagihan: true,
      buat_kelas:       true,
      import_siswa:     true,
    },
  }).eq('sekolah_id', DEMO_SEKOLAH_ID)

  if (pengaturanError) {
    return NextResponse.json({ data: null, error: `Gagal memperbarui pengaturan: ${pengaturanError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      siswa:      rencana.siswa.length,
      tagihan:    rencana.tagihan.length,
      pembayaran: rencana.pembayaran.length,
    },
    error: null,
  })
}
