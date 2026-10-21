import { IconButton } from '../../ui/IconButton/IconButton'
import { MarkdownText } from '../../ui/Markdown/MarkdownText'
import { MarkdownEditor } from '../../ui/MarkdownEditor/MarkdownEditor'
import { prLinks, type RefHandlers } from './prLinks'
import styles from './PullRequests.module.css'
import { useCreatePr } from './useCreatePr'
import { useDraft } from './useDraft'

type Props = {
  repoId: number
  repo: string
  head: string
  headIsCurrent: boolean
  handlers: RefHandlers
  onCreated: (number: number) => void
  onCancel: () => void
}

/** Base, title and body prefilled; Create pushes the branch first, then opens the PR. */
export function CreatePrForm({ repoId, repo, head, headIsCurrent, handlers, onCreated, onCancel }: Props) {
  const { form, setForm, error, busy, create } = useCreatePr(repoId, repo, head, headIsCurrent)
  const draft = useDraft()
  const links = prLinks(repo, head, handlers, draft.id)
  const submit = async () => {
    const n = await create(draft.id)
    if (n) {
      draft.reset()
      onCreated(n)
    }
  }
  return (
    <div className={styles.create}>
      <h2>New pull request</h2>
      <div className={styles.form}>
        <div className={styles.row2}>
          <label className={styles.field}>
            Merge
            <input value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })} />
          </label>
          <label className={styles.field}>
            into
            <input value={form.base} placeholder="default branch" onChange={(e) => setForm({ ...form, base: e.target.value })} />
          </label>
        </div>
        <label className={styles.field}>
          Title
          <input value={form.title} autoFocus onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <MarkdownEditor
          value={form.body}
          onChange={(body) => setForm({ ...form, body })}
          onSubmit={() => void submit()}
          onAttach={draft.upload}
          rows={12}
          placeholder="What and why. Markdown, pictures by paste or drop."
          preview={(t) => <MarkdownText text={t} links={links} />}
        />
        <label className={styles.check}>
          <input type="checkbox" checked={form.draft} onChange={(e) => setForm({ ...form, draft: e.target.checked })} />
          Create as a draft
        </label>
        {error && <div className={styles.warn}>{error}</div>}
        <div className={styles.formActions}>
          <IconButton
            title="Leave without creating"
            onClick={() => {
              draft.discard()
              onCancel()
            }}
          >
            Cancel
          </IconButton>
          <IconButton title={`Push ${form.head} to ${repo}, then open the PR`} disabled={busy || !form.title.trim() || !form.base.trim() || !form.head.trim()} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create pull request'}
          </IconButton>
        </div>
      </div>
    </div>
  )
}
