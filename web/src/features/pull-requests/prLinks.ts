import { gitd } from '../../protocol/client'
import type { RefCard } from '../../protocol/github'
import type { MarkdownLinks, RefPreview } from '../../ui/Markdown/links'
import { draftUrl } from './useDraft'

export const imageProxy = (url: string) => `/api/gh/image?url=${encodeURIComponent(url)}`

const cards = new Map<string, Promise<RefCard | null>>()

/** Hover cards, asked once per reference while the page is open (gitd caches them too). */
export function refCard(repo: string, number: number): Promise<RefPreview | null> {
  const key = `${repo.toLowerCase()}#${number}`
  let card = cards.get(key)
  if (!card) {
    card = gitd.call<RefCard>('pr.card', { repo, number }).catch(() => null)
    cards.set(key, card)
  }
  return card
}

export type RefHandlers = {
  onRef: (repo: string, number: number) => void
  onCommit: (repo: string, sha: string) => void
}

/**
 * How a PR's text links out: references open in the PR view, pictures through gitd. A picture
 * hosted outside GitHub goes through GitHub's camo copy, the only one gitd may fetch.
 */
export function prLinks(repo: string, head: string | undefined, handlers: RefHandlers, draft?: string, images?: Record<string, string>): MarkdownLinks {
  return {
    repo,
    head,
    image: (url) => (url.startsWith('./') ? (draft ? draftUrl(draft, url.slice(2)) : null) : imageProxy(images?.[url] ?? url)),
    onRef: (r, n) => handlers.onRef(r ?? repo, n),
    onCommit: (r, sha) => handlers.onCommit(r ?? repo, sha),
    preview: (r, n) => refCard(r ?? repo, n),
  }
}
