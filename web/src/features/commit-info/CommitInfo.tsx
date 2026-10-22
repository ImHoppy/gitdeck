import { Spinner } from '../../ui/Spinner/Spinner'
import { relativeTime } from '../../lib/relativeTime'
import type { GitRef } from '../../protocol/types'
import styles from './CommitInfo.module.css'
import { useCommitDetails } from './useCommitDetails'

type Props = { repoId: number; sha: string; refs: GitRef[]; onPick: (sha: string) => void }

export function CommitInfo({ repoId, sha, refs, onPick }: Props) {
  const { details: d, error } = useCommitDetails(repoId, sha)
  if (error) return <div className={styles.info}>{error}</div>
  if (!d) return <div className={styles.info}><Spinner /></div>
  const here = refs.filter((r) => r.sha === d.sha)
  const when = (t: number) => `${new Date(t * 1000).toLocaleString()} (${relativeTime(t)})`
  return (
    <div className={styles.info}>
      <dl className={styles.fields}>
        <dt>Author</dt>
        <dd>
          {d.author} &lt;{d.authorEmail}&gt;
        </dd>
        <dt>Date</dt>
        <dd>{when(d.authorTime)}</dd>
        {(d.committer !== d.author || d.commitTime !== d.authorTime) && (
          <>
            <dt>Committer</dt>
            <dd>
              {d.committer} &lt;{d.committerEmail}&gt;, {when(d.commitTime)}
            </dd>
          </>
        )}
        <dt>Commit</dt>
        <dd className={styles.mono}>{d.sha}</dd>
        <dt>Parents</dt>
        <dd className={styles.mono}>
          {d.parents.map((p) => (
            <a key={p} onClick={() => onPick(p)}>
              {p.slice(0, 10)}{' '}
            </a>
          ))}
        </dd>
        {here.length > 0 && (
          <>
            <dt>Refs</dt>
            <dd>{here.map((r) => r.name).join(', ')}</dd>
          </>
        )}
      </dl>
      <pre className={styles.message}>{d.message}</pre>
      {d.notes && (
        <>
          <div className={styles.notesTitle}>Notes</div>
          <pre className={styles.message}>{d.notes}</pre>
        </>
      )}
    </div>
  )
}
