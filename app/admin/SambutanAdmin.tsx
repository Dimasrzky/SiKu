import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, UserRound } from 'lucide-react'

/**
 * Banner beranda SiKuAdmin: sambutan "Selamat datang di SiKuAdmin!" (SiKu kuning, Admin
 * biru muda — keputusan user 18 Okt 2026), subjudul, dan tombol pintas.
 */
export default function SambutanAdmin({ menunggu }: { menunggu: number }) {
  return (
    <section className="admin-sambutan" aria-labelledby="judul-sambutan">
      <div className="admin-sambutan-teks">
        <div className="admin-sambutan-label">Panel admin SiKu</div>
        <h2 id="judul-sambutan">
          Selamat datang di <span className="admin-sambutan-siku">SiKu</span><span className="admin-sambutan-admin">Admin</span>!
        </h2>
        <p>Manajemen kemitraan, pembayaran, dan fitur sekolah</p>
        <div className="admin-sambutan-aksi">
          {menunggu > 0 && (
            <Link href="/admin/kemitraan?menunggu=1" className="admin-tombol admin-tombol--kuning">
              <UserRound size={16} /> Tinjau {menunggu} sekolah baru
            </Link>
          )}
          <Link href="/admin/kemitraan" className="admin-tombol admin-tombol--kaca">
            Lihat sekolah mitra <ArrowRight size={16} />
          </Link>
        </div>
      </div>
      <div className="admin-sambutan-simbol" aria-hidden>
        <Image src="/image/SimbolSiKuTerang.png" alt="" width={92} height={95} priority />
      </div>
    </section>
  )
}
