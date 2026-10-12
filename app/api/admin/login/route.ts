import { NextRequest, NextResponse } from 'next/server'
import { checkAdminCredentials, createAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase-service'
import { catatPercobaanGagal, terlaluBanyakPercobaan } from '@/lib/percobaanLogin'

interface LoginBody {
  email:    string
  password: string
}

const JENDELA_MENIT = 15
// Per alamat IP, dan untuk semua IP sekaligus — penebakan dari banyak IP juga tertahan
const BATAS_PER_IP  = 5
const BATAS_SEMUA   = 30

export async function POST(req: NextRequest) {
  let body: Partial<LoginBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request tidak valid.' }, { status: 400 })
  }

  const email    = body.email ?? ''
  const password = body.password ?? ''

  // Vercel mengisi ulang x-forwarded-for dengan IP pengunjung, jadi tidak bisa dipalsukan pengirim
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'tanpa-ip'
  const db = createServiceClient()

  const [perIp, semua] = await Promise.all([
    terlaluBanyakPercobaan(db, `admin:${ip}`, BATAS_PER_IP, JENDELA_MENIT),
    terlaluBanyakPercobaan(db, 'admin:*', BATAS_SEMUA, JENDELA_MENIT),
  ])
  if (perIp === null || semua === null) {
    return NextResponse.json({ error: 'Gagal memeriksa percobaan masuk. Silakan coba lagi.' }, { status: 503 })
  }
  if (perIp || semua) {
    return NextResponse.json({ error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${JENDELA_MENIT} menit.` }, { status: 429 })
  }

  if (!checkAdminCredentials(email, password)) {
    await Promise.all([catatPercobaanGagal(db, `admin:${ip}`), catatPercobaanGagal(db, 'admin:*')])
    return NextResponse.json({ error: 'Email atau password admin salah.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 12,
  })
  return res
}
