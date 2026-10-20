import { relativeTime } from '../../lib/relativeTime'
import { Avatar } from '../../ui/Avatar/Avatar'
import styles from './Stats.module.css'
import type { AuthorStats } from './useStats'

const fmt = new Intl.NumberFormat()

/** Contributors by commits; the bar is their share of the top contributor's count. */
export function AuthorsTable({ authors, total }: { authors: AuthorStats[]; total: number }) {
  const top = Math.max(1, authors[0]?.commits ?? 1)
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>Contributors ({authors.length})</figcaption>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Author</th>
            <th className={styles.num}>Commits</th>
            <th className={styles.share} aria-label="Share" />
            <th className={styles.num}>Added</th>
            <th className={styles.num}>Removed</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {authors.map((a) => (
            <tr key={a.email} title={`${a.name} <${a.email}>`}>
              <td>
                <span className={styles.author}>
                  <Avatar name={a.name} email={a.email} size={18} />
                  {a.name}
                </span>
              </td>
              <td className={styles.num}>{fmt.format(a.commits)}</td>
              <td className={styles.share}>
                <span className={styles.shareTrack} title={`${((a.commits / Math.max(1, total)) * 100).toFixed(1)}% of all commits`}>
                  <span className={styles.shareFill} style={{ width: `${(a.commits / top) * 100}%` }} />
                </span>
              </td>
              <td className={`${styles.num} ${styles.added}`}>+{fmt.format(a.added)}</td>
              <td className={`${styles.num} ${styles.removed}`}>−{fmt.format(a.removed)}</td>
              <td className={styles.muted}>
                {relativeTime(a.first)} → {relativeTime(a.last)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
