import type { Root } from 'mdast'
import { useEffect, useState } from 'react'
import { cacheGet, cachePut } from './immutableCall'
import { parseMarkdown } from './markdown'

/** Bumped when the parser's output changes shape, so old cached trees are not reused. */
const TREE_VERSION = 1

/**
 * The parsed tree of `text`. `cacheKey` names text that never changes for that key (a comment
 * id with its `updatedAt`), so revisits skip the worker.
 */
export function useMarkdown(text: string, cacheKey?: string): Root | null {
  const [done, setDone] = useState<{ text: string; tree: Root } | null>(null)

  useEffect(() => {
    let live = true
    const key = cacheKey ? `md:${TREE_VERSION}:${cacheKey}` : null
    void (async () => {
      const hit = key ? await cacheGet<Root>(key) : undefined
      const tree = hit ?? (await parseMarkdown(text))
      if (key && !hit) void cachePut(key, tree)
      if (live) setDone({ text, tree })
    })().catch(() => {})
    return () => {
      live = false
    }
  }, [text, cacheKey])

  return done?.text === text ? done.tree : null
}
