import type { Root } from 'mdast'

let worker: Worker | null = null
let nextId = 1
const waiting = new Map<number, { resolve: (tree: Root) => void; reject: (e: Error) => void }>()

function markdownWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/markdown.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; tree?: Root; error?: string }>) => {
      const w = waiting.get(e.data.id)
      waiting.delete(e.data.id)
      if (e.data.tree) w?.resolve(e.data.tree)
      else w?.reject(new Error(e.data.error ?? 'markdown failed'))
    }
  }
  return worker
}

/** GitHub-flavoured markdown parsed off the main thread, as an mdast tree. */
export function parseMarkdown(text: string): Promise<Root> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    markdownWorker().postMessage({ id, text })
  })
}
