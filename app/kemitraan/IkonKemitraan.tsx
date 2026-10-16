// Ikon mockup yang tidak ada di lucide. Ukurannya diatur CSS, warnanya mengikuti currentColor.

/** Logo WhatsApp satu warna (bentuk Simple Icons) */
export const IkonWhatsApp = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
)

/** Terompet pesta seperti di mockup: ujung kerucut menghadap kiri, konfeti di kiri atas */
export const IkonTerompet = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7.2 15.35 15.6 7.7 21.7 19 18.7 21.6Z" />
    <path d="M12.96 10.1v8.4" />
    <path d="M17.74 11.7v9.3" />
    <path d="m7.2 2.9 1 4.8" />
    <path d="m11 2.9 1 3.9" />
    <path d="M3.4 5.3h1" />
    <path d="M3.3 10.9c1.3-.4 2.6-.3 3.9.4" />
  </svg>
)

/** "Menunggu langkah sebelumnya": papan klip ramping dengan jam kecil di pojok kanan bawah */
export const IkonPapanJam = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h3.5" />
    <path d="M15 4h1.5a2 2 0 0 1 2 2v4.5" />
    <rect x="9" y="2.5" width="6" height="3.5" rx="1" />
    <circle cx="16.5" cy="17.5" r="4" />
    <path d="M16.5 15.8v1.9l1.2.8" />
  </svg>
)

/** "Sedang diproses": garis gerak di kiri, lembar berisi tanda putar */
export const IkonDiproses = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3.5" width="12" height="17" rx="2.5" />
    <path d="m13.5 9 3 3-3 3" />
    <path d="M2.5 8h3.5" />
    <path d="M1.5 12h4.5" />
    <path d="M2.5 16h3.5" />
  </svg>
)
