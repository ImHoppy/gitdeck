import { type ReactNode, useState } from 'react'
import { relativeTime } from '../../lib/relativeTime'
import type { Comment } from '../../protocol/github'
import { IconButton } from '../../ui/IconButton/IconButton'
import type { MarkdownLinks } from '../../ui/Markdown/links'
import { MarkdownText } from '../../ui/Markdown/MarkdownText'
import { MarkdownEditor } from '../../ui/MarkdownEditor/MarkdownEditor'
import styles from './Conversation.module.css'
import { Who } from './Who'

const REACTIONS: Record<string, string> = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  LAUGH: '😄',
  HOORAY: '🎉',
  CONFUSED: '😕',
  HEART: '❤️',
  ROCKET: '🚀',
  EYES: '👀',
}

type Props = {
  comment: Comment
  links: MarkdownLinks
  /** The review state, the "commented" verb… shown after the author. */
  badge?: ReactNode
  /** Text when the body is empty (a review with only inline comments). */
  empty?: string
  /** Names this exact text for the parsed-markdown cache; the comment's id and updatedAt by default. */
  cacheKey?: string
  onEdit?: (body: string) => Promise<boolean>
  onDelete?: () => void
  compact?: boolean
}

export function CommentCard({ comment: c, links, badge, empty, cacheKey, onEdit, onDelete, compact }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const edited = c.updatedAt !== c.createdAt && c.updatedAt > c.createdAt
  const save = async () => {
    if (editing === null || !onEdit) return
    setSaving(true)
    if (await onEdit(editing)) setEditing(null)
    setSaving(false)
  }
  return (
    <div className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <div className={styles.cardHead}>
        <Who login={c.author} size={compact ? 16 : 20} />
        <strong>{c.author}</strong>
        {badge}
        <span className={styles.time} title={new Date(c.createdAt).toLocaleString()}>
          {relativeTime(Date.parse(c.createdAt) / 1000)}
          {edited ? ' · edited' : ''}
        </span>
        <span className={styles.spacer} />
        {c.canEdit && onEdit && editing === null && (
          <IconButton title="Edit" onClick={() => setEditing(c.body)}>Edit</IconButton>
        )}
        {c.canDelete && onDelete && editing === null && (
          <IconButton title="Delete this comment" onClick={onDelete}>Delete</IconButton>
        )}
      </div>
      {editing === null ? (
        <div className={styles.body}>
          <MarkdownText text={c.body} links={links} cacheKey={cacheKey ?? `${c.id}@${c.updatedAt}`} empty={empty ?? 'No description.'} />
        </div>
      ) : (
        <MarkdownEditor
          value={editing}
          onChange={setEditing}
          onSubmit={() => void save()}
          autoFocus
          attachHint="Pictures can't be added when editing"
          preview={(text) => <MarkdownText text={text} links={links} />}
          actions={
            <>
              <IconButton title="Keep the comment as it was" onClick={() => setEditing(null)}>Cancel</IconButton>
              <IconButton title="Save (Ctrl+Enter)" disabled={saving} onClick={() => void save()}>Save</IconButton>
            </>
          }
        />
      )}
      {c.reactions.length > 0 && (
        <div className={styles.reactions}>
          {c.reactions.map((r) => (
            <span key={r.content} className={styles.reaction}>{REACTIONS[r.content] ?? r.content} {r.count}</span>
          ))}
        </div>
      )}
    </div>
  )
}
