import { useMemo, useState } from 'react'

/** Lines of a diff matching a case-insensitive text, and which match is the current one. */
export function useDiffFind(texts: readonly string[]) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const matches = useMemo(() => {
    const q = query.toLowerCase()
    if (!open || !q) return []
    const found: number[] = []
    texts.forEach((t, i) => t.toLowerCase().includes(q) && found.push(i))
    return found
  }, [texts, query, open])

  const current = matches.length ? Math.min(index, matches.length - 1) : -1
  const step = (by: number) => matches.length && setIndex((current + by + matches.length) % matches.length)

  return {
    open,
    query,
    matches,
    matchSet: useMemo(() => new Set(matches), [matches]),
    /** The line of the current match, or null. */
    line: current >= 0 ? matches[current] : null,
    current,
    show: () => setOpen(true),
    hide: () => {
      setOpen(false)
      setQuery('')
    },
    search: (q: string) => {
      setQuery(q)
      setIndex(0)
    },
    next: () => step(1),
    prev: () => step(-1),
  }
}
