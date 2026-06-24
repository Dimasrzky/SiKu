import { NextRequest, NextResponse } from 'next/server'

const FONNTE_BASE = 'https://api.fonnte.com'

export async function POST(req: NextRequest) {
  try {
    const { phone_number, content } = await req.json() as {
      phone_number: string
      content:      string
    }

    if (!phone_number || !content) {
      return NextResponse.json({ error: 'phone_number dan content wajib diisi' }, { status: 400 })
    }

    const token = process.env.FONNTE_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'FONNTE_TOKEN belum dikonfigurasi' }, { status: 500 })
    }

    console.log('[kirim-wa] target:', phone_number)

    const res = await fetch(`${FONNTE_BASE}/send`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        target:  phone_number,
        message: content,
      }),
    })

    const rawText = await res.text()
    console.log('[kirim-wa] status:', res.status, 'body:', rawText)

    let data: { status: boolean | string; reason?: string }
    try { data = JSON.parse(rawText) } catch { data = { status: false, reason: rawText } }

    if (!data.status || data.status === 'false') {
      return NextResponse.json(
        { error: data.reason ?? 'Gagal mengirim pesan WA' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
