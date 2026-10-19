import { relativeTime } from '../../lib/relativeTime'
import { Avatar } from '../../ui/Avatar/Avatar'
import type { HistoryRow } from '../../protocol/types'
import { GraphCell } from './GraphCell'
import { RefPill } from './RefPill'
import type { Pill } from './refPills'
import styles from './RevisionGrid.module.css'

type Props = {
  row: HistoryRow
  pills: Pill[]
  tracking?: string
  isHead: boolean
  selected: boolean
  dim?: boolean
  graphWidth: number
  height: number
  onSelect: () => void
  onContextMenu: (at: { x: number; y: number }) => void
}

export function CommitRow({ row, pills, tracking, isHead, selected, dim, graphWidth, height, onSelect, onContextMenu }: Props) {
  return (
    <div
      className={`${styles.row} ${selected ? styles.selected : ''} ${dim ? styles.dim : ''}`}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault()
        onSelect()
        onContextMenu({ x: e.clientX, y: e.clientY })
      }}
      title={row.multiline ? `${row.subject}\n\n${row.bodyHint}…` : row.subject}
    >
      <GraphCell row={row.graph} height={height} width={graphWidth} square={pills.length > 0} head={isHead} />
      <span className={styles.message}>
        {pills.map((p) => (
          <RefPill key={`${p.kind}:${p.name}`} pill={p} tracking={p.kind === 'branch' && p.head ? tracking : undefined} />
        ))}
        <span className={styles.subject}>{row.subject}</span>
        {row.bodyHint && <span className={styles.body}>{row.bodyHint}</span>}
        {row.multiline && <span className={styles.more}>⋯</span>}
      </span>
      <span className={styles.author}>
        <Avatar name={row.author} email={row.email} />
        <span className={styles.authorName}>{row.author}</span>
      </span>
      <span className={styles.date} title={new Date(row.time * 1000).toLocaleString()}>
        {relativeTime(row.time)}
      </span>
      <span className={styles.sha}>{row.sha.slice(0, 7)}</span>
    </div>
  )
}
