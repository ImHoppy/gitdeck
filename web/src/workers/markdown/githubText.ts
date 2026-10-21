import { nameToEmoji } from 'gemoji'
import type { MdNode, MdParent } from '../../lib/markdownTree'
import { hasChildren } from '../../lib/markdownTree'

const SLUG = '[A-Za-z0-9][\\w.-]*\\/[\\w.-]+'

/**
 * One pass over plain text, in priority order: `owner/repo#12` and `#12`, `GH-12`,
 * `owner/repo@sha`, a bare SHA, `@login`, `:emoji:`. Each needs a non-word character (or the
 * start) before it, as on GitHub, so `a#1`, `x@y.com` and words stay text.
 */
const PATTERN = new RegExp(
  [
    `(?<![\\w/#@])(?:(${SLUG}))?#(\\d+)\\b`,
    `(?<![\\w-])GH-(\\d+)\\b`,
    `(?<![\\w/])(${SLUG})@([0-9a-f]{7,40})\\b`,
    `(?<![\\w/@.-])([0-9a-f]{7,40})\\b`,
    `(?<![\\w@/.])@([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})(?![\\w/])`,
    `:([\\w+-]+):`,
  ].join('|'),
  'g',
)

/** A word of hex letters (`deadbeef`, `facade1`) or a number is rarely a commit. */
const looksLikeSha = (s: string) => /\d/.test(s) && /[a-f]/.test(s)

export function linkText(value: string): MdNode[] {
  const out: MdNode[] = []
  let at = 0
  const push = (node: MdNode, start: number, end: number) => {
    if (start > at) out.push({ type: 'text', value: value.slice(at, start) })
    out.push(node)
    at = end
  }
  for (const m of value.matchAll(PATTERN)) {
    const start = m.index
    const end = start + m[0].length
    if (m[2]) push({ type: 'ghRef', repo: m[1] ?? null, number: Number(m[2]), text: m[0] }, start, end)
    else if (m[3]) push({ type: 'ghRef', repo: null, number: Number(m[3]), text: m[0] }, start, end)
    else if (m[5]) push({ type: 'ghCommit', repo: m[4], sha: m[5], text: `${m[4]}@${m[5].slice(0, 7)}` }, start, end)
    else if (m[6] && looksLikeSha(m[6])) push({ type: 'ghCommit', repo: null, sha: m[6], text: m[6].slice(0, 7) }, start, end)
    else if (m[7]) push({ type: 'mention', login: m[7] }, start, end)
    else if (m[8] && nameToEmoji[m[8]]) push({ type: 'text', value: nameToEmoji[m[8]] }, start, end)
  }
  if (at === 0) return [{ type: 'text', value }]
  if (at < value.length) out.push({ type: 'text', value: value.slice(at) })
  return mergeText(out)
}

function mergeText(nodes: MdNode[]): MdNode[] {
  const out: MdNode[] = []
  for (const n of nodes) {
    const last = out[out.length - 1]
    if (n.type === 'text' && last?.type === 'text') last.value += n.value
    else out.push(n)
  }
  return out
}

const GITHUB_URL = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(?:(pull|issues)\/(\d+)|commit\/([0-9a-f]{7,40}))\/?(?:[#?].*)?$/

/** A bare GitHub PR, issue or commit URL becomes the short reference, as GitHub shows it. */
export function shortenUrl(url: string): MdNode | null {
  const m = GITHUB_URL.exec(url)
  if (!m) return null
  if (m[3]) return { type: 'ghRef', repo: m[1], number: Number(m[3]), text: `${m[1]}#${m[3]}` }
  return { type: 'ghCommit', repo: m[1], sha: m[4], text: `${m[1]}@${m[4].slice(0, 7)}` }
}

/** Text inside these is left alone. */
const LITERAL = new Set(['inlineCode', 'code', 'html'])

export function linkGithub(node: MdNode): void {
  if (!hasChildren(node)) return
  const parent = node as MdParent
  const inLink = node.type === 'link' || (node.type === 'htmlElement' && ['a', 'code', 'pre', 'kbd'].includes(node.tag))
  const children: MdNode[] = []
  for (const child of parent.children) {
    if (child.type === 'link' && child.children.length === 1) {
      const only = child.children[0]
      const short = only.type === 'text' && only.value === child.url ? shortenUrl(child.url) : null
      if (short) {
        children.push(short)
        continue
      }
    }
    if (child.type === 'text' && !inLink) children.push(...linkText(child.value))
    else {
      if (!LITERAL.has(child.type)) linkGithub(child)
      children.push(child)
    }
  }
  parent.children = children
}
