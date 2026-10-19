const BY_EXTENSION: Record<string, string> = {
  sh: 'bash', bash: 'bash', c: 'cpp', h: 'cpp', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', css: 'css', scss: 'css',
  go: 'go', ini: 'ini', toml: 'ini', cfg: 'ini', java: 'java', js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  jsx: 'javascript', json: 'json', lua: 'lua', md: 'markdown', py: 'python', rs: 'rust', sql: 'sql', ts: 'typescript',
  tsx: 'typescript', html: 'xml', xml: 'xml', csproj: 'xml', svg: 'xml', yml: 'yaml', yaml: 'yaml',
}

export function languageFor(path: string): string | null {
  const ext = path.toLowerCase().split('.').pop() ?? ''
  return BY_EXTENSION[ext] ?? null
}

const POOL_SIZE = 2
let pool: Worker[] | null = null
let next = 0
let nextId = 1
const waiting = new Map<number, (html: string[]) => void>()

function workers(): Worker[] {
  if (!pool) {
    pool = Array.from({ length: POOL_SIZE }, () => {
      const w = new Worker(new URL('../workers/highlight.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<{ id: number; html: string[] }>) => {
        waiting.get(e.data.id)?.(e.data.html)
        waiting.delete(e.data.id)
      }
      return w
    })
  }
  return pool
}

/** Highlights each line on its own in a worker; resolves to escaped HTML per line. */
export function highlightLines(lang: string, lines: string[]): Promise<string[]> {
  const id = nextId++
  const ws = workers()
  return new Promise((resolve) => {
    waiting.set(id, resolve)
    ws[next++ % ws.length].postMessage({ id, lang, lines })
  })
}
