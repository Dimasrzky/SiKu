// Tunggakan awal: tunggakan dari bulan-bulan sebelum sekolah memakai SiKu (mis. tahun
// ajaran mulai Juli, sekolah baru memakai SiKu di Oktober). Bendahara memasukkannya di
// Tagihan Aktif, dan tersimpan sebagai tagihan biasa untuk bulan itu bertanda
// tagihan.sumber = 'input_manual'. Status Menunggak tidak pernah ditulis: ia dihitung dari
// tagihan bulan lalu yang belum lunas, jadi halaman bayar wali, pesan WhatsApp, Catat
// Pembayaran Manual, Dashboard, dan Laporan ikut menagihnya tanpa aturan tambahan.
//
// Aturannya:
// - Bulan yang bisa diisi: tahun ajaran aktif, dari bulan mulainya sampai bulan lalu, dan
//   hanya bulan yang belum punya tagihan untuk siswa itu. Bulan yang sudah diterbitkan
//   SiKu tidak bisa diisi, jadi tidak ada tagihan ganda.
// - Nominal = yang masih terutang (sesudah beasiswa, dikurangi yang sudah dibayar di luar
//   SiKu). Disimpan apa adanya di tagihan_item.nominal dengan potongan 0.
// - Tunggakan awal bisa diubah atau dihapus selama belum ada pembayaran / bukti transfer.
//
// Terbuka untuk semua sekolah sejak 30 Okt 2026 (sebelumnya khusus sekolah demo); route-nya di
// /api/tagihan/tunggakan-awal, tombolnya di halaman Tagihan Aktif.
//
// Berkas ini dipakai browser dan server — jangan mengimpor apa pun yang khusus server.

/** Nilai tagihan.sumber untuk tunggakan yang dimasukkan bendahara */
export const SUMBER_INPUT_MANUAL = 'input_manual'

/** Batas atas nominal satu komponen, penjaga salah ketik angka nol */
export const NOMINAL_MAKS = 100_000_000

/**
 * - `kosong`: belum ada tagihan untuk bulan ini — bisa diisi
 * - `manual`: sudah berisi tunggakan awal — bisa diubah atau dihapus kecuali terkunci
 * - `sistem`: sudah diterbitkan SiKu — tidak bisa diisi di sini
 */
export type KeadaanBulan = 'kosong' | 'manual' | 'sistem'

export interface KomponenTunggakanAwal {
  komponen_id:  string
  nama:         string
  jenis:        string
  /** Warna komponen (komponen_tagihan.kelas_warna) untuk chip dan kolom nominal */
  warna:        string | null
  /** Yang masih terutang: tersimpan, atau usulan dari paket kelas sesudah beasiswa */
  nominal:      number
  /** Sudah tersimpan di tunggakan awal bulan ini */
  tersimpan:    boolean
  /**
   * Komponen per semester / sekali bayar: komponen dengan kunci yang sama hanya boleh
   * ditagih di satu bulan (satu semester / satu tahun ajaran). null untuk komponen rutin.
   */
  kunciCakupan: string | null
}

export interface BulanTunggakanAwal {
  bulan:       number
  tahun:       number
  keadaan:     KeadaanBulan
  tagihan_id:  string | null
  /** Alasan tunggakan awal ini tidak bisa diubah lagi; null kalau masih bisa */
  terkunci:    string | null
  komponen:    KomponenTunggakanAwal[]
}

export interface DataTunggakanAwal {
  siswa: {
    id:          string
    nama:        string
    nis:         string | null
    kelas_nama:  string | null
    kelas_warna: string | null
  }
  tahunAjaran: string
  /** Terlama dulu */
  bulan:       BulanTunggakanAwal[]
  /** Kelas siswa belum masuk paket tahun ajaran aktif, jadi tidak ada usulan komponen */
  tanpaPaket:  boolean
}

/**
 * Isi tunggakan awal satu siswa yang diinginkan. Bulan berisi tunggakan awal yang tidak
 * dikirim dihapus; bulan yang terkunci tidak disentuh.
 */
export interface SimpanTunggakanAwal {
  siswa_id: string
  bulan: {
    bulan:    number
    tahun:    number
    komponen: { komponen_id: string; nominal: number }[]
  }[]
}

export interface HasilSimpanTunggakanAwal {
  dibuat:  number
  diubah:  number
  dihapus: number
}

export const BULAN_TUNGGAKAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export const labelBulan = (b: { bulan: number; tahun: number }): string =>
  `${BULAN_TUNGGAKAN[b.bulan] ?? b.bulan} ${b.tahun}`
