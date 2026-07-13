export interface WhatsAppSendResult {
  data: { messageId: string } | null
  error: string | null
}

export interface WhatsAppProvider {
  sendText(to: string, body: string): Promise<WhatsAppSendResult>
}
