export const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

export const formatKelasNama = (k: string) => k.replace(/-/g, '')

export function formatTanggalWaktu(iso: string): string {
  const d   = new Date(iso)
  const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).replace(':', '.')
  return `${tgl}, ${jam} WIB`
}

/** "25 Oktober 2026" menurut kalender WIB — dari 'YYYY-MM-DD' maupun timestamp */
export function formatTanggalWIB(s: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00+07:00`) : new Date(s)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
}

export function formatTanggal(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function tanggalTagihanBerikutnya(bulan: number, tahun: number): string {
  const nextBulan = bulan === 12 ? 1 : bulan + 1
  const nextTahun = bulan === 12 ? tahun + 1 : tahun
  return formatTanggal(new Date(Date.UTC(nextTahun, nextBulan - 1, 1)).toISOString())
}
