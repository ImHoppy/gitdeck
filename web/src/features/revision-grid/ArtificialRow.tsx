import type { GraphRow } from '../../protocol/types'
import { GraphCell } from './GraphCell'
import styles from './RevisionGrid.module.css'

type Props = {
  label: string
  badge: string
  title?: string
  top: boolean
  selected: boolean
  graphWidth: number
  height: number
  onSelect: () => void
}

const GRAPH: GraphRow = { lane: 0, color: 7, segments: [{ start: null, center: 0, end: 0, color: 7, fromNode: false, toNode: false }] }
const GRAPH_THROUGH: GraphRow = { ...GRAPH, segments: [{ start: 0, center: 0, end: null, color: 7, fromNode: true, toNode: false }, ...GRAPH.segments] }

export function ArtificialRow({ label, badge, title, top, selected, graphWidth, height, onSelect }: Props) {
  return (
    <div className={`${styles.row} ${styles.artificial} ${selected ? styles.selected : ''}`} onClick={onSelect} title={title}>
      <GraphCell row={top ? GRAPH : GRAPH_THROUGH} height={height} width={graphWidth} square={false} head={false} />
      <span className={styles.message}>
        <span className={styles.subject}>{label}</span>
        <span className={styles.badge}>{badge}</span>
      </span>
    </div>
  )
}
