import { useCallback, useMemo, useState } from 'react'
import type { HistoryInfo, HistoryRow, RepoSnapshot } from '../../protocol/types'
import { VirtualList } from '../../ui/VirtualList/VirtualList'
import { ArtificialRow } from './ArtificialRow'
import { CommitRow } from './CommitRow'
import { LANE_WIDTH } from './GraphCell'
import { pillsBySha } from './refPills'
import styles from './RevisionGrid.module.css'
import { type Marks, NO_MARKS, nextMarks } from './multiSelect'
import type { GridSelection } from './selection'

const ROW_HEIGHT = 22
const ARTIFICIAL = 2
const MIN_LANES = 1

type Props = {
  repo: RepoSnapshot
  info: HistoryInfo
  rows: ReadonlyMap<number, HistoryRow>
  ensure: (start: number, end: number) => void
  selection: GridSelection | null
  onSelect: (s: GridSelection) => void
  onCommitMenu: (row: HistoryRow, at: { x: number; y: number }) => void
  /** Double click or Enter: the commit in a window of its own. */
  onOpenCommit?: (row: HistoryRow) => void
  /** Enter on several picked commits (Ctrl/Shift click), newest first. */
  onOpenCommits?: (rows: HistoryRow[]) => void
  scrollTo: number | null
  onScrollTo: (index: number) => void
  highlighted: ReadonlySet<number> | null
}

export function RevisionGrid({ repo, info, rows, ensure, selection, onSelect, onCommitMenu, onOpenCommit, onOpenCommits, scrollTo, onScrollTo, highlighted }: Props) {
  const head = repo.state?.head
  const pills = useMemo(() => pillsBySha(info.refs, head?.kind === 'branch' ? head.name : null), [info.refs, head])
  const [range, setRange] = useState<[number, number]>([0, 0])
  // picked commit indices, tied to the history they were picked in
  const [picked, setPicked] = useState<{ key: string; marks: Marks }>({ key: info.key, marks: NO_MARKS })
  const marks = picked.key === info.key ? picked.marks : NO_MARKS
  const multi = marks.set.size > 1
  // sized from the visible rows only, so one wide stretch of history doesn't widen the whole grid
  const lanes = useMemo(() => {
    let max = MIN_LANES
    for (let i = range[0]; i < range[1]; i++) {
      const r = rows.get(i)
      if (!r) continue
      max = Math.max(max, r.graph.lane + 1, ...r.graph.segments.map((s) => Math.max(s.from ?? 0, s.to ?? 0) + 1))
    }
    return Math.min(max, 40)
  }, [rows, range])
  const graphWidth = lanes * LANE_WIDTH

  const onRange = useCallback(
    (start: number, end: number) => {
      const r: [number, number] = [Math.max(0, start - ARTIFICIAL), end - ARTIFICIAL]
      setRange(r)
      ensure(...r)
    },
    [ensure],
  )

  const t = repo.state?.tracking
  const trackingText = t && (t.ahead || t.behind) ? `${t.ahead ?? 0}↑${t.behind ?? 0}↓` : undefined
  const status = repo.state?.status
  const unstaged = (status?.unstaged ?? 0) + (status?.untracked ?? 0)
  const staged = status?.staged ?? 0

  const renderRow = (i: number) => {
    if (i === 0) {
      return (
        <ArtificialRow
          label="Working directory"
          badge={unstaged > 0 ? `✎ ${unstaged}` : ''}
          top
          selected={selection?.kind === 'worktree'}
          graphWidth={graphWidth}
          height={ROW_HEIGHT}
          onSelect={() => {
            setPicked({ key: info.key, marks: NO_MARKS })
            onSelect({ kind: 'worktree' })
          }}
        />
      )
    }
    if (i === 1) {
      return (
        <ArtificialRow
          label="Commit index"
          badge={staged > 0 ? `✓ ${staged}` : '✓'}
          top={false}
          selected={selection?.kind === 'index'}
          graphWidth={graphWidth}
          height={ROW_HEIGHT}
          onSelect={() => {
            setPicked({ key: info.key, marks: NO_MARKS })
            onSelect({ kind: 'index' })
          }}
        />
      )
    }
    const row = rows.get(i - ARTIFICIAL)
    if (!row) return <div className={styles.loading} />
    return (
      <CommitRow
        row={row}
        pills={pills.get(row.sha) ?? []}
        tracking={trackingText}
        dim={highlighted !== null && !highlighted.has(i - ARTIFICIAL)}
        isHead={row.sha === info.head}
        selected={multi ? marks.set.has(i - ARTIFICIAL) : selection?.kind === 'commit' && selection.sha === row.sha}
        graphWidth={graphWidth}
        height={ROW_HEIGHT}
        onSelect={(mods) => {
          setPicked({ key: info.key, marks: nextMarks(marks, i - ARTIFICIAL, mods ?? { ctrl: false, shift: false }) })
          onSelect({ kind: 'commit', sha: row.sha, parents: row.parents, subject: row.subject })
        }}
        onContextMenu={(at) => onCommitMenu(row, at)}
        onOpen={onOpenCommit && (() => onOpenCommit(row))}
      />
    )
  }

  const selectedRow = (): number | null => {
    if (selection?.kind === 'worktree') return 0
    if (selection?.kind === 'index') return 1
    if (selection?.kind !== 'commit') return null
    for (const [i, r] of rows) if (r.sha === selection.sha) return i + ARTIFICIAL
    return null
  }

  const selectAt = (i: number) => {
    if (i === 0) onSelect({ kind: 'worktree' })
    else if (i === 1) onSelect({ kind: 'index' })
    else {
      const row = rows.get(i - ARTIFICIAL)
      if (!row) return
      onSelect({ kind: 'commit', sha: row.sha, parents: row.parents, subject: row.subject })
    }
    onScrollTo(i - ARTIFICIAL)
  }

  const openPicked = () => {
    if (multi) {
      const picks = [...marks.set].sort((a, b) => a - b).map((i) => rows.get(i))
      if (picks.every((r) => r !== undefined)) onOpenCommits?.(picks)
    } else if (selection?.kind === 'commit') {
      const i = selectedRow()
      const row = i === null ? undefined : rows.get(i - ARTIFICIAL)
      if (row) onOpenCommit?.(row)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      openPicked()
      return
    }
    const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 20, PageUp: -20 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    const last = info.count + ARTIFICIAL - 1
    const target = Math.min(last, Math.max(0, (selectedRow() ?? -1) + step))
    // shift extends the pick over commits, arrows alone start over
    if (target >= ARTIFICIAL) {
      const base = marks.anchor === null && selection?.kind === 'commit' ? { set: marks.set, anchor: (selectedRow() ?? target) - ARTIFICIAL } : marks
      setPicked({ key: info.key, marks: nextMarks(base, target - ARTIFICIAL, { ctrl: false, shift: e.shiftKey }) })
    } else {
      setPicked({ key: info.key, marks: NO_MARKS })
    }
    selectAt(target)
  }

  return (
    <div className={styles.grid} tabIndex={0} onKeyDown={onKeyDown}>
      <VirtualList
        count={info.count + ARTIFICIAL}
        rowHeight={ROW_HEIGHT}
        renderRow={renderRow}
        onRangeChange={onRange}
        scrollTo={scrollTo === null ? null : scrollTo + ARTIFICIAL}
      />
    </div>
  )
}
