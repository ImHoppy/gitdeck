// Git Extensions' inline difference markers (GitUI/Editor/Diff/DiffHighlightService.cs): a block of
// removed lines and the added lines after it are paired, and in each pair what both lines share
// is dimmed so what changed stands out. Lines left without a pair keep their full colour.

import type { DiffLine } from './diffLines'
import { bestWordMatch, linePairs } from './lineMatcher'

/** Within one line's text: what its pair shares, and where the pair has text this one lacks. */
export type LineMarks = { same: [start: number, end: number][]; anchors: number[] }

const MAX_GAP_LINES = 5
const MAX_LENGTH = 2000

type Block = { removed: number[]; added: number[] }

/** The removed/added blocks, as git-diff writes them: removed lines, then added ones, a few context lines apart at most. */
export function blocks(lines: DiffLine[]): Block[] {
  const out: Block[] = []
  let index = 0
  const take = (kind: 'del' | 'add', found: boolean): number[] => {
    const got: number[] = []
    let gap = 0
    for (; index < lines.length; index++) {
      const l = lines[index]
      if (l.kind !== kind) {
        if (!found) continue
        if (l.kind === 'ctx' && gap < MAX_GAP_LINES) {
          gap++
          continue
        }
        break
      }
      gap = 0
      found = true
      got.push(index)
    }
    return got
  }
  while (index < lines.length) {
    const removed = take('del', false)
    if (removed.length === 0) continue
    const added = take('add', true)
    if (added.length > 0) out.push({ removed, added })
  }
  return out
}

/** Marks for a line, worked out block by block the first time a line of the block is asked for. */
export function inlineMarks(lines: DiffLine[]): (line: number) => LineMarks | null {
  const all = blocks(lines)
  const blockOf = new Map<number, number>()
  all.forEach((b, i) => [...b.removed, ...b.added].forEach((l) => blockOf.set(l, i)))
  const done = new Map<number, Map<number, LineMarks>>()
  return (line) => {
    const b = blockOf.get(line)
    if (b === undefined) return null
    let marks = done.get(b)
    if (!marks) {
      marks = blockMarks(lines, all[b])
      done.set(b, marks)
    }
    return marks.get(line) ?? null
  }
}

function blockMarks(lines: DiffLine[], block: Block): Map<number, LineMarks> {
  const out = new Map<number, LineMarks>()
  const removed = block.removed.map((i) => lines[i].text)
  const added = block.added.map((i) => lines[i].text)
  for (const [r, a] of linePairs(removed, added)) {
    const [mr, ma] = pairMarks(removed[r], added[a])
    out.set(block.removed[r], mr)
    out.set(block.added[a], ma)
  }
  return out
}

/** What changed between a removed line and the added line it became. */
export function pairMarks(removedText: string, addedText: string): [LineMarks, LineMarks] {
  const textRemoved = removedText.slice(0, MAX_LENGTH)
  const textAdded = addedText.slice(0, MAX_LENGTH)
  const r: LineMarks = { same: [], anchors: [] }
  const a: LineMarks = { same: [], anchors: [] }
  const [atStart, atEnd] = differences(textRemoved, textAdded, 0, 0, r, a)
  for (const [side, text] of [[r, textRemoved], [a, textAdded]] as const) {
    if (atStart > 0) side.same.push([0, atStart])
    if (atEnd > 0) side.same.push([text.length - atEnd, text.length])
  }
  return [r, a]
}

// Split both texts at their longest shared word, recurse on what's left and right of it, and
// join each shared part to the identical start or end where it touches one.
function differences(tr: string, ta: string, offR: number, offA: number, r: LineMarks, a: LineMarks): [number, number] {
  let atStart = 0
  let atEnd = 0
  const endR = tr.length
  const endA = ta.length
  if (endR === endA && tr === ta) return [endR, 0]

  const match = bestWordMatch(tr, ta)
  if (match) {
    let length = match.word.length
    let startR = match.removed
    let startA = match.added
    const rightR = startR + length
    const rightA = startA + length
    const [rightStart, rightEnd] = differences(tr.slice(rightR), ta.slice(rightA), offR + rightR, offA + rightA, r, a)
    atEnd = rightEnd
    length += rightStart
    const [leftStart, leftEnd] = differences(tr.slice(0, startR), ta.slice(0, startA), offR, offA, r, a)
    atStart = leftStart
    length += leftEnd
    startR -= leftEnd
    startA -= leftEnd
    if (startR === atStart && startA === atStart) {
      atStart += length
    } else if (startR + length + atEnd === endR && startA + length + atEnd === endA) {
      atEnd += length
    } else {
      r.same.push([offR + startR, offR + startR + length])
      a.same.push([offA + startA, offA + startA + length])
    }
  } else {
    const min = Math.min(endR, endA)
    while (atStart < min && tr[atStart] === ta[atStart]) atStart++
    let endSameR = endR
    let endSameA = endA
    while (endSameR > atStart && endSameA > atStart && tr[endSameR - 1] === ta[endSameA - 1]) {
      endSameR--
      endSameA--
      atEnd++
    }
    const diffR = endSameR - atStart
    const diffA = endSameA - atStart
    if (diffR === 0 && diffA > 0) r.anchors.push(offR + atStart)
    else if (diffR > 0 && diffA === 0) a.anchors.push(offA + atStart)
  }
  return [atStart, atEnd]
}
