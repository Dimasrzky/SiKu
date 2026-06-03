import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | null = null

function getClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}

// Singleton untuk client components ('use client')
// Lazy proxy — client dibuat saat pertama kali diakses, bukan saat module di-import
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_, prop: string | symbol) {
    const client = getClient()
    const value = client[prop as keyof typeof client]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value
  },
})
