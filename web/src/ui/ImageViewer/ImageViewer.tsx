import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './ImageViewer.module.css'

/** A picture at full size over the page; a click or Esc closes it. */
export function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-label={alt || 'Image'}>
      <img className={styles.image} src={src} alt={alt} />
      {alt && <div className={styles.caption}>{alt}</div>}
    </div>,
    document.body,
  )
}
