import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Klien Supabase untuk Server Component dengan sesi pengguna dari cookie, jadi RLS tetap
 * berlaku (berbeda dengan createServiceClient). Buat baru di setiap render, jangan disimpan
 * di variabel modul.
 */
export async function createSessionClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Server Component tidak boleh menulis cookie; sesi sudah disegarkan proxy.ts
          }
        },
      },
    }
  )
}
