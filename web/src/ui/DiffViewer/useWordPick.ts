import { useState } from 'react'
import { wordAt } from '../../lib/decorate'

/** Where a point falls in a line's text element, as a character offset. */
function offsetAt(el: Element, x: number, y: number): number | null {
  const caret = document.caretPositionFromPoint?.(x, y)
  const node = caret ? caret.offsetNode : document.caretRangeFromPoint?.(x, y)?.startContainer
  const offset = caret ? caret.offset : document.caretRangeFromPoint?.(x, y)?.startOffset
  if (!node || offset === undefined || !el.contains(node)) return null
  const range = document.createRange()
  range.setStart(el, 0)
  range.setEnd(node, offset)
  return range.toString().length
}

/**
 * The word whose other occurrences are lit up: double-clicked, or selected with the mouse where
 * the diff lets text be selected. A single click or Escape lets it go.
 */
export function useWordPick(texts: string[]) {
  const [word, setWord] = useState<string | null>(null)
  return {
    word,
    clear: () => setWord(null),
    onMouseDown: (e: React.MouseEvent) => {
      if (e.detail === 1) setWord(null)
    },
    onMouseUp: () => {
      const picked = window.getSelection()?.toString() ?? ''
      if (picked.trim() && !picked.includes('\n')) setWord(picked)
    },
    onDoubleClick: (i: number, e: React.MouseEvent) => {
      const el = (e.target as Element).closest('[data-text]')
      const at = el ? offsetAt(el, e.clientX, e.clientY) : null
      if (at !== null) setWord(wordAt(texts[i], at))
    },
  }
}
