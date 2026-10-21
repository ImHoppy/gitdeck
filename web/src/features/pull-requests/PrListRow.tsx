import { relativeTime } from '../../lib/relativeTime'
import type { PrRow } from './filter'
import { ChecksMark, ReviewMark } from './PrBadges'
import styles from './PullRequests.module.css'

type Props = { pr: PrRow; unread: boolean; selected: boolean; checkedOut: boolean; showRepo: boolean; onClick: () => void }

export function PrListRow({ pr, unread, selected, checkedOut, showRepo, onClick }: Props) {
  return (
    <div className={`${styles.row} ${selected ? styles.selected : ''} ${unread ? styles.unread : ''}`} onClick={onClick} title={pr.title}>
      <div className={styles.rowTitle}>
        <span className={styles.dot}>{unread ? '●' : ''}</span>
        <span className={styles.number}>#{pr.number}</span>
        <span className={styles.titleText}>{pr.title}</span>
        {checkedOut && <span className={styles.checkedOut} title="Checked out here">▶</span>}
      </div>
      <div className={styles.rowMeta}>
        {showRepo && <span className={styles.repoTag}>{pr.repo.split('/')[1]}</span>}
        <span>{pr.author}</span>
        <span className={styles.branch}>{pr.headRefName}</span>
        <ChecksMark checks={pr.checks} />
        <ReviewMark pr={pr} />
        <span className={styles.age}>{relativeTime(Date.parse(pr.updatedAt) / 1000)}</span>
      </div>
    </div>
  )
}
