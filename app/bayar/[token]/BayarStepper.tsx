const STEPS = ['Tagihan', 'Pembayaran', 'Selesai'] as const

export default function BayarStepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(4px, 3vw, 40px)', marginBottom: 'clamp(1.25rem, 4vw, 3rem)' }}>
      {STEPS.map((label, i) => {
        const n         = i + 1
        const active    = n === step
        const done      = n < step
        const circleBg  = active || done ? '#1A2C4E' : '#A6AFC3'
        const circleFg  = active || done ? '#fff' : '#ffffff'
        const textColor = active ? '#1A2C4E' : done ? '#475569' : '#5B6882'

        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 3vw, 40px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 2vw, 20px)' }}>
              <div style={{
                width: 'clamp(26px, 8vw, 45px)', height: 'clamp(26px, 8vw, 45px)', borderRadius: '50%',
                background: circleBg, color: circleFg,
                border: active || done ? 'none' : '4px solid #959DAD',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'clamp(0.65rem, 2.2vw, 1rem)', fontWeight: 800, flexShrink: 0,
              }}>
                {done ? '✓' : n}
              </div>
              <span style={{ fontSize: 'clamp(0.62rem, 2.6vw, 1rem)', fontWeight: 700, color: textColor, whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {n < STEPS.length && (
              <div style={{ width: 'clamp(14px, 4vw, 20px)', height: 4, borderRadius: 50, background: done ? '#1A2C4E' : '#A6AFC3', flexShrink: 0 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
