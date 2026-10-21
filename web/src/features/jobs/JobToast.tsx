import type { JobUpdate } from '../../protocol/types'
import { Toast } from '../../ui/Toast/Toast'
import { describeOutcome } from '../sync'
import { firstError, progressOf, statusLine } from './jobLines'
import styles from './Jobs.module.css'

type Props = { job: JobUpdate; failed: boolean; onOpen: () => void; onDismiss: () => void }

export function JobToast({ job, failed, onOpen, onDismiss }: Props) {
  const percent = job.done ? null : progressOf(job)
  const tone = !job.done ? 'busy' : failed ? 'bad' : 'ok'
  const title = job.done ? `${job.title}: ${describeOutcome(job.done)}` : job.title
  const detail = failed ? (firstError(job) ?? statusLine(job)) : job.done ? null : statusLine(job)
  return (
    <Toast tone={tone} title={title} onDismiss={onDismiss}>
      <button className={styles.toastBody} title="Show the full output" onClick={onOpen}>
        {detail && <span className={`${styles.detail} ${failed ? styles.error : ''}`}>{detail}</span>}
        {percent !== null && (
          <span className={styles.bar}>
            <span style={{ width: `${percent}%` }} />
          </span>
        )}
        <span className={styles.link}>{failed ? 'Show log' : 'Show output'}</span>
      </button>
    </Toast>
  )
}
