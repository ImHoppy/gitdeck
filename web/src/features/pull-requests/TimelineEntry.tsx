import { relativeTime } from '../../lib/relativeTime'
import type { Comment, PrDetail, ReviewState, Timeline } from '../../protocol/github'
import type { MarkdownLinks } from '../../ui/Markdown/links'
import { CommentCard } from './CommentCard'
import { Who } from './Who'
import styles from './Conversation.module.css'
import { ThreadCard } from './ThreadCard'
import type { Entry } from './timelineEntries'

export type ConversationActions = {
  editDescription: (body: string) => Promise<boolean>
  editComment: (id: string, body: string) => Promise<boolean>
  deleteComment: (id: string) => void
  reply: (threadId: string, body: string) => Promise<boolean>
  resolve: (threadId: string, resolve: boolean) => void
  openFile: (path: string) => void
  openCommit: (sha: string) => void
}

const REVIEW_VERB: Record<ReviewState, [string, string]> = {
  APPROVED: ['approved these changes', 'good'],
  CHANGES_REQUESTED: ['requested changes', 'bad'],
  COMMENTED: ['reviewed', 'muted'],
  DISMISSED: ['review dismissed', 'muted'],
  PENDING: ['pending review', 'muted'],
}

const EVENT_TEXT = { merged: 'merged', closed: 'closed this', reopened: 'reopened this', ready: 'marked this ready for review', draft: 'converted this to a draft' }

const ago = (at: string) => relativeTime(Date.parse(at) / 1000)

function Line({ who, children, at }: { who: string; children: React.ReactNode; at: string }) {
  return (
    <div className={styles.event}>
      <Who login={who} size={16} />
      <strong>{who}</strong>
      <span>{children}</span>
      <span className={styles.time}>{ago(at)}</span>
    </div>
  )
}

type Props = { entry: Entry; detail: PrDetail; timeline: Timeline | null; links: MarkdownLinks; actions: ConversationActions; threadCount: Map<string, number> }

export function TimelineEntry({ entry, detail, timeline, links, actions, threadCount }: Props) {
  const sha = (oid: string) => (
    <button className={styles.sha} onClick={() => actions.openCommit(oid)} title="Show in the history">{oid.slice(0, 7)}</button>
  )
  if (entry.kind === 'description') {
    const description: Comment = {
      id: detail.id,
      author: detail.author,
      body: detail.body,
      createdAt: detail.createdAt,
      // the PR's updatedAt moves with every comment: it says nothing about the description
      updatedAt: detail.createdAt,
      canEdit: !!timeline?.viewerCanUpdate,
      canDelete: false,
      reactions: [],
    }
    return <CommentCard comment={description} cacheKey={`${detail.id}@${detail.updatedAt}`} links={links} badge={<span className={styles.muted}>opened this pull request</span>} onEdit={actions.editDescription} />
  }
  if (entry.kind === 'thread') {
    const t = entry.thread
    return (
      <div className={styles.indent}>
        <ThreadCard
          thread={t}
          links={links}
          onReply={(body) => actions.reply(t.id, body)}
          onResolve={(r) => actions.resolve(t.id, r)}
          onEdit={actions.editComment}
          onDelete={actions.deleteComment}
          onOpenFile={() => actions.openFile(t.path)}
        />
      </div>
    )
  }
  const item = entry.item
  switch (item.kind) {
    case 'comment':
      return <CommentCard comment={item} links={links} badge={<span className={styles.muted}>commented</span>} onEdit={(b) => actions.editComment(item.id, b)} onDelete={() => actions.deleteComment(item.id)} />
    case 'review': {
      const [verb, tone] = REVIEW_VERB[item.state] ?? ['reviewed', 'muted']
      if (!item.body.trim()) {
        const n = threadCount.get(item.id) ?? 0
        return <Line who={item.author} at={item.createdAt}><span className={styles[tone]}>{verb}</span>{n ? ` · ${n} comment${n === 1 ? '' : 's'}` : ''}</Line>
      }
      return <CommentCard comment={item} links={links} badge={<span className={styles[tone]}>{verb}</span>} onEdit={(b) => actions.editComment(item.id, b)} />
    }
    case 'commit':
      return <Line who={item.author || '?'} at={item.at}>added {sha(item.oid)} {item.headline}</Line>
    case 'forcePushed':
      return (
        <Line who={item.actor} at={item.at}>
          force-pushed {item.before ? sha(item.before) : '?'} → {item.after ? sha(item.after) : '?'}
        </Line>
      )
    case 'event':
      return (
        <Line who={item.actor} at={item.at}>
          <span className={item.event === 'merged' ? styles.merged : undefined}>{EVENT_TEXT[item.event]}</span>
          {item.commit ? <> commit {sha(item.commit)}</> : null}
        </Line>
      )
  }
}
