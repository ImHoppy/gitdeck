/**
 * Unread PRs, like unread mail: the last `updatedAt` seen per PR is kept in this browser; newer
 * activity makes the row bold. A repo's first listing is the baseline, so opening the view once
 * doesn't mark every old PR unread.
 */

const KEY = 'gitdeck.prSeen'
const MAX_ENTRIES = 2000

type Seen = { prs: Record<string, string>; since: Record<string, string> }

export const prKey = (repo: string, number: number) => `${repo.toLowerCase()}#${number}`

function load(): Seen {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Seen | null
    return v && v.prs && v.since ? v : { prs: {}, since: {} }
  } catch {
    return { prs: {}, since: {} }
  }
}

function save(s: Seen) {
  const entries = Object.entries(s.prs)
  if (entries.length > MAX_ENTRIES) s.prs = Object.fromEntries(entries.sort((a, b) => a[1].localeCompare(b[1])).slice(-MAX_ENTRIES))
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage blocked: everything reads as seen next time
  }
  window.dispatchEvent(new Event(KEY))
}

export function isUnread(seen: Seen, repo: string, number: number, updatedAt: string): boolean {
  const last = seen.prs[prKey(repo, number)] ?? seen.since[repo.toLowerCase()]
  return last === undefined ? false : updatedAt > last
}

export const loadSeen = load

/** The first time a repo is listed, its PRs as they are now count as read. */
export function setBaseline(repo: string, at: string) {
  const s = load()
  if (s.since[repo.toLowerCase()]) return
  s.since[repo.toLowerCase()] = at
  save(s)
}

export function markSeen(repo: string, number: number, updatedAt: string) {
  const s = load()
  const k = prKey(repo, number)
  if ((s.prs[k] ?? '') >= updatedAt) return
  s.prs[k] = updatedAt
  save(s)
}

export const SEEN_EVENT = KEY
