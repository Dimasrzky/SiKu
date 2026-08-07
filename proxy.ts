import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Route yang bisa diakses tanpa login
const PUBLIC_PATHS = [
  '/',                       // halaman login
  '/daftar',                 // halaman registrasi — wajib bisa diakses tanpa login
  '/bayar',                  // halaman pembayaran publik (orang tua)
  '/api/bayar',              // konfirmasi upload bukti transfer dari halaman publik
  '/api/payment/create',     // buat transaksi dari halaman publik
  '/api/payment/callback',   // webhook dari iPaymu
  '/api/payment/status',     // cek status tagihan (polling dari halaman publik)
  '/admin',                  // halaman admin verifikasi pembayaran — auth sendiri (cookie sesi admin), bukan Supabase Auth
  '/api/admin',              // login/logout/aksi admin verifikasi — cek sesi sendiri di masing-masing route
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Lewati aset statis
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/images/') ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — jangan hapus baris ini
  const { data: { user } } = await supabase.auth.getUser()

  // Belum login dan akses route protected → redirect ke halaman login
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/'
    loginUrl.search = ''
    return NextResponse.redirect(loginUrl)
  }

  // Sudah login dan akses halaman login → redirect ke dashboard
  if (user && pathname === '/') {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
