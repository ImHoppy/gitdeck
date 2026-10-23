import { type ReactNode, useMemo, useRef } from 'react'
import { type Mark, occurrences } from '../../lib/decorate'
import { parseDiff } from '../../lib/diffLines'
import { inlineMarks } from '../../lib/inlineDiff'
import { longPress } from '../../lib/longPress'
import { useHighlight } from '../../lib/useHighlight'
import { Icon } from '../Icon/Icon'
import { VirtualList } from '../VirtualList/VirtualList'
import { DiffFind } from './DiffFind'
import { LineText } from './LineText'
import styles from './DiffViewer.module.css'
import { useDiffFind } from './useDiffFind'
import { useWordPick } from './useWordPick'

const LINE_HEIGHT = 18

type Props = {
  patch: string
  path?: string
  selected?: ReadonlySet<number>
  onSelect?: (lines: Set<number>) => void
  onContextMenu?: (line: number, at: { x: number; y: number }) => void
  /** A narrow column before the line numbers (review threads, "add a comment"). */
  gutter?: (line: number) => ReactNode
  /** Dim what a changed line shares with the line it became, so the change stands out. */
  wordDiff?: boolean
}

export function DiffViewer({ patch, path, selected, onSelect, onContextMenu, gutter, wordDiff }: Props) {
  const lines = useMemo(() => parseDiff(patch), [patch])
  const texts = useMemo(() => lines.map((l) => (l.kind === 'meta' || l.kind === 'hunk' ? '' : l.text)), [lines])
  const html = useHighlight(path, texts)
  const all = useMemo(() => lines.map((l) => l.text), [lines])
  const find = useDiffFind(all)
  const inline = useMemo(() => (wordDiff ? inlineMarks(lines) : null), [lines, wordDiff])
  const pick = useWordPick(all)
  const widest = useMemo(() => all.reduce((w, t) => Math.max(w, t.replace(/	/g, '        ').length), 0), [all])
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

  const open = (i: number, at: { x: number; y: number }) => {
    if (!onContextMenu) return
    if (!selected?.has(i)) {
      anchor.current = i
      onSelect?.(new Set([i]))
    }
    onContextMenu(i, at)
  }

  const context = (i: number, e: React.MouseEvent) => {
    if (!onContextMenu) return
    e.preventDefault()
    open(i, { x: e.clientX, y: e.clientY })
  }

  const handlers = (i: number) => ({
    onMouseDown: (e: React.MouseEvent) => {
      pick.onMouseDown(i, e)
      down(i, e)
    },
    onDoubleClick: (e: React.MouseEvent) => pick.onDoubleClick(i, e),
    onMouseEnter: () => enter(i),
    onContextMenu: (e: React.MouseEvent) => context(i, e),
    ...(onContextMenu ? longPress((at) => open(i, at)) : {}),
  })

  const marks = (i: number): Mark[] => {
    const l = lines[i]
    const out: Mark[] = []
    const m = inline?.(i)
    if (m) {
      for (const [start, end] of m.same) out.push({ start, end, cls: styles.same })
      const anchor = l.kind === 'del' ? styles.anchorAdd : styles.anchorDel
      for (const at of m.anchors) out.push({ start: at, end: at, cls: anchor })
    }
    if (pick.word && pick.line !== i) for (const [start, end] of occurrences(l.text, pick.word)) out.push({ start, end, cls: styles.occurrence })
    return out
  }

  if (lines.length === 0) return <div className={styles.empty}>No changes</div>
  return (
    <div
      className={`${styles.viewer} ${onSelect ? styles.selectable : ''} ${wordDiff ? styles.words : ''}`}
      style={{ '--widest': `${widest}ch` } as React.CSSProperties}
      tabIndex={-1}
      // line clicks prevent the default (no text selection), which would also keep focus away
      onMouseDownCapture={(e) => e.currentTarget.focus({ preventScroll: true })}
      onMouseUp={pick.onMouseUp}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && pick.word) {
          pick.clear()
        } else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
          // the diff's own search, not the history search of the page around it
          e.preventDefault()
          e.stopPropagation()
          find.show()
        } else if (e.ctrlKey && e.key.toLowerCase() === 'a' && !(e.target instanceof HTMLInputElement)) {
          // every changed line of this diff, not the whole page's text
          e.preventDefault()
          e.stopPropagation()
          onSelect?.(new Set(lines.flatMap((l, i) => (l.kind === 'add' || l.kind === 'del' ? [i] : []))))
        }
      }}
    >
      {find.open ? (
        <DiffFind
          query={find.query}
          count={find.matches.length}
          current={find.current}
          onSearch={find.search}
          onNext={find.next}
          onPrev={find.prev}
          onClose={find.hide}
        />
      ) : (
        <button className={styles.findOpen} title="Find in diff (Ctrl+F)" onClick={find.show}>
          <Icon name="search" size={12} />
        </button>
      )}
      <VirtualList
        count={lines.length}
        rowHeight={LINE_HEIGHT}
        scrollTo={find.line}
        renderRow={(i) => {
          const l = lines[i]
          const hit = find.matchSet.has(i) ? (i === find.line ? styles.current : styles.match) : ''
          const cls = `${styles.line} ${styles[l.kind]} ${selected?.has(i) ? styles.picked : ''} ${hit}`
          if (l.kind === 'meta' || l.kind === 'hunk') {
            return (
              <div className={cls} {...handlers(i)}>
                {gutter && <span className={styles.gutter} />}
                {l.text}
              </div>
            )
          }
          return (
            <div className={cls} {...handlers(i)}>
              {gutter && <span className={styles.gutter}>{gutter(i)}</span>}
              <span className={styles.no}>{l.oldNo ?? ''}</span>
              <span className={styles.no}>{l.newNo ?? ''}</span>
              <span className={styles.sign}>{l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}</span>
              <LineText html={html?.[i]} text={l.text} marks={marks(i)} />
            </div>
          )
        }}
      />
    </div>
  )
}
