export type StatusBayar = 'lunas' | 'belum' | 'terlambat'

export interface Siswa {
  id: string
  nama: string
  nis: string
  kelas: string
  nominal: number
  status: StatusBayar
  tanggalBayar: string | null
  noWa: string
}

export const MOCK_USER = {
  nama: 'Sri Rahayu, S.Pd',
  jabatan: 'Bendahara',
  sekolah: 'SDIT Al-Hikmah Yogyakarta',
  avatar: 'SR',
  email: 'bendahara@sdit.sch.id',
  password: 'demo2025',
}

export const BULAN_AKTIF = 'April 2025'

export const MOCK_SISWA: Siswa[] = [
  { id: '1',  nama: 'Alif Ramadhan',   nis: '2401001', kelas: 'VII-A',  nominal: 450000, status: 'lunas',     tanggalBayar: '2 Apr 2025',  noWa: '6281111111111' },
  { id: '2',  nama: 'Budi Santoso',    nis: '2401002', kelas: 'VII-A',  nominal: 450000, status: 'terlambat', tanggalBayar: null,           noWa: '6281222222222' },
  { id: '3',  nama: 'Citra Dewi',      nis: '2401003', kelas: 'VII-B',  nominal: 450000, status: 'belum',     tanggalBayar: null,           noWa: '6281333333333' },
  { id: '4',  nama: 'Dina Putri',      nis: '2401004', kelas: 'VII-B',  nominal: 450000, status: 'lunas',     tanggalBayar: '5 Apr 2025',  noWa: '6281444444444' },
  { id: '5',  nama: 'Eko Prasetyo',    nis: '2401005', kelas: 'VII-C',  nominal: 450000, status: 'lunas',     tanggalBayar: '3 Apr 2025',  noWa: '6281555555555' },
  { id: '6',  nama: 'Fajar Nugroho',   nis: '2401006', kelas: 'VIII-A', nominal: 475000, status: 'terlambat', tanggalBayar: null,           noWa: '6281666666666' },
  { id: '7',  nama: 'Gita Rahayu',     nis: '2401007', kelas: 'VIII-A', nominal: 475000, status: 'lunas',     tanggalBayar: '1 Apr 2025',  noWa: '6281777777777' },
  { id: '8',  nama: 'Hendra Wijaya',   nis: '2401008', kelas: 'VIII-B', nominal: 475000, status: 'belum',     tanggalBayar: null,           noWa: '6281888888888' },
  { id: '9',  nama: 'Indah Permata',   nis: '2401009', kelas: 'VIII-B', nominal: 475000, status: 'lunas',     tanggalBayar: '7 Apr 2025',  noWa: '6281999999999' },
  { id: '10', nama: 'Joko Susilo',     nis: '2401010', kelas: 'VIII-C', nominal: 475000, status: 'terlambat', tanggalBayar: null,           noWa: '6282111111111' },
  { id: '11', nama: 'Kartika Sari',    nis: '2401011', kelas: 'IX-A',   nominal: 500000, status: 'lunas',     tanggalBayar: '4 Apr 2025',  noWa: '6282222222222' },
  { id: '12', nama: 'Luki Andrian',    nis: '2401012', kelas: 'IX-A',   nominal: 500000, status: 'lunas',     tanggalBayar: '6 Apr 2025',  noWa: '6282333333333' },
  { id: '13', nama: 'Maya Fitriani',   nis: '2401013', kelas: 'IX-B',   nominal: 500000, status: 'belum',     tanggalBayar: null,           noWa: '6282444444444' },
  { id: '14', nama: 'Nanda Kusuma',    nis: '2401014', kelas: 'IX-B',   nominal: 500000, status: 'lunas',     tanggalBayar: '8 Apr 2025',  noWa: '6282555555555' },
  { id: '15', nama: 'Omar Hakim',      nis: '2401015', kelas: 'IX-C',   nominal: 500000, status: 'terlambat', tanggalBayar: null,           noWa: '6282666666666' },
  { id: '16', nama: 'Putri Ayu',       nis: '2401016', kelas: 'IX-C',   nominal: 500000, status: 'lunas',     tanggalBayar: '2 Apr 2025',  noWa: '6282777777777' },
  { id: '17', nama: 'Reza Firmansyah', nis: '2401017', kelas: 'VII-A',  nominal: 450000, status: 'belum',     tanggalBayar: null,           noWa: '6282888888888' },
  { id: '18', nama: 'Sinta Maharani',  nis: '2401018', kelas: 'VII-B',  nominal: 450000, status: 'lunas',     tanggalBayar: '3 Apr 2025',  noWa: '6282999999999' },
  { id: '19', nama: 'Tono Wibowo',     nis: '2401019', kelas: 'VIII-A', nominal: 475000, status: 'belum',     tanggalBayar: null,           noWa: '6283111111111' },
  { id: '20', nama: 'Ulfa Ramadhani',  nis: '2401020', kelas: 'VIII-B', nominal: 475000, status: 'lunas',     tanggalBayar: '9 Apr 2025',  noWa: '6283222222222' },
]