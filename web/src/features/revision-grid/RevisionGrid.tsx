import { useCallback, useMemo, useState } from 'react'
import type { HistoryInfo, HistoryRow, RepoSnapshot } from '../../protocol/types'
import { VirtualList } from '../../ui/VirtualList/VirtualList'
import { ArtificialRow } from './ArtificialRow'
import { CommitRow } from './CommitRow'
import { LANE_WIDTH } from './GraphCell'
import { pillsBySha } from './refPills'
import styles from './RevisionGrid.module.css'
import type { GridSelection } from './selection'

const ROW_HEIGHT = 22
const ARTIFICIAL = 2
const MIN_LANES = 2

type Props = {
  repo: RepoSnapshot
  info: HistoryInfo
  rows: ReadonlyMap<number, HistoryRow>
  ensure: (start: number, end: number) => void
  selection: GridSelection | null
  onSelect: (s: GridSelection) => void
}

export function RevisionGrid({ repo, info, rows, ensure, selection, onSelect }: Props) {
  const head = repo.state?.head
  const pills = useMemo(() => pillsBySha(info.refs, head?.kind === 'branch' ? head.name : null), [info.refs, head])
  const [range, setRange] = useState<[number, number]>([0, 0])
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
          onSelect={() => onSelect({ kind: 'worktree' })}
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
          onSelect={() => onSelect({ kind: 'index' })}
        />
      )
    }
    const row = rows.get(i - ARTIFICIAL)
    if (!row) return <div className={styles.loading} />
    return (
      <CommitRow
        row={row}
        pills={pills.get(row.sha) ?? []}
        isHead={row.sha === info.head}
        selected={selection?.kind === 'commit' && selection.sha === row.sha}
        graphWidth={graphWidth}
        height={ROW_HEIGHT}
        onSelect={() => onSelect({ kind: 'commit', sha: row.sha, parents: row.parents, subject: row.subject })}
      />
    )
  }

  return (
    <div className={styles.grid}>
      <VirtualList count={info.count + ARTIFICIAL} rowHeight={ROW_HEIGHT} renderRow={renderRow} onRangeChange={onRange} />
    </div>
  )
}
