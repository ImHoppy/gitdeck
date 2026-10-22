import { useState } from 'react'
import type { MergeMethod, PrDetail, RepoInfo } from '../../protocol/github'
import { Dialog } from '../../ui/Dialog/Dialog'
import { Button } from '../../ui/Button/Button'
import { Select } from '../../ui/Select/Select'
import { defaultSquash, mergeBlocked, type SquashMessage } from './mergeBlocked'
import dialog from '../../ui/Dialog/Dialog.module.css'
import styles from './PullRequests.module.css'

type Props = {
  detail: PrDetail
  info: RepoInfo | null
  /** The branch checked out here for the PR, deleted too when asked. */
  localBranch: string | null
  onMerge: (method: MergeMethod, deleteBranch: boolean, message: SquashMessage | null) => void
  onCancel: () => void
}

export function MergeDialog({ detail, info, localBranch, onMerge, onCancel }: Props) {
  const methods: [MergeMethod, string][] = []
  if (!info || info.rebaseMergeAllowed) methods.push(['rebase', 'Rebase and merge'])
  if (!info || info.squashMergeAllowed) methods.push(['squash', 'Squash and merge'])
  const [method, setMethod] = useState<MergeMethod>(methods[0]?.[0] ?? 'rebase')
  const [deleteBranch, setDeleteBranch] = useState(false)
  const [message, setMessage] = useState(() => defaultSquash(detail))
  const blocked = mergeBlocked(detail)
  const unstable = detail.mergeStateStatus === 'UNSTABLE'
  return (
    <Dialog
      title={`Merge #${detail.number}?`}
      actions={
        <>
          <Button title="Cancel" onClick={onCancel}>Cancel</Button>
          <Button primary title={blocked ?? 'Merge on GitHub'} disabled={!!blocked || methods.length === 0 || (method === 'squash' && !message.subject.trim())} onClick={() => onMerge(method, deleteBranch, method === 'squash' ? message : null)}>
            {methods.find(([m]) => m === method)?.[1] ?? 'Merge'}
          </Button>
        </>
      }
    >
      <div className={dialog.fields}>
        <div>
          {detail.headRefName} → {detail.baseRefName}, {detail.commits.length} commit{detail.commits.length === 1 ? '' : 's'}
        </div>
        {methods.length === 0 ? (
          <div className={styles.warn}>This repo allows only merge commits; gitdeck keeps history linear, so merge it on GitHub.</div>
        ) : (
          <label className={dialog.field}>
            Method
            <Select field value={method} options={methods} onChange={setMethod} />
          </label>
        )}
        {method === 'squash' && (
          <>
            <label className={dialog.field}>
              Commit message
              <input value={message.subject} onChange={(e) => setMessage({ ...message, subject: e.target.value })} />
            </label>
            <label className={dialog.field}>
              Extended description
              <textarea rows={6} value={message.body} placeholder="Add an optional extended description…" onChange={(e) => setMessage({ ...message, body: e.target.value })} />
            </label>
          </>
        )}
        {!detail.isCrossRepository && (
          <label className={styles.check}>
            <input type="checkbox" checked={deleteBranch} onChange={(e) => setDeleteBranch(e.target.checked)} />
            Delete {detail.headRefName} on GitHub{localBranch ? ` and ${localBranch} here` : ''} afterwards
          </label>
        )}
        {blocked && <div className={styles.warn}>Can't merge: {blocked}</div>}
        {!blocked && unstable && <div className={styles.warn}>Some checks fail, but none is required.</div>}
      </div>
    </Dialog>
  )
}
