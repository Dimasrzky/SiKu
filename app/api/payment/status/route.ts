import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token diperlukan.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data } = await supabase
    .from('tagihan')
    .select('status')
    .eq('payment_token', token)
    .single()

  if (!data) {
    return NextResponse.json({ error: 'Tagihan tidak ditemukan.' }, { status: 404 })
  }

  return NextResponse.json({ status: data.status })
}
