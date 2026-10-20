import styles from './Resizer.module.css'

type Props = {
  axis: 'x' | 'y'
  /** Called with the pointer movement since the last call; negative for left/up. */
  onDrag: (delta: number) => void
  onDone?: () => void
}

export function Resizer({ axis, onDrag, onDone }: Props) {
  return (
    <div
      className={`${styles.handle} ${axis === 'x' ? styles.x : styles.y}`}
      onPointerDown={(e) => {
        e.preventDefault()
        let last = axis === 'x' ? e.clientX : e.clientY
        const handle = e.currentTarget
        handle.classList.add(styles.dragging)
        document.body.style.userSelect = 'none'
        document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
        const move = (m: PointerEvent) => {
          const now = axis === 'x' ? m.clientX : m.clientY
          onDrag(now - last)
          last = now
        }
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          document.body.style.userSelect = ''
          document.body.style.cursor = ''
          handle.classList.remove(styles.dragging)
          onDone?.()
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
    />
  )
}
