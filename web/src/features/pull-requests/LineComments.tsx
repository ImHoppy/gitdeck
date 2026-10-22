import { useState } from 'react'
import { isMac } from '../../lib/platform'
import type { DraftThread, ReviewThread } from '../../protocol/github'
import { Icon } from '../../ui/Icon/Icon'
import { IconButton } from '../../ui/IconButton/IconButton'
import type { MarkdownLinks } from '../../ui/Markdown/links'
import { MarkdownText } from '../../ui/Markdown/MarkdownText'
import { MarkdownEditor } from '../../ui/MarkdownEditor/MarkdownEditor'
import styles from './Conversation.module.css'
import type { LinePick } from './FilesTab'
import { ThreadCard } from './ThreadCard'
import type { ConversationActions } from './TimelineEntry'
import type { PendingReview } from './usePendingReview'

type Props = {
  line: LinePick
  threads: ReviewThread[]
  review: PendingReview
  links: MarkdownLinks
  actions: ConversationActions & { commentNow: (t: DraftThread) => Promise<boolean> }
  onClose: () => void
}

/** The threads on one diff line, and a new comment for it: into the pending review, or sent now. */
export function LineComments({ line, threads, review, links, actions, onClose }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const pending = review.pending.map((p, i) => [p, i] as const).filter(([p]) => p.path === line.path && p.side === line.side && p.line === line.line)
  const draft: DraftThread = { path: line.path, side: line.side, line: line.line, body: text }
  const now = async () => {
    setSending(true)
    if (await actions.commentNow(draft)) setText('')
    setSending(false)
  }
  const close = (
    <IconButton title="Close" onClick={onClose}>
      <Icon name="close" size={11} />
    </IconButton>
  )
  return (
    <div className={styles.lineBox}>
      <div className={styles.lineHead}>
        {isMac && close}
        <strong>{line.path}:{line.line}</strong>
        <span className={styles.muted}>{line.side === 'LEFT' ? 'old side' : 'new side'}</span>
        <span className={styles.spacer} />
        {!isMac && close}
      </div>
      {threads.map((t) => (
        <ThreadCard
          key={t.id}
          thread={t}
          links={links}
          inDiff
          onReply={(body) => actions.reply(t.id, body)}
          onResolve={(r) => actions.resolve(t.id, r)}
          onEdit={actions.editComment}
          onDelete={actions.deleteComment}
        />
      ))}
      {pending.map(([p, i]) => (
        <div key={i} className={styles.pendingComment}>
          <span className={styles.tag}>pending</span>
          <MarkdownText text={p.body} links={links} />
          <IconButton title="Drop this pending comment" onClick={() => review.remove(i)}>Remove</IconButton>
        </div>
      ))}
      <MarkdownEditor
        value={text}
        onChange={setText}
        onSubmit={() => {
          if (!text.trim()) return
          review.add(draft)
          setText('')
        }}
        rows={3}
        placeholder="Comment on this line… Ctrl+Enter adds it to your review"
        attachHint="Pictures go in a PR comment (gh can't attach to inline comments)"
        preview={(t) => <MarkdownText text={t} links={links} />}
        actions={
          <>
            <IconButton title="Send this one comment now" disabled={!text.trim() || sending} onClick={() => void now()}>Comment now</IconButton>
            <IconButton
              title="Keep it with the review, sent from the Conversation tab (Ctrl+Enter)"
              disabled={!text.trim()}
              onClick={() => {
                review.add(draft)
                setText('')
              }}
            >
              Add to review
            </IconButton>
          </>
        }
      />
    </div>
  )
}
