import { useEffect } from 'react'
import type { JobUpdate } from '../../protocol/types'
import { Icon } from '../../ui/Icon/Icon'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Spinner } from '../../ui/Spinner/Spinner'
import { VirtualList } from '../../ui/VirtualList/VirtualList'
import { describeOutcome } from '../sync'
import { isErrorLine } from './jobLines'
import styles from './Jobs.module.css'

const ROW = 18

type Props = { job: JobUpdate; failed: boolean; onClose: () => void }

export function JobConsole({ job, failed, onClose }: Props) {
  const rows = job.current ? [...job.lines, job.current] : job.lines

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.console} role="dialog" aria-label={job.title}>
        <div className={styles.head}>
          {job.done ? null : <Spinner />}
          <strong className={styles.headTitle}>{job.title}</strong>
          {job.done && <span className={failed ? styles.error : styles.muted}>{describeOutcome(job.done)}</span>}
          <span className={styles.headTools}>
            <IconButton title="Copy the output" onClick={() => void navigator.clipboard.writeText(rows.join('\n'))}>
              <Icon name="copy" size={12} />
            </IconButton>
            <IconButton title="Close (Esc)" onClick={onClose}>
              <Icon name="close" size={12} />
            </IconButton>
          </span>
        </div>
        <div className={styles.lines}>
          <VirtualList
            count={rows.length}
            rowHeight={ROW}
            scrollTo={rows.length - 1}
            renderRow={(i) => <div className={`${styles.line} ${isErrorLine(rows[i]) ? styles.error : ''}`}>{rows[i]}</div>}
          />
        </div>
      </div>
    </div>
  )
}
