const STEPS = ['Tagihan', 'Pembayaran', 'Selesai'] as const

export default function BayarStepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, marginBottom: '3rem' }}>
      {STEPS.map((label, i) => {
        const n         = i + 1
        const active    = n === step
        const done      = n < step
        const circleBg  = active || done ? '#1A2C4E' : '#A6AFC3'
        const circleFg  = active || done ? '#fff' : '#ffffff'
        const textColor = active ? '#1A2C4E' : done ? '#475569' : '#5B6882'

        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                width: 45, height: 45, borderRadius: '50%',
                background: circleBg, color: circleFg,
                border: active || done ? 'none' : '4px solid #959DAD',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', fontWeight: 800, flexShrink: 0,
              }}>
                {done ? '✓' : n}
              </div>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: textColor, whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {n < STEPS.length && (
              <div style={{ width: 80, height: 4, borderRadius: 50, background: done ? '#1A2C4E' : '#A6AFC3' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
