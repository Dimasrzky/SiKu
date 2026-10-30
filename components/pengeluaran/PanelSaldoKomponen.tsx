import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatRupiahRingkas } from '@/lib/formatLaporan'
import { persenTersisa, WARNA_LAINNYA, type SaldoKomponen } from '@/lib/kasKomponen'
import { NAVY, sKartuPutih, WARNA_KELUAR, WARNA_MASUK } from './BagianPengeluaran'

// Saldo tiap komponen sepanjang periode terpilih sampai hari ini (keputusan user 27 Okt
// 2026): pemasukan ↑ dan pengeluaran ↓ tiap komponen, sisanya, dan persen yang tersisa.

/** "Rp 38,2 jt"; minus ditulis di depan */
const ringkas = (n: number): string => (n < 0 ? `−${formatRupiahRingkas(-n)}` : formatRupiahRingkas(n))

export const PanelSaldoKomponen = ({ baris, warna, namaPeriode }: {
  baris:       SaldoKomponen[]
  warna:       Map<string, string>
  namaPeriode: string
}) => {
  const total = baris.reduce((s, b) => s + b.saldo, 0)
  // Tingginya mengikuti tabel riwayat di sebelahnya (.pg-panel-saldo di dashboard.css):
  // daftar komponen digulir di dalamnya, kotak Total Saldo Kas tetap di bawah
  return (
    <div className="pg-panel-saldo">
    <section aria-label="Saldo per komponen" style={{ ...sKartuPutih, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {baris.length === 0 ? (
        <div style={{ padding: '2rem 1.25rem', textAlign: 'center', fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.5, flex: 1 }}>
          Belum ada pemasukan atau pengeluaran di periode {namaPeriode}.
        </div>
      ) : (
        <div className="pg-gulir-tegak pg-panel-daftar">
          {baris.map(b => {
            const w = warna.get(b.kunci) ?? WARNA_LAINNYA
            const persen = persenTersisa(b)
            const isi = persen === null ? 0 : Math.max(0, Math.min(100, persen))
            return (
              <div key={b.kunci} style={{ borderLeft: `5px solid ${w}`, borderBottom: '1px solid #E5E7EB', padding: '0.75rem 1rem 0.7rem 0.95rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: NAVY, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.nama}</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: b.saldo < 0 ? WARNA_KELUAR : NAVY, whiteSpace: 'nowrap' }}>{ringkas(b.saldo)}</span>
                </div>
                <div style={{ height: 9, borderRadius: 9, background: '#D9DEE5', margin: '0.45rem 0 0.4rem', overflow: 'hidden' }}
                  role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(isi)} aria-label={`Sisa ${b.nama}`}>
                  <div style={{ width: `${isi}%`, height: '100%', borderRadius: 9, background: w, transition: 'width 500ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.68rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <span title="Pemasukan" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: WARNA_MASUK }}><ArrowUp size={11} /> {formatRupiahRingkas(b.masuk)}</span>
                    <span title="Pengeluaran" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: WARNA_KELUAR }}><ArrowDown size={11} /> {formatRupiahRingkas(b.keluar)}</span>
                  </span>
                  <span style={{ color: b.saldo < 0 ? WARNA_KELUAR : w, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {persen === null ? 'Belum ada pemasukan' : b.saldo < 0 ? 'Saldo minus' : `${Math.round(persen)}% tersisa`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ background: NAVY, color: '#fff', padding: '1rem 1.15rem 0.9rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 400, opacity: 0.92 }}>Total Saldo Kas</span>
          <span style={{ fontSize: '1.35rem', fontWeight: 700, whiteSpace: 'nowrap', color: total < 0 ? '#FCA5A5' : '#fff' }}>{ringkas(total)}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.68rem', opacity: 0.75, marginTop: 4 }}>
          {baris.length} komponen aktif · Periode {namaPeriode}
        </div>
      </div>
    </section>
    </div>
  )
}
