import type { ReactNode } from 'react'
import type { MarkdownContext } from './context'
import { githubRef, resolveHref } from './links'

/** Only http(s), mailto and in-page links are followed; a GitHub PR link opens in the PR view. */
export function SafeLink({ href, children, ctx }: { href: string; children: ReactNode; ctx: MarkdownContext }) {
  const url = resolveHref(href, ctx)
  if (!url) return <>{children}</>
  const ref = githubRef(url)
  if (ref && ctx.onRef) {
    const open = ctx.onRef
    return (
      <a href={url} onClick={(e) => {
        e.preventDefault()
        open(ref.repo, ref.number)
      }}>
        {children}
      </a>
    )
  }
  if (url.startsWith('#')) return <a href={url}>{children}</a>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}
