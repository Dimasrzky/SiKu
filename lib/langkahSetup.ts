import type { SupabaseClient } from '@supabase/supabase-js'

// Cache langkah setup sekolah (pengaturan.setup_steps) di localStorage. Dashboard dan
// sidebar membacanya supaya tampilan pertama sudah benar — checklist setup atau
// Dashboard penuh, menu terkunci atau terbuka — tanpa menunggu database.

export const KUNCI_LANGKAH_SETUP = 'siku_setup_steps'

/** Lima langkah setup, urut seperti checklist di Dashboard (components/SetupChecklist STEPS) */
export const LANGKAH_SETUP = [
  { kunci: 'profil_sekolah',   label: 'Profil sekolah' },
  { kunci: 'tahun_ajaran',     label: 'Tahun ajaran' },
  { kunci: 'komponen_tagihan', label: 'Komponen tagihan' },
  { kunci: 'buat_kelas',       label: 'Buat kelas' },
  { kunci: 'import_siswa',     label: 'Import siswa' },
] as const

export interface RingkasanSetup {
  /** Setup selesai = langkah import siswa sudah dijalankan, aturan yang sama dengan Dashboard */
  selesai:    boolean
  /** Jumlah langkah yang sudah selesai, dari LANGKAH_SETUP.length */
  jumlah:     number
  /** Langkah pertama yang belum selesai; null kalau setup selesai */
  berikutnya: string | null
}

/** Ringkas pengaturan.setup_steps untuk dasbor admin. Tanpa baris pengaturan = belum ada langkah yang selesai. */
export function ringkasLangkahSetup(steps: unknown): RingkasanSetup {
  const s = (steps && typeof steps === 'object' ? steps : {}) as Record<string, unknown>
  const selesai = s.import_siswa === true
  return {
    selesai,
    jumlah:     selesai ? LANGKAH_SETUP.length : LANGKAH_SETUP.filter(l => s[l.kunci] === true).length,
    berikutnya: selesai ? null : LANGKAH_SETUP.find(l => s[l.kunci] !== true)?.label ?? null,
  }
}

/**
 * Setup belum selesai menurut cache. Tanpa cache tidak diketahui — dianggap selesai,
 * karena itu yang umum. Aturan yang sama ditulis ulang di SKRIP_TANDA_SETUP; ubah bersamaan.
 */
export function setupBelumSelesaiLokal(): boolean {
  try {
    const raw = localStorage.getItem(KUNCI_LANGKAH_SETUP)
    return raw !== null && (JSON.parse(raw) as Record<string, boolean>).import_siswa !== true
  } catch { return false }
}

/**
 * Isi cache dari database sebelum masuk Dashboard (login, Buka Dashboard di /kemitraan).
 * Gagal dibaca: cache dikosongkan, supaya tidak tertinggal milik akun sebelumnya.
 * Tidak pernah melempar galat — masuk ke Dashboard tidak boleh tertahan karenanya.
 */
export async function simpanLangkahSetupLokal(db: SupabaseClient, sekolahId: string): Promise<void> {
  try {
    const { data, error } = await db
      .from('pengaturan')
      .select('setup_steps')
      .eq('sekolah_id', sekolahId)
      .maybeSingle()
    const steps = (data as { setup_steps: Record<string, boolean> | null } | null)?.setup_steps
    if (!error && steps) localStorage.setItem(KUNCI_LANGKAH_SETUP, JSON.stringify(steps))
    else localStorage.removeItem(KUNCI_LANGKAH_SETUP)
  } catch {
    try { localStorage.removeItem(KUNCI_LANGKAH_SETUP) } catch { /* penyimpanan diblokir */ }
  }
}

/**
 * Dijalankan di <head> (app/layout.tsx) sebelum halaman digambar. HTML dari server tidak
 * bisa membaca localStorage, jadi kerangka di sana (components/skeleton/SkeletonShell)
 * memilih tampilannya lewat CSS dari atribut ini: <html data-setup="…"> hanya ada selama
 * setup belum selesai, isinya langkah yang sudah selesai dipisah spasi. Atribut ini
 * mencerminkan keadaan saat halaman dimuat; sesudah itu tampilan memakai state React.
 */
export const SKRIP_TANDA_SETUP =
  `try{var s=JSON.parse(localStorage.getItem('${KUNCI_LANGKAH_SETUP}')||'null');` +
  `if(s&&s.import_siswa!==true)document.documentElement.setAttribute('data-setup',` +
  `Object.keys(s).filter(function(k){return s[k]===true}).join(' '))}catch(e){}`
