'use client'

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const tanpaLangganan = () => () => {}

/**
 * Popup seragam dasbor admin: ikon + judul + tombol tutup, isi, lalu tombol di kaki.
 * Esc dan klik di luar menutup popup, kecuali selama `sibuk` (sedang menyimpan).
 * Dirender ke <body> lewat portal, jadi tidak ikut terpotong bar judul yang sticky.
 */
export default function ModalAdmin({
  judul, ikon, nada = 'utama', lebar = 440, sibuk = false, onTutup, kaki, children,
}: {
  judul:    string
  ikon?:    ReactNode
  nada?:    'utama' | 'sukses' | 'bahaya'
  lebar?:   number
  sibuk?:   boolean
  onTutup:  () => void
  kaki?:    ReactNode
  children: ReactNode
}) {
  const idJudul = useId()
  const kotak = useRef<HTMLDivElement>(null)
  // Portal hanya bisa di browser; HTML dari server belum memuat popup
  const diBrowser = useSyncExternalStore(tanpaLangganan, () => true, () => false)

  // onTutup lewat ref, supaya pendengar Esc tidak dipasang ulang di setiap render
  const tutupRef = useRef(onTutup)
  const sibukRef = useRef(sibuk)
  useEffect(() => {
    tutupRef.current = onTutup
    sibukRef.current = sibuk
  })

  useEffect(() => {
    if (!diBrowser) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sibukRef.current) tutupRef.current() }
    document.addEventListener('keydown', esc)
    const overflowLama = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Fokus ke popup, kecuali isinya sudah memfokuskan isian sendiri (autoFocus)
    if (kotak.current && !kotak.current.contains(document.activeElement)) kotak.current.focus()
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = overflowLama
    }
  }, [diBrowser])

  if (!diBrowser) return null

  return createPortal(
    <div
      className="admin-modal-tirai"
      onMouseDown={e => { if (e.target === e.currentTarget && !sibuk) onTutup() }}
    >
      <div
        ref={kotak}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        tabIndex={-1}
        className={`admin-modal admin-modal--${nada}`}
        style={{ maxWidth: lebar }}
      >
        <div className="admin-modal-kepala">
          {ikon && <span className="admin-modal-ikon">{ikon}</span>}
          <h2 id={idJudul}>{judul}</h2>
          <button type="button" className="admin-modal-tutup" onClick={onTutup} disabled={sibuk} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="admin-modal-isi">{children}</div>
        {kaki && <div className="admin-modal-kaki">{kaki}</div>}
      </div>
    </div>,
    document.body,
  )
}
