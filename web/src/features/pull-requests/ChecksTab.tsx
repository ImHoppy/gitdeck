import type { PrCheck } from '../../protocol/github'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Spinner } from '../../ui/Spinner/Spinner'
import styles from './Conversation.module.css'

const ORDER: PrCheck['bucket'][] = ['fail', 'pending', 'cancel', 'pass', 'skipping']

const MARK: Record<PrCheck['bucket'], [string, string]> = {
  fail: ['✗', 'bad'],
  pending: ['●', 'pending'],
  cancel: ['⊘', 'muted'],
  pass: ['✓', 'good'],
  skipping: ['–', 'muted'],
}

function duration(c: PrCheck): string {
  if (!c.startedAt || !c.completedAt) return ''
  const s = Math.round((Date.parse(c.completedAt) - Date.parse(c.startedAt)) / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}

export function ChecksTab({ checks, error, onReload }: { checks: PrCheck[] | null; error: string | null; onReload: () => void }) {
  if (error) return <div className={styles.empty}>{error}</div>
  if (!checks) return <div className={styles.empty}><Spinner /></div>
  const sorted = [...checks].sort((a, b) => ORDER.indexOf(a.bucket) - ORDER.indexOf(b.bucket) || a.name.localeCompare(b.name))
  return (
    <div className={styles.checks}>
      <div className={styles.checksHead}>
        <span>{checks.length ? `${checks.filter((c) => c.bucket === 'pass').length} of ${checks.length} passed` : 'No checks on this PR'}</span>
        <IconButton title="Ask again" onClick={onReload}>Refresh</IconButton>
      </div>
      {sorted.map((c) => {
        const [mark, tone] = MARK[c.bucket] ?? ['?', 'muted']
        return (
          <div key={`${c.workflow}/${c.name}`} className={styles.check}>
            <span className={styles[tone]}>{mark}</span>
            <span className={styles.checkName}>
              {c.workflow && <span className={styles.muted}>{c.workflow} / </span>}
              {c.name}
            </span>
            <span className={styles.muted}>{c.description}</span>
            <span className={styles.time}>{duration(c)}</span>
            {c.link && (
              <a href={c.link} target="_blank" rel="noopener noreferrer">
                Details ↗
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
