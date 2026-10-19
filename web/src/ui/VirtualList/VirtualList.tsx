import { type ReactNode, useEffect, useRef, useState } from 'react'
import styles from './VirtualList.module.css'

type Props = {
  count: number
  rowHeight: number
  renderRow: (index: number) => ReactNode
  onRangeChange?: (start: number, end: number) => void
  scrollTo?: number | null
  overscan?: number
}

export function VirtualList({ count, rowHeight, renderRow, onRangeChange, scrollTo, overscan = 10 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el || scrollTo == null) return
    const top = scrollTo * rowHeight
    if (top < el.scrollTop || top + rowHeight > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.max(0, top - el.clientHeight / 2)
    }
  }, [scrollTo, rowHeight])

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const last = Math.min(count, Math.ceil((scrollTop + height) / rowHeight) + overscan)

  useEffect(() => {
    onRangeChange?.(first, last)
  }, [first, last, onRangeChange])

  const rows: ReactNode[] = []
  for (let i = first; i < last; i++) {
    rows.push(
      <div key={i} className={styles.row} style={{ top: i * rowHeight, height: rowHeight }}>
        {renderRow(i)}
      </div>,
    )
  }

  return (
    <div ref={box} className={styles.box} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <div className={styles.spacer} style={{ height: count * rowHeight }}>
        {rows}
      </div>
    </div>
  )
}
