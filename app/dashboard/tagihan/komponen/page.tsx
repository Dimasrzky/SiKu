'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Receipt, X, ChevronLeft, ChevronRight, Pencil, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TagihanCard, type TagihanCardData, type TagihanItem, type JenisTagihan, type PotonganData } from '@/components/TagihanCard'
import { KelasCard } from '@/components/KelasCard'

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const SEMESTER_OPTIONS     = ['Ganjil', 'Genap']
const TAHUN_AJARAN_OPTIONS = (() => {
  const base = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => `${base - 1 + i}/${base + i}`)
})()

// ── Types ─────────────────────────────────────────────────────────────────────

interface KelasOption {
  jenjang:   string
  warna:     string
  jumlah:    number
  identitas: string[]
}

interface ModalItemInput {
  id:      string
  nama:    string
  nominal: string
}

interface BeasiswaPotonganInput {
  id:           string
  kelasJenjang: string
  namaItem:     string
  nominalAsli:  number
  persenPotong: string
}

interface ModalState {
  open:           boolean
  mode:           'add' | 'edit'
  editId?:        string
  jenis:          JenisTagihan
  kelasJenjang:   string
  kelasWarna:     string
  kelasJumlah:    number
  namaProg:       string
  scope:          'semua' | 'perorangan'
  items:          ModalItemInput[]
  // beasiswa only
  kelasRefs:      string[]
  potonganInputs: BeasiswaPotonganInput[]
}

const defaultModal = (): ModalState => ({
  open: false, mode: 'add', jenis: 'wajib',
  kelasJenjang: '', kelasWarna: '', kelasJumlah: 0,
  namaProg: '', scope: 'semua',
  items: [{ id: '1', nama: '', nominal: '' }],
  kelasRefs: [], potonganInputs: [],
})

// ── Tagihan DB types ──────────────────────────────────────────────────────────

interface TagihanRow {
  id:            string
  jenis:         string
  bulan:         string
  tahun:         number
  nominal:       number
  kelas_jenjang: string | null
  nama:          string | null
  jatuh_tempo:   string | null
  status:        'draft' | 'aktif' | 'selesai'
  total_siswa:   number
  sudah_bayar:   number
}

const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni',
                     'Juli','Agustus','September','Oktober','November','Desember']

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KomponenTagihanPage() {
  const router = useRouter()

  // Setup mode state
  const [setupDone,      setSetupDone]      = useState(false)
  const [dataLoading,    setDataLoading]    = useState(true)
  const [tahunAjaran,    setTahunAjaran]    = useState('2025/2026')
  const [semester,       setSemester]       = useState('Genap')
  const [cardsWajib,     setCardsWajib]     = useState<TagihanCardData[]>([])
  const [cardsBeasiswa,  setCardsBeasiswa]  = useState<TagihanCardData[]>([])
  const [cardsEkskul,    setCardsEkskul]    = useState<TagihanCardData[]>([])
  const [cardsAktivitas, setCardsAktivitas] = useState<TagihanCardData[]>([])
  const [activeTab,      setActiveTab]      = useState<JenisTagihan>('wajib')
  const [kelasOptions,   setKelasOptions]   = useState<KelasOption[]>([])
  const [modal,          setModal]          = useState<ModalState>(defaultModal())
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')
  const [carouselIdx,    setCarouselIdx]    = useState(0)

  // View mode state
  const [showKomponen,   setShowKomponen]   = useState(false)
  const [komponenTab,    setKomponenTab]    = useState<JenisTagihan>('wajib')
  const [sekolahId,      setSekolahId]      = useState('')
  const [tagihanList,    setTagihanList]    = useState<TagihanRow[]>([])
  const [tagihanLoading, setTagihanLoading] = useState(false)
  const [filterBulan,    setFilterBulan]    = useState('Semua')
  const [filterStatus,   setFilterStatus]   = useState('Semua')

  // Generate modal state
  const [showGenModal,  setShowGenModal]  = useState(false)
  const [genBulan,      setGenBulan]      = useState('')
  const [genTahun,      setGenTahun]      = useState(new Date().getFullYear())
  const [genJatuhTempo, setGenJatuhTempo] = useState('')
  const [generating,    setGenerating]    = useState(false)
  const [genError,      setGenError]      = useState('')


  const loadTagihanFromDB = async () => {
    setTagihanLoading(true)
    const { data } = await supabase
      .from('tagihan')
      .select('id, jenis, bulan, tahun, nominal, kelas_jenjang, nama, jatuh_tempo, status, total_siswa, sudah_bayar')
      .order('tahun', { ascending: false })
      .order('bulan')
      .limit(200)
    setTagihanList((data ?? []) as TagihanRow[])
    setTagihanLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      const [{ data: pData }, { data: kData }] = await Promise.all([
        supabase.from('pengaturan').select('sekolah_id, setup_steps').maybeSingle(),
        supabase.from('kelas').select('id, nama, jenjang, warna, tahun_ajaran, semester').order('jenjang'),
      ])

      const peng = pData as { sekolah_id?: string; setup_steps?: Record<string, unknown> } | null

      // Guard: redirect ke setup jika tahun_ajaran belum selesai
      if (!peng?.setup_steps?.['tahun_ajaran']) {
        router.replace('/dashboard/tagihan/tahun-ajaran')
        return
      }

      if (peng?.sekolah_id) setSekolahId(peng.sekolah_id)

      // Selalu proses data kelas agar kelasOptions tersedia saat Edit Komponen dibuka
      const kelasRows = (kData ?? []) as { id: string; nama: string; jenjang: string; warna: string; tahun_ajaran: string; semester: string }[]
      if (kelasRows.length > 0) {
        setTahunAjaran(kelasRows[0].tahun_ajaran)
        setSemester(kelasRows[0].semester)
        const grouped = new Map<string, { warna: string; identitas: string[] }>()
        for (const row of kelasRows) {
          if (!grouped.has(row.jenjang)) grouped.set(row.jenjang, { warna: row.warna, identitas: [] })
          const dashIdx = row.nama.indexOf('-')
          const id = dashIdx >= 0 ? row.nama.slice(dashIdx + 1) : row.nama
          grouped.get(row.jenjang)!.identitas.push(id)
        }
        setKelasOptions(Array.from(grouped.entries()).map(([jenjang, { warna, identitas }]) => ({
          jenjang, warna, jumlah: identitas.length, identitas,
        })))
      }

      if (peng?.setup_steps?.['komponen_tagihan'] === true) {
        setSetupDone(true)

        type KomponenRow = {
          id: string; jenis: string; nama: string | null
          kelas_jenjang: string | null; kelas_warna: string | null; kelas_jumlah: number | null
          kelas_ref: string | null; scope: string | null; tahun_ajaran: string; semester: string
          komponen_tagihan_item: { id: string; nama: string; nominal: number; urutan: number }[]
          komponen_tagihan_potongan: { kelas_jenjang: string; nama_item: string; nominal_asli: number; persen_potong: number }[]
        }

        const { data: kRows } = await supabase
          .from('komponen_tagihan')
          .select('id, jenis, nama, kelas_jenjang, kelas_warna, kelas_jumlah, kelas_ref, scope, tahun_ajaran, semester, komponen_tagihan_item(id, nama, nominal, urutan), komponen_tagihan_potongan(kelas_jenjang, nama_item, nominal_asli, persen_potong)')
          .order('created_at')

        const kompRows = (kRows ?? []) as KomponenRow[]
        if (kompRows.length > 0) {
          setTahunAjaran(kompRows[0].tahun_ajaran)
          setSemester(kompRows[0].semester)
        }

        const cards: TagihanCardData[] = kompRows.map(row => ({
          id:           row.id,
          jenis:        row.jenis as JenisTagihan,
          nama:         row.nama         ?? undefined,
          kelasJenjang: row.kelas_jenjang ?? undefined,
          kelasWarna:   row.kelas_warna   ?? undefined,
          kelasJumlah:  row.kelas_jumlah  ?? undefined,
          kelasRef:     row.kelas_ref     ?? undefined,
          scope:        (row.scope as 'semua' | 'perorangan' | null) ?? undefined,
          items: (row.komponen_tagihan_item ?? [])
            .sort((a, b) => a.urutan - b.urutan)
            .map(item => ({ id: item.id, nama: item.nama, nominal: item.nominal })),
          potonganData: row.komponen_tagihan_potongan?.map(p => ({
            kelasJenjang: p.kelas_jenjang,
            namaItem:     p.nama_item,
            nominalAsli:  p.nominal_asli,
            persenPotong: p.persen_potong,
          })),
        }))

        setCardsWajib(cards.filter(c => c.jenis === 'wajib'))
        setCardsBeasiswa(cards.filter(c => c.jenis === 'beasiswa'))
        setCardsEkskul(cards.filter(c => c.jenis === 'ekskul'))
        setCardsAktivitas(cards.filter(c => c.jenis === 'aktivitas'))

        loadTagihanFromDB()
      }

      setDataLoading(false)
    })()
  }, [router])

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const allCards      = [...cardsWajib, ...cardsBeasiswa, ...cardsEkskul, ...cardsAktivitas]
  const availableKelas = kelasOptions.filter(k => !cardsWajib.some(c => c.kelasJenjang === k.jenjang))

  const loadTemplate = (jenis: JenisTagihan): ModalItemInput[] => {
    try {
      const saved = localStorage.getItem(`siku_tagihan_template_${jenis}`)
      if (saved) {
        const parsed = JSON.parse(saved) as ModalItemInput[]
        if (parsed.length > 0) return parsed.map((item, i) => ({ ...item, id: `${Date.now()}-${i}` }))
      }
    } catch { /* ignore */ }
    return [{ id: Date.now().toString(), nama: '', nominal: '' }]
  }

  const buildPotonganInputs = (wajibCard: TagihanCardData, kelasJenjang: string): BeasiswaPotonganInput[] =>
    wajibCard.items.map(item => ({
      id:           `${kelasJenjang}-${item.id}`,
      kelasJenjang,
      namaItem:     item.nama,
      nominalAsli:  item.nominal,
      persenPotong: '',
    }))

  const openAdd = () => {
    if (activeTab === 'wajib') {
      if (availableKelas.length === 0) return
      setCarouselIdx(0)
      setModal({
        open: true, mode: 'add', jenis: 'wajib',
        kelasJenjang: availableKelas[0].jenjang,
        kelasWarna:   availableKelas[0].warna,
        kelasJumlah:  availableKelas[0].jumlah,
        namaProg: '', scope: 'semua',
        items: loadTemplate('wajib'),
        kelasRefs: [], potonganInputs: [],
      })
    } else if (activeTab === 'beasiswa') {
      setModal({
        open: true, mode: 'add', jenis: 'beasiswa',
        kelasJenjang: '', kelasWarna: '', kelasJumlah: 0,
        namaProg: '', scope: 'semua', items: [],
        kelasRefs: [], potonganInputs: [],
      })
    } else {
      setModal({
        open: true, mode: 'add', jenis: activeTab,
        kelasJenjang: '', kelasWarna: '', kelasJumlah: 0,
        namaProg: '', scope: 'semua',
        items: loadTemplate(activeTab),
        kelasRefs: [], potonganInputs: [],
      })
    }
  }

  const openEdit = (card: TagihanCardData) => {
    const opt = kelasOptions.find(k => k.jenjang === card.kelasJenjang)
    if (card.jenis === 'wajib') setCarouselIdx(0)
    setModal({
      open: true, mode: 'edit', editId: card.id,
      jenis:        card.jenis,
      kelasJenjang: card.kelasJenjang ?? '',
      kelasWarna:   card.kelasWarna   ?? '',
      kelasJumlah:  opt?.jumlah ?? card.kelasJumlah ?? 0,
      namaProg:     card.nama  ?? '',
      scope:        card.scope ?? 'semua',
      items:        card.jenis !== 'beasiswa'
        ? card.items.map(item => ({ id: item.id, nama: item.nama, nominal: item.nominal.toString() }))
        : [],
      kelasRefs:      card.kelasRef?.split(', ').filter(Boolean) ?? [],
      potonganInputs: card.potonganData?.map((p, i) => ({
        id:           `edit-${i}`,
        kelasJenjang: p.kelasJenjang ?? '',
        namaItem:     p.namaItem,
        nominalAsli:  p.nominalAsli,
        persenPotong: p.persenPotong.toString(),
      })) ?? [],
    })
  }

  const closeModal = () => setModal(defaultModal())

  const selectKelas = (opt: KelasOption) =>
    setModal(m => ({ ...m, kelasJenjang: opt.jenjang, kelasWarna: opt.warna, kelasJumlah: opt.jumlah }))

  const toggleKelasBeasiswa = (wajibCard: TagihanCardData) => {
    const jenjang = wajibCard.kelasJenjang ?? ''
    setModal(m => {
      const isSelected = m.kelasRefs.includes(jenjang)
      if (isSelected) {
        return {
          ...m,
          kelasRefs:      m.kelasRefs.filter(k => k !== jenjang),
          potonganInputs: m.potonganInputs.filter(p => p.kelasJenjang !== jenjang),
        }
      }
      return {
        ...m,
        kelasRefs:      [...m.kelasRefs, jenjang],
        potonganInputs: [...m.potonganInputs, ...buildPotonganInputs(wajibCard, jenjang)],
      }
    })
  }

  const updatePotonganGroup = (namaItem: string, nominalAsli: number, value: string) =>
    setModal(m => ({
      ...m,
      potonganInputs: m.potonganInputs.map(p =>
        p.namaItem === namaItem && p.nominalAsli === nominalAsli ? { ...p, persenPotong: value } : p
      ),
    }))

  const navigateCarousel = (dir: 1 | -1) => {
    const list = modal.mode === 'add' ? availableKelas : kelasOptions
    const len  = list.length
    if (len === 0) return
    const idx = (carouselIdx + dir + len) % len
    setCarouselIdx(idx)
    selectKelas(list[idx])
  }

  const addItem = () =>
    setModal(m => ({ ...m, items: [...m.items, { id: Date.now().toString(), nama: '', nominal: '' }] }))

  const removeItem = (id: string) =>
    setModal(m => ({ ...m, items: m.items.filter(item => item.id !== id) }))

  const updateItem = (id: string, field: 'nama' | 'nominal', value: string) =>
    setModal(m => ({ ...m, items: m.items.map(item => item.id === id ? { ...item, [field]: value } : item) }))

  const validItems = (items: ModalItemInput[]): TagihanItem[] =>
    items
      .filter(item => item.nama.trim() && parseFloat(item.nominal) > 0)
      .map(item => ({ id: item.id, nama: item.nama.trim(), nominal: parseFloat(item.nominal) }))

  const handleSubmitModal = () => {
    // ── Beasiswa: gunakan potonganInputs ──────────────────────────────────────
    if (modal.jenis === 'beasiswa') {
      if (!modal.namaProg.trim() || modal.kelasRefs.length === 0) return
      const valid = modal.potonganInputs.filter(p => {
        const pct = parseFloat(p.persenPotong)
        return !isNaN(pct) && pct > 0 && pct <= 100
      })
      if (valid.length === 0) return
      // Items di card = grup unik (tidak duplikat per kelas)
      const uniqueValid = Array.from(
        valid.reduce((map, p) => {
          const key = `${p.namaItem}||${p.nominalAsli}`
          if (!map.has(key)) map.set(key, p)
          return map
        }, new Map<string, typeof valid[number]>()).values()
      )
      const items: TagihanItem[] = uniqueValid.map(p => ({
        id:      p.id,
        nama:    `${p.namaItem} (${parseFloat(p.persenPotong)}%)`,
        nominal: Math.round(p.nominalAsli * parseFloat(p.persenPotong) / 100),
      }))
      const potonganData: PotonganData[] = valid.map(p => ({
        kelasJenjang: p.kelasJenjang,
        namaItem:     p.namaItem,
        nominalAsli:  p.nominalAsli,
        persenPotong: parseFloat(p.persenPotong),
      }))
      const cardData: TagihanCardData = {
        id: modal.editId ?? Date.now().toString(),
        jenis: 'beasiswa', nama: modal.namaProg.trim(),
        kelasRef: modal.kelasRefs.join(', '), potonganData, items,
      }
      if (modal.mode === 'add') setCardsBeasiswa(prev => [...prev, cardData])
      else setCardsBeasiswa(prev => prev.map(c => c.id === modal.editId ? cardData : c))
      closeModal()
      return
    }

    // ── Jenis lain: gunakan items biasa ───────────────────────────────────────
    const items = validItems(modal.items)
    if (items.length === 0) return
    if (modal.jenis !== 'wajib' && !modal.namaProg.trim()) return
    const cardData: TagihanCardData = {
      id:    modal.editId ?? Date.now().toString(),
      jenis: modal.jenis,
      ...(modal.jenis === 'wajib'
        ? { kelasJenjang: modal.kelasJenjang, kelasWarna: modal.kelasWarna, kelasJumlah: modal.kelasJumlah }
        : { nama: modal.namaProg.trim() }
      ),
      ...(modal.jenis === 'aktivitas' ? { scope: modal.scope } : {}),
      items,
    }
    const setFn = modal.jenis === 'wajib'   ? setCardsWajib
      : modal.jenis === 'ekskul'   ? setCardsEkskul
      : setCardsAktivitas
    if (modal.mode === 'add') {
      setFn(prev => [...prev, cardData])
      try {
        localStorage.setItem(`siku_tagihan_template_${modal.jenis}`, JSON.stringify(
          modal.items.filter(item => item.nama.trim() && parseFloat(item.nominal) > 0)
        ))
      } catch { /* ignore */ }
    } else {
      setFn(prev => prev.map(c => c.id === modal.editId ? cardData : c))
    }
    closeModal()
  }

  const handleSimpan = async () => {
    setError('')
    if (allCards.length === 0) { setError('Tambahkan minimal 1 komponen tagihan.'); return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/setup-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ step: 'komponen_tagihan', data: { tahun_ajaran: tahunAjaran, semester, komponen: allCards } }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setError(json.error ?? 'Gagal menyimpan.'); setSaving(false); return }
    setSaving(false)
    setSetupDone(true)
    loadTagihanFromDB()
  }

  const handleGenerateTagihan = async () => {
    setGenError('')
    if (!genBulan) { setGenError('Pilih bulan tagihan.'); return }
    if (!genJatuhTempo) { setGenError('Isi tanggal jatuh tempo.'); return }
    if (allCards.length === 0) { setGenError('Komponen tagihan belum disetup.'); return }
    setGenerating(true)

    const rows: Record<string, unknown>[] = []

    for (const card of cardsWajib) {
      rows.push({
        sekolah_id:    sekolahId,
        jenis:         'SPP Bulanan',
        bulan:         genBulan,
        tahun:         genTahun,
        nominal:       card.items.reduce((s, item) => s + item.nominal, 0),
        kelas_jenjang: card.kelasJenjang ?? null,
        jatuh_tempo:   genJatuhTempo,
        status:        'aktif',
        total_siswa:   card.kelasJumlah ?? 0,
        sudah_bayar:   0,
      })
    }
    for (const card of cardsBeasiswa) {
      rows.push({
        sekolah_id:  sekolahId,
        jenis:       'Beasiswa',
        nama:        card.nama ?? null,
        bulan:       genBulan,
        tahun:       genTahun,
        nominal:     card.items.reduce((s, item) => s + item.nominal, 0),
        jatuh_tempo: genJatuhTempo,
        status:      'aktif',
        total_siswa: 0,
        sudah_bayar: 0,
      })
    }
    for (const card of cardsEkskul) {
      rows.push({
        sekolah_id:  sekolahId,
        jenis:       'Ekskul',
        nama:        card.nama ?? null,
        bulan:       genBulan,
        tahun:       genTahun,
        nominal:     card.items.reduce((s, item) => s + item.nominal, 0),
        jatuh_tempo: genJatuhTempo,
        status:      'aktif',
        total_siswa: 0,
        sudah_bayar: 0,
      })
    }
    for (const card of cardsAktivitas) {
      rows.push({
        sekolah_id:  sekolahId,
        jenis:       'Aktivitas',
        nama:        card.nama ?? null,
        bulan:       genBulan,
        tahun:       genTahun,
        nominal:     card.items.reduce((s, item) => s + item.nominal, 0),
        jatuh_tempo: genJatuhTempo,
        status:      'aktif',
        total_siswa: 0,
        sudah_bayar: 0,
      })
    }

    const { error: insertError } = await supabase.from('tagihan').insert(rows)
    if (insertError) { setGenError('Gagal generate: ' + insertError.message); setGenerating(false); return }

    setShowGenModal(false)
    setGenBulan('')
    setGenJatuhTempo('')
    setGenerating(false)
    loadTagihanFromDB()
  }

  // ── Modal computed ────────────────────────────────────────────────────────

  const modalTotal      = modal.items.reduce((s, item) => { const n = parseFloat(item.nominal); return s + (isNaN(n) ? 0 : n) }, 0)
  const modalValidCount = validItems(modal.items).length
  // Hitung dari grup unik (namaItem+nominalAsli) — sama seperti yang ditampilkan di tabel
  const uniquePotonganGroups = (() => {
    const map = new Map<string, BeasiswaPotonganInput>()
    for (const p of modal.potonganInputs) {
      const key = `${p.namaItem}||${p.nominalAsli}`
      if (!map.has(key)) map.set(key, p)
    }
    return Array.from(map.values())
  })()

  const beasiswaValidCount  = uniquePotonganGroups.filter(p => { const pct = parseFloat(p.persenPotong); return !isNaN(pct) && pct > 0 && pct <= 100 }).length
  const beasiswaTotalAsli   = uniquePotonganGroups.reduce((s, p) => s + p.nominalAsli, 0)
  const beasiswaTotalPotong = uniquePotonganGroups.reduce((s, p) => {
    const pct = parseFloat(p.persenPotong)
    return s + (isNaN(pct) ? 0 : Math.round(p.nominalAsli * pct / 100))
  }, 0)

  // ── Render ────────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Memuat data...
        </div>
      </div>
    )
  }

  // ── SETUP MODE ────────────────────────────────────────────────────────────
  if (!setupDone) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Komponen Tagihan</h1>
            <p className="dashboard-subtitle">Setup komponen biaya SPP per jenjang kelas</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>

          {/* Kolom kiri */}
          <div>
            {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            {/* Periode Aktif */}
            <div style={sCard}>
              <div style={sCardTitle}>Periode Aktif</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={sLabel}>Tahun Ajaran</label>
                  <select style={{ ...sInput, appearance: 'auto' }} value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)}>
                    {TAHUN_AJARAN_OPTIONS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={sLabel}>Semester</label>
                  <select style={{ ...sInput, appearance: 'auto' }} value={semester} onChange={e => setSemester(e.target.value)}>
                    {SEMESTER_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Daftar Tagihan — dengan tab */}
            <div style={sCard}>
              {/* Tab bar */}
              {(() => {
                const tabs: { key: JenisTagihan; label: string; color: string }[] = [
                  { key: 'wajib',     label: 'Tagihan Wajib',  color: 'var(--navy)' },
                  { key: 'beasiswa',  label: 'Beasiswa',        color: '#B45309'     },
                  { key: 'ekskul',    label: 'Ekskul',          color: '#047857'     },
                  { key: 'aktivitas', label: 'Aktivitas Lain',  color: '#7C3AED'     },
                ]
                return (
                  <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '1.25rem', marginTop: '-0.25rem' }}>
                    {tabs.map(tab => (
                      <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        style={{
                          flex: 1, padding: '0.5rem 0.25rem', background: 'none', border: 'none',
                          borderBottom: activeTab === tab.key ? `2.5px solid ${tab.color}` : '2.5px solid transparent',
                          marginBottom: -2,
                          fontWeight: activeTab === tab.key ? 700 : 400,
                          fontSize: '0.78rem',
                          color: activeTab === tab.key ? tab.color : 'var(--text-muted)',
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        }}
                      >
                        {tab.label}
                        {activeTab === tab.key && (
                          <span style={{ marginLeft: 4, fontSize: '0.7rem', opacity: 0.8 }}>
                            ({(tab.key === 'wajib' ? cardsWajib : tab.key === 'beasiswa' ? cardsBeasiswa : cardsEkskul).length})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )
              })()}

              {/* Header tab aktif + tombol tambah */}
              {(() => {
                const activeCards  = activeTab === 'wajib' ? cardsWajib : activeTab === 'beasiswa' ? cardsBeasiswa : activeTab === 'ekskul' ? cardsEkskul : cardsAktivitas
                const setActiveFn  = activeTab === 'wajib' ? setCardsWajib : activeTab === 'beasiswa' ? setCardsBeasiswa : activeTab === 'ekskul' ? setCardsEkskul : setCardsAktivitas
                const addDisabled  = activeTab === 'wajib' && availableKelas.length === 0
                const addLabel     = activeTab === 'wajib' ? 'Tambah Tagihan Wajib' : activeTab === 'beasiswa' ? 'Tambah Beasiswa' : activeTab === 'ekskul' ? 'Tambah Ekskul' : 'Tambah Aktivitas'
                const emptyMsg     = activeTab === 'wajib'
                  ? kelasOptions.length === 0
                    ? '⚠️ Data kelas belum ada. Selesaikan setup kelas terlebih dahulu.'
                    : 'Belum ada tagihan wajib.'
                  : activeTab === 'beasiswa' ? 'Belum ada beasiswa.'
                  : activeTab === 'ekskul'   ? 'Belum ada ekstrakurikuler.'
                  : 'Belum ada aktivitas lain.'

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                      <button
                        onClick={openAdd}
                        disabled={addDisabled}
                        style={{ ...sBtnPrimary, padding: '0.45rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5, opacity: addDisabled ? 0.5 : 1 }}
                      >
                        <Plus size={14} /> {addLabel}
                      </button>
                    </div>

                    {activeCards.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {emptyMsg}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        {activeCards.map(c => (
                          <TagihanCard
                            key={c.id}
                            card={c}
                            onEdit={openEdit}
                            onDelete={id => setActiveFn(prev => prev.filter(x => x.id !== id))}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => router.push('/dashboard')} style={sBtnSecondary}>← Kembali</button>
              <button onClick={handleSimpan} disabled={saving} style={{ ...sBtnPrimary, flex: 1, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>

          {/* Kolom kanan — Preview */}
          <div style={{ position: 'sticky', top: '1.5rem' }}>
            <div style={sCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Receipt size={16} color="var(--navy)" />
                <span style={sCardTitle}>Preview</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: allCards.length > 0 ? '0.75rem' : '1.25rem' }}>
                <span style={sBadge}>{tahunAjaran}</span>
                <span style={sBadge}>Semester {semester}</span>
              </div>

              {allCards.length > 0 && (() => {
                const grandTotal = cardsWajib.reduce((s, c) => s + c.items.reduce((ss, item) => ss + item.nominal, 0), 0)
                return (
                  <div style={{
                    background: 'linear-gradient(135deg, var(--navy) 0%, #1D4ED8 100%)',
                    borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 2 }}>
                        Total tagihan wajib / siswa
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>
                        {cardsWajib.length} jenjang · {allCards.reduce((s, c) => s + c.items.length, 0)} item total
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
                      {formatRp(grandTotal)}
                    </div>
                  </div>
                )
              })()}

              {allCards.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1.5rem 0' }}>
                  Belum ada tagihan ditambahkan
                </div>
              ) : (
                <>
                  {[
                    { label: 'Tagihan Wajib',  list: cardsWajib,     color: 'var(--navy)' },
                    { label: 'Beasiswa',        list: cardsBeasiswa,  color: '#B45309'     },
                    { label: 'Ekstrakurikuler', list: cardsEkskul,    color: '#047857'     },
                    { label: 'Aktivitas Lain',  list: cardsAktivitas, color: '#7C3AED'     },
                  ].filter(s => s.list.length > 0).map(section => (
                    <div key={section.label} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: section.color, marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {section.label}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {section.list.map(c => <TagihanCard key={c.id} card={c} readonly />)}
                      </div>
                    </div>
                  ))}
                  <div style={{
                    marginTop: '0.5rem', paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)', fontSize: '0.78rem',
                    color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>{allCards.length} komponen</span>
                    <strong style={{ color: 'var(--navy-dark)' }}>
                      {allCards.reduce((s, c) => s + c.items.length, 0)} item tagihan
                    </strong>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modal tambah / edit */}
        {modal.open && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            onClick={closeModal}
          >
            <div
              style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '88vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontFamily: 'var(--font-serif,Georgia,serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '1.25rem' }}>
                {modal.mode === 'add'
                  ? modal.jenis === 'wajib' ? 'Tambah Tagihan Wajib'
                  : modal.jenis === 'beasiswa' ? 'Tambah Beasiswa'
                  : modal.jenis === 'ekskul' ? 'Tambah Ekstrakurikuler'
                  : 'Tambah Aktivitas Lain'
                  : 'Edit Tagihan'}
              </h3>

              {/* Scope toggle — hanya untuk aktivitas */}
              {modal.jenis === 'aktivitas' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={sLabel}>Peserta</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['semua', 'perorangan'] as const).map(s => (
                      <button key={s} onClick={() => setModal(m => ({ ...m, scope: s }))}
                        style={{
                          flex: 1, padding: '0.55rem 0', borderRadius: 8,
                          fontFamily: 'inherit', fontWeight: 600, fontSize: '0.82rem',
                          cursor: 'pointer', transition: 'all 0.15s',
                          border: `2px solid ${modal.scope === s ? '#7C3AED' : 'var(--border)'}`,
                          background: modal.scope === s ? '#7C3AED' : '#fff',
                          color: modal.scope === s ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        {s === 'semua' ? 'Semua Siswa' : 'Perorangan'}
                      </button>
                    ))}
                  </div>
                  <p style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {modal.scope === 'semua'
                      ? 'Berlaku untuk seluruh siswa sekolah'
                      : 'Hanya untuk siswa yang mengikuti kegiatan ini'}
                  </p>
                </div>
              )}

              {/* Nama program — untuk beasiswa, ekskul, aktivitas */}
              {modal.jenis !== 'wajib' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={sLabel}>
                    {modal.jenis === 'beasiswa' ? 'Nama Beasiswa' : modal.jenis === 'ekskul' ? 'Nama Ekstrakurikuler' : 'Nama Kegiatan'}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      modal.jenis === 'beasiswa' ? 'cth: Beasiswa Prestasi, Beasiswa KIP'
                      : modal.jenis === 'ekskul' ? 'cth: Pramuka, Karate, Paduan Suara'
                      : 'cth: Perpisahan Kelas, Study Tour, Pentas Seni'
                    }
                    value={modal.namaProg}
                    onChange={e => setModal(m => ({ ...m, namaProg: e.target.value }))}
                    style={sInput}
                  />
                </div>
              )}

              {/* Pilih kelas — carousel (wajib only) */}
              {modal.jenis === 'wajib' && modal.mode === 'add' && <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ ...sLabel, marginBottom: 0 }}>Kelas</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {carouselIdx + 1} / {availableKelas.length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => navigateCarousel(-1)}
                    disabled={availableKelas.length <= 1}
                    style={sChevronBtn}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  {/* Coverflow track */}
                  <div style={{ flex: 1, overflow: 'hidden', position: 'relative', paddingTop: 16, paddingBottom: 6 }}>
                    <div style={{
                      display: 'flex',
                      transform: `translateX(calc(15% - ${carouselIdx * 70}%))`,
                      transition: 'transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      willChange: 'transform',
                    }}>
                      {availableKelas.map((opt, i) => {
                        const isActive = i === carouselIdx
                        return (
                          <div
                            key={opt.jenjang}
                            style={{
                              flex: '0 0 70%',
                              maxWidth: '70%',
                              padding: '0 5px',
                              transform: isActive ? 'translateY(-10px)' : 'translateY(0px)',
                              transition: 'transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                            }}
                          >
                            <div style={{ position: 'relative' }}>
                              <KelasCard
                                card={{ id: opt.jenjang, jenjang: opt.jenjang, identitas: opt.identitas, warna: opt.warna }}
                                readonly
                              />
                              {/* Overlay redup untuk card non-aktif */}
                              <div style={{
                                position: 'absolute', inset: 0, borderRadius: 12,
                                background: 'rgba(0,0,0,0.38)',
                                opacity: isActive ? 0 : 1,
                                transition: 'opacity 0.38s ease',
                                pointerEvents: 'none',
                              }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => navigateCarousel(1)}
                    disabled={kelasOptions.length <= 1}
                    style={sChevronBtn}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>}

              {/* ── Beasiswa: pilih kelas + persen per item ────────────────── */}
              {modal.jenis === 'beasiswa' && (
                <div style={{ marginBottom: '1rem' }}>
                  {cardsWajib.length === 0 ? (
                    <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.75rem', fontSize: '0.82rem', color: '#92400E' }}>
                      ⚠️ Tambahkan tagihan wajib terlebih dahulu agar bisa memilih item potongan.
                    </div>
                  ) : (
                    <>
                      <label style={sLabel}>Berlaku untuk Kelas <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>(pilih satu atau lebih)</span></label>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                        {cardsWajib.map(c => {
                          const isSelected = modal.kelasRefs.includes(c.kelasJenjang ?? '')
                          return (
                            <button key={c.id}
                              onClick={() => toggleKelasBeasiswa(c)}
                              style={{
                                padding: '0.45rem 0.85rem', borderRadius: 8, fontFamily: 'inherit',
                                fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
                                border: `2px solid ${isSelected ? '#B45309' : 'var(--border)'}`,
                                background: isSelected ? '#B45309' : '#fff',
                                color: isSelected ? '#fff' : 'var(--text-muted)',
                              }}
                            >
                              Kelas {c.kelasJenjang}
                            </button>
                          )
                        })}
                      </div>

                      {modal.potonganInputs.length > 0 && (() => {
                        // Group by (namaItem + nominalAsli) — merge rows with same name & amount
                        const groups = new Map<string, BeasiswaPotonganInput[]>()
                        for (const p of modal.potonganInputs) {
                          const key = `${p.namaItem}||${p.nominalAsli}`
                          const g = groups.get(key) ?? []
                          g.push(p)
                          groups.set(key, g)
                        }

                        const formatKelasLabel = (kelas: string[]) => {
                          if (kelas.length === 1) return kelas[0]
                          if (kelas.length === 2) return `${kelas[0]} & ${kelas[1]}`
                          return `${kelas[0]}–${kelas[kelas.length - 1]}`
                        }

                        return (
                          <>
                            <label style={sLabel}>Potongan per Item Tagihan</label>
                            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: '0.75rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                <span>Item & Kelas</span><span style={{ textAlign: 'right' }}>Nominal Asli</span><span style={{ textAlign: 'center' }}>Diskon</span><span style={{ textAlign: 'right' }}>Potongan</span>
                              </div>
                              {Array.from(groups.entries()).map(([key, items]) => {
                                const { namaItem, nominalAsli, persenPotong } = items[0]
                                const pct    = parseFloat(persenPotong)
                                const potong = (!isNaN(pct) && pct > 0) ? Math.round(nominalAsli * pct / 100) : 0
                                const kelasLabel = formatKelasLabel(items.map(p => p.kelasJenjang))
                                return (
                                  <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px', gap: '0.5rem', padding: '0.55rem 0.75rem', alignItems: 'center', borderBottom: '1px solid #F8FAFC', fontSize: '0.82rem' }}>
                                    <div>
                                      <div style={{ fontWeight: 500, color: 'var(--navy-dark)' }}>{namaItem}</div>
                                      <div style={{ fontSize: '0.68rem', color: '#B45309', marginTop: 1 }}>Kelas {kelasLabel}</div>
                                    </div>
                                    <span style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{formatRp(nominalAsli)}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <input type="number" min={0} max={100} placeholder="0" value={persenPotong}
                                        onChange={e => updatePotonganGroup(namaItem, nominalAsli, e.target.value)}
                                        style={{ ...sInput, padding: '0.35rem 0.4rem', textAlign: 'right', fontSize: '0.8rem' }} />
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>%</span>
                                    </div>
                                    <span style={{ textAlign: 'right', fontWeight: 700, color: potong > 0 ? '#B45309' : 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      {potong > 0 ? `- ${formatRp(potong)}` : '-'}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* ── Item tagihan biasa (wajib / ekskul / aktivitas) ─────────── */}
              {modal.jenis !== 'beasiswa' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={sLabel}>Item Tagihan</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {modal.items.map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input type="text" placeholder={`Nama tagihan ${idx + 1}`} value={item.nama}
                          onChange={e => updateItem(item.id, 'nama', e.target.value)}
                          style={{ ...sInput, flex: '2 1 0' }} />
                        <input type="number" placeholder="Nominal" value={item.nominal} min={0}
                          onChange={e => updateItem(item.id, 'nominal', e.target.value)}
                          style={{ ...sInput, flex: '1.5 1 0' }} />
                        <button onClick={() => removeItem(item.id)} disabled={modal.items.length === 1} title="Hapus"
                          style={{ background: 'none', border: '1.5px solid #FCA5A5', color: '#DC2626', borderRadius: 6, width: 32, height: 32, cursor: modal.items.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: modal.items.length === 1 ? 0.35 : 1, padding: 0 }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addItem} style={{ marginTop: '0.5rem', background: 'none', border: '1.5px dashed var(--border)', color: 'var(--text-muted)', borderRadius: 8, padding: '0.5rem 0.9rem', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5, width: '100%', justifyContent: 'center', fontFamily: 'inherit' }}>
                    <Plus size={13} /> Tambah Item Tagihan
                  </button>
                </div>
              )}

              {/* Summary */}
              {modal.jenis === 'beasiswa' ? (
                beasiswaTotalPotong > 0 && (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#92400E' }}>Total tagihan asli</span>
                      <span style={{ fontWeight: 600, color: '#92400E', fontSize: '0.85rem' }}>{formatRp(beasiswaTotalAsli)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#92400E' }}>Total potongan</span>
                      <span style={{ fontWeight: 600, color: '#B45309', fontSize: '0.85rem' }}>- {formatRp(beasiswaTotalPotong)}</span>
                    </div>
                    <div style={{ borderTop: '1px solid #FDE68A', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400E' }}>Total biaya / siswa</span>
                      <span style={{ fontWeight: 800, color: '#B45309', fontSize: '0.95rem' }}>{formatRp(beasiswaTotalAsli - beasiswaTotalPotong)}</span>
                    </div>
                  </div>
                )
              ) : (
                modalTotal > 0 && (
                  <div style={{ background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-mid)', fontWeight: 600 }}>Total per siswa</span>
                    <span style={{ fontWeight: 800, color: modal.kelasWarna || 'var(--navy-dark)', fontSize: '0.95rem' }}>{formatRp(modalTotal)}</span>
                  </div>
                )
              )}

              {/* Tombol aksi */}
              {(() => {
                const isBeasiswa    = modal.jenis === 'beasiswa'
                const canSubmit     = isBeasiswa
                  ? (!!modal.namaProg.trim() && modal.kelasRefs.length > 0 && beasiswaValidCount > 0)
                  : modalValidCount > 0
                const submitLabel   = modal.mode !== 'add' ? 'Simpan Perubahan'
                  : isBeasiswa ? `Tambah Beasiswa (${beasiswaValidCount} item)`
                  : `Tambah (${modalValidCount} item)`
                return (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={closeModal} style={{ ...sBtnSecondary, flex: 1 }}>Batal</button>
                    <button onClick={handleSubmitModal} disabled={!canSubmit}
                      style={{ ...sBtnPrimary, flex: 2, opacity: canSubmit ? 1 : 0.5 }}>
                      {submitLabel}
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── KOMPONEN VIEW MODE ────────────────────────────────────────────────────
  if (showKomponen) {
    const KOMPONEN_TABS: { key: JenisTagihan; label: string; color: string; cards: TagihanCardData[] }[] = [
      { key: 'wajib',     label: 'Tagihan Wajib',  color: 'var(--navy)', cards: cardsWajib     },
      { key: 'beasiswa',  label: 'Beasiswa',        color: '#B45309',     cards: cardsBeasiswa  },
      { key: 'ekskul',    label: 'Ekstrakurikuler', color: '#047857',     cards: cardsEkskul    },
      { key: 'aktivitas', label: 'Aktivitas Lain',  color: '#7C3AED',     cards: cardsAktivitas },
    ]
    const activeCards = KOMPONEN_TABS.find(t => t.key === komponenTab)?.cards ?? []

    return (
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setShowKomponen(false)}
              style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--navy)', flexShrink: 0, padding: 0 }}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="dashboard-title">Komponen Tagihan</h1>
              <p className="dashboard-subtitle">{tahunAjaran} · Semester {semester}</p>
            </div>
          </div>
          <button
            onClick={() => { setShowKomponen(false); setSetupDone(false) }}
            style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}
          >
            <Pencil size={13} /> Edit Komponen
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border)' }}>
            {KOMPONEN_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setKomponenTab(tab.key)}
                style={{
                  flex: 1, padding: '0.75rem 0.5rem', background: 'none', border: 'none',
                  borderBottom: komponenTab === tab.key ? `3px solid ${tab.color}` : '3px solid transparent',
                  marginBottom: -2,
                  fontWeight: komponenTab === tab.key ? 700 : 400,
                  fontSize: '0.82rem',
                  color: komponenTab === tab.key ? tab.color : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {tab.label}
                <span style={{
                  background: komponenTab === tab.key ? tab.color : 'var(--border)',
                  color: komponenTab === tab.key ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.68rem', fontWeight: 700,
                  padding: '1px 7px', borderRadius: 20, transition: 'all 0.15s',
                }}>
                  {tab.cards.length}
                </span>
              </button>
            ))}
          </div>

          {/* Cards */}
          <div style={{ padding: '1.25rem 1.5rem' }}>
            {activeCards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Belum ada komponen {KOMPONEN_TABS.find(t => t.key === komponenTab)?.label.toLowerCase()}.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.875rem' }}>
                {activeCards.map(c => (
                  <TagihanCard key={c.id} card={c} readonly />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary footer */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {KOMPONEN_TABS.filter(t => t.cards.length > 0).map(t => (
            <div key={t.key} style={{ background: '#fff', border: `1.5px solid ${t.color}20`, borderRadius: 10, padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-dark)' }}>{t.label}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.cards.length} komponen</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── VIEW MODE computed ────────────────────────────────────────────────────
  const periodeOptions = ['Semua', ...Array.from(new Set(
    tagihanList.map(t => `${t.bulan} ${t.tahun}`)
  ))]

  const filtered = tagihanList.filter(t =>
    (filterBulan  === 'Semua' || `${t.bulan} ${t.tahun}` === filterBulan) &&
    (filterStatus === 'Semua' || t.status === filterStatus)
  )

  const totalTarget   = filtered.reduce((s, t) => s + t.nominal * t.total_siswa, 0)
  const totalTerkumpul = filtered.reduce((s, t) => s + t.nominal * t.sudah_bayar, 0)
  const totalSiswa    = filtered.reduce((s, t) => s + t.total_siswa, 0)
  const totalLunas    = filtered.reduce((s, t) => s + t.sudah_bayar, 0)

  const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    aktif:   { label: 'Aktif',   bg: '#FEF3C7', color: '#D97706' },
    selesai: { label: 'Selesai', bg: '#DCFCE7', color: '#15803D' },
    draft:   { label: 'Draft',   bg: '#F1F5F9', color: '#64748B' },
  }

  // ── VIEW MODE ─────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-content">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Tagihan</h1>
          <p className="dashboard-subtitle">Kelola tagihan per kelas per bulan</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowKomponen(true)}
            style={{ ...sBtnSecondary, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0.5rem 1rem' }}
          >
            <Receipt size={13} /> Komponen Tagihan
          </button>
          <button
            onClick={() => { setShowGenModal(true); setGenError('') }}
            style={{ ...sBtnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={15} /> Generate Tagihan Baru
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'TOTAL TARGET',  value: formatRp(totalTarget),   sub: `${filtered.length} tagihan aktif`,     border: 'var(--navy)',  icon: '📋' },
          { label: 'TERKUMPUL',     value: formatRp(totalTerkumpul), sub: 'Sudah masuk ke kas sekolah',           border: '#16A34A',      icon: '💰' },
          { label: 'SISWA LUNAS',   value: `${totalLunas}/${totalSiswa}`, sub: 'Dari semua tagihan terpilih',    border: '#2563EB',      icon: '👥' },
          { label: 'SISA TAGIHAN',  value: formatRp(totalTarget - totalTerkumpul), sub: 'Belum terkumpul',       border: '#D97706',      icon: '⏳' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', borderLeft: `4px solid ${card.border}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>{card.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-dark)', lineHeight: 1.2 }}>{card.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{card.sub}</div>
            <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '2rem', opacity: 0.12 }}>{card.icon}</span>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={filterBulan}
          onChange={e => setFilterBulan(e.target.value)}
          style={{ ...sInput, width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.82rem', appearance: 'auto' }}
        >
          {periodeOptions.map(o => <option key={o}>{o}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ ...sInput, width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.82rem', appearance: 'auto' }}
        >
          {['Semua Status', 'aktif', 'selesai', 'draft'].map(o => <option key={o} value={o === 'Semua Status' ? 'Semua' : o}>{o === 'aktif' ? 'Aktif' : o === 'selesai' ? 'Selesai' : o === 'draft' ? 'Draft' : o}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {filtered.length} tagihan
        </span>
      </div>

      {/* Table */}
      {tagihanLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Memuat data tagihan...</div>
      ) : tagihanList.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
          <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>Belum ada tagihan</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Klik <strong>Generate Tagihan Baru</strong> untuk membuat tagihan bulan ini berdasarkan komponen yang sudah dikonfigurasi.
          </div>
          <button onClick={() => { setShowGenModal(true); setGenError('') }} style={{ ...sBtnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Generate Tagihan Baru
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>PERIODE</th>
                <th>JENIS</th>
                <th>KELAS</th>
                <th>NOMINAL/SISWA</th>
                <th>PROGRESS</th>
                <th>JATUH TEMPO</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">Tidak ada tagihan sesuai filter</td></tr>
              ) : filtered.map((t, idx) => {
                const pct   = t.total_siswa > 0 ? Math.round(t.sudah_bayar / t.total_siswa * 100) : 0
                const badge = STATUS_BADGE[t.status] ?? STATUS_BADGE.draft
                const shortId = `T${String(idx + 1).padStart(3, '0')}`
                return (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)' }}>{shortId}</td>
                    <td style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.bulan} {t.tahun}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-mid)' }}>{t.jenis}{t.nama ? ` — ${t.nama}` : ''}</td>
                    <td>
                      {t.kelas_jenjang
                        ? <span style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Kelas {t.kelas_jenjang}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                      }
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{formatRp(t.nominal)}</td>
                    <td style={{ minWidth: 160 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        {t.sudah_bayar}/{t.total_siswa} siswa ({pct}%)
                      </div>
                      <div style={{ background: '#F1F5F9', borderRadius: 100, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#16A34A' : '#1D4ED8', borderRadius: 100, transition: 'width 0.4s ease' }} />
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-mid)' }}>
                      {t.jatuh_tempo ? new Date(t.jatuh_tempo).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      <span style={{ background: badge.bg, color: badge.color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                        {badge.label}
                      </span>
                    </td>
                    <td>
                      <button style={{ background: '#EFF6FF', color: '#1D4ED8', border: 'none', borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Detail
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Modal */}
      {showGenModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setShowGenModal(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '88vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: 'var(--font-serif,Georgia,serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.25rem' }}>
              Generate Tagihan Baru
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Membuat tagihan berdasarkan {allCards.length} komponen yang sudah dikonfigurasi.
            </p>

            {genError && <div className="login-error" style={{ marginBottom: '1rem' }}>{genError}</div>}

            {/* Periode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={sLabel}>Bulan</label>
                <select
                  style={{ ...sInput, appearance: 'auto' }}
                  value={genBulan}
                  onChange={e => setGenBulan(e.target.value)}
                >
                  <option value="">-- Pilih Bulan --</option>
                  {BULAN_NAMES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={sLabel}>Tahun</label>
                <input
                  type="number"
                  value={genTahun}
                  onChange={e => setGenTahun(parseInt(e.target.value) || new Date().getFullYear())}
                  min={2020} max={2040}
                  style={sInput}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={sLabel}>Jatuh Tempo</label>
              <input
                type="date"
                value={genJatuhTempo}
                onChange={e => setGenJatuhTempo(e.target.value)}
                style={sInput}
              />
            </div>

            {/* Preview tagihan yang akan dibuat */}
            {genBulan && (
              <div style={{ background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Preview — {allCards.length} tagihan akan dibuat
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {cardsWajib.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-mid)' }}>SPP Bulanan — Kelas {c.kelasJenjang}</span>
                      <span style={{ fontWeight: 600 }}>{formatRp(c.items.reduce((s, i) => s + i.nominal, 0))}</span>
                    </div>
                  ))}
                  {[...cardsBeasiswa, ...cardsEkskul, ...cardsAktivitas].map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-mid)' }}>{c.jenis === 'beasiswa' ? 'Beasiswa' : c.jenis === 'ekskul' ? 'Ekskul' : 'Aktivitas'} — {c.nama}</span>
                      <span style={{ fontWeight: 600 }}>{formatRp(c.items.reduce((s, i) => s + i.nominal, 0))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowGenModal(false)} style={{ ...sBtnSecondary, flex: 1 }}>Batal</button>
              <button
                onClick={handleGenerateTagihan}
                disabled={generating || !genBulan || !genJatuhTempo}
                style={{ ...sBtnPrimary, flex: 2, opacity: (generating || !genBulan || !genJatuhTempo) ? 0.6 : 1 }}
              >
                {generating ? 'Menyimpan...' : `Generate ${allCards.length} Tagihan`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const sLabel:       React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 4 }
const sInput:       React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--text-dark)', outline: 'none', background: '#fff' }
const sCard:        React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sCardTitle:   React.CSSProperties = { fontWeight: 700, color: 'var(--navy-dark)', fontSize: '0.9rem', marginBottom: '1rem' }
const sBadge:       React.CSSProperties = { background: '#F1F5F9', color: 'var(--navy-dark)', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem', borderRadius: 20, border: '1px solid var(--border)' }
const sChevronBtn:  React.CSSProperties = { background: '#F1F5F9', border: '1px solid var(--border)', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--navy)', flexShrink: 0, padding: 0 }
const sBtnPrimary:  React.CSSProperties = { background: 'var(--navy)', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
const sBtnSecondary:React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
