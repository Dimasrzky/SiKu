import { NextRequest, NextResponse } from 'next/server'
import { checkAdminCredentials, createAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

interface LoginBody {
  email:    string
  password: string
}

export async function POST(req: NextRequest) {
  let body: Partial<LoginBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request tidak valid.' }, { status: 400 })
  }

  const email    = body.email ?? ''
  const password = body.password ?? ''

  if (!checkAdminCredentials(email, password)) {
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
