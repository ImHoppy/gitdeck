import { relativeTime } from '../../lib/relativeTime'
import type { PrDetail } from '../../protocol/github'
import { VirtualList } from '../../ui/VirtualList/VirtualList'
import { Who } from './Who'
import styles from './Conversation.module.css'

const ROW = 30

/** The PR's commits; a click shows the commit in the history (it's there once the PR head is fetched). */
export function CommitsTab({ detail, onOpen }: { detail: PrDetail; onOpen: ((sha: string) => void) | null }) {
  const commits = detail.commits
  return (
    <div className={styles.listTab}>
      <VirtualList
        count={commits.length}
        rowHeight={ROW}
        renderRow={(i) => {
          const c = commits[i]
          return (
            <div className={`${styles.commitRow} ${onOpen ? styles.clickable : ''}`} onClick={() => onOpen?.(c.oid)} title={onOpen ? 'Show in the history' : c.oid}>
              <Who login={c.author || '?'} size={16} />
              <span className={styles.commitText}>{c.headline}</span>
              <span className={styles.muted}>{c.author}</span>
              <span className={styles.time}>{relativeTime(Date.parse(c.authoredDate) / 1000)}</span>
              <code className={styles.code}>{c.oid.slice(0, 7)}</code>
            </div>
          )
        }}
      />
    </div>
  )
}
