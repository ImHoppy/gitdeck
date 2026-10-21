import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './VirtualList.module.css'

type Props = {
  count: number
  /** Stable per item, so measured heights follow items when the list changes. */
  itemKey: (index: number) => string
  /** Height guessed for an item not measured yet. */
  estimate: number
  renderItem: (index: number) => ReactNode
  /** Extra pixels rendered above and below the view. */
  overscan?: number
  /** Scroll to the end when the count grows while already at the end (a conversation). */
  stickToEnd?: boolean
}

/** Like `VirtualList`, for rows of different heights (comments): each row is measured once shown. */
export function MeasuredList({ count, itemKey, estimate, renderItem, overscan = 800, stickToEnd }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map())
  const [view, setView] = useState({ top: 0, height: 0 })
  const observer = useRef<ResizeObserver | null>(null)
  const atEnd = useRef(true)

  // made on the first row's mount: rows mount before effects run
  const observe = () => {
    observer.current ??= new ResizeObserver((entries) => {
      setHeights((known) => {
        let next: Map<string, number> | null = null
        for (const e of entries) {
          const key = (e.target as HTMLElement).dataset.key
          const h = Math.ceil(e.borderBoxSize[0]?.blockSize ?? e.contentRect.height)
          if (key && known.get(key) !== h) {
            next ??= new Map(known)
            next.set(key, h)
          }
        }
        return next ?? known
      })
    })
    return observer.current
  }
  useEffect(
    () => () => {
      observer.current?.disconnect()
      observer.current = null
    },
    [],
  )

  useEffect(() => {
    const el = box.current
    if (!el) return
    const r = new ResizeObserver(() => setView({ top: el.scrollTop, height: el.clientHeight }))
    r.observe(el)
    return () => r.disconnect()
  }, [])

  const offsets: number[] = new Array(count + 1)
  offsets[0] = 0
  for (let i = 0; i < count; i++) offsets[i + 1] = offsets[i] + (heights.get(itemKey(i)) ?? estimate)
  const total = offsets[count]

  useLayoutEffect(() => {
    const el = box.current
    if (stickToEnd && el && atEnd.current) el.scrollTop = el.scrollHeight
  })

  const measure = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const o = observe()
    o.observe(el)
    return () => o.unobserve(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  let first = 0
  while (first < count && offsets[first + 1] < view.top - overscan) first++
  let last = first
  while (last < count && offsets[last] < view.top + view.height + overscan) last++

  const rows: ReactNode[] = []
  for (let i = first; i < last; i++) {
    const key = itemKey(i)
    rows.push(
      <div key={key} data-key={key} ref={measure} className={styles.measured} style={{ top: offsets[i] }}>
        {renderItem(i)}
      </div>,
    )
  }

  return (
    <div
      ref={box}
      className={styles.box}
      onScroll={(e) => {
        const el = e.currentTarget
        atEnd.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 4
        setView({ top: el.scrollTop, height: el.clientHeight })
      }}
    >
      <div className={styles.spacer} style={{ height: total }}>
        {rows}
      </div>
    </div>
  )
}
