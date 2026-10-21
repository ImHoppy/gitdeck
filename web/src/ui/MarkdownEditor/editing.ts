export type Edit = { text: string; start: number; end: number }

/** Wraps the selection in `mark` (bold, italic), or unwraps it when it already is. */
export function wrap(text: string, start: number, end: number, mark: string): Edit {
  const before = text.slice(0, start)
  const picked = text.slice(start, end)
  const after = text.slice(end)
  if (before.endsWith(mark) && after.startsWith(mark)) {
    return { text: before.slice(0, -mark.length) + picked + after.slice(mark.length), start: start - mark.length, end: end - mark.length }
  }
  return { text: before + mark + picked + mark + after, start: start + mark.length, end: end + mark.length }
}

/** `[selection](url)` with the URL part selected, ready to type over. */
export function link(text: string, start: number, end: number): Edit {
  const label = text.slice(start, end) || 'text'
  const inserted = `[${label}](url)`
  const urlAt = start + label.length + 3
  return { text: text.slice(0, start) + inserted + text.slice(end), start: urlAt, end: urlAt + 3 }
}

/** Inserts `snippet` at the cursor on a line of its own (pictures). */
export function insertBlock(text: string, at: number, snippet: string): Edit {
  const before = text.slice(0, at)
  const after = text.slice(at)
  const lead = before === '' || before.endsWith('\n') ? '' : '\n'
  const trail = after.startsWith('\n') ? '' : '\n'
  const next = before + lead + snippet + trail + after
  const cursor = before.length + lead.length + snippet.length + trail.length
  return { text: next, start: cursor, end: cursor }
}
