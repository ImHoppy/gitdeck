import { useMemo, useState } from 'react'
import { parseDiff } from '../../lib/diffLines'
import type { ReviewThread } from '../../protocol/github'
import { IconButton } from '../../ui/IconButton/IconButton'
import type { MarkdownLinks } from '../../ui/Markdown/links'
import { MarkdownText } from '../../ui/Markdown/MarkdownText'
import { MarkdownEditor } from '../../ui/MarkdownEditor/MarkdownEditor'
import { CommentCard } from './CommentCard'
import styles from './Conversation.module.css'

/** The last lines of the hunk a thread hangs on, like GitHub's snippet above the comments. */
const SNIPPET_LINES = 4

type Props = {
  thread: ReviewThread
  links: MarkdownLinks
  /** Hides the code snippet (the Files tab shows the diff around it already). */
  inDiff?: boolean
  onReply: (body: string) => Promise<boolean>
  onResolve: (resolve: boolean) => void
  onEdit: (id: string, body: string) => Promise<boolean>
  onDelete: (id: string) => void
  onOpenFile?: () => void
}

export function ThreadCard({ thread: t, links, inDiff, onReply, onResolve, onEdit, onDelete, onOpenFile }: Props) {
  const [open, setOpen] = useState(!t.resolved)
  const [reply, setReply] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const snippet = useMemo(() => parseDiff(t.diffHunk).filter((l) => l.kind !== 'meta' && l.kind !== 'hunk').slice(-SNIPPET_LINES), [t.diffHunk])
  const line = t.line ?? t.originalLine
  const send = async () => {
    if (!reply?.trim()) return
    setSending(true)
    if (await onReply(reply)) setReply(null)
    setSending(false)
  }
  return (
    <div className={`${styles.thread} ${t.resolved ? styles.resolved : ''}`}>
      <div className={styles.threadHead}>
        <button className={styles.threadToggle} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button>
        <button className={styles.threadPath} onClick={onOpenFile} title="Show in the Files tab">
          {t.path}
          {line !== null ? `:${line}` : ''}
        </button>
        {t.outdated && <span className={styles.tag}>outdated</span>}
        {t.resolved && <span className={styles.tag}>resolved</span>}
        <span className={styles.spacer} />
        {!t.resolved && t.canResolve && <IconButton title="Mark the conversation resolved" onClick={() => onResolve(true)}>Resolve</IconButton>}
        {t.resolved && t.canUnresolve && <IconButton title="Open the conversation again" onClick={() => onResolve(false)}>Unresolve</IconButton>}
      </div>
      {open && (
        <>
          {!inDiff && snippet.length > 0 && (
            <pre className={styles.snippet}>
              {snippet.map((l, i) => (
                <div key={i} className={l.kind === 'add' ? styles.add : l.kind === 'del' ? styles.del : undefined}>
                  {l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}
                  {l.text}
                </div>
              ))}
            </pre>
          )}
          {t.comments.map((c) => (
            <CommentCard key={c.id} comment={c} links={links} compact onEdit={(body) => onEdit(c.id, body)} onDelete={() => onDelete(c.id)} />
          ))}
          {t.canReply &&
            (reply === null ? (
              <button className={styles.replyOpen} onClick={() => setReply('')}>Reply…</button>
            ) : (
              <MarkdownEditor
                value={reply}
                onChange={setReply}
                onSubmit={() => void send()}
                autoFocus
                rows={3}
                attachHint="Pictures go in a PR comment (gh can't attach to a thread reply)"
                preview={(text) => <MarkdownText text={text} links={links} />}
                actions={
                  <>
                    <IconButton title="Cancel" onClick={() => setReply(null)}>Cancel</IconButton>
                    <IconButton title="Reply (Ctrl+Enter)" disabled={sending || !reply.trim()} onClick={() => void send()}>Reply</IconButton>
                  </>
                }
              />
            ))}
        </>
      )}
    </div>
  )
}
