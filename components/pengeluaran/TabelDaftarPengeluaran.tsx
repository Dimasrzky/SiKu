import { ImageIcon, Pencil, Trash2 } from 'lucide-react'
import { formatRupiah } from '@/lib/formatLaporan'
import { kunciKomponen, WARNA_LAINNYA } from '@/lib/kasKomponen'
import { teksSatuan, teksVolume, type KelompokPengeluaran, type Pengeluaran } from '@/lib/pengeluaran'
import { DaftarChip, KOLOM_DAFTAR, NAVY, sKartuPutih } from './BagianPengeluaran'

// Daftar pengeluaran bulan terpilih (tab Daftar Pengeluaran), dikelompokkan per jenis
// seperti format laporan sekolah. Hanya jenis yang punya pengeluaran (keputusan user).

const tanggalPanjang = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })

const sTh: React.CSSProperties = {
  background: NAVY, color: '#fff', fontSize: '0.8rem', fontWeight: 600, padding: '0.7rem 0.75rem', textAlign: 'left', whiteSpace: 'nowrap',
}
const sTd: React.CSSProperties = {
  borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #EEF0F3', padding: '0.7rem 0.75rem', fontSize: '0.8rem', color: '#6B7280', verticalAlign: 'top',
}

/** Kolom angka (rata kanan): Biaya Satuan, Jumlah */
const KANAN = new Set([6, 7])

export const TabelDaftarPengeluaran = ({ kelompok, warna, labelBulan, onUbah, onHapus, onFoto }: {
  kelompok:   KelompokPengeluaran[]
  warna:      Map<string, string>
  labelBulan: string
  onUbah:     (p: Pengeluaran) => void
  onHapus:    (p: Pengeluaran) => void
  onFoto:     (p: Pengeluaran) => void
}) => {
  const total = kelompok.reduce((s, k) => s + k.total, 0)
  return (
    <section aria-label={`Daftar pengeluaran ${labelBulan}`} style={{ ...sKartuPutih, padding: '1rem 1rem 1.25rem' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 900 }}>
          <thead>
            <tr>
              {KOLOM_DAFTAR.map((k, i) => (
                <th key={k} style={{
                  ...sTh, textAlign: KANAN.has(i) ? 'right' : 'left',
                  borderTopLeftRadius: i === 0 ? 7 : 0, borderTopRightRadius: i === KOLOM_DAFTAR.length - 1 ? 7 : 0,
                }}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kelompok.length === 0 ? (
              <tr>
                <td colSpan={KOLOM_DAFTAR.length} style={{ ...sTd, borderRight: 'none', textAlign: 'center', padding: '2.5rem 1rem', color: '#94A3B8' }}>
                  Belum ada pengeluaran di {labelBulan}.
                </td>
              </tr>
            ) : kelompok.flatMap((k, i) => k.baris.map((b, j) => (
              <tr key={b.id}>
                {j === 0 && (
                  <>
                    <td rowSpan={k.baris.length} style={{ ...sTd, width: 40, color: '#4B5563' }}>{i + 1}</td>
                    <td rowSpan={k.baris.length} style={{ ...sTd, width: 130, color: '#4B5563', overflowWrap: 'anywhere' }}>{k.kategori.nama}</td>
                  </>
                )}
                <td style={{ ...sTd, minWidth: 120, overflowWrap: 'anywhere' }}>{b.keterangan}</td>
                <td style={{ ...sTd, whiteSpace: 'nowrap' }}>{tanggalPanjang(b.tanggal)}</td>
                <td style={{ ...sTd, whiteSpace: 'nowrap' }}>{teksVolume(b)}</td>
                <td style={{ ...sTd, whiteSpace: 'nowrap' }}>{teksSatuan(b)}</td>
                <td style={{ ...sTd, textAlign: 'right', whiteSpace: 'nowrap' }}>{b.biaya_satuan != null ? formatRupiah(b.biaya_satuan) : ''}</td>
                <td style={{ ...sTd, textAlign: 'right', whiteSpace: 'nowrap', color: '#374151' }}>{formatRupiah(b.jumlah)}</td>
                <td style={sTd}>
                  {b.sumber_dana.length === 0
                    ? <span style={{ fontSize: '0.7rem', color: '#CBD5E1' }}>—</span>
                    : <DaftarChip nama={b.sumber_dana.map(s => s.nama_komponen)} warna={n => warna.get(kunciKomponen(n)) ?? WARNA_LAINNYA} />}
                </td>
                <td style={{ ...sTd, borderRight: 'none', whiteSpace: 'nowrap', width: 104 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {b.foto_path && (
                      <button type="button" onClick={() => onFoto(b)} aria-label={`Lihat foto nota ${b.keterangan}`} title="Lihat foto nota"
                        className="fp-tekan" style={{ ...sTombolAksi, color: '#16A34A' }}>
                        <ImageIcon size={15} />
                      </button>
                    )}
                    <button type="button" onClick={() => onUbah(b)} aria-label={`Ubah ${b.keterangan}`} title="Ubah"
                      className="fp-tekan" style={{ ...sTombolAksi, color: '#94A3B8' }}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => onHapus(b)} aria-label={`Hapus ${b.keterangan}`} title="Hapus"
                      className="fp-tekan" style={{ ...sTombolAksi, width: 26, height: 26, background: '#E8787E', color: '#fff', borderRadius: 5 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
          {kelompok.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={7} style={{ background: '#E4E9F1', padding: '0.6rem 0.75rem', fontSize: '0.82rem', color: '#374151', textAlign: 'center', borderBottomLeftRadius: 7 }}>
                  Total Pengeluaran
                </td>
                <td style={{ background: '#E4E9F1', padding: '0.6rem 0.75rem', fontSize: '0.82rem', color: '#374151', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {formatRupiah(total)}
                </td>
                <td colSpan={2} style={{ background: '#E4E9F1', borderBottomRightRadius: 7 }} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}

const sTombolAksi: React.CSSProperties = {
  width: 26, height: 26, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', borderRadius: 6,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
