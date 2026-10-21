import { useMarkdown } from '../../lib/useMarkdown'
import type { MarkdownLinks } from './links'
import { Markdown } from './Markdown'

/** Markdown from its source text; `cacheKey` names text that never changes (id + updatedAt). */
export function MarkdownText({ text, links, cacheKey, empty }: { text: string; links: MarkdownLinks; cacheKey?: string; empty?: string }) {
  const tree = useMarkdown(text, cacheKey)
  return <Markdown tree={tree} links={links} empty={empty} />
}
