export default function SuksesPage() {
  return (
    <main style={{
      minHeight:       '100vh',
      background:      '#F1F5F9',
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '1.5rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#1A2C4E', letterSpacing: '-0.5px' }}>SiKu</div>
          <div style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: 2 }}>Portal Pembayaran Sekolah</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '2.5rem 2rem', textAlign: 'center', boxShadow: '0 4px 24px #0000000f' }}>
          <div style={{ width: 72, height: 72, background: '#D1FAE5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2.5rem' }}>
            ✓
          </div>

          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1A2C4E', marginBottom: 8 }}>
            Pembayaran Berhasil!
          </div>

          <div style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            Terima kasih! Pembayaran Anda sedang dikonfirmasi oleh sistem.
            Status tagihan akan diperbarui otomatis dalam beberapa saat.
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0.9rem 1rem', fontSize: '0.8rem', color: '#64748B', lineHeight: 1.6 }}>
            Jika status belum berubah setelah beberapa menit, silakan hubungi pihak sekolah dengan menyebutkan bukti pembayaran Anda.
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', color: '#CBD5E1', fontSize: '0.72rem' }}>
          Transaksi diproses oleh iPaymu · PT. Inti Prima Mandiri Utama
        </div>

      </div>
    </main>
  )
}
