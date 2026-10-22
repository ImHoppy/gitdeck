import { useRef, useState } from 'react'
import { useMarkdownCtx } from './context'
import type { RefPreview } from './links'
import styles from './Markdown.module.css'

const HOVER_DELAY_MS = 400

/** `#12` or `owner/repo#12`: opens in the PR view, a card with its title and state on hover. */
export function RefLink({ repo, number, text }: { repo: string | null; number: number; text: string }) {
  const ctx = useMarkdownCtx()
  const [card, setCard] = useState<RefPreview | null | 'loading'>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // a card that arrives after the pointer left stays closed
  const hovering = useRef(false)
  const slug = repo ?? ctx.repo
  const href = slug ? `https://github.com/${slug}/issues/${number}` : undefined

  const enter = () => {
    if (!ctx.preview) return
    const preview = ctx.preview
    hovering.current = true
    timer.current = setTimeout(() => {
      setCard('loading')
      preview(repo, number).then(
        (c) => hovering.current && setCard(c),
        () => setCard(null),
      )
    }, HOVER_DELAY_MS)
  }
  const leave = () => {
    hovering.current = false
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setCard(null)
  }

  return (
    <span className={styles.refBox} onMouseEnter={enter} onMouseLeave={leave}>
      <a
        className={styles.ref}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!ctx.onRef) return
          e.preventDefault()
          ctx.onRef(repo, number)
        }}
      >
        {text}
      </a>
      {card && card !== 'loading' && (
        <span className={styles.card} role="tooltip">
          <span className={`${styles.cardState} ${styles[cardTone(card)]}`}>{cardLabel(card)}</span>
          <strong>{card.title}</strong>
          <span className={styles.cardMeta}>
            {slug}#{number} · {card.author}
          </span>
        </span>
      )}
    </span>
  )
}

function cardTone(c: RefPreview): string {
  if (c.merged) return 'merged'
  if (c.state === 'closed') return 'closed'
  return c.draft ? 'draft' : 'open'
}

function cardLabel(c: RefPreview): string {
  const kind = c.isPull ? 'PR' : 'Issue'
  if (c.merged) return `${kind} merged`
  if (c.state === 'closed') return `${kind} closed`
  return c.draft ? 'Draft PR' : `${kind} open`
}
