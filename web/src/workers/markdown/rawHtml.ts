import type { HtmlElement, MdNode, MdParent } from '../../lib/markdownTree'
import { hasChildren } from '../../lib/markdownTree'

/** Tags kept from raw HTML, with the attributes each may carry; anything else shows as text. */
const ALLOWED: Record<string, readonly string[]> = {
  a: ['href', 'title', 'name'],
  img: ['src', 'alt', 'title', 'width', 'height', 'align'],
  details: ['open'],
  summary: [],
  br: [],
  hr: [],
  p: ['align'],
  div: ['align'],
  span: [],
  center: [],
  sub: [],
  sup: [],
  b: [],
  strong: [],
  i: [],
  em: [],
  u: [],
  s: [],
  strike: [],
  del: [],
  ins: [],
  mark: [],
  small: [],
  tt: [],
  code: [],
  kbd: [],
  samp: [],
  var: [],
  pre: [],
  blockquote: [],
  q: [],
  cite: [],
  abbr: ['title'],
  dl: [],
  dt: [],
  dd: [],
  ul: [],
  ol: ['start'],
  li: [],
  table: ['align'],
  caption: [],
  thead: [],
  tbody: [],
  tfoot: [],
  tr: [],
  th: ['align', 'colspan', 'rowspan'],
  td: ['align', 'colspan', 'rowspan'],
  h1: ['align'],
  h2: ['align'],
  h3: ['align'],
  h4: ['align'],
  h5: ['align'],
  h6: ['align'],
  // dark/light variants of a picture: only the plain `<img>` inside is shown
  picture: [],
}

const VOID = new Set(['br', 'hr', 'img', 'source', 'wbr', 'input', 'meta', 'link'])

type Token =
  | { kind: 'text'; text: string }
  | { kind: 'open'; tag: string; attrs: Record<string, string>; selfClosing: boolean; raw: string }
  | { kind: 'close'; tag: string; raw: string }

const TAG = /<!--[\s\S]*?(?:-->|$)|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? all
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all
  })
}

export function tokenize(html: string): Token[] {
  const out: Token[] = []
  let at = 0
  for (const m of html.matchAll(TAG)) {
    if (m.index > at) out.push({ kind: 'text', text: decodeEntities(html.slice(at, m.index)) })
    at = m.index + m[0].length
    if (m[0].startsWith('<!--')) continue
    if (m[1]) {
      out.push({ kind: 'close', tag: m[1].toLowerCase(), raw: m[0] })
      continue
    }
    const tag = m[2].toLowerCase()
    const allowed = ALLOWED[tag] ?? []
    const attrs: Record<string, string> = {}
    for (const a of (m[3] ?? '').matchAll(ATTR)) {
      const name = a[1].toLowerCase()
      if (allowed.includes(name)) attrs[name] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '')
    }
    out.push({ kind: 'open', tag, attrs, selfClosing: m[4] === '/' || VOID.has(tag), raw: m[0] })
  }
  if (at < html.length) out.push({ kind: 'text', text: decodeEntities(html.slice(at)) })
  return out
}

const text = (value: string): MdNode => ({ type: 'text', value })

/**
 * markdown splits raw HTML into separate `html` nodes (`<sub>`, text, `</sub>`; or `<details>`,
 * paragraphs, `</details>`), so open and close tags are matched across siblings here.
 */
export function groupHtml(children: MdNode[]): MdNode[] {
  const root: MdNode[] = []
  const stack: { el: HtmlElement; into: MdNode[] }[] = []
  let current = root
  for (const child of children) {
    if (child.type !== 'html') {
      if (hasChildren(child)) (child as MdParent).children = groupHtml(child.children)
      current.push(child)
      continue
    }
    for (const t of tokenize((child as { value: string }).value)) {
      if (t.kind === 'text') {
        if (t.text) current.push(text(t.text))
      } else if (t.kind === 'open') {
        if (!(t.tag in ALLOWED)) {
          if (t.tag !== 'source') current.push(text(t.raw))
          continue
        }
        const el: HtmlElement = { type: 'htmlElement', tag: t.tag, attrs: t.attrs, children: [] }
        current.push(el)
        if (!t.selfClosing) {
          stack.push({ el, into: current })
          current = el.children
        }
      } else {
        const at = stack.findLastIndex((f) => f.el.tag === t.tag)
        if (at >= 0) {
          current = stack[at].into
          stack.length = at
        } else if (!(t.tag in ALLOWED) && t.tag !== 'source') {
          current.push(text(t.raw))
        }
      }
    }
  }
  return root
}
