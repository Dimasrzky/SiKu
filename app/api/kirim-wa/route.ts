import { NextRequest, NextResponse } from 'next/server'

const APICOID_BASE = 'https://chat.api.co.id/api/v1/public'

export async function POST(req: NextRequest) {
  try {
    const { phone_number, content } = await req.json() as {
      phone_number: string
      content:      string
    }

    if (!phone_number || !content) {
      return NextResponse.json({ error: 'phone_number dan content wajib diisi' }, { status: 400 })
    }

    const apiKey = process.env.APICOID_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'APICOID_API_KEY belum dikonfigurasi' }, { status: 500 })
    }

    const body: Record<string, string> = {
      phone_number,
      channel:      'whatsapp',
      message_type: 'text',
      content,
    }

    // Opsional: tentukan nomor WA bisnis pengirim
    const phoneNumberId = process.env.APICOID_PHONE_NUMBER_ID
    if (phoneNumberId) body.whatsapp_phone_number_id = phoneNumberId

    const res = await fetch(`${APICOID_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json() as { success: boolean; message?: string }

    if (!res.ok || !data.success) {
      return NextResponse.json(
        { error: data.message ?? 'Gagal mengirim pesan WA' },
        { status: res.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
