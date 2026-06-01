import { createBrowserClient } from '@supabase/ssr'

// Singleton untuk client components ('use client')
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
