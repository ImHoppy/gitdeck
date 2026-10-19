import { useMemo } from 'react'
import { parseDiff } from '../../lib/diffLines'
import { VirtualList } from '../VirtualList/VirtualList'
import styles from './DiffViewer.module.css'

const LINE_HEIGHT = 18

type Props = { patch: string }

export function DiffViewer({ patch }: Props) {
  const lines = useMemo(() => parseDiff(patch), [patch])
  if (lines.length === 0) return <div className={styles.empty}>No changes</div>
  return (
    <div className={styles.viewer}>
      <VirtualList
        count={lines.length}
        rowHeight={LINE_HEIGHT}
        renderRow={(i) => {
          const l = lines[i]
          if (l.kind === 'meta' || l.kind === 'hunk') {
            return <div className={`${styles.line} ${styles[l.kind]}`}>{l.text}</div>
          }
          return (
            <div className={`${styles.line} ${styles[l.kind]}`}>
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
