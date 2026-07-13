import { formatWaNumber } from '@/lib/templates/waTagihan'
import type { WhatsAppProvider, WhatsAppSendResult } from '@/lib/wa/types'

const KAPSO_API_BASE_URL = process.env.KAPSO_API_BASE_URL || 'https://api.kapso.ai'
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0'

interface KapsoSendResponse {
  messages?: { id: string }[]
  error?: { message?: string }
}

export const kapsoProvider: WhatsAppProvider = {
  async sendText(to: string, body: string): Promise<WhatsAppSendResult> {
    const apiKey = process.env.KAPSO_API_KEY
    const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID

    if (!apiKey)       return { data: null, error: 'KAPSO_API_KEY belum dikonfigurasi' }
    if (!phoneNumberId) return { data: null, error: 'KAPSO_PHONE_NUMBER_ID belum dikonfigurasi' }

    const res = await fetch(
      `${KAPSO_API_BASE_URL}/meta/whatsapp/${META_GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'X-API-Key':    apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to:                formatWaNumber(to),
          type:              'text',
          text:              { body },
        }),
      }
    )

    const json = await res.json().catch(() => null) as KapsoSendResponse | null

    if (!res.ok) {
      return { data: null, error: json?.error?.message ?? `Kapso API error (status ${res.status})` }
    }

    const messageId = json?.messages?.[0]?.id
    if (!messageId) {
      return { data: null, error: 'Kapso tidak mengembalikan message id' }
    }

    return { data: { messageId }, error: null }
  },
}
