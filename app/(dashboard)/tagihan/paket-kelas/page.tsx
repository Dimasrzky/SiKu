'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Trash2, Search, Pencil, Layers, AlertTriangle, Archive, ChevronRight, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const JENJANG_MAP: Record<string, string[]> = {
  'TK/PAUD': ['A', 'B', 'C'],
  'SD/MI':   ['1', '2', '3', '4', '5', '6'],
  'SMP/MTs': ['7', '8', '9'],
  'SMA/MA':  ['10', '11', '12'],
  'SMK':     ['10', '11', '12'],
}

const formatRupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

const jenisBadgeMap: Record<string, string> = {
  rutin_bulanan: 'Rutin bulanan',
  sekali_bayar:  'Sekali bayar',
  per_semester:  'Per semester',
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface KomponenItem {
  id:              string
  nama:            string
  jenis:           'rutin_bulanan' | 'sekali_bayar' | 'per_semester'
  kelas_warna:     string | null
  keterangan:      string | null
  nominal_default: number | null
}

interface KelasOption {
  id:          string
  nama:        string
  jenjang:     string
  siswa_count: number
}

interface PaketKelasData {
  id:          string
  nama:        string
  jenjang:     string
  siswa_count: number
}

interface PaketKomponenData {
  id:          string
  komponen_id: string
  nominal:     number
  komponen:    { nama: string; kelas_warna: string | null } | null
}

interface PaketItem {
  id:            string
  nama:          string
  tahun_ajaran:  string
  jatuh_tempo:   string | null
  kelas_list:    PaketKelasData[]
  komponen_list: PaketKomponenData[]
}

interface RiwayatItem {
  tahun_ajaran:    string
  paket_count:     number
  tanggal_mulai:   string | null
  tanggal_selesai: string | null
}

// ── Raw Supabase response types ───────────────────────────────────────────────
type SiswaCountRow     = { count: number }
type KelasNested       = { id: string; nama: string; jenjang: string; siswa: SiswaCountRow[] }
type PaketKelasNested  = { kelas: KelasNested | null }
type KomponenNested    = { nama: string; kelas_warna: string | null }
type PaketKomponenNested = { id: string; komponen_id: string; nominal: number; komponen: KomponenNested | null }
type PaketRawFull = {
  id:            string
  nama:          string
  tahun_ajaran:  string
  jatuh_tempo:   string | null
  paket_kelas:   PaketKelasNested[]
  paket_komponen: PaketKomponenNested[]
}
type KelasRaw = { id: string; nama: string; jenjang: string; siswa: SiswaCountRow[] }
type TaRow    = { nama: string; tanggal_mulai: string | null; tanggal_selesai: string | null }
type PaketSimple = { id: string; tahun_ajaran: string }

export default function PaketPerKelasPage() {
  const router = useRouter()

  const [loading,          setLoading]          = useState(true)
  const [sekolahId,        setSekolahId]        = useState('')
  const [paketList,        setPaketList]        = useState<PaketItem[]>([])
  const [riwayatList,      setRiwayatList]      = useState<RiwayatItem[]>([])
  const [kelasList,        setKelasList]        = useState<KelasOption[]>([])
  const [komponenList,     setKomponenList]     = useState<KomponenItem[]>([])
  const [activeTahunAjaran, setActiveTahunAjaran] = useState('')
  const [searchQuery,      setSearchQuery]      = useState('')

  // Form state
  const [showForm,           setShowForm]           = useState(false)
  const [formClosing,        setFormClosing]        = useState(false)
  const [formNama,           setFormNama]           = useState('')
  const [formJatuhTempo,     setFormJatuhTempo]     = useState('')
  const [formSaving,         setFormSaving]         = useState(false)
  const [formError,          setFormError]          = useState('')
  const [selectedJenjang,    setSelectedJenjang]    = useState('')
  const [selectedKelasIds,   setSelectedKelasIds]   = useState<string[]>([])
  const [checkedKomponenIds, setCheckedKomponenIds] = useState<string[]>([])
  const [nominalMap,         setNominalMap]         = useState<Record<string, number>>({})
  const [editingNominalId,   setEditingNominalId]   = useState<string | null>(null)
  const [editingNominalVal,  setEditingNominalVal]  = useState('')

  // Delete modal
  const [deleteTarget,  setDeleteTarget]  = useState<PaketItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Edit modal
  const [editTarget,              setEditTarget]              = useState<PaketItem | null>(null)
  const [editNama,                setEditNama]                = useState('')
  const [editJatuhTempo,          setEditJatuhTempo]          = useState('')
  const [editNominalMap,          setEditNominalMap]          = useState<Record<string, number>>({})
  const [editingKompId,           setEditingKompId]           = useState<string | null>(null)
  const [editingKompVal,          setEditingKompVal]          = useState('')
  const [editSelectedKomponenIds, setEditSelectedKomponenIds] = useState<string[]>([])
  const [editNewNominalMap,       setEditNewNominalMap]       = useState<Record<string, number>>({})
  const [editSelectedKelasIds,    setEditSelectedKelasIds]    = useState<string[]>([])
  const [editSaving,              setEditSaving]              = useState(false)
  const [editError,               setEditError]               = useState('')

  // Popup kelas belum lengkap
  const [jenjangOptions,         setJenjangOptions]         = useState<string[]>([])
  const [showKelasKurangPopup,   setShowKelasKurangPopup]   = useState(false)
  const [showAllPaketedPopup,    setShowAllPaketedPopup]    = useState(false)

  // Rekening sekolah — paket tagihan tak ada gunanya tanpa rekening tujuan pembayaran
  const [hasRekening,          setHasRekening]          = useState(true)
  const [showRekeningPopup,    setShowRekeningPopup]    = useState(false)

  // Bawa paket periode sebelumnya ke tahun ajaran baru
  const [showCarryPopup, setShowCarryPopup] = useState(false)
  const [carryFrom,      setCarryFrom]      = useState('')
  const [carrying,       setCarrying]       = useState(false)
  const [carryError,     setCarryError]     = useState('')
  const [aktifSelesai,   setAktifSelesai]   = useState('')

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadPaket = async (sid: string, tahun: string) => {
    const { data: paketData } = await supabase
      .from('paket')
      .select(`
        id, nama, tahun_ajaran, jatuh_tempo,
        paket_kelas(kelas_id, kelas:kelas_id(id, nama, jenjang, siswa(count))),
        paket_komponen(id, komponen_id, nominal, komponen:komponen_id(nama, kelas_warna))
      `)
      .eq('sekolah_id', sid)
      .order('created_at', { ascending: false })
      .limit(100)

    const semuaPaket = (paketData ?? []) as unknown as PaketRawFull[]

    if (paketData) {
      setPaketList((paketData as unknown as PaketRawFull[]).map(p => ({
        id:           p.id,
        nama:         p.nama,
        tahun_ajaran: p.tahun_ajaran,
        jatuh_tempo:  p.jatuh_tempo ?? null,
        kelas_list:   p.paket_kelas
          .map(pk => ({
            id:          pk.kelas?.id ?? '',
            nama:        pk.kelas?.nama ?? '',
            jenjang:     pk.kelas?.jenjang ?? '',
            siswa_count: pk.kelas?.siswa?.[0]?.count ?? 0,
          }))
          .filter(k => k.id !== ''),
        komponen_list: p.paket_komponen.map(pk => ({
          id:          pk.id,
          komponen_id: pk.komponen_id,
          nominal:     pk.nominal,
          komponen:    pk.komponen,
        })),
      })))
    }

    const [{ data: inactiveTa }, { data: oldPakets }] = await Promise.all([
      supabase.from('tahun_ajaran')
        .select('nama, tanggal_mulai, tanggal_selesai')
        .eq('is_aktif', false)
        .order('tanggal_mulai', { ascending: false }),
      tahun
        ? supabase.from('paket').select('id, tahun_ajaran').eq('sekolah_id', sid).neq('tahun_ajaran', tahun)
        : supabase.from('paket').select('id, tahun_ajaran').eq('sekolah_id', sid),
    ])

    const riwayat = ((inactiveTa ?? []) as TaRow[])
      .map(ta => ({
        tahun_ajaran:    ta.nama,
        paket_count:     ((oldPakets ?? []) as PaketSimple[]).filter(p => p.tahun_ajaran === ta.nama).length,
        tanggal_mulai:   ta.tanggal_mulai,
        tanggal_selesai: ta.tanggal_selesai,
      }))
      .filter(r => r.paket_count > 0)

    setRiwayatList(riwayat)

    return {
      adaPaketAktif:   semuaPaket.some(p => p.tahun_ajaran === tahun),
      // riwayat sudah terurut tanggal_mulai menurun dan hanya berisi periode yang punya paket
      periodeTerakhir: riwayat[0]?.tahun_ajaran ?? '',
    }
  }

  useEffect(() => {
    ;(async () => {
      const { data: pData } = await supabase.from('pengaturan').select('setup_steps, jenjang_sekolah').maybeSingle()
      const peng  = pData as { setup_steps?: Record<string, boolean>; jenjang_sekolah?: string } | null
      const steps = peng?.setup_steps ?? {}
      if (!steps['buat_kelas']) { router.replace('/siswa/manajemen-kelas'); return }
      setJenjangOptions(JENJANG_MAP[peng?.jenjang_sekolah ?? ''] ?? [])

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('sekolah_id').eq('id', user.id).single()
      const sid = (profile as { sekolah_id: string } | null)?.sekolah_id ?? ''
      if (!sid) return
      setSekolahId(sid)

      const { data: taData } = await supabase.from('tahun_ajaran')
        .select('nama, tanggal_selesai').eq('is_aktif', true).maybeSingle()
      const ta    = taData as { nama: string; tanggal_selesai: string } | null
      const tahun = ta?.nama ?? ''
      setActiveTahunAjaran(tahun)
      setAktifSelesai(ta?.tanggal_selesai ?? '')

      const [{ data: kData }, { data: kompData }, { data: rekData }] = await Promise.all([
        supabase.from('kelas').select('id, nama, jenjang, siswa(count)').order('jenjang').limit(100),
        supabase.from('komponen_tagihan')
          .select('id, jenis, nama, kelas_warna, keterangan, nominal_default')
          .eq('tahun_ajaran', tahun)
          .order('created_at')
          .limit(100),
        supabase.from('rekening')
          .select('id')
          .eq('sekolah_id', sid).eq('jenis', 'transfer').eq('aktif', true)
          .limit(1)
          .maybeSingle(),
      ])

      setHasRekening(!!rekData)

      setKelasList(((kData ?? []) as KelasRaw[]).map(k => ({
        id:          k.id,
        nama:        k.nama,
        jenjang:     k.jenjang,
        siswa_count: k.siswa?.[0]?.count ?? 0,
      })))
      setKomponenList((kompData ?? []) as KomponenItem[])

      const { adaPaketAktif, periodeTerakhir } = await loadPaket(sid, tahun)

      // Tahun ajaran baru selalu mulai tanpa paket karena paket terikat nama periode.
      // Tawarkan membawa paket periode sebelumnya sebelum bendahara menyusun dari nol.
      if (tahun && !adaPaketAktif && periodeTerakhir) {
        setCarryFrom(periodeTerakhir)
        setShowCarryPopup(true)
      }

      setLoading(false)
    })()
  }, [router])

  // ── Derived ───────────────────────────────────────────────────────────────
  const activePakets       = paketList.filter(p => p.tahun_ajaran === activeTahunAjaran)
  const assignedKelasIds   = new Set(activePakets.flatMap(p => p.kelas_list.map(k => k.id)))
  // Kelas & jenjang yang masih tersedia untuk form (belum dipakai di paket aktif manapun)
  const availableKelas     = kelasList.filter(k => !assignedKelasIds.has(k.id))
  const availableJenjang   = [...new Set(availableKelas.map(k => k.jenjang).filter(Boolean))]
  // Kelas dari jenjang yg sudah ada paket tapi tidak dipilih + jenjang yang belum ada paket sama sekali
  const coveredJenjang     = new Set(activePakets.flatMap(p => p.kelas_list.map(k => k.jenjang)))
  const missedKelas        = kelasList.filter(k => coveredJenjang.has(k.jenjang) && !assignedKelasIds.has(k.id))
  const uncoveredKelas     = kelasList.filter(k => !coveredJenjang.has(k.jenjang))
  const warningKelas       = [...missedKelas, ...uncoveredKelas]
  const filteredKelas      = selectedJenjang ? availableKelas.filter(k => k.jenjang === selectedJenjang) : []
  const totalSiswaSelected = kelasList.filter(k => selectedKelasIds.includes(k.id)).reduce((s, k) => s + k.siswa_count, 0)
  const totalKomponen      = checkedKomponenIds.length
  const totalNominal       = checkedKomponenIds.reduce((sum, id) => {
    const k = komponenList.find(x => x.id === id)
    return sum + (nominalMap[id] ?? k?.nominal_default ?? 0)
  }, 0)
  const filtered         = activePakets.filter(p =>
    !searchQuery || p.nama.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const getNominal = (k: KomponenItem) => nominalMap[k.id] ?? k.nominal_default ?? 0

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openForm = () => {
    // Tanpa rekening tujuan, tagihan yang dibuat tidak bisa dibayar orang tua
    if (!hasRekening) { setShowRekeningPopup(true); return }

    const allJenjangReady = jenjangOptions.length > 0 &&
      jenjangOptions.every(j => kelasList.some(k => k.jenjang === j))
    if (!allJenjangReady) { setShowKelasKurangPopup(true); return }

    const allPaketed = kelasList.length > 0 &&
      kelasList.every(k => paketList.some(p => p.kelas_list.some(pk => pk.id === k.id)))
    if (allPaketed) { setShowAllPaketedPopup(true); return }

    setFormNama(''); setFormJatuhTempo(''); setFormError(''); setFormClosing(false)
    setSelectedJenjang(''); setSelectedKelasIds([])
    setCheckedKomponenIds([]); setNominalMap({})
    setEditingNominalId(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeForm = () => {
    setFormClosing(true)
    setTimeout(() => { setShowForm(false); setFormClosing(false) }, 400)
  }

  // ── Bawa paket periode sebelumnya ke tahun ajaran aktif ───────────────────
  // Komponen ikut disalin karena komponen_tagihan juga terikat nama periode —
  // tanpa itu paket salinan menunjuk komponen tahun lalu dan daftar pilihan
  // komponen di form tetap kosong.
  const handleGunakanPaketLama = async () => {
    if (!carryFrom || !sekolahId || !activeTahunAjaran) return
    setCarrying(true); setCarryError('')

    type KompLama = {
      id: string; jenis: string; nama: string | null; kelas_warna: string | null
      keterangan: string | null; nominal_default: number | null; semester: string | null
    }
    type ItemLama     = { nama: string; nominal: number | null; urutan: number | null }
    type PotonganLama = {
      kelas_jenjang: string; nama_item: string
      nominal_asli: number | null; persen_potong: number | null
    }

    try {
      const { data: kompLama } = await supabase
        .from('komponen_tagihan')
        .select('id, jenis, nama, kelas_warna, keterangan, nominal_default, semester')
        .eq('sekolah_id', sekolahId)
        .eq('tahun_ajaran', carryFrom)
        .limit(200)

      const komponenMap = new Map<string, string>()  // id lama → id baru
      for (const k of ((kompLama ?? []) as KompLama[])) {
        const { data: baru, error } = await supabase.from('komponen_tagihan').insert({
          sekolah_id:      sekolahId,
          jenis:           k.jenis,
          nama:            k.nama,
          kelas_warna:     k.kelas_warna,
          keterangan:      k.keterangan,
          nominal_default: k.nominal_default,
          tahun_ajaran:    activeTahunAjaran,
          semester:        k.semester,
        }).select('id').single()
        if (error || !baru) throw new Error(error?.message ?? 'Gagal menyalin komponen tagihan.')
        komponenMap.set(k.id, baru.id)

        const [{ data: items }, { data: potongan }] = await Promise.all([
          supabase.from('komponen_tagihan_item')
            .select('nama, nominal, urutan').eq('komponen_id', k.id).limit(100),
          supabase.from('komponen_tagihan_potongan')
            .select('kelas_jenjang, nama_item, nominal_asli, persen_potong').eq('komponen_id', k.id).limit(100),
        ])
        const itemRows = (items ?? []) as ItemLama[]
        if (itemRows.length > 0) {
          await supabase.from('komponen_tagihan_item')
            .insert(itemRows.map(i => ({ ...i, komponen_id: baru.id })))
        }
        const potonganRows = (potongan ?? []) as PotonganLama[]
        if (potonganRows.length > 0) {
          await supabase.from('komponen_tagihan_potongan')
            .insert(potonganRows.map(p => ({ ...p, komponen_id: baru.id })))
        }
      }

      const paketLama = paketList.filter(p => p.tahun_ajaran === carryFrom)
      if (paketLama.length === 0) throw new Error('Paket periode sebelumnya tidak ditemukan.')

      for (const p of paketLama) {
        const { data: paketBaru, error } = await supabase.from('paket').insert({
          sekolah_id:   sekolahId,
          nama:         p.nama,
          tahun_ajaran: activeTahunAjaran,
          jatuh_tempo:  aktifSelesai || null,
        }).select('id').single()
        if (error || !paketBaru) throw new Error(error?.message ?? 'Gagal menyalin paket.')

        if (p.kelas_list.length > 0) {
          const { error: eKelas } = await supabase.from('paket_kelas')
            .insert(p.kelas_list.map(k => ({ paket_id: paketBaru.id, kelas_id: k.id })))
          if (eKelas) throw new Error(`Gagal menyalin kelas paket: ${eKelas.message}`)
        }

        const komps = p.komponen_list
          .map(kl => ({
            paket_id:    paketBaru.id,
            komponen_id: komponenMap.get(kl.komponen_id) ?? '',
            nominal:     kl.nominal,
          }))
          .filter(kl => kl.komponen_id !== '')
        if (komps.length > 0) {
          const { error: eKomp } = await supabase.from('paket_komponen').insert(komps)
          if (eKomp) throw new Error(`Gagal menyalin komponen paket: ${eKomp.message}`)
        }
      }

      window.location.reload()
    } catch (err) {
      setCarryError((err as Error).message)
      setCarrying(false)
    }
  }

  const toggleKelas = (id: string) =>
    setSelectedKelasIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleKomponen = (id: string) =>
    setCheckedKomponenIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const startEditNominal = (k: KomponenItem) => {
    setEditingNominalId(k.id)
    setEditingNominalVal(String(getNominal(k)))
  }

  const commitNominal = (id: string) => {
    const val = parseInt(editingNominalVal.replace(/\D/g, ''), 10)
    setNominalMap(prev => ({ ...prev, [id]: isNaN(val) ? 0 : val }))
    setEditingNominalId(null)
  }

  const handleSimpan = async () => {
    setFormError('')
    if (selectedKelasIds.length === 0) { setFormError('Pilih minimal satu kelas.'); return }
    if (totalKomponen === 0)           { setFormError('Pilih minimal satu komponen tagihan.'); return }
    if (!formNama.trim())              { setFormError('Nama paket harus diisi.'); return }
    setFormSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setFormError('Sesi tidak ditemukan.'); setFormSaving(false); return }
    if (!sekolahId) { setFormError('Data sekolah tidak ditemukan.'); setFormSaving(false); return }

    const { data: paket, error: e1 } = await supabase
      .from('paket')
      .insert({ sekolah_id: sekolahId, nama: formNama.trim(), tahun_ajaran: activeTahunAjaran, jatuh_tempo: formJatuhTempo || null })
      .select('id').single()
    if (e1 || !paket) { setFormError(e1?.message ?? 'Gagal menyimpan paket.'); setFormSaving(false); return }
    const paketId = (paket as { id: string }).id

    const { error: e2 } = await supabase.from('paket_kelas').insert(
      selectedKelasIds.map(kelas_id => ({ paket_id: paketId, kelas_id }))
    )
    if (e2) { setFormError(e2.message); setFormSaving(false); return }

    const { error: e3 } = await supabase.from('paket_komponen').insert(
      checkedKomponenIds.map(komponen_id => {
        const k = komponenList.find(x => x.id === komponen_id)
        return { paket_id: paketId, komponen_id, nominal: nominalMap[komponen_id] ?? k?.nominal_default ?? 0 }
      })
    )
    if (e3) { setFormError(e3.message); setFormSaving(false); return }

    await loadPaket(sekolahId, activeTahunAjaran)
    setFormSaving(false)
    closeForm()
    triggerRecalculate()
  }

  const triggerRecalculate = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    fetch('/api/recalculate-tagihan', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
    }).catch(() => {})
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const { error } = await supabase.from('paket').delete().eq('id', deleteTarget.id)
    if (error) { setDeleteLoading(false); return }
    setPaketList(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleteLoading(false)
  }

  const openEdit = (p: PaketItem) => {
    setEditTarget(p)
    setEditNama(p.nama)
    setEditJatuhTempo(p.jatuh_tempo ?? '')
    const map: Record<string, number> = {}
    p.komponen_list.forEach(kp => { map[kp.id] = kp.nominal })
    setEditNominalMap(map)
    setEditSelectedKomponenIds(p.komponen_list.map(kp => kp.komponen_id))
    setEditNewNominalMap({})
    setEditSelectedKelasIds(p.kelas_list.map(k => k.id))
    setEditingKompId(null)
    setEditError('')
  }

  const commitEditNominal = (id: string) => {
    const val = parseInt(editingKompVal.replace(/\D/g, ''), 10)
    setEditNominalMap(prev => ({ ...prev, [id]: isNaN(val) ? 0 : val }))
    setEditingKompId(null)
  }

  const handleEditSimpan = async () => {
    if (!editTarget) return
    if (!editNama.trim()) { setEditError('Nama paket harus diisi.'); return }
    if (editSelectedKelasIds.length === 0) { setEditError('Pilih minimal satu kelas.'); return }
    if (editSelectedKomponenIds.length === 0) { setEditError('Pilih minimal satu komponen tagihan.'); return }
    setEditSaving(true)
    setEditError('')

    // Update nama & jatuh tempo
    const { error: e1 } = await supabase
      .from('paket')
      .update({ nama: editNama.trim(), jatuh_tempo: editJatuhTempo || null })
      .eq('id', editTarget.id)
    if (e1) { setEditError(e1.message); setEditSaving(false); return }

    // Komponen: existing ones — update nominal, removed ones — delete
    const existingKompIds = new Set(editTarget.komponen_list.map(kp => kp.komponen_id))
    const removedKomps    = editTarget.komponen_list.filter(kp => !editSelectedKomponenIds.includes(kp.komponen_id))
    const addedKompIds    = editSelectedKomponenIds.filter(kid => !existingKompIds.has(kid))

    await Promise.all([
      ...editTarget.komponen_list
        .filter(kp => editSelectedKomponenIds.includes(kp.komponen_id))
        .map(kp => supabase.from('paket_komponen').update({ nominal: editNominalMap[kp.id] ?? kp.nominal }).eq('id', kp.id)),
      ...removedKomps.map(kp => supabase.from('paket_komponen').delete().eq('id', kp.id)),
      addedKompIds.length > 0
        ? supabase.from('paket_komponen').insert(
            addedKompIds.map(kid => ({
              paket_id:    editTarget.id,
              komponen_id: kid,
              nominal:     editNewNominalMap[kid] ?? (komponenList.find(k => k.id === kid)?.nominal_default ?? 0),
            }))
          )
        : Promise.resolve(),
    ])

    // Kelas: removed ones — delete, added ones — insert
    const existingKelasIds = new Set(editTarget.kelas_list.map(k => k.id))
    const removedKelasIds  = editTarget.kelas_list.filter(k => !editSelectedKelasIds.includes(k.id)).map(k => k.id)
    const addedKelasIds    = editSelectedKelasIds.filter(kid => !existingKelasIds.has(kid))

    await Promise.all([
      removedKelasIds.length > 0
        ? supabase.from('paket_kelas').delete().eq('paket_id', editTarget.id).in('kelas_id', removedKelasIds)
        : Promise.resolve(),
      addedKelasIds.length > 0
        ? supabase.from('paket_kelas').insert(addedKelasIds.map(kid => ({ paket_id: editTarget.id, kelas_id: kid })))
        : Promise.resolve(),
    ])

    await loadPaket(sekolahId, activeTahunAjaran)
    setEditTarget(null)
    setEditSaving(false)
    triggerRecalculate()
  }

  if (loading) {
    return (
      <div className="dashboard-content">
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Memuat data...</div>
      </div>
    )
  }

  return (
    <div className="dashboard-content">
      <style>{`
        @keyframes modalBackdrop { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalCard { from { opacity: 0; transform: scale(0.88) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes formSlideDown { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes formSlideUp   { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ width: 60, height: 60, background: '#1A2C4E', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '10px 16px 14px rgba(18,47,102,0.31)' }}>
          <Image src="/icons/IconBox.png" width={32} height={32} alt="Paket" style={{ display: 'block' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy-dark)', fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, lineHeight: 1.2 }}>
            Paket per kelas
          </h1>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
            Kelola paket tagihan per jenjang kelas
          </p>
        </div>
        {!showForm && (
          <button onClick={openForm}
            style={{ marginLeft: 'auto', background: '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.6rem 1.1rem', borderRadius: 10, fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 5px 2px rgba(18,47,102,0.31)', flexShrink: 0 }}>
            Tambah Paket Baru <Image src="/icons/IconEdit2.png" width={18} height={18} alt="Tambah" style={{ display: 'block' }} />
          </button>
        )}
      </div>

      {/* ── Inline Form (animasi tidak berubah) ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateRows: showForm && !formClosing ? '1fr' : '0fr', transition: 'grid-template-rows 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ overflow: 'hidden', paddingBottom: showForm && !formClosing ? '1.5rem' : 0, transition: 'padding-bottom 0.38s cubic-bezier(0.4,0,0.2,1)' }}>
          {showForm && (
            <div style={{ animation: formClosing ? 'formSlideUp 0.26s cubic-bezier(0.22,1,0.36,1) forwards' : 'formSlideDown 0.3s cubic-bezier(0.22,1,0.36,1)' }}>
              <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '6px 6px 8px rgba(18,47,102,0.18)', marginBottom: 0 }}>

                {formError && <div className="login-error" style={{ marginBottom: '1rem' }}>{formError}</div>}

                {/* Pilih Tingkat Jenjang + Kelas */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.5rem' }}>Pilih Tingkat Jenjang</div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {availableJenjang.length === 0 ? (
                          <span style={{ fontSize: '0.875rem', color: '#94A3B8' }}>Semua jenjang sudah memiliki paket</span>
                        ) : availableJenjang.map(j => (
                          <button key={j}
                            onClick={() => { setSelectedJenjang(j); setSelectedKelasIds([]) }}
                            style={{ padding: '0.45rem 1.1rem', borderRadius: 8, border: selectedJenjang === j ? 'none' : '2px solid #C1C6CF', background: selectedJenjang === j ? '#1A2C4E' : '#fff', color: selectedJenjang === j ? '#fff' : '#6F788A', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                            Kelas {j}
                          </button>
                        ))}
                      </div>
                    </div>
                    {selectedJenjang && (
                      <button
                        onClick={() => setSelectedKelasIds(filteredKelas.map(k => k.id))}
                        style={{ background: '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.5rem 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, boxShadow: '0 4px 2px rgba(18,47,102,0.2)', alignSelf: 'flex-end' }}>
                        Pilih Semua
                      </button>
                    )}
                  </div>

                  {selectedJenjang && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.5rem' }}>Berlaku untuk kelas</div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {filteredKelas.length === 0 ? (
                          <span style={{ fontSize: '0.875rem', color: '#94A3B8' }}>Tidak ada kelas di jenjang ini</span>
                        ) : filteredKelas.map(k => {
                          const active = selectedKelasIds.includes(k.id)
                          return (
                            <button key={k.id} onClick={() => toggleKelas(k.id)}
                              style={{ padding: '0.4rem 0.875rem', borderRadius: 8, border: active ? '2px solid #1A2C4E' : '2px solid #C1C6CF', background: active ? '#EEF2FF' : '#F8FAFC', color: active ? '#1A2C4E' : '#6F788A', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                              {k.nama}
                            </button>
                          )
                        })}
                      </div>
                      {selectedKelasIds.length > 0 && (
                        <p style={{ fontSize: '0.82rem', fontWeight: 500, color: '#6F788A', margin: '0.5rem 0 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span>ⓘ</span>
                          {selectedKelasIds.length} kelas terpilih · {totalSiswaSelected} total siswa
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                {/* Pilih Komponen Tagihan */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.2rem' }}>Pilih Komponen Tagihan</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                    Pilih dan atur nominal komponen yang masuk dalam paket ini
                  </div>
                  <div style={{ maxHeight: 310, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                    {komponenList.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Belum ada komponen tagihan untuk tahun ajaran ini
                      </div>
                    ) : komponenList.map((k, i) => {
                      const checked       = checkedKomponenIds.includes(k.id)
                      const isEditing     = editingNominalId === k.id
                      const avatarInisial = k.nama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
                      return (
                        <div key={k.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem' }}>
                            <input type="checkbox" checked={checked}
                              onChange={() => toggleKomponen(k.id)}
                              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#1A2C4E', flexShrink: 0 }} />
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: k.kelas_warna ?? '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.875rem' }}>{avatarInisial}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy-dark)' }}>{k.nama}</span>
                                <span style={{ background: '#EEF2FF', color: '#1A2C4E', padding: '0.1rem 0.45rem', borderRadius: 4, fontWeight: 600, fontSize: '0.72rem', flexShrink: 0 }}>
                                  {jenisBadgeMap[k.jenis] ?? k.jenis}
                                </span>
                              </div>
                              {k.keterangan && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                  {k.keterangan}
                                </div>
                              )}
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              {isEditing ? (
                                <input
                                  type="number" value={editingNominalVal}
                                  onChange={e => setEditingNominalVal(e.target.value)}
                                  onBlur={() => commitNominal(k.id)}
                                  onKeyDown={e => { if (e.key === 'Enter') commitNominal(k.id) }}
                                  style={{ ...sInput, width: 150, padding: '0.4rem 0.75rem', fontSize: '0.875rem', boxShadow: 'none', borderRadius: 999 }}
                                  autoFocus
                                />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', background: '#F1F5F9', border: '1.5px solid #CBD5E1', borderRadius: 999, padding: '0.38rem 0.5rem 0.38rem 0.875rem', gap: '0.3rem', minWidth: 160 }}>
                                  <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                                    {formatRupiah(getNominal(k))}
                                  </span>
                                  <button onClick={() => startEditNominal(k)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0.35rem', color: '#94A3B8', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                    <Pencil size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {i < komponenList.length - 1 && (
                            <div style={{ height: 1, background: '#E2E8F0', marginLeft: '1rem', marginRight: '1rem' }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {komponenList.length > 5 && (
                    <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#94A3B8', marginTop: '0.4rem', fontWeight: 500 }}>
                      ↓ Scroll untuk lihat komponen lain
                    </div>
                  )}
                </div>

                {/* Total card */}
                {totalKomponen > 0 && (
                  <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#6F788A' }}>{totalKomponen} komponen terpilih</span>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--navy-dark)' }}>{formatRupiah(totalNominal)}</span>
                  </div>
                )}

                <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '0.5rem' }}>
                  <div>
                    <label style={sLabel}>Nama paket</label>
                    <input
                      type="text" placeholder="Contoh: Paket Kelas 10 Semester Ganjil"
                      value={formNama} onChange={e => setFormNama(e.target.value)}
                      style={sInput}
                    />
                  </div>
                  <div>
                    <label style={sLabel}>Tentukan jatuh tempo</label>
                    <input
                      type="date"
                      value={formJatuhTempo} onChange={e => setFormJatuhTempo(e.target.value)}
                      style={sInput}
                    />
                  </div>
                </div>

                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6F788A', margin: '0 0 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
                  <span style={{ flexShrink: 0 }}>ⓘ</span>
                  Butuh nominal berbeda untuk siswa tertentu? Gunakan fitur <strong style={{ marginLeft: 3 }}>Beasiswa &amp; Override</strong>&nbsp;di halaman tagihan siswa.
                </p>

                <div style={{ height: 3, background: '#C1C6CF', margin: '0 0 1.25rem' }} />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button onClick={closeForm} style={{ ...sBtn, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Batalkan Pembuatan <span>✕</span>
                  </button>
                  <button onClick={handleSimpan} disabled={formSaving}
                    style={{ background: formSaving ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.7rem 1.5rem', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: formSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: formSaving ? 'none' : '0 5px 2px rgba(18,47,102,0.31)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {formSaving ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
                    {!formSaving && <Image src="/icons/IconArrowKanan.png" width={12} height={12} alt="Simpan" />}
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section A: Active Paket Cards ──────────────────────────────────── */}
      {filtered.length > 0 && (
        <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '0 0 0 1px rgba(26,44,78,0.08), 6px 6px 24px rgba(26,44,78,0.14)', marginBottom: '1rem' }}>

          {/* Search bar */}
          {activePakets.length > 1 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  placeholder="Cari paket" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ ...sInput, padding: '0.3rem 0.85rem 0.3rem 2.25rem', width: 280, border: '3px solid #C1C6CF', boxShadow: 'none', fontSize: '0.875rem' }}
                />
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Tidak ada paket yang sesuai pencarian.
            </div>
          ) : (
          <div style={{ maxHeight: filtered.length > 2 ? 580 : 'none', overflowY: filtered.length > 2 ? 'auto' : 'visible', paddingRight: filtered.length > 2 ? '0.35rem' : 0, paddingLeft: filtered.length > 2 ? 12 : 0, marginLeft: filtered.length > 2 ? -12 : 0, paddingBottom: filtered.length > 2 ? 4 : 0 }}>
          {filtered.map((p, i) => {
            const kelasText    = p.kelas_list.map(k => k.nama).join(', ')
            const siswaTotal   = p.kelas_list.reduce((s, k) => s + k.siswa_count, 0)
            const row1Komp     = p.komponen_list.slice(0, 3)
            const row2Komp     = p.komponen_list.slice(3, 5)
            const extraCount   = Math.max(0, p.komponen_list.length - 5)

            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 0 10px rgba(56, 96, 151, 0.52)', padding: '1.2rem 1.5rem', marginBottom: i < filtered.length - 1 ? '1.6rem' : 0, marginTop:10, }}>

                {/* Top: nama + badge | actions */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--navy-dark)' }}>{p.nama}</span>
                      <span style={{ background: '#69C183', color: '#ffffff', border: '2px solid #C1E6CC', fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 1rem', borderRadius: 99, flexShrink: 0 }}>Aktif</span>
                    </div>
                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                      Berlaku untuk kelas {kelasText} • {siswaTotal} siswa
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', flexShrink: 0 }}>
                    <button onClick={() => openEdit(p)}
                      style={{ background: '#EFF6FF', border: 'none', borderRadius: 8, padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#1D4ED8' }}
                      title="Edit paket">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setDeleteTarget(p)}
                      style={{ background: '#FEE2E2', border: 'none', borderRadius: 8, padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#DC2626' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Komponen badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.875rem' }}>
                  {/* Baris 1: maks 3 badge */}
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'nowrap' }}>
                    {row1Komp.map(kp => (
                      <div key={kp.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#D3DFF3', borderRadius: 99, padding: '0.25rem 0.7rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-dark)', flexShrink: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: kp.komponen?.kelas_warna ?? '#94A3B8', flexShrink: 0 }} />
                        {kp.komponen?.nama} — {formatRupiah(kp.nominal)}
                      </div>
                    ))}
                  </div>
                  {/* Baris 2: maks 2 badge + "+X lainnya" */}
                  {(row2Komp.length > 0 || extraCount > 0) && (
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'nowrap' }}>
                      {row2Komp.map(kp => (
                        <div key={kp.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#D3DFF3', borderRadius: 99, padding: '0.25rem 0.7rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-dark)', flexShrink: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: kp.komponen?.kelas_warna ?? '#94A3B8', flexShrink: 0 }} />
                          {kp.komponen?.nama} — {formatRupiah(kp.nominal)}
                        </div>
                      ))}
                      {extraCount > 0 && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 99, padding: '0.25rem 0.7rem', fontSize: '0.8rem', fontWeight: 600, color: '#64748B', flexShrink: 0 }}>
                          + {extraCount} lainnya
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Separator + footer */}
                <div style={{ height: 1, background: '#E2E8F0', margin: '0.875rem 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#64748B', fontWeight: 500 }}>
                    <Layers size={14} /> {p.komponen_list.length} komponen
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#64748B', fontWeight: 500 }}>
                    <Pencil size={14} /> Tidak ada override
                  </span>
                </div>
              </div>
            )
          })}
          </div>
          )}
        </div>
      )}

      {/* ── Empty state (belum ada paket sama sekali) ───────────────────────── */}
      {activePakets.length === 0 && (
        <div style={{ ...sCard, borderLeft: '30px solid #1A2C4E', borderRadius: 15, boxShadow: '0 0 0 1px rgba(26,44,78,0.08), 6px 6px 24px rgba(26,44,78,0.14)', marginBottom: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '7rem 0' }}>
            <Image src="/icons/IconNotBox.png" width={80} height={80} alt="Belum ada paket" style={{ margin: '0 auto 0.875rem', display: 'block' }} />
            <p style={{ fontWeight: 700, fontSize: '1.2rem', color: '#6F788A', margin: '0 0 0.35rem' }}>Belum ada paket komponen per kelas</p>
            <p style={{ fontSize: '1rem', color: '#6F788A', margin: 0 }}>Buat paket untuk menggabungkan komponen tagihan &amp; men-assign ke tiap tingkat kelas</p>
          </div>
        </div>
      )}

      {/* ── Section B: Warning card (satu card untuk semua kelas yang belum dipaketin) */}
      {!showForm && activePakets.length > 0 && warningKelas.length > 0 && (() => {
        // Kelas terlewat dari jenjang yang sudah ada paket → nama kelas spesifik
        // Jenjang yang belum ada paket sama sekali → label "Kelas X"
        const uncoveredJenjangLabels = [...new Set(uncoveredKelas.map(k => k.jenjang))].map(j => `Kelas ${j}`)
        const names    = [...missedKelas.map(k => k.nama), ...uncoveredJenjangLabels]
        const MAX_SHOW = 4
        const shown    = names.slice(0, MAX_SHOW)
        const rest     = names.length - MAX_SHOW
        const kelasText = rest > 0
          ? `${shown.join(', ')} dan ${rest} lainnya`
          : names.length === 1
            ? names[0]
            : `${names.slice(0, -1).join(', ')} dan ${names[names.length - 1]}`
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 15, padding: '1rem 1.5rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: '#DE6666', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={24} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-dark)', marginBottom: '0.15rem' }}>
                {kelasText} belum punya paket
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Siswa di kelas ini belum bisa ditagih
              </div>
            </div>
            <button onClick={openForm}
              style={{ background: '#F7DD7D', color: '#1A2C4E', border: 'none', padding: '0.6rem 1.25rem', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, boxShadow: '0 4px 2px rgba(18,47,102,0.2)' }}>
              Buat Paket
            </button>
          </div>
        )
      })()}

      {/* ── Section C: Riwayat paket ────────────────────────────────────────── */}
      {riwayatList.length > 0 && (
      <div style={{ ...sCard, borderRadius: 15, boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--navy-dark)', marginBottom: '0.875rem' }}>Riwayat paket</div>
        {riwayatList.map((r, i) => (
          <div key={r.tahun_ajaran}>
            {i > 0 && <div style={{ height: 1, background: '#E2E8F0' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 0', cursor: 'pointer' }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Archive size={20} color="#64748B" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy-dark)' }}>{r.tahun_ajaran}</span>
                  <span style={{ background: '#FEF08A', color: '#854D0E', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 99 }}>Diarsipkan</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {formatDate(r.tanggal_mulai)} – {formatDate(r.tanggal_selesai)} · {r.paket_count} paket
                </div>
              </div>
              <ChevronRight size={18} color="#94A3B8" />
            </div>
          </div>
        ))}
      </div>
      )}

      {/* ── Delete modal ─────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.18s ease' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, padding: '2rem 1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <Trash2 size={24} color="#DC2626" />
            </div>
            <h3 style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.5rem' }}>Hapus Paket?</h3>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              Paket <strong>{deleteTarget.nama}</strong> beserta semua relasi kelas dan komponen akan dihapus permanen.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
                style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: 'var(--navy-dark)' }}>
                Batal
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: deleteLoading ? 'not-allowed' : 'pointer' }}>
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      {editTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.18s ease' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, padding: '2rem 1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: 0 }}>Edit Paket</h3>
              <button onClick={() => setEditTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.25rem', display: 'flex' }}>
                <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>✕</span>
              </button>
            </div>

            {editError && <div className="login-error" style={{ marginBottom: '1rem' }}>{editError}</div>}

            {/* Nama + Jatuh Tempo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={sLabel}>Nama paket</label>
                <input
                  type="text" value={editNama} onChange={e => setEditNama(e.target.value)}
                  style={sInput}
                />
              </div>
              <div>
                <label style={sLabel}>Jatuh tempo</label>
                <input
                  type="date" value={editJatuhTempo} onChange={e => setEditJatuhTempo(e.target.value)}
                  style={sInput}
                />
              </div>
            </div>

            {/* Kelas yang dituju */}
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy-dark)', marginBottom: '0.6rem' }}>Kelas yang dituju</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {kelasList.map(k => {
                const isSelected  = editSelectedKelasIds.includes(k.id)
                const inOtherPaket = assignedKelasIds.has(k.id) && !editTarget.kelas_list.some(ek => ek.id === k.id)
                return (
                  <button
                    key={k.id}
                    disabled={inOtherPaket}
                    onClick={() => {
                      if (inOtherPaket) return
                      setEditSelectedKelasIds(prev =>
                        prev.includes(k.id) ? prev.filter(id => id !== k.id) : [...prev, k.id]
                      )
                    }}
                    style={{
                      padding: '0.4rem 0.85rem', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600,
                      border: isSelected ? '1.5px solid #1A2C4E' : '1.5px solid #E2E8F0',
                      background: isSelected ? '#1A2C4E' : inOtherPaket ? '#F8FAFC' : '#fff',
                      color: isSelected ? '#fff' : inOtherPaket ? '#CBD5E1' : '#64748B',
                      cursor: inOtherPaket ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >
                    {k.nama}
                    {inOtherPaket && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>· dipakai</span>}
                  </button>
                )
              })}
            </div>

            <div style={{ height: 1, background: '#E2E8F0', margin: '0 0 1.25rem' }} />

            {/* Komponen tagihan */}
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy-dark)', marginBottom: '0.6rem' }}>Komponen tagihan</div>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: '1.5rem' }}>
              {komponenList.map((km, i) => {
                const isChecked     = editSelectedKomponenIds.includes(km.id)
                const existingKp    = editTarget.komponen_list.find(kp => kp.komponen_id === km.id)
                const isEditingThis = editingKompId === (existingKp?.id ?? '')
                const inisial       = km.nama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
                return (
                  <div key={km.id}>
                    {i > 0 && <div style={{ height: 1, background: '#E2E8F0' }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: isChecked ? '#fff' : '#FAFAFA', transition: 'background 0.15s' }}>
                      {/* Checkbox */}
                      <button
                        onClick={() => {
                          setEditSelectedKomponenIds(prev =>
                            prev.includes(km.id) ? prev.filter(id => id !== km.id) : [...prev, km.id]
                          )
                          if (editingKompId === existingKp?.id) setEditingKompId(null)
                        }}
                        style={{ width: 20, height: 20, borderRadius: 5, border: isChecked ? '2px solid #1A2C4E' : '2px solid #CBD5E1', background: isChecked ? '#1A2C4E' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', padding: 0 }}
                      >
                        {isChecked && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </button>
                      {/* Avatar */}
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: km.kelas_warna ?? '#1A2C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: isChecked ? 1 : 0.4 }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.75rem' }}>{inisial}</span>
                      </div>
                      {/* Nama */}
                      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', color: isChecked ? 'var(--navy-dark)' : '#94A3B8' }}>{km.nama}</span>
                      {/* Nominal */}
                      {isChecked && (
                        existingKp ? (
                          isEditingThis ? (
                            <input
                              type="number"
                              value={editingKompVal}
                              onChange={e => setEditingKompVal(e.target.value)}
                              onBlur={() => commitEditNominal(existingKp.id)}
                              onKeyDown={e => { if (e.key === 'Enter') commitEditNominal(existingKp.id) }}
                              style={{ ...sInput, width: 150, padding: '0.4rem 0.75rem', fontSize: '0.875rem', boxShadow: 'none', borderRadius: 999 }}
                              autoFocus
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', background: '#F1F5F9', border: '1.5px solid #CBD5E1', borderRadius: 999, padding: '0.35rem 0.5rem 0.35rem 0.875rem', gap: '0.3rem', minWidth: 148 }}>
                              <span style={{ flex: 1, fontWeight: 600, fontSize: '0.82rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                                {formatRupiah(editNominalMap[existingKp.id] ?? existingKp.nominal)}
                              </span>
                              <button
                                onClick={() => { setEditingKompId(existingKp.id); setEditingKompVal(String(editNominalMap[existingKp.id] ?? existingKp.nominal)) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0.35rem', color: '#94A3B8', display: 'flex', alignItems: 'center' }}>
                                <Pencil size={12} />
                              </button>
                            </div>
                          )
                        ) : (
                          // Komponen baru — input nominal langsung
                          <input
                            type="number"
                            placeholder={String(km.nominal_default ?? 0)}
                            value={editNewNominalMap[km.id] ?? ''}
                            onChange={e => setEditNewNominalMap(prev => ({ ...prev, [km.id]: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 }))}
                            style={{ ...sInput, width: 150, padding: '0.4rem 0.75rem', fontSize: '0.82rem', boxShadow: 'none', borderRadius: 999 }}
                          />
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setEditTarget(null)} disabled={editSaving}
                style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: 'var(--navy-dark)' }}>
                Batal
              </button>
              <button onClick={handleEditSimpan} disabled={editSaving}
                style={{ flex: 2, padding: '0.7rem', borderRadius: 10, border: 'none', background: editSaving ? '#D1D5DB' : '#F7DD7D', color: '#1A2C4E', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: editSaving ? 'not-allowed' : 'pointer', boxShadow: editSaving ? 'none' : '0 4px 2px rgba(18,47,102,0.25)' }}>
                {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Popup kelas belum lengkap ─────────────────────────────────────────── */}
      {/* ── Popup bawa paket periode sebelumnya ──────────────────────────── */}
      {showCarryPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.2s ease' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 440, padding: '2rem 1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <Layers size={28} color="#D97706" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.6rem' }}>
              Paket per kelas periode {carryFrom} telah diarsipkan
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 1rem' }}>
              Tahun ajaran <strong style={{ color: 'var(--navy-dark)' }}>{activeTahunAjaran}</strong> belum punya paket,
              sehingga tagihan belum bisa dibuat. Tetap menggunakan paket per kelas periode sebelumnya?
            </p>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#475569', lineHeight: 1.6, textAlign: 'left', marginBottom: '1.25rem' }}>
              Paket dan komponen tagihan akan <strong>disalin</strong> ke {activeTahunAjaran} — data periode {carryFrom} tetap
              utuh di Riwayat. Jatuh tempo diisi <strong>{aktifSelesai ? formatDate(aktifSelesai) : 'akhir tahun ajaran'}</strong> dan
              bisa diubah kapan saja.
            </div>

            {carryError && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem', textAlign: 'left' }}>
                {carryError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => { setShowCarryPopup(false); openForm() }}
                disabled={carrying}
                style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontWeight: 700, fontSize: '0.875rem', cursor: carrying ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: carrying ? 0.5 : 1 }}
              >
                Tidak, buat baru
              </button>
              <button
                onClick={handleGunakanPaketLama}
                disabled={carrying}
                style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: 10, border: 'none', background: carrying ? '#94A3B8' : '#1A2C4E', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: carrying ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                {carrying ? 'Menyalin...' : 'Ya, gunakan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRekeningPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.2s ease' }}>
          <div style={{ position: 'relative', background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, padding: '2rem 1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)', textAlign: 'center' }}>
            <button
              onClick={() => setShowRekeningPopup(false)}
              style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
            >
              <X size={15} />
            </button>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <AlertTriangle size={28} color="#DC2626" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.6rem' }}>
              Rekening sekolah belum ditambahkan!
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              Tambahkan rekening resmi sekolah di halaman Pengaturan terlebih dahulu. Tanpa rekening tujuan, tagihan yang dibuat tidak bisa dibayar oleh orang tua.
            </p>
            <button
              onClick={() => { setShowRekeningPopup(false); router.push('/pengaturan') }}
              style={{ width: '100%', padding: '0.7rem', borderRadius: 10, border: 'none', background: '#1A2C4E', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Tambah Rekening Sekarang
            </button>
          </div>
        </div>
      )}

      {showAllPaketedPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.2s ease' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, padding: '2rem 1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <Layers size={28} color="#059669" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.6rem' }}>
              Semua Kelas Sudah Dipaketkan
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              Seluruh kelas yang ada sudah memiliki paket tagihan masing-masing. Tambah kelas baru jika ingin membuat paket tambahan.
            </p>
            <button
              onClick={() => setShowAllPaketedPopup(false)}
              style={{ width: '100%', padding: '0.7rem', borderRadius: 10, border: 'none', background: '#1A2C4E', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {showKelasKurangPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'modalBackdrop 0.2s ease' }}>
          <div style={{ position: 'relative', background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, padding: '2rem 1.75rem', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'modalCard 0.28s cubic-bezier(0.34,1.56,0.64,1)', textAlign: 'center' }}>
            <button
              onClick={() => setShowKelasKurangPopup(false)}
              style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
            >
              <X size={15} />
            </button>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <AlertTriangle size={28} color="#D97706" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', margin: '0 0 0.6rem' }}>
              Kelas Belum Lengkap
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 0.5rem', lineHeight: 1.6 }}>
              Semua jenjang kelas belum dibuat. Silahkan buat terlebih dahulu sebelum menambah paket.
            </p>
            <p style={{ fontSize: '0.82rem', color: '#D97706', fontWeight: 600, background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 8, padding: '0.5rem 0.75rem', margin: '0 0 1.5rem' }}>
              Jenjang yang belum punya kelas:{' '}
              <strong>
                {jenjangOptions.filter(j => !kelasList.some(k => k.jenjang === j)).map(j => `Kelas ${j}`).join(', ')}
              </strong>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setShowKelasKurangPopup(false)
                  setFormNama(''); setFormJatuhTempo(''); setFormError(''); setFormClosing(false)
                  setSelectedJenjang(''); setSelectedKelasIds([])
                  setCheckedKomponenIds([]); setNominalMap({})
                  setEditingNominalId(null)
                  setShowForm(true)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: 'var(--navy-dark)' }}
              >
                Tetap Buat
              </button>
              <button
                onClick={() => { setShowKelasKurangPopup(false); router.push('/siswa/manajemen-kelas') }}
                style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: 'none', background: '#1A2C4E', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Buat Kelas Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const sLabel: React.CSSProperties = { display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--text-mid)', marginBottom: 4 }
const sInput: React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '2.5px solid #BABFC7', boxShadow: '6px 6px 8px rgba(18,47,102,0.19)', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const sCard:  React.CSSProperties = { background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem' }
const sBtn:   React.CSSProperties = { background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--navy)', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }
