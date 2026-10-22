/** A class over `[start, end)` of a line's text, or a zero-width marker when `start === end`. */
export type Mark = { start: number; end: number; cls: string }

const isWord = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}_]/u.test(c)

// past this the line is shown as it is: a class per character costs too much on a minified file
const MAX_LENGTH = 5000

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/**
 * Wraps text ranges of a line's HTML (highlighter output: `<span>` tags and entities) in spans,
 * closed and reopened around every tag so they nest inside the highlighter's own.
 */
export function decorate(html: string, length: number, marks: Mark[]): string {
  if (marks.length === 0 || length > MAX_LENGTH) return html
  const classes: string[] = new Array(length).fill('')
  const anchors = new Map<number, string[]>()
  for (const m of marks) {
    if (m.start === m.end) anchors.set(m.start, [...(anchors.get(m.start) ?? []), m.cls])
    for (let i = Math.max(0, m.start); i < Math.min(length, m.end); i++) classes[i] = classes[i] ? `${classes[i]} ${m.cls}` : m.cls
  }
  let out = ''
  let open = ''
  let pos = 0
  const close = () => {
    if (open) out += '</span>'
  }
  const anchorsAt = (at: number) => {
    for (const cls of anchors.get(at) ?? []) out += `<span class="${cls}"></span>`
  }
  for (let k = 0; k < html.length; ) {
    if (html[k] === '<') {
      const end = html.indexOf('>', k) + 1 || html.length
      close()
      out += html.slice(k, end)
      if (open) out += `<span class="${open}">`
      k = end
      continue
    }
    const end = html[k] === '&' ? html.indexOf(';', k) + 1 || k + 1 : k + 1
    anchorsAt(pos)
    const cls = classes[pos] ?? ''
    if (cls !== open) {
      close()
      open = cls
      if (open) out += `<span class="${open}">`
    }
    out += html.slice(k, end)
    pos++
    k = end
  }
  close()
  anchorsAt(pos)
  return out
}

/** Every exact occurrence of `word` in `text`; a picked word only matches whole words. */
export function occurrences(text: string, word: string): [number, number][] {
  if (!word) return []
  const whole = /^[\p{L}\p{N}_]+$/u.test(word)
  const out: [number, number][] = []
  for (let at = text.indexOf(word); at >= 0; at = text.indexOf(word, at + word.length)) {
    if (whole && (isWord(text[at - 1]) || isWord(text[at + word.length]))) continue
    out.push([at, at + word.length])
  }
  return out
}

/** The word around `offset` (or just before it), as a double click picks it. */
export function wordAt(text: string, offset: number): string | null {
  let at = isWord(text[offset]) ? offset : isWord(text[offset - 1]) ? offset - 1 : -1
  if (at < 0) return null
  let end = at
  while (isWord(text[end])) end++
  while (isWord(text[at - 1])) at--
  return text.slice(at, end)
}
