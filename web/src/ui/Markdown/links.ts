/** What a reference card shows on hover. */
export type RefPreview = {
  title: string
  state: 'open' | 'closed'
  author: string
  isPull: boolean
  merged: boolean
  draft: boolean
}

/** How markdown links reach the app: the renderer itself never fetches or navigates. */
export type MarkdownLinks = {
  /** `owner/repo` the text belongs to: `#12` and relative links resolve against it. */
  repo: string | null
  /** The branch or commit relative file links point at. */
  head?: string
  /** The URL the page loads a picture from (gitd's proxy), or null to show the alt text. */
  image: (url: string) => string | null
  onRef?: (repo: string | null, number: number) => void
  onCommit?: (repo: string | null, sha: string) => void
  preview?: (repo: string | null, number: number) => Promise<RefPreview | null>
}

const SAFE = /^(https?:|mailto:)/i

/** An absolute URL for `url` written in `repo`'s text, or null when it may not be followed. */
export function resolveHref(url: string, links: Pick<MarkdownLinks, 'repo' | 'head'>, raw = false): string | null {
  const u = url.trim()
  if (u.startsWith('#')) return u
  if (SAFE.test(u)) return u
  if (/^[a-z][a-z\d+.-]*:/i.test(u) || u.startsWith('//')) return null
  if (u.startsWith('./') && raw) return u
  if (!links.repo) return null
  const path = u.replace(/^\.?\//, '')
  return `https://github.com/${links.repo}/${raw ? 'raw' : 'blob'}/${links.head ?? 'HEAD'}/${path}`
}

const PR_URL = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(pull|issues)\/(\d+)\/?(?:[#?].*)?$/

/** A link to a GitHub PR or issue opens in the PR view like a `#12` reference. */
export function githubRef(url: string): { repo: string; number: number } | null {
  const m = PR_URL.exec(url)
  return m ? { repo: m[1], number: Number(m[3]) } : null
}

/** `https://github.com/user-attachments/assets/<id>` alone on a line: a picture or a video. */
export const isAttachment = (url: string) => /^https:\/\/github\.com\/user-attachments\/assets\/[\w-]+$/.test(url)
