import { useState } from 'react'
import type { CommandRecord } from '../../protocol/types'
import { VirtualList } from '../../ui/VirtualList/VirtualList'
import styles from './OutputPanel.module.css'

const ROW = 18

export function OutputPanel({ records, cwd }: { records: CommandRecord[]; cwd: string | null }) {
  const [onlyThisRepo, setOnlyThisRepo] = useState(true)
  const shown = onlyThisRepo && cwd ? records.filter((r) => r.cwd === cwd) : records
  return (
    <div className={styles.panel}>
      <label className={styles.bar}>
        <input type="checkbox" checked={onlyThisRepo} onChange={(e) => setOnlyThisRepo(e.target.checked)} /> only this
        repo ({shown.length})
      </label>
      <div className={styles.list}>
        <VirtualList
          count={shown.length}
          rowHeight={ROW}
          scrollTo={shown.length - 1}
          renderRow={(i) => {
            const r = shown[i]
            return (
              <div className={`${styles.row} ${r.code !== 0 ? styles.failed : ''}`} title={r.cwd}>
                <span className={styles.time}>{new Date(r.at * 1000).toLocaleTimeString()}</span>
                <span className={styles.ms}>{r.millis} ms</span>
                <span className={styles.code}>{r.code}</span>
                <span>git {r.args.join(' ')}</span>
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}
