import { useState } from 'react'
import type { ReviewEvent } from '../../protocol/github'
import { DropButton } from '../../ui/DropButton/DropButton'
import { IconButton } from '../../ui/IconButton/IconButton'
import type { MarkdownLinks } from '../../ui/Markdown/links'
import { MarkdownText } from '../../ui/Markdown/MarkdownText'
import { MarkdownEditor } from '../../ui/MarkdownEditor/MarkdownEditor'
import { Menu, type MenuItem } from '../../ui/Menu/Menu'

type Props = {
  value: string
  onChange: (text: string) => void
  links: MarkdownLinks
  onAttach: (files: File[]) => Promise<string[]>
  /** Inline comments waiting in the review, sent with it. */
  pending: number
  busy: boolean
  canReview: boolean
  onComment: () => void
  onReview: (event: ReviewEvent) => void
}

/** Uses pictures from the draft folder: those only go up with a PR comment (`gh --attach`). */
const usesDraftPictures = (text: string) => /\]\(\.\//.test(text)

export function ReplyBox({ value, onChange, links, onAttach, pending, busy, canReview, onComment, onReview }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const pictures = usesDraftPictures(value)
  const reviewItems: MenuItem[] = [
    { key: 'approve', label: 'Approve', icon: 'checkout', disabled: pictures, onSelect: () => onReview('APPROVE') },
    { key: 'changes', label: 'Request changes', icon: 'alert', disabled: pictures || (!value.trim() && pending === 0), onSelect: () => onReview('REQUEST_CHANGES') },
    { key: 'comment', label: pending ? `Send ${pending} inline comment${pending === 1 ? '' : 's'} as a review` : 'Comment as a review', icon: 'comment', disabled: pictures || (!value.trim() && pending === 0), onSelect: () => onReview('COMMENT') },
  ]
  return (
    <>
      <MarkdownEditor
        value={value}
        onChange={onChange}
        onSubmit={() => value.trim() && !busy && onComment()}
        onAttach={onAttach}
        rows={3}
        preview={(text) => <MarkdownText text={text} links={links} />}
        actions={
          <>
            {pictures && <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>pictures go up with a comment, not a review</span>}
            {canReview && <DropButton icon="comment" label={pending ? `Review (${pending})` : 'Review'} title="Approve, request changes, or send the inline comments" onOpen={setMenu} />}
            <IconButton title="Comment (Ctrl+Enter)" disabled={busy || !value.trim()} onClick={onComment}>
              Comment
            </IconButton>
          </>
        }
      />
      {menu && <Menu items={reviewItems} at={menu} onClose={() => setMenu(null)} />}
    </>
  )
}
