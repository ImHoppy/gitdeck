import type { CheckSummary, PrSummary } from '../../protocol/github'
import styles from './PullRequests.module.css'

export function ChecksMark({ checks }: { checks: CheckSummary }) {
  const total = checks.passed + checks.failed + checks.pending
  if (total === 0) return null
  const title = `${checks.passed} passed, ${checks.failed} failed, ${checks.pending} pending`
  if (checks.failed) return <span className={styles.bad} title={title}>✗ {checks.passed}/{total}</span>
  if (checks.pending) return <span className={styles.pending} title={title}>● {checks.passed}/{total}</span>
  return <span className={styles.good} title={title}>✓ {total}/{total}</span>
}

export function ReviewMark({ pr }: { pr: Pick<PrSummary, 'isDraft' | 'reviewDecision' | 'state'> }) {
  if (pr.state === 'MERGED') return <span className={styles.merged}>merged</span>
  if (pr.state === 'CLOSED') return <span className={styles.bad}>closed</span>
  if (pr.isDraft) return <span className={styles.muted}>draft</span>
  if (pr.reviewDecision === 'APPROVED') return <span className={styles.good}>approved</span>
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return <span className={styles.bad}>changes requested</span>
  if (pr.reviewDecision === 'REVIEW_REQUIRED') return <span className={styles.muted}>review required</span>
  return null
}

/** The coloured state label of the PR header, as on GitHub. */
export function StatePill({ pr }: { pr: Pick<PrSummary, 'isDraft' | 'state'> }) {
  const [label, tone] =
    pr.state === 'MERGED' ? ['Merged', styles.pillMerged] : pr.state === 'CLOSED' ? ['Closed', styles.pillClosed] : pr.isDraft ? ['Draft', styles.pillDraft] : ['Open', styles.pillOpen]
  return <span className={`${styles.statePill} ${tone}`}>{label}</span>
}
