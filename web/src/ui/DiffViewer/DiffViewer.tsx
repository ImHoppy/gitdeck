import { useMemo, useRef } from 'react'
import { parseDiff } from '../../lib/diffLines'
import { VirtualList } from '../VirtualList/VirtualList'
import styles from './DiffViewer.module.css'

const LINE_HEIGHT = 18

type Props = {
  patch: string
  selected?: ReadonlySet<number>
  onSelect?: (lines: Set<number>) => void
}

export function DiffViewer({ patch, selected, onSelect }: Props) {
  const lines = useMemo(() => parseDiff(patch), [patch])
  const anchor = useRef<number | null>(null)
  const dragging = useRef(false)

  const range = (a: number, b: number) => {
    const s = new Set<number>()
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) s.add(i)
    return s
  }

  const down = (i: number, e: React.MouseEvent) => {
    if (!onSelect || e.button !== 0) return
    e.preventDefault()
    if (e.shiftKey && anchor.current !== null) {
      onSelect(range(anchor.current, i))
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selected)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      anchor.current = i
      onSelect(next)
    } else {
      anchor.current = i
      dragging.current = true
      onSelect(new Set([i]))
      window.addEventListener('mouseup', () => (dragging.current = false), { once: true })
    }
  }

  const enter = (i: number) => {
    if (dragging.current && onSelect && anchor.current !== null) onSelect(range(anchor.current, i))
  }

  if (lines.length === 0) return <div className={styles.empty}>No changes</div>
  return (
    <div className={`${styles.viewer} ${onSelect ? styles.selectable : ''}`}>
      <VirtualList
        count={lines.length}
        rowHeight={LINE_HEIGHT}
        renderRow={(i) => {
          const l = lines[i]
          const cls = `${styles.line} ${styles[l.kind]} ${selected?.has(i) ? styles.picked : ''}`
          if (l.kind === 'meta' || l.kind === 'hunk') {
            return (
              <div className={cls} onMouseDown={(e) => down(i, e)} onMouseEnter={() => enter(i)}>
                {l.text}
              </div>
            )
          }
          return (
            <div className={cls} onMouseDown={(e) => down(i, e)} onMouseEnter={() => enter(i)}>
              <span className={styles.no}>{l.oldNo ?? ''}</span>
              <span className={styles.no}>{l.newNo ?? ''}</span>
              <span className={styles.sign}>{l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}</span>
              <span className={styles.text}>{l.text}</span>
            </div>
          )
        }}
      />
    </div>
  )
}
