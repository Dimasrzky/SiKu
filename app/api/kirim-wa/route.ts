import { NextRequest, NextResponse } from 'next/server'
import { kapsoProvider } from '@/lib/wa/kapso'

export async function POST(req: NextRequest) {
  try {
    const { phone_number, content } = await req.json() as {
      phone_number: string
      content:      string
    }

    if (!phone_number || !content) {
      return NextResponse.json({ data: null, error: 'phone_number dan content wajib diisi' }, { status: 400 })
    }

    const result = await kapsoProvider.sendText(phone_number, content)

    if (result.error) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ data: null, error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
