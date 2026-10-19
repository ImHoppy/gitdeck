import { useState } from 'react'
import { type GridSelection, RevisionGrid, useHistory } from '../features/revision-grid'
import type { RepoSnapshot } from '../protocol/types'
import styles from './App.module.css'

export function RepoView({ repo }: { repo: RepoSnapshot }) {
  const history = useHistory(repo.id)
  const [selection, setSelection] = useState<GridSelection | null>(null)

  if (history.error) return <div className={styles.message}>{history.error}</div>
  if (!history.info) return <div className={styles.message}>Loading history…</div>
  return (
    <div className={styles.repoView}>
      <div className={styles.gridPane}>
        <RevisionGrid
          repo={repo}
          info={history.info}
          rows={history.rows}
          ensure={history.ensure}
          selection={selection}
          onSelect={setSelection}
        />
      </div>
    </div>
  )
}
