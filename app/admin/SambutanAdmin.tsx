const WARNA_ILUSTRASI = '#93ABCF'

/** Kartu identitas putih di dalam ubin bergradien, seperti ilustrasi referensi */
const IlustrasiKartu = () => (
  <svg width="84" height="50" viewBox="0 0 84 50" aria-hidden>
    <rect width="84" height="50" rx="6" fill="#fff" />
    <circle cx="21" cy="18" r="6.5" fill={WARNA_ILUSTRASI} />
    <path d="M9 39a12 10.5 0 0 1 24 0v1H9z" fill={WARNA_ILUSTRASI} />
    <rect x="39" y="10" width="36" height="3.5" rx="1.75" fill={WARNA_ILUSTRASI} />
    <rect x="39" y="18" width="36" height="3.5" rx="1.75" fill={WARNA_ILUSTRASI} />
    <rect x="39" y="26" width="15" height="3.5" rx="1.75" fill={WARNA_ILUSTRASI} />
    <circle cx="67" cy="33" r="7" fill="none" stroke={WARNA_ILUSTRASI} strokeWidth="1.6" />
    <text x="67" y="36.4" textAnchor="middle" fontSize="9.5" fontWeight="700" fontFamily="sans-serif" fill={WARNA_ILUSTRASI}>A</text>
  </svg>
)

/** Isi beranda SiKuAdmin: judul sambutan, subjudul, dan ilustrasi di kanan */
export default function SambutanAdmin() {
  return (
    <div className="admin-sambutan">
      <div>
        <h1>
          Selamat datang di <span className="admin-sambutan-siku">SiKu</span><span className="admin-sambutan-admin">Admin</span>!
        </h1>
        <p>Manajemen kemitraan, pembayaran, dan fitur sekolah</p>
      </div>
      <div className="admin-sambutan-ilustrasi"><IlustrasiKartu /></div>
    </div>
  )
}
