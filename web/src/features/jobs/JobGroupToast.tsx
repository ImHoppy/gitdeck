import type { JobUpdate } from '../../protocol/types'
import { Toast } from '../../ui/Toast/Toast'
import { progressOf, statusLine } from './jobLines'
import styles from './Jobs.module.css'

type Props = { jobs: JobUpdate[]; onOpen: (id: number) => void; onDismiss: () => void }

export function JobGroupToast({ jobs, onOpen, onDismiss }: Props) {
  return (
    <Toast tone="busy" title={`${jobs.length} jobs running`} onDismiss={onDismiss}>
      {jobs.map((j) => {
        const percent = progressOf(j)
        return (
          <button key={j.id} className={styles.groupRow} title={statusLine(j)} onClick={() => onOpen(j.id)}>
            <span className={styles.groupName}>{j.title}</span>
            <span className={styles.groupStatus}>{percent !== null ? `${percent}%` : ''}</span>
          </button>
        )
      })}
    </Toast>
  )
}
