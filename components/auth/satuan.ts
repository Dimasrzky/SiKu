/** Ukuran desain (px pada bingkai Figma 1440×1024) → panjang CSS yang ikut skala halaman auth */
export const u = (px: number): string => `calc(${px} * var(--u))`

/** Ukuran kotak untuk ikon SVG (lucide atau IkonAuth) dalam satuan desain */
export const ukuranIkon = (px: number) => ({ width: u(px), height: u(px) })
