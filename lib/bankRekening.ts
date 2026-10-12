// Bank yang bisa dipilih untuk rekening resmi sekolah. Dipakai halaman Pengaturan dan
// route /api/rekening, supaya server menolak bank di luar daftar ini.
export const BANK_REKENING = ['BCA', 'BNI', 'BPD DIY', 'BRI', 'BSI', 'BTN', 'CIMB', 'MANDIRI'] as const

export type BankRekening = typeof BANK_REKENING[number]

export const bankSah = (bank: string): bank is BankRekening =>
  (BANK_REKENING as readonly string[]).includes(bank)
