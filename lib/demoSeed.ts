import { randomUUID } from 'crypto'
import { komponenDitagihkan, periodeIndex, kunciRiwayat, type KomponenJenis, type RiwayatTagih } from './komponenTagihan'
import { tanggalWIB } from './metrikLaporan'
import type { AlasanTindakLanjut } from './catatanTindakLanjut'

// Rancangan data contoh untuk akun demo (Draft Pengembangan Fitur Laporan, 1.7).
// Murni tanpa Supabase supaya bisa diuji: acaknya memakai benih tetap sehingga
// pola bayar sama setiap kali diisi, sedangkan tanggalnya dihitung mundur dari
// `sekarang` sehingga datanya tidak pernah basi. Id dibuat di sini agar relasi
// antar tabel sudah utuh sebelum satu baris pun dikirim ke database.
//
// "12 bulan terakhir" selalu melewati pergantian tahun ajaran, jadi datanya
// memuat tahun ajaran lalu (arsip) dan aktif, satu kali naik kelas, alumni yang
// lulus Juni lalu, dan siswa baru tingkat terbawah yang masuk Juli.

// Sama dengan halaman naik-kelas, laporan, dan paket-kelas
const JENJANG_MAP: Record<string, string[]> = {
  'TK/PAUD': ['A', 'B', 'C'],
  'SD/MI':   ['1', '2', '3', '4', '5', '6'],
  'SMP/MTs': ['7', '8', '9'],
  'SMA/MA':  ['10', '11', '12'],
  'SMK':     ['10', '11', '12'],
}

/** Tanggal jatuh tempo setiap bulan di paket contoh — memperlihatkan fitur jatuh tempo per paket */
export const TANGGAL_JATUH_TEMPO_DEMO = 10

const KOMPONEN_DEMO: { jenis: KomponenJenis; nama: string; nominal: number; warna: string; keterangan: string }[] = [
  { jenis: 'rutin_bulanan', nama: 'SPP',           nominal: 250_000, warna: '#69C183', keterangan: 'Sumbangan pembinaan pendidikan bulanan' },
  { jenis: 'per_semester',  nama: 'Uang Kegiatan', nominal: 300_000, warna: '#7D7ADC', keterangan: 'Kegiatan siswa setiap semester' },
  { jenis: 'sekali_bayar',  nama: 'Daftar Ulang',  nominal: 750_000, warna: '#3C75B7', keterangan: 'Daftar ulang awal tahun ajaran' },
]

const WARNA_KELAS = ['#3C75B7', '#69C183', '#7D7ADC', '#F59E0B', '#14B8A6', '#EC4899']

const NAMA_LAKI = [
  'Ahmad', 'Budi', 'Dimas', 'Fajar', 'Gilang', 'Hafiz', 'Ilham', 'Joko', 'Kevin', 'Lutfi',
  'Muhammad', 'Naufal', 'Oki', 'Putra', 'Rafi', 'Rizky', 'Satria', 'Taufik', 'Umar', 'Wahyu',
  'Yoga', 'Zaki', 'Arif', 'Bayu', 'Dafa', 'Eko', 'Farhan', 'Galih', 'Hendra', 'Irfan',
]
const NAMA_PEREMPUAN = [
  'Aisyah', 'Bunga', 'Citra', 'Dewi', 'Elisa', 'Fitri', 'Gita', 'Hana', 'Indah', 'Jihan',
  'Kirana', 'Laras', 'Maya', 'Nabila', 'Olivia', 'Putri', 'Rara', 'Salsabila', 'Tiara', 'Ulfa',
  'Vina', 'Wulan', 'Yuni', 'Zahra', 'Anisa', 'Dinda', 'Intan', 'Nadia', 'Siti', 'Tasya',
]
const NAMA_KELUARGA = [
  'Pratama', 'Saputra', 'Wijaya', 'Nugroho', 'Santoso', 'Hidayat', 'Kurniawan', 'Setiawan', 'Rahman', 'Siregar',
  'Nasution', 'Lubis', 'Hakim', 'Firmansyah', 'Ramadhan', 'Syahputra', 'Permana', 'Gunawan', 'Utami', 'Lestari',
  'Wibowo', 'Susanto', 'Hasibuan', 'Harahap', 'Purnomo', 'Maulana', 'Anggraini', 'Putri', 'Wahyudi', 'Salim',
]
const NAMA_ORANG_TUA = [
  'Agus', 'Bambang', 'Dedi', 'Hadi', 'Iwan', 'Joko', 'Rudi', 'Slamet', 'Sri', 'Yanti',
  'Rina', 'Wati', 'Ani', 'Ratna', 'Endang', 'Heru', 'Asep', 'Dadang', 'Nur', 'Lina',
]

type Metode = 'tunai' | 'transfer' | 'qris' | 'va'
const METODE_TERBOBOT: Metode[] = ['tunai', 'tunai', 'tunai', 'transfer', 'transfer', 'qris', 'qris', 'va']

/**
 * Pola bayar per siswa. Proporsinya mengikuti draft: mayoritas lancar, sebagian
 * kadang telat, sedikit menunggak, ada cicilan.
 */
type Profil = 'lancar' | 'kadang_telat' | 'cicilan' | 'menunggak'

// ── Bentuk baris yang dikirim ke database ────────────────────────────────────

export interface TahunAjaranBaru {
  id: string; sekolah_id: string; nama: string
  tanggal_mulai: string; tanggal_selesai: string
  semester_ganjil_mulai: string; semester_ganjil_selesai: string
  semester_genap_mulai: string; semester_genap_selesai: string
  is_aktif: boolean; diarsipkan_pada: string | null
}
export interface KelasBaru {
  id: string; sekolah_id: string; nama: string; jenjang: string; warna: string; tahun_ajaran: string; semester: string
}
export interface KomponenBaru {
  id: string; sekolah_id: string; jenis: KomponenJenis; nama: string; kelas_warna: string
  keterangan: string; nominal_default: number; tahun_ajaran: string; semester: string
}
export interface PaketBaru { id: string; sekolah_id: string; nama: string; tahun_ajaran: string; tanggal_jatuh_tempo: number }
export interface PaketKelasBaru { paket_id: string; kelas_id: string }
export interface PaketKomponenBaru { paket_id: string; komponen_id: string; nominal: number }
export interface SiswaBaru {
  id: string; sekolah_id: string; nama: string; nis: string; nisn: string
  kelas_id: string | null; nama_wali: string; no_wa: string | null
  status: 'aktif' | 'alumni'; jenis_alumni: string | null; tahun_lulus: string | null
  /** Snapshot teks kelas terakhir — hanya untuk alumni, seperti yang ditulis naik kelas */
  kelas: string | null
}
export interface TagihanBaru {
  id: string; sekolah_id: string; siswa_id: string
  /** Diisi eksplisit: trigger hanya mengisi yang kosong, dan kelas siswa sekarang
   *  sudah bergeser dari kelas saat tagihan tahun lalu dibuat */
  kelas_id: string; tahun_ajaran_id: string
  bulan: number; tahun: number; jatuh_tempo: string
  total_nominal: number; status: 'lunas' | 'cicilan' | 'belum_bayar'; created_at: string
}
export interface TagihanItemBaru { tagihan_id: string; komponen_id: string; nama_komponen: string; nominal: number }
export interface PembayaranBaru {
  id: string; sekolah_id: string; tagihan_id: string; siswa_id: string
  jumlah: number; metode: Metode; tanggal_bayar: string; catatan: string
  status: 'terkonfirmasi'; created_at: string
}

/** dibuat_oleh diisi route dengan id akun demo, supaya catatannya bisa dihapus dari aplikasi */
export interface CatatanBaru {
  id: string; sekolah_id: string; siswa_id: string
  alasan: AlasanTindakLanjut; catatan: string; created_at: string
}

export interface RencanaDemo {
  catatanTindakLanjut: CatatanBaru[]
  tahunAjaran:   TahunAjaranBaru[]
  kelas:         KelasBaru[]
  komponen:      KomponenBaru[]
  paket:         PaketBaru[]
  paketKelas:    PaketKelasBaru[]
  paketKomponen: PaketKomponenBaru[]
  siswa:         SiswaBaru[]
  tagihan:       TagihanBaru[]
  tagihanItem:   TagihanItemBaru[]
  pembayaran:    PembayaranBaru[]
}

export interface OpsiDemo {
  sekolahId:      string
  jenjangSekolah: string
  sekarang:       Date
  /** Nomor WA semua orang tua contoh — satu nomor milik tim, supaya pengingat tidak
   *  pernah terkirim ke orang sungguhan. null = dikosongkan. */
  noWa:           string | null
  benih?:         number
}

// ── Utilitas ─────────────────────────────────────────────────────────────────

/** mulberry32 — cukup untuk data contoh, dan sama persis di setiap mesin */
function buatAcak(benih: number) {
  let s = benih >>> 0
  const acak = (): number => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const antara = (min: number, maks: number): number => min + Math.floor(acak() * (maks - min + 1))
  const pilih  = <T>(daftar: readonly T[]): T => daftar[Math.floor(acak() * daftar.length)]
  return { acak, antara, pilih }
}

/** Waktu WIB sebagai ISO UTC. Hari yang melewati akhir bulan otomatis bergulir. */
const isoWIB = (tahun: number, bulan: number, hari: number, jam = 0, menit = 0): string =>
  new Date(Date.UTC(tahun, bulan - 1, hari, jam - 7, menit)).toISOString()

/** Sama dengan hitung_jatuh_tempo di database: detik terakhir hari jatuh tempo, WIB */
function jatuhTempoISO(tahun: number, bulan: number, tanggal: number): string {
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  return new Date(Date.UTC(tahun, bulan - 1, Math.min(tanggal, hariTerakhir), 16, 59, 59, 999)).toISOString()
}

const bulatRibuan = (n: number) => Math.round(n / 1000) * 1000

// ── Rancangan ────────────────────────────────────────────────────────────────

export function rancangDataDemo(opsi: OpsiDemo): RencanaDemo {
  const { acak, antara, pilih } = buatAcak(opsi.benih ?? 20260925)
  // Modul crypto Node, bukan global — globalnya belum pasti ada di semua versi Node server
  const buatId     = () => randomUUID()
  const sekolah_id = opsi.sekolahId
  const sekarangMs = opsi.sekarang.getTime()

  const [tahunIni, bulanIni] = tanggalWIB(opsi.sekarang).split('-').map(Number)
  const mulaiTAAktif = bulanIni >= 7 ? tahunIni : tahunIni - 1
  const semesterKini = bulanIni >= 7 ? 'Ganjil' : 'Genap'

  // ── Tahun ajaran: lalu (arsip) + aktif, Juli–Juni
  const buatTA = (mulai: number, aktif: boolean): TahunAjaranBaru => ({
    id: buatId(), sekolah_id, nama: `${mulai}/${mulai + 1}`,
    tanggal_mulai:         `${mulai}-07-01`,     tanggal_selesai:         `${mulai + 1}-06-30`,
    semester_ganjil_mulai: `${mulai}-07-01`,     semester_ganjil_selesai: `${mulai}-12-31`,
    semester_genap_mulai:  `${mulai + 1}-01-01`, semester_genap_selesai:  `${mulai + 1}-06-30`,
    is_aktif: aktif,
    diarsipkan_pada: aktif ? null : isoWIB(mulai + 1, 7, 1),
  })
  const taLalu  = buatTA(mulaiTAAktif - 1, false)
  const taAktif = buatTA(mulaiTAAktif, true)

  // ── Kelas: baris kelas dipakai kedua tahun ajaran, persis seperti setelah naik
  //    kelas di aplikasi — yang berpindah siswanya, bukan kelasnya
  const tingkat      = JENJANG_MAP[opsi.jenjangSekolah] ?? JENJANG_MAP['SMP/MTs']
  const jumlahRombel = tingkat.length >= 6 ? 2 : 4
  const identitas    = (tingkat[0] === 'A' ? ['1', '2', '3', '4'] : ['A', 'B', 'C', 'D']).slice(0, jumlahRombel)
  const kelasPerTingkat: KelasBaru[][] = tingkat.map((t, i) => identitas.map(idn => ({
    id: buatId(), sekolah_id, nama: `${t}-${idn}`, jenjang: t,
    warna: WARNA_KELAS[i % WARNA_KELAS.length], tahun_ajaran: taAktif.nama, semester: semesterKini,
  })))

  // ── Komponen dan paket: dibuat ulang per tahun ajaran, seperti salin paket di aplikasi
  const komponenPerTA = new Map<string, KomponenBaru[]>()
  const paket: PaketBaru[] = []
  const paketKelas: PaketKelasBaru[] = []
  const paketKomponen: PaketKomponenBaru[] = []
  for (const ta of [taLalu, taAktif]) {
    const komponen = KOMPONEN_DEMO.map(k => ({
      id: buatId(), sekolah_id, jenis: k.jenis, nama: k.nama, kelas_warna: k.warna,
      keterangan: k.keterangan, nominal_default: k.nominal, tahun_ajaran: ta.nama, semester: 'Ganjil',
    }))
    komponenPerTA.set(ta.id, komponen)
    tingkat.forEach((t, i) => {
      const p: PaketBaru = { id: buatId(), sekolah_id, nama: `Paket Kelas ${t}`, tahun_ajaran: ta.nama, tanggal_jatuh_tempo: TANGGAL_JATUH_TEMPO_DEMO }
      paket.push(p)
      for (const k of kelasPerTingkat[i]) paketKelas.push({ paket_id: p.id, kelas_id: k.id })
      for (const k of komponen) paketKomponen.push({ paket_id: p.id, komponen_id: k.id, nominal: k.nominal_default })
    })
  }

  // ── Siswa per kohort
  interface Keanggotaan { ta: TahunAjaranBaru; kelas: KelasBaru }
  interface SiswaRencana {
    siswa:        SiswaBaru
    profil:       Profil
    metode:       Metode
    /** Untuk profil menunggak: berapa tagihan terakhir yang belum dibayar sama sekali */
    bulanMacet:   number
    keanggotaan:  Keanggotaan[]
  }

  const daftarSiswa: SiswaRencana[] = []
  let urut = 0

  const tambahSiswa = (keanggotaan: Keanggotaan[], tahunMasuk: number, alumni: boolean) => {
    urut += 1
    const perempuan = acak() < 0.5
    const keluarga  = pilih(NAMA_KELUARGA)
    const r = acak()
    const profil: Profil = r < 0.65 ? 'lancar' : r < 0.85 ? 'kadang_telat' : r < 0.93 ? 'cicilan' : 'menunggak'
    const terakhir = keanggotaan[keanggotaan.length - 1]
    daftarSiswa.push({
      profil,
      metode:     pilih(METODE_TERBOBOT),
      bulanMacet: antara(2, 5),
      keanggotaan,
      siswa: {
        id: buatId(), sekolah_id,
        nama:         `${pilih(perempuan ? NAMA_PEREMPUAN : NAMA_LAKI)} ${keluarga}`,
        nis:          `${tahunMasuk}${String(urut).padStart(4, '0')}`,
        nisn:         `00${String(tahunMasuk % 100).padStart(2, '0')}${String(urut).padStart(6, '0')}`,
        kelas_id:     alumni ? null : terakhir.kelas.id,
        nama_wali:    `${pilih(NAMA_ORANG_TUA)} ${keluarga}`,
        no_wa:        opsi.noWa,
        status:       alumni ? 'alumni' : 'aktif',
        jenis_alumni: alumni ? 'lulus' : null,
        tahun_lulus:  alumni ? String(mulaiTAAktif) : null,
        kelas:        alumni ? terakhir.kelas.nama : null,
      },
    })
  }

  const tingkatAkhir = tingkat.length - 1
  for (let r = 0; r < jumlahRombel; r++) {
    tingkat.forEach((_, i) => {
      // Tingkat terbawah = siswa baru Juli ini; tingkat lain naik dari tingkat di bawahnya
      const keanggotaan: Keanggotaan[] = i === 0
        ? [{ ta: taAktif, kelas: kelasPerTingkat[0][r] }]
        : [{ ta: taLalu, kelas: kelasPerTingkat[i - 1][r] }, { ta: taAktif, kelas: kelasPerTingkat[i][r] }]
      const jumlah = antara(22, 26)
      for (let n = 0; n < jumlah; n++) tambahSiswa(keanggotaan, mulaiTAAktif - i, false)
    })
    // Lulus Juni lalu dari tingkat teratas
    const jumlahAlumni = antara(22, 26)
    for (let n = 0; n < jumlahAlumni; n++) {
      tambahSiswa([{ ta: taLalu, kelas: kelasPerTingkat[tingkatAkhir][r] }], mulaiTAAktif - 1 - tingkatAkhir, true)
    }
  }

  // ── Bulan yang ditagih: 12 bulan terakhir sampai bulan ini, dan selalu memuat
  //    minimal tiga bulan terakhir tahun ajaran lalu. Tanpa itu, data yang diisi
  //    April–Juni seluruhnya jatuh di tahun ajaran aktif: arsip kosong, alumni tanpa
  //    tagihan, dan naik kelas tidak terlihat di riwayat.
  const indeksKini = periodeIndex(bulanIni, tahunIni)
  const indeksAwal = Math.min(indeksKini - 11, periodeIndex(7, mulaiTAAktif) - 3)
  const bulanTagih: { bulan: number; tahun: number; ta: TahunAjaranBaru }[] = []
  for (let p = indeksAwal; p <= indeksKini; p++) {
    const tahun = Math.floor((p - 1) / 12)
    const bulan = p - tahun * 12
    const ta    = p >= periodeIndex(7, mulaiTAAktif) ? taAktif : taLalu
    bulanTagih.push({ bulan, tahun, ta })
  }

  // ── Tagihan, rincian, dan pembayaran
  const tagihan: TagihanBaru[] = []
  const tagihanItem: TagihanItemBaru[] = []
  const pembayaran: PembayaranBaru[] = []
  // Aturan "sekali per semester" dan "sekali per tahun ajaran" dibaca dari riwayat
  // ini lewat komponenDitagihkan — aturan yang sama dengan generate tagihan di aplikasi
  const riwayat: RiwayatTagih = new Map()

  for (const s of daftarSiswa) {
    const milikSiswa: { t: TagihanBaru }[] = []

    for (const { bulan, tahun, ta } of bulanTagih) {
      const anggota = s.keanggotaan.find(k => k.ta.id === ta.id)
      if (!anggota) continue

      const komponen = (komponenPerTA.get(ta.id) ?? [])
        .filter(k => komponenDitagihkan(k.jenis, bulan, tahun, ta, s.siswa.id, k.id, riwayat))
      if (komponen.length === 0) continue

      const t: TagihanBaru = {
        id: buatId(), sekolah_id, siswa_id: s.siswa.id,
        kelas_id: anggota.kelas.id, tahun_ajaran_id: ta.id,
        bulan, tahun,
        jatuh_tempo:   jatuhTempoISO(tahun, bulan, TANGGAL_JATUH_TEMPO_DEMO),
        total_nominal: komponen.reduce((sum, k) => sum + k.nominal_default, 0),
        status:        'belum_bayar',
        created_at:    isoWIB(tahun, bulan, 1, 7),
      }
      for (const k of komponen) {
        tagihanItem.push({ tagihan_id: t.id, komponen_id: k.id, nama_komponen: k.nama, nominal: k.nominal_default })
        const kunci = kunciRiwayat(s.siswa.id, k.id)
        riwayat.set(kunci, [...(riwayat.get(kunci) ?? []), periodeIndex(bulan, tahun)])
      }
      tagihan.push(t)
      milikSiswa.push({ t })
    }

    milikSiswa.forEach(({ t }, urutan) => {
      // Rencana cicilan: [porsi nominal, selisih hari dari tanggal jatuh tempo]
      const tepat = () => antara(-(TANGGAL_JATUH_TEMPO_DEMO - 1), 0)
      let rencana: [number, number][] = []

      switch (s.profil) {
        case 'lancar':
          rencana = [[1, acak() < 0.9 ? tepat() : antara(1, 5)]]
          break
        case 'kadang_telat':
          rencana = [[1, acak() < 0.55 ? tepat() : antara(5, 30)]]
          break
        case 'cicilan': {
          if (acak() < 0.25) { rencana = [[1, tepat()]]; break }
          const porsi = acak() < 0.5 ? [0.5, 0.5] : [0.4, 0.3, 0.3]
          let hari = antara(-(TANGGAL_JATUH_TEMPO_DEMO - 1), -2)
          rencana = porsi.map((p, i) => {
            if (i > 0) hari += antara(7, 20)
            return [p, hari]
          })
          break
        }
        case 'menunggak':
          // Tagihan-tagihan terakhirnya belum tersentuh sama sekali; yang lebih lama
          // dibayar jauh terlambat, sebagian hanya separuh
          if (urutan >= milikSiswa.length - s.bulanMacet) { rencana = []; break }
          rencana = acak() < 0.25 ? [[0.5, antara(15, 60)]] : [[1, antara(15, 60)]]
          break
      }

      // Rencana yang porsinya genap satu ditutup dengan sisa persis di cicilan
      // terakhir, supaya pembulatan ribuan tidak meninggalkan selisih Rp 1.000
      const melunasi = Math.abs(rencana.reduce((sum, [p]) => sum + p, 0) - 1) < 1e-9
      let terbayar = 0
      rencana.forEach(([porsi, selisih], i) => {
        const tanggal = isoWIB(t.tahun, t.bulan, TANGGAL_JATUH_TEMPO_DEMO + selisih, antara(8, 16), antara(0, 59))
        // Pembayaran yang jatuh setelah hari ini belum terjadi — tagihannya tetap
        // terbuka dan tampil sebagai "akan masuk" atau cicilan berjalan
        if (new Date(tanggal).getTime() > sekarangMs) return
        const jumlah = melunasi && i === rencana.length - 1
          ? t.total_nominal - terbayar
          : bulatRibuan(t.total_nominal * porsi)
        if (jumlah <= 0) return
        terbayar += jumlah
        pembayaran.push({
          id: buatId(), sekolah_id, tagihan_id: t.id, siswa_id: s.siswa.id,
          jumlah,
          metode:        acak() < 0.7 ? s.metode : pilih(METODE_TERBOBOT),
          tanggal_bayar: tanggal,
          catatan:       'Data contoh',
          status:        'terkonfirmasi',
          created_at:    tanggal,
        })
      })

      t.status = terbayar >= t.total_nominal ? 'lunas' : terbayar > 0 ? 'cicilan' : 'belum_bayar'
    })
  }

  // ── Catatan tindak lanjut untuk siswa yang menunggak. Dibuat paling akhir supaya
  //    urutan angka acak di atas — dan pola bayarnya — tidak berubah.
  const CONTOH_CATATAN: { alasan: AlasanTindakLanjut; catatan: string }[] = [
    { alasan: 'kendala_ekonomi',  catatan: 'Orang tua menyampaikan usaha sedang sepi, minta waktu sampai akhir bulan.' },
    { alasan: 'kendala_ekonomi',  catatan: 'Ayah baru selesai kontrak kerja. Orang tua minta izin mencicil mulai bulan depan.' },
    { alasan: 'lupa',             catatan: 'Sudah ditelepon. Orang tua lupa karena nomor WA yang terdaftar jarang dibuka.' },
    { alasan: 'sengketa_tagihan', catatan: 'Orang tua menanyakan rincian Uang Kegiatan semester ini, menunggu penjelasan bendahara.' },
  ]
  const catatanTindakLanjut: CatatanBaru[] = daftarSiswa
    .filter(s => s.profil === 'menunggak')
    .map(s => {
      const contoh = pilih(CONTOH_CATATAN)
      return {
        id: buatId(), sekolah_id, siswa_id: s.siswa.id,
        alasan:     contoh.alasan,
        catatan:    contoh.catatan,
        created_at: new Date(sekarangMs - antara(3, 25) * 86_400_000).toISOString(),
      }
    })

  return {
    catatanTindakLanjut,
    tahunAjaran: [taLalu, taAktif],
    kelas:       kelasPerTingkat.flat(),
    komponen:    [...komponenPerTA.values()].flat(),
    paket,
    paketKelas,
    paketKomponen,
    siswa:       daftarSiswa.map(s => s.siswa),
    tagihan,
    tagihanItem,
    pembayaran,
  }
}
