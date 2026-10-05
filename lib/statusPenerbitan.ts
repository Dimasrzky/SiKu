import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilSemua } from './ambilSemua'
import { kelasTanpaPaket } from './generateTagihan'

// Kenapa tagihan bulan berjalan belum terbit — bahan pemberitahuan di Dashboard dan
// Tagihan Aktif (diputuskan 2 Okt 2026: sekolah diberi tahu di aplikasi, bukan lewat
// WhatsApp). Hanya membaca. Penerbitannya sendiri ada di lib/generateTagihan, dan
// syaratnya diambil dari sana supaya tidak ada dua versi aturan.
//
// Dipakai dari komponen 'use client' (klien browser, tunduk pada RLS).

export type JenisPenahan = 'tanpa_tahun_ajaran' | 'kelas_tanpa_paket'

export interface PenahanTerbit {
  jenis: JenisPenahan
  /** Nama kelas penyebabnya, terurut; kosong untuk `tanpa_tahun_ajaran` */
  kelas: string[]
}

export interface StatusPenerbitan {
  /**
   * Siswa aktif yang sudah punya kelas tetapi belum punya tagihan bulan itu. Kalau ada
   * penahan, hanya siswa yang tertahan olehnya — angka ini tampil di samping alasannya.
   */
  belumDitagih: number
  /**
   * Yang menahan penerbitan tagihan mereka. null = tidak ada yang menahan: tagihannya
   * terbit pada penerbitan berikutnya (Tagihan Aktif, simpan data siswa atau pengaturan
   * tagihan, cron pagi).
   */
  penahan: PenahanTerbit | null
}

const GAGAL = 'Status penerbitan tagihan gagal dimuat.'

export async function statusPenerbitan(
  db: SupabaseClient, sid: string, bulan: number, tahun: number,
): Promise<{ data: StatusPenerbitan; error: null } | { data: null; error: string }> {
  const [siswaRes, tagihanRes] = await Promise.all([
    ambilSemua<{ id: string; kelas_id: string | null }>((dari, sampai) => db
      .from('siswa').select('id, kelas_id')
      .eq('sekolah_id', sid).eq('status', 'aktif')
      .order('id').range(dari, sampai)),
    ambilSemua<{ siswa_id: string }>((dari, sampai) => db
      .from('tagihan').select('id, siswa_id')
      .eq('sekolah_id', sid).eq('bulan', bulan).eq('tahun', tahun)
      .order('id').range(dari, sampai)),
  ])
  if (siswaRes.error || tagihanRes.error) return { data: null, error: GAGAL }

  const sudahDitagih = new Set(tagihanRes.data.map(t => t.siswa_id))
  const belum = siswaRes.data.filter((s): s is { id: string; kelas_id: string } =>
    !!s.kelas_id && !sudahDitagih.has(s.id))
  const belumDitagih = belum.length
  // Keadaan yang paling sering: semua sudah ditagih. Tidak perlu membaca apa-apa lagi.
  if (belumDitagih === 0) return { data: { belumDitagih: 0, penahan: null }, error: null }

  // Disaring per sekolah secara eksplisit, sama seperti cron dan route recalculate
  const { data: ta, error: eTa } = await db
    .from('tahun_ajaran').select('nama').eq('sekolah_id', sid).eq('is_aktif', true).maybeSingle()
  if (eTa) return { data: null, error: GAGAL }
  const tahunAjaran = (ta as { nama: string | null } | null)?.nama
  if (!tahunAjaran) return { data: { belumDitagih, penahan: { jenis: 'tanpa_tahun_ajaran', kelas: [] } }, error: null }

  const [paketRes, kelasRes] = await Promise.all([
    db.from('paket').select('id, paket_kelas(kelas_id)').eq('sekolah_id', sid).eq('tahun_ajaran', tahunAjaran),
    db.from('kelas').select('id, nama').eq('sekolah_id', sid),
  ])
  if (paketRes.error || kelasRes.error) return { data: null, error: GAGAL }

  const semuaKelas    = (kelasRes.data ?? []) as { id: string; nama: string }[]
  const kelasBerpaket = new Set(
    ((paketRes.data ?? []) as unknown as { paket_kelas: { kelas_id: string }[] }[])
      .flatMap(p => p.paket_kelas.map(pk => pk.kelas_id))
  )
  const urut = (nama: string[]) => [...nama].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }))

  // Penerbitan berjalan per kelas, jadi yang disebut hanya kelas tanpa paket yang siswanya
  // memang belum ditagih. Kelas kosong tidak menahan siapa pun.
  const kelasSiswaBelum = new Set(belum.map(s => s.kelas_id))
  const tanpaPaket = kelasTanpaPaket(semuaKelas, kelasBerpaket).filter(k => kelasSiswaBelum.has(k.id))
  if (tanpaPaket.length > 0) {
    const idTanpaPaket = new Set(tanpaPaket.map(k => k.id))
    return {
      data: {
        belumDitagih: belum.filter(s => idTanpaPaket.has(s.kelas_id)).length,
        penahan:      { jenis: 'kelas_tanpa_paket', kelas: urut(tanpaPaket.map(k => k.nama)) },
      },
      error: null,
    }
  }

  return { data: { belumDitagih, penahan: null }, error: null }
}

const MAKS_NAMA_KELAS = 3

/** "Kelas 7-A, 7-B, dan 2 kelas lain" — nama di data bisa "7-A" atau "Kelas 7-A" */
function daftarKelas(nama: string[]): string {
  const pendek = nama.map(n => n.replace(/^kelas\s+/i, ''))
  const tampil = pendek.slice(0, MAKS_NAMA_KELAS).join(', ')
  const sisa   = pendek.length - MAKS_NAMA_KELAS
  return sisa > 0 ? `Kelas ${tampil}, dan ${sisa} kelas lain` : `Kelas ${tampil}`
}

export interface PesanPenahan {
  /** Satu kalimat yang menyebut penyebabnya */
  alasan:    string
  aksiLabel: string
  aksiHref:  string
}

export function pesanPenahanTerbit(p: PenahanTerbit): PesanPenahan {
  switch (p.jenis) {
    case 'tanpa_tahun_ajaran':
      return { alasan: 'Belum ada tahun ajaran aktif.', aksiLabel: 'Atur Tahun Ajaran', aksiHref: '/tagihan/tahun-ajaran' }
    case 'kelas_tanpa_paket':
      return { alasan: `${daftarKelas(p.kelas)} belum punya paket.`, aksiLabel: 'Atur Paket Kelas', aksiHref: '/tagihan/paket-kelas' }
  }
}
