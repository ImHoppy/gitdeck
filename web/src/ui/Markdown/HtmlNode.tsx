import { createElement } from 'react'
import type { HtmlElement } from '../../lib/markdownTree'
import type { MarkdownContext } from './context'
import { resolveHref } from './links'
import { MdImage } from './MdImage'
import { renderAll } from './renderNode'

/** An allow-listed tag from raw HTML, its attributes already filtered by the worker. */
export function HtmlNode({ node, ctx }: { node: HtmlElement; ctx: MarkdownContext }) {
  const { tag, attrs } = node
  const children = renderAll(node.children, ctx)
  if (tag === 'img') {
    const size = (v?: string) => (v && /^\d+%?$/.test(v) ? v : undefined)
    return <MdImage url={attrs.src ?? ''} alt={attrs.alt ?? ''} width={size(attrs.width)} height={size(attrs.height)} />
  }
  if (tag === 'a') {
    const href = attrs.href ? resolveHref(attrs.href, ctx) : null
    if (!href) return <>{children}</>
    return <a href={href} title={attrs.title} target={href.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">{children}</a>
  }
  const props: Record<string, unknown> = {}
  if (attrs.align) props.style = { textAlign: attrs.align }
  if (tag === 'details' && 'open' in attrs) props.open = true
  if (tag === 'ol' && attrs.start) props.start = Number(attrs.start) || undefined
  if ((tag === 'td' || tag === 'th') && attrs.colspan) props.colSpan = Number(attrs.colspan) || undefined
  if ((tag === 'td' || tag === 'th') && attrs.rowspan) props.rowSpan = Number(attrs.rowspan) || undefined
  if (tag === 'abbr' && attrs.title) props.title = attrs.title
  const element = tag === 'center' || tag === 'tt' ? (tag === 'center' ? 'div' : 'code') : tag
  if (tag === 'center') props.style = { textAlign: 'center' }
  const voids = tag === 'br' || tag === 'hr'
  return voids ? createElement(element, props) : createElement(element, props, ...children)
}
