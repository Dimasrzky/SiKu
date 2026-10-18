import { supabase } from './supabase'

// Foto nota pengeluaran lewat /api/pengeluaran/[id]/foto — bucket-nya privat, jadi
// browser tidak pernah menyentuh storage langsung. Hanya untuk komponen 'use client'.

type Hasil<T> = { data: T; error: null } | { data: null; error: string }

async function panggil<T>(id: string, init: RequestInit): Promise<Hasil<T>> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/pengeluaran/${id}/foto`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    const json = await res.json().catch(() => null) as { data?: T; error?: string | null } | null
    if (!res.ok || !json?.data) return { data: null, error: json?.error ?? `Server membalas status ${res.status}.` }
    return { data: json.data, error: null }
  } catch {
    return { data: null, error: 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.' }
  }
}

export function unggahFotoPengeluaran(id: string, foto: File): Promise<Hasil<{ foto_path: string }>> {
  const form = new FormData()
  form.append('foto', foto)
  return panggil(id, { method: 'POST', body: form })
}

export async function tautanFotoPengeluaran(id: string): Promise<Hasil<string>> {
  const hasil = await panggil<{ url: string }>(id, { method: 'GET' })
  return hasil.error === null ? { data: hasil.data.url, error: null } : hasil
}

export function hapusFotoPengeluaran(id: string): Promise<Hasil<{ id: string }>> {
  return panggil(id, { method: 'DELETE' })
}

export const UKURAN_FOTO_MAKS = 5 * 1024 * 1024

/** Pemeriksaan awal di browser; server memeriksa ulang dari isi berkasnya */
export function periksaFoto(foto: File): string | null {
  if (foto.type !== 'image/jpeg' && foto.type !== 'image/png') return 'Format foto harus JPG atau PNG.'
  if (foto.size > UKURAN_FOTO_MAKS) return 'Ukuran foto maksimal 5MB.'
  return null
}
