export type StatusBayar = 'lunas' | 'belum' | 'terlambat'

export interface Siswa {
  id: string; nama: string; nis: string; kelas: string
  noWa: string; namaWali: string; nominal: number
  status: StatusBayar; tanggalBayar: string | null; aktif: boolean
}

export interface Tagihan {
  id: string; bulan: string; tahun: number; jenis: string
  nominal: number; kelas: string; tanggalJatuhTempo: string
  totalSiswa: number; sudahBayar: number; status: 'aktif' | 'selesai' | 'draft'
}

export interface TagihanSiswa {
  tagihanId: string
  siswaId: string
  status: StatusBayar
  tanggalBayar: string | null
}

export interface Pembayaran {
  id: string; siswaId: string; namaSiswa: string; nis: string
  kelas: string; bulan: string; nominal: number
  metode: 'Transfer' | 'Tunai'
  tanggal: string; status: 'terkonfirmasi' | 'menunggu'; noResi: string
}

export const MOCK_USER = {
  nama: 'Sri Rahayu, S.Pd', jabatan: 'Bendahara',
  sekolah: 'SDIT Al-Hikmah Yogyakarta', avatar: 'SR',
  email: 'bendahara@sdit.sch.id', password: 'demo2026',
  noWa: '6281234567890', yayasan: 'Yayasan Pendidikan Al-Hikmah',
  alamat: 'Jl. Kaliurang Km.5, Sleman, Yogyakarta', npsn: '20403456',
}

export const BULAN_AKTIF = 'April 2026'
export const TAHUN_AKTIF = 'Semester Genap 2025/2026'

// ─── Master Siswa ─────────────────────────────────────────────────────────────
// VII  (nominal 450.000): id 1,2,3,4,5,17,18  → 7 siswa
// VIII (nominal 475.000): id 6,7,8,9,10,19,20 → 7 siswa
// IX   (nominal 500.000): id 11,12,13,14,15,16 → 6 siswa
export const MOCK_SISWA: Siswa[] = [
  { id:'1',  nama:'Alif Ramadhan',   nis:'2401001', kelas:'VII-A',  noWa:'6281111111111', namaWali:'Ahmad Fauzi',     nominal:450000, status:'lunas',     tanggalBayar:'2 Apr 2026',  aktif:true },
  { id:'2',  nama:'Budi Santoso',    nis:'2401002', kelas:'VII-A',  noWa:'6281222222222', namaWali:'Slamet Santoso',  nominal:450000, status:'terlambat', tanggalBayar:'15 Apr 2026', aktif:true },
  { id:'3',  nama:'Citra Dewi',      nis:'2401003', kelas:'VII-B',  noWa:'6281333333333', namaWali:'Dewi Lestari',    nominal:450000, status:'belum',     tanggalBayar:null,           aktif:true },
  { id:'4',  nama:'Dina Putri',      nis:'2401004', kelas:'VII-B',  noWa:'6281444444444', namaWali:'Hendra Gunawan',  nominal:450000, status:'lunas',     tanggalBayar:'5 Apr 2026',  aktif:true },
  { id:'5',  nama:'Eko Prasetyo',    nis:'2401005', kelas:'VII-C',  noWa:'6281555555555', namaWali:'Prasetyo Utomo',  nominal:450000, status:'lunas',     tanggalBayar:'3 Apr 2026',  aktif:true },
  { id:'6',  nama:'Fajar Nugroho',   nis:'2401006', kelas:'VIII-A', noWa:'6281666666666', namaWali:'Nugroho Santoso', nominal:475000, status:'terlambat', tanggalBayar:'18 Apr 2026', aktif:true },
  { id:'7',  nama:'Gita Rahayu',     nis:'2401007', kelas:'VIII-A', noWa:'6281777777777', namaWali:'Rahayu Setiawan', nominal:475000, status:'lunas',     tanggalBayar:'1 Apr 2026',  aktif:true },
  { id:'8',  nama:'Hendra Wijaya',   nis:'2401008', kelas:'VIII-B', noWa:'6281888888888', namaWali:'Wijaya Kusuma',   nominal:475000, status:'belum',     tanggalBayar:null,           aktif:true },
  { id:'9',  nama:'Indah Permata',   nis:'2401009', kelas:'VIII-B', noWa:'6281999999999', namaWali:'Permata Indah',   nominal:475000, status:'lunas',     tanggalBayar:'7 Apr 2026',  aktif:true },
  { id:'10', nama:'Joko Susilo',     nis:'2401010', kelas:'VIII-C', noWa:'6282111111111', namaWali:'Susilo Bambang',  nominal:475000, status:'terlambat', tanggalBayar:'20 Apr 2026', aktif:true },
  { id:'11', nama:'Kartika Sari',    nis:'2401011', kelas:'IX-A',   noWa:'6282222222222', namaWali:'Sari Kartika',    nominal:500000, status:'lunas',     tanggalBayar:'4 Apr 2026',  aktif:true },
  { id:'12', nama:'Luki Andrian',    nis:'2401012', kelas:'IX-A',   noWa:'6282333333333', namaWali:'Andrian Luki',    nominal:500000, status:'lunas',     tanggalBayar:'6 Apr 2026',  aktif:true },
  { id:'13', nama:'Maya Fitriani',   nis:'2401013', kelas:'IX-B',   noWa:'6282444444444', namaWali:'Fitriani Maya',   nominal:500000, status:'belum',     tanggalBayar:null,           aktif:true },
  { id:'14', nama:'Nanda Kusuma',    nis:'2401014', kelas:'IX-B',   noWa:'6282555555555', namaWali:'Kusuma Nanda',    nominal:500000, status:'lunas',     tanggalBayar:'8 Apr 2026',  aktif:true },
  { id:'15', nama:'Omar Hakim',      nis:'2401015', kelas:'IX-C',   noWa:'6282666666666', namaWali:'Hakim Omar',      nominal:500000, status:'terlambat', tanggalBayar:'22 Apr 2026', aktif:true },
  { id:'16', nama:'Putri Ayu',       nis:'2401016', kelas:'IX-C',   noWa:'6282777777777', namaWali:'Ayu Putri',       nominal:500000, status:'lunas',     tanggalBayar:'2 Apr 2026',  aktif:true },
  { id:'17', nama:'Reza Firmansyah', nis:'2401017', kelas:'VII-A',  noWa:'6282888888888', namaWali:'Firmansyah Reza', nominal:450000, status:'belum',     tanggalBayar:null,           aktif:true },
  { id:'18', nama:'Sinta Maharani',  nis:'2401018', kelas:'VII-B',  noWa:'6282999999999', namaWali:'Maharani Sinta',  nominal:450000, status:'lunas',     tanggalBayar:'3 Apr 2026',  aktif:true },
  { id:'19', nama:'Tono Wibowo',     nis:'2401019', kelas:'VIII-A', noWa:'6283111111111', namaWali:'Wibowo Tono',     nominal:475000, status:'belum',     tanggalBayar:null,           aktif:true },
  { id:'20', nama:'Ulfa Ramadhani',  nis:'2401020', kelas:'VIII-B', noWa:'6283222222222', namaWali:'Ramadhani Ulfa',  nominal:475000, status:'lunas',     tanggalBayar:'9 Apr 2026',  aktif:true },
]

// ─── Tagihan SPP ──────────────────────────────────────────────────────────────
// sudahBayar dihitung dari MOCK_TAGIHAN_SISWA (lunas + terlambat)
export const MOCK_TAGIHAN: Tagihan[] = [
  // April 2026 — aktif (bulan berjalan)
  { id:'T001', bulan:'April',    tahun:2026, jenis:'SPP Bulanan', nominal:450000, kelas:'VII',  tanggalJatuhTempo:'10 Apr 2026', totalSiswa:7, sudahBayar:5, status:'aktif'   },
  { id:'T002', bulan:'April',    tahun:2026, jenis:'SPP Bulanan', nominal:475000, kelas:'VIII', tanggalJatuhTempo:'10 Apr 2026', totalSiswa:7, sudahBayar:5, status:'aktif'   },
  { id:'T003', bulan:'April',    tahun:2026, jenis:'SPP Bulanan', nominal:500000, kelas:'IX',   tanggalJatuhTempo:'10 Apr 2026', totalSiswa:6, sudahBayar:5, status:'aktif'   },
  // Maret 2026 — selesai (semua lunas)
  { id:'T004', bulan:'Maret',    tahun:2026, jenis:'SPP Bulanan', nominal:450000, kelas:'VII',  tanggalJatuhTempo:'10 Mar 2026', totalSiswa:7, sudahBayar:7, status:'selesai' },
  { id:'T005', bulan:'Maret',    tahun:2026, jenis:'SPP Bulanan', nominal:475000, kelas:'VIII', tanggalJatuhTempo:'10 Mar 2026', totalSiswa:7, sudahBayar:7, status:'selesai' },
  { id:'T006', bulan:'Maret',    tahun:2026, jenis:'SPP Bulanan', nominal:500000, kelas:'IX',   tanggalJatuhTempo:'10 Mar 2026', totalSiswa:6, sudahBayar:6, status:'selesai' },
  // Februari 2026 — selesai (semua lunas)
  { id:'T007', bulan:'Februari', tahun:2026, jenis:'SPP Bulanan', nominal:450000, kelas:'VII',  tanggalJatuhTempo:'10 Feb 2026', totalSiswa:7, sudahBayar:7, status:'selesai' },
  { id:'T008', bulan:'Februari', tahun:2026, jenis:'SPP Bulanan', nominal:475000, kelas:'VIII', tanggalJatuhTempo:'10 Feb 2026', totalSiswa:7, sudahBayar:7, status:'selesai' },
  // Mei 2026 — draft (belum dimulai)
  { id:'T009', bulan:'Mei',      tahun:2026, jenis:'SPP Bulanan', nominal:450000, kelas:'VII',  tanggalJatuhTempo:'10 Mei 2026', totalSiswa:7, sudahBayar:0, status:'draft'   },
  { id:'T010', bulan:'Mei',      tahun:2026, jenis:'SPP Bulanan', nominal:475000, kelas:'VIII', tanggalJatuhTempo:'10 Mei 2026', totalSiswa:7, sudahBayar:0, status:'draft'   },
]

// ─── Status Pembayaran per Siswa per Tagihan ──────────────────────────────────
export const MOCK_TAGIHAN_SISWA: TagihanSiswa[] = [
  // ── T001 · April 2026 · Kelas VII ────────────────────────────────────────
  { tagihanId:'T001', siswaId:'1',  status:'lunas',     tanggalBayar:'2 Apr 2026'  },
  { tagihanId:'T001', siswaId:'2',  status:'terlambat', tanggalBayar:'15 Apr 2026' },
  { tagihanId:'T001', siswaId:'3',  status:'belum',     tanggalBayar:null          },
  { tagihanId:'T001', siswaId:'4',  status:'lunas',     tanggalBayar:'5 Apr 2026'  },
  { tagihanId:'T001', siswaId:'5',  status:'lunas',     tanggalBayar:'3 Apr 2026'  },
  { tagihanId:'T001', siswaId:'17', status:'belum',     tanggalBayar:null          },
  { tagihanId:'T001', siswaId:'18', status:'lunas',     tanggalBayar:'3 Apr 2026'  },

  // ── T002 · April 2026 · Kelas VIII ───────────────────────────────────────
  { tagihanId:'T002', siswaId:'6',  status:'terlambat', tanggalBayar:'18 Apr 2026' },
  { tagihanId:'T002', siswaId:'7',  status:'lunas',     tanggalBayar:'1 Apr 2026'  },
  { tagihanId:'T002', siswaId:'8',  status:'belum',     tanggalBayar:null          },
  { tagihanId:'T002', siswaId:'9',  status:'lunas',     tanggalBayar:'7 Apr 2026'  },
  { tagihanId:'T002', siswaId:'10', status:'terlambat', tanggalBayar:'20 Apr 2026' },
  { tagihanId:'T002', siswaId:'19', status:'belum',     tanggalBayar:null          },
  { tagihanId:'T002', siswaId:'20', status:'lunas',     tanggalBayar:'9 Apr 2026'  },

  // ── T003 · April 2026 · Kelas IX ─────────────────────────────────────────
  { tagihanId:'T003', siswaId:'11', status:'lunas',     tanggalBayar:'4 Apr 2026'  },
  { tagihanId:'T003', siswaId:'12', status:'lunas',     tanggalBayar:'6 Apr 2026'  },
  { tagihanId:'T003', siswaId:'13', status:'belum',     tanggalBayar:null          },
  { tagihanId:'T003', siswaId:'14', status:'lunas',     tanggalBayar:'8 Apr 2026'  },
  { tagihanId:'T003', siswaId:'15', status:'terlambat', tanggalBayar:'22 Apr 2026' },
  { tagihanId:'T003', siswaId:'16', status:'lunas',     tanggalBayar:'2 Apr 2026'  },

  // ── T004 · Maret 2026 · Kelas VII — selesai (100%) ───────────────────────
  { tagihanId:'T004', siswaId:'1',  status:'lunas',     tanggalBayar:'5 Mar 2026'  },
  { tagihanId:'T004', siswaId:'2',  status:'lunas',     tanggalBayar:'7 Mar 2026'  },
  { tagihanId:'T004', siswaId:'3',  status:'lunas',     tanggalBayar:'8 Mar 2026'  },
  { tagihanId:'T004', siswaId:'4',  status:'lunas',     tanggalBayar:'3 Mar 2026'  },
  { tagihanId:'T004', siswaId:'5',  status:'lunas',     tanggalBayar:'6 Mar 2026'  },
  { tagihanId:'T004', siswaId:'17', status:'terlambat', tanggalBayar:'15 Mar 2026' },
  { tagihanId:'T004', siswaId:'18', status:'lunas',     tanggalBayar:'4 Mar 2026'  },

  // ── T005 · Maret 2026 · Kelas VIII — selesai (100%) ──────────────────────
  { tagihanId:'T005', siswaId:'6',  status:'lunas',     tanggalBayar:'9 Mar 2026'  },
  { tagihanId:'T005', siswaId:'7',  status:'lunas',     tanggalBayar:'2 Mar 2026'  },
  { tagihanId:'T005', siswaId:'8',  status:'terlambat', tanggalBayar:'18 Mar 2026' },
  { tagihanId:'T005', siswaId:'9',  status:'lunas',     tanggalBayar:'7 Mar 2026'  },
  { tagihanId:'T005', siswaId:'10', status:'lunas',     tanggalBayar:'5 Mar 2026'  },
  { tagihanId:'T005', siswaId:'19', status:'lunas',     tanggalBayar:'6 Mar 2026'  },
  { tagihanId:'T005', siswaId:'20', status:'lunas',     tanggalBayar:'3 Mar 2026'  },

  // ── T006 · Maret 2026 · Kelas IX — selesai (100%) ────────────────────────
  { tagihanId:'T006', siswaId:'11', status:'lunas',     tanggalBayar:'4 Mar 2026'  },
  { tagihanId:'T006', siswaId:'12', status:'lunas',     tanggalBayar:'7 Mar 2026'  },
  { tagihanId:'T006', siswaId:'13', status:'lunas',     tanggalBayar:'6 Mar 2026'  },
  { tagihanId:'T006', siswaId:'14', status:'lunas',     tanggalBayar:'8 Mar 2026'  },
  { tagihanId:'T006', siswaId:'15', status:'terlambat', tanggalBayar:'17 Mar 2026' },
  { tagihanId:'T006', siswaId:'16', status:'lunas',     tanggalBayar:'3 Mar 2026'  },

  // ── T007 · Februari 2026 · Kelas VII — selesai (100%) ────────────────────
  { tagihanId:'T007', siswaId:'1',  status:'lunas',     tanggalBayar:'6 Feb 2026'  },
  { tagihanId:'T007', siswaId:'2',  status:'terlambat', tanggalBayar:'16 Feb 2026' },
  { tagihanId:'T007', siswaId:'3',  status:'lunas',     tanggalBayar:'8 Feb 2026'  },
  { tagihanId:'T007', siswaId:'4',  status:'lunas',     tanggalBayar:'4 Feb 2026'  },
  { tagihanId:'T007', siswaId:'5',  status:'lunas',     tanggalBayar:'5 Feb 2026'  },
  { tagihanId:'T007', siswaId:'17', status:'lunas',     tanggalBayar:'7 Feb 2026'  },
  { tagihanId:'T007', siswaId:'18', status:'lunas',     tanggalBayar:'3 Feb 2026'  },

  // ── T008 · Februari 2026 · Kelas VIII — selesai (100%) ───────────────────
  { tagihanId:'T008', siswaId:'6',  status:'lunas',     tanggalBayar:'7 Feb 2026'  },
  { tagihanId:'T008', siswaId:'7',  status:'lunas',     tanggalBayar:'3 Feb 2026'  },
  { tagihanId:'T008', siswaId:'8',  status:'lunas',     tanggalBayar:'6 Feb 2026'  },
  { tagihanId:'T008', siswaId:'9',  status:'terlambat', tanggalBayar:'19 Feb 2026' },
  { tagihanId:'T008', siswaId:'10', status:'lunas',     tanggalBayar:'8 Feb 2026'  },
  { tagihanId:'T008', siswaId:'19', status:'lunas',     tanggalBayar:'5 Feb 2026'  },
  { tagihanId:'T008', siswaId:'20', status:'lunas',     tanggalBayar:'4 Feb 2026'  },

  // ── T009 · Mei 2026 · Kelas VII — draft (0%) ─────────────────────────────
  { tagihanId:'T009', siswaId:'1',  status:'belum', tanggalBayar:null },
  { tagihanId:'T009', siswaId:'2',  status:'belum', tanggalBayar:null },
  { tagihanId:'T009', siswaId:'3',  status:'belum', tanggalBayar:null },
  { tagihanId:'T009', siswaId:'4',  status:'belum', tanggalBayar:null },
  { tagihanId:'T009', siswaId:'5',  status:'belum', tanggalBayar:null },
  { tagihanId:'T009', siswaId:'17', status:'belum', tanggalBayar:null },
  { tagihanId:'T009', siswaId:'18', status:'belum', tanggalBayar:null },

  // ── T010 · Mei 2026 · Kelas VIII — draft (0%) ────────────────────────────
  { tagihanId:'T010', siswaId:'6',  status:'belum', tanggalBayar:null },
  { tagihanId:'T010', siswaId:'7',  status:'belum', tanggalBayar:null },
  { tagihanId:'T010', siswaId:'8',  status:'belum', tanggalBayar:null },
  { tagihanId:'T010', siswaId:'9',  status:'belum', tanggalBayar:null },
  { tagihanId:'T010', siswaId:'10', status:'belum', tanggalBayar:null },
  { tagihanId:'T010', siswaId:'19', status:'belum', tanggalBayar:null },
  { tagihanId:'T010', siswaId:'20', status:'belum', tanggalBayar:null },
]

export const MOCK_PEMBAYARAN: Pembayaran[] = [
  { id:'P001', siswaId:'1',  namaSiswa:'Alif Ramadhan',  nis:'2401001', kelas:'VII-A',  bulan:'April 2026', nominal:450000, metode:'Transfer', tanggal:'2 Apr 2026',  status:'terkonfirmasi', noResi:'TRF-20250402-001'  },
  { id:'P002', siswaId:'4',  namaSiswa:'Dina Putri',     nis:'2401004', kelas:'VII-B',  bulan:'April 2026', nominal:450000, metode:'Transfer',     tanggal:'5 Apr 2026',  status:'terkonfirmasi', noResi:'TRF-20250405-001' },
  { id:'P003', siswaId:'5',  namaSiswa:'Eko Prasetyo',   nis:'2401005', kelas:'VII-C',  bulan:'April 2026', nominal:450000, metode:'Tunai',    tanggal:'3 Apr 2026',  status:'terkonfirmasi', noResi:'-'  },
  { id:'P004', siswaId:'7',  namaSiswa:'Gita Rahayu',    nis:'2401007', kelas:'VIII-A', bulan:'April 2026', nominal:475000, metode:'Transfer', tanggal:'1 Apr 2026',  status:'terkonfirmasi', noResi:'TRF-20250401-001'  },
  { id:'P005', siswaId:'9',  namaSiswa:'Indah Permata',  nis:'2401009', kelas:'VIII-B', bulan:'April 2026', nominal:475000, metode:'Transfer', tanggal:'7 Apr 2026',  status:'terkonfirmasi', noResi:'TRF-20250407-001'  },
  { id:'P006', siswaId:'11', namaSiswa:'Kartika Sari',   nis:'2401011', kelas:'IX-A',   bulan:'April 2026', nominal:500000, metode:'Tunai',     tanggal:'4 Apr 2026',  status:'terkonfirmasi', noResi:'-' },
  { id:'P007', siswaId:'12', namaSiswa:'Luki Andrian',   nis:'2401012', kelas:'IX-A',   bulan:'April 2026', nominal:500000, metode:'Transfer', tanggal:'6 Apr 2026',  status:'terkonfirmasi', noResi:'TRF-20250406-001'  },
  { id:'P008', siswaId:'14', namaSiswa:'Nanda Kusuma',   nis:'2401014', kelas:'IX-B',   bulan:'April 2026', nominal:500000, metode:'Tunai',    tanggal:'8 Apr 2026',  status:'terkonfirmasi', noResi:'-'  },
  { id:'P009', siswaId:'16', namaSiswa:'Putri Ayu',      nis:'2401016', kelas:'IX-C',   bulan:'April 2026', nominal:500000, metode:'Transfer', tanggal:'2 Apr 2026',  status:'terkonfirmasi', noResi:'TRF-20250402-002'  },
  { id:'P010', siswaId:'18', namaSiswa:'Sinta Maharani', nis:'2401018', kelas:'VII-B',  bulan:'April 2026', nominal:450000, metode:'Tunai',     tanggal:'3 Apr 2026',  status:'terkonfirmasi', noResi:'-' },
  { id:'P011', siswaId:'20', namaSiswa:'Ulfa Ramadhani', nis:'2401020', kelas:'VIII-B', bulan:'April 2026', nominal:475000, metode:'Transfer', tanggal:'9 Apr 2026',  status:'terkonfirmasi', noResi:'TRF-20250409-001'  },
  { id:'P012', siswaId:'2',  namaSiswa:'Budi Santoso',   nis:'2401002', kelas:'VII-A',  bulan:'Maret 2026', nominal:450000, metode:'Tunai',    tanggal:'8 Mar 2026',  status:'terkonfirmasi', noResi:'-'  },
  { id:'P013', siswaId:'3',  namaSiswa:'Citra Dewi',     nis:'2401003', kelas:'VII-B',  bulan:'Maret 2026', nominal:450000, metode:'Transfer', tanggal:'5 Mar 2026',  status:'terkonfirmasi', noResi:'TRF-20250305-001'  },
  { id:'P014', siswaId:'6',  namaSiswa:'Fajar Nugroho',  nis:'2401006', kelas:'VIII-A', bulan:'Maret 2026', nominal:475000, metode:'Transfer', tanggal:'9 Mar 2026',  status:'terkonfirmasi', noResi:'TRF-20250309-001'  },
  { id:'P015', siswaId:'8',  namaSiswa:'Hendra Wijaya',  nis:'2401008', kelas:'VIII-B', bulan:'Maret 2026', nominal:475000, metode:'Transfer',     tanggal:'7 Mar 2026',  status:'terkonfirmasi', noResi:'TRF-20250307-001' },
]

export const LAPORAN_BULANAN = [
  { bulan:'Jan 2026', target:9425000, terkumpul:8950000 },
  { bulan:'Feb 2026', target:9425000, terkumpul:9425000 },
  { bulan:'Mar 2026', target:9425000, terkumpul:9425000 },
  { bulan:'Apr 2026', target:9425000, terkumpul:5475000 },
]
