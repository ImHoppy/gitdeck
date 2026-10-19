import { relativeTime } from '../../lib/relativeTime'
import type { HistoryRow } from '../../protocol/types'
import { GraphCell } from './GraphCell'
import { RefPill } from './RefPill'
import type { Pill } from './refPills'
import styles from './RevisionGrid.module.css'

type Props = {
  row: HistoryRow
  pills: Pill[]
  isHead: boolean
  selected: boolean
  graphWidth: number
  height: number
  onSelect: () => void
}

export function CommitRow({ row, pills, isHead, selected, graphWidth, height, onSelect }: Props) {
  return (
    <div
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      onClick={onSelect}
      title={row.multiline ? `${row.subject}\n\n${row.bodyHint}…` : row.subject}
    >
      <GraphCell row={row.graph} height={height} width={graphWidth} square={pills.length > 0} head={isHead} />
      <span className={styles.message}>
        {pills.map((p) => (
          <RefPill key={`${p.kind}:${p.name}`} pill={p} />
        ))}
        <span className={styles.subject}>{row.subject}</span>
        {row.bodyHint && <span className={styles.body}>{row.bodyHint}</span>}
      </span>
      <span className={styles.author}>{row.author}</span>
      <span className={styles.date} title={new Date(row.time * 1000).toLocaleString()}>
        {relativeTime(row.time)}
      </span>
      <span className={styles.sha}>{row.sha.slice(0, 7)}</span>
    </div>
  )
}
