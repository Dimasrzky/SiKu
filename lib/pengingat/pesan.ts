import type { SupabaseClient } from '@supabase/supabase-js'
import { ambilPerPotong } from '../ambilSemua'
import type { RingkasanTunggakan, TagihanPengingat } from './kelayakan'
import type { PenilaianSiswa } from './penilaian'
import { renderPesanPengingat } from './templat'

// Isi job pengingat untuk satu siswa: teks pesan beserta kolom yang ikut berubah kalau
// tagihannya berubah. Dipakai saat job dibuat dan sekali lagi tepat sebelum dikirim.
// Khusus server.

export interface KonteksPesan {
  namaSekolah: string
  /** Nomor bendahara, atau nomor sekolah kalau bendaharanya tidak punya nomor */
  kontakTu:    string | null
  kelas:       Map<string, { nama: string; jenjang: string | null }>
}

export async function muatKonteksPesan(
  db: SupabaseClient, sekolahId: string, kelasIds: string[],
): Promise<{ data: KonteksPesan | null; error: string | null }> {
  const [sekolahRes, stafRes, kelasRes] = await Promise.all([
    db.from('sekolah').select('nama, no_wa').eq('id', sekolahId).maybeSingle(),
    db.from('profiles').select('jabatan, no_wa').eq('sekolah_id', sekolahId).limit(20),
    ambilPerPotong<{ id: string; nama: string; jenjang: string | null }>(kelasIds, (ids, dari, sampai) => db
      .from('kelas').select('id, nama, jenjang').in('id', ids).order('id').range(dari, sampai)),
  ])
  if (sekolahRes.error || stafRes.error || kelasRes.error) return { data: null, error: 'Data sekolah gagal dimuat.' }

  // Kontak TU = bendahara sekolah, lalu nomor sekolah — sama dengan kaki halaman bayar
  const staf    = (stafRes.data ?? []) as { jabatan: string | null; no_wa: string | null }[]
  const sekolah = sekolahRes.data as { nama: string | null; no_wa: string | null } | null
  return {
    data: {
      namaSekolah: sekolah?.nama ?? '',
      kontakTu:    (staf.find(s => s.jabatan === 'Bendahara') ?? staf[0])?.no_wa?.trim() || sekolah?.no_wa?.trim() || null,
      kelas:       new Map(kelasRes.data.map(k => [k.id, k])),
    },
    error: null,
  }
}

/** Kolom reminder_job yang isinya mengikuti keadaan tagihan */
export interface IsiJob {
  tagihan_id:    string | null
  jenjang:       string
  message:       string
  total_tagihan: number
  link_token:    string | null
}

/** `origin` = alamat aplikasi tanpa garis miring di akhir, untuk tautan halaman bayar */
export function susunIsiJob(
  p: PenilaianSiswa,
  ringkasan: RingkasanTunggakan<TagihanPengingat>,
  konteks: KonteksPesan,
  origin: string,
): IsiJob {
  const kelas  = p.siswa.kelas_id ? konteks.kelas.get(p.siswa.kelas_id) : undefined
  const token  = ringkasan.tautan?.payment_token ?? null
  return {
    tagihan_id:    ringkasan.tautan?.id ?? null,
    // Alumni tidak punya kelas aktif — dikelompokkan sendiri supaya urutan batch tetap rapi
    jenjang:       kelas?.jenjang ?? (p.siswa.status === 'alumni' ? 'alumni' : ''),
    message:       renderPesanPengingat({
      namaWali:    p.siswa.nama_wali,
      namaSiswa:   p.siswa.nama,
      kelasNama:   kelas?.nama ?? p.siswa.kelas,
      namaSekolah: konteks.namaSekolah,
      periode:     ringkasan.tertagih.map(t => ({ bulan: t.bulan, tahun: t.tahun })),
      total:       ringkasan.total,
      tautan:      token ? `${origin}/bayar/${token}` : null,
      kontakTu:    konteks.kontakTu,
    }),
    total_tagihan: ringkasan.total,
    link_token:    token,
  }
}
