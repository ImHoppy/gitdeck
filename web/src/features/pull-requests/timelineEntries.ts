import type { ReviewThread, Timeline, TimelineItem } from '../../protocol/github'

export type Entry =
  | { key: string; kind: 'description' }
  | { key: string; kind: 'item'; item: TimelineItem }
  | { key: string; kind: 'thread'; thread: ReviewThread }

const itemKey = (item: TimelineItem, i: number) => ('id' in item ? item.id : item.kind === 'commit' ? `c:${item.oid}` : `e:${i}:${item.at}`)

/** The conversation in GitHub's order: description, then each item, a review followed by its threads. */
export function timelineEntries(timeline: Timeline | null): Entry[] {
  const out: Entry[] = [{ key: 'description', kind: 'description' }]
  if (!timeline) return out
  const byReview = new Map<string, ReviewThread[]>()
  const placed = new Set<string>()
  for (const t of timeline.threads) {
    if (t.reviewId) byReview.set(t.reviewId, [...(byReview.get(t.reviewId) ?? []), t])
  }
  timeline.items.forEach((item, i) => {
    out.push({ key: itemKey(item, i), kind: 'item', item })
    if (item.kind !== 'review') return
    for (const t of byReview.get(item.id) ?? []) {
      out.push({ key: t.id, kind: 'thread', thread: t })
      placed.add(t.id)
    }
  })
  for (const t of timeline.threads) if (!placed.has(t.id)) out.push({ key: t.id, kind: 'thread', thread: t })
  return out
}

/** Threads on one file line, for the Files tab: by side and line number. */
export function threadsAt(threads: ReviewThread[], path: string): Map<string, ReviewThread[]> {
  const out = new Map<string, ReviewThread[]>()
  for (const t of threads) {
    const line = t.line ?? t.originalLine
    if (t.path !== path || line === null) continue
    const k = `${t.side}:${line}`
    out.set(k, [...(out.get(k) ?? []), t])
  }
  return out
}
