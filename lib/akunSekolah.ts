// Hapus akun sekolah dari dasbor admin — dipakai bersama popup Hapus (browser) dan
// /api/admin/sekolah/[id] (server).

/** Nama untuk dicocokkan saat konfirmasi hapus: spasi di tepi dan spasi berlebih diabaikan */
export const samakanNama = (nama: string) => nama.trim().replace(/\s+/g, ' ')

/**
 * Sekolah demo dipakai ulang setiap sesi demo (DEMO_SEKOLAH_ID, akun super_admin), jadi
 * tidak boleh dihapus. Cukup salah satu tanda: jenis 'demo', id = DEMO_SEKOLAH_ID, atau
 * dipakai akun super_admin. `idDemo` dari env server — di browser selalu undefined.
 */
export const adalahSekolahDemo = (
  sekolah: { id: string; jenis: string | null },
  peranAkun: (string | null)[],
  idDemo: string | undefined,
): boolean => sekolah.jenis === 'demo' || (!!idDemo && sekolah.id === idDemo) || peranAkun.includes('super_admin')

/** Isi popup Hapus: apa saja yang ikut terhapus. null = jumlahnya gagal dihitung. */
export interface RingkasanHapusSekolah {
  nama:   string
  /** Email akun login bendahara yang ikut dihapus */
  akun:   string[]
  jumlah: {
    siswa:         number | null
    tagihan:       number | null
    pembayaran:    number | null
    pengeluaran:   number | null
    buktiTransfer: number | null
  }
}
