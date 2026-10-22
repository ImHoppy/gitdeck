// Git Extensions' LinesMatcher (GitUI/Editor/Diff/LinesMatcher.cs): which removed line became
// which added line, and the longest word two lines share.

export type Word = [word: string, start: number]

const WORD_CHAR = /[\p{L}\p{N}_]/u
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u
const UPPER = /\p{Lu}/u

export function words(text: string): Word[] {
  const out: Word[] = []
  let start = 0
  while (start < text.length) {
    if (!WORD_CHAR.test(text[start])) {
      start++
      continue
    }
    let end = start + 1
    while (end < text.length && WORD_CHAR.test(text[end])) end++
    out.push([text.slice(start, end), start])
    start = end + 1
  }
  return out
}

/** `camelCase_snake` → `camel`, `Case`, `snake`: a renamed identifier still shares its parts. */
export function subwords(word: string): Word[] {
  const out: Word[] = []
  const end = word.length
  if (end === 0) return out
  let start = 0
  let previousUpper = UPPER.test(word[0])
  for (let i = 0; i < end; i++) {
    const upper = UPPER.test(word[i])
    if (previousUpper !== upper) {
      previousUpper = upper
      if (upper) {
        // no lone leading '_'
        if (!(i === 1 && !LETTER_OR_DIGIT.test(word[0]))) out.push([word.slice(start, i), start])
        start = i
      }
    }
    if (i > 0 && !LETTER_OR_DIGIT.test(word[i])) {
      if (start < i && LETTER_OR_DIGIT.test(word[i - 1])) out.push([word.slice(start, i), start])
      start = i + 1
      previousUpper = true
    }
  }
  if (start < end && !(end === 1 && !LETTER_OR_DIGIT.test(word[0]))) out.push([word.slice(start), start])
  return out
}

const allSubwords = (ws: Word[]): Word[] => ws.flatMap(([w, at]) => subwords(w).map(([s, i]): Word => [s, at + i]))

/** The longest word in both texts (else the longest shared subword), with where it starts in each. */
export function bestWordMatch(removed: string, added: string): { word: string; removed: number; added: number } | null {
  const wordsRemoved = words(removed)
  const wordsAdded = words(added)
  return longestCommon(wordsRemoved, wordsAdded) ?? longestCommon(allSubwords(wordsRemoved), allSubwords(wordsAdded))
}

function longestCommon(removed: Word[], added: Word[]) {
  const inRemoved = new Set(removed.map(([w]) => w))
  let best: Word | null = null
  for (const pair of added) if (inRemoved.has(pair[0]) && (!best || pair[0].length > best[0].length)) best = pair
  if (!best) return null
  const word = best[0]
  return { word, removed: removed.find(([w]) => w === word)![1], added: best[1] }
}

/** Index pairs walked diagonal by diagonal: (0,0), (1,0), (0,1), (2,0), (1,1), … */
export function* combinations(firstEnd: number, secondEnd: number): Generator<[number, number]> {
  for (let d = 0; d < firstEnd; d++) {
    for (let s = 0; s < Math.min(d + 1, secondEnd); s++) yield [d - s, s]
  }
  for (let d = 1; d < secondEnd; d++) {
    for (let s = d; s < Math.min(firstEnd + d, secondEnd); s++) yield [firstEnd - 1 + d - s, s]
  }
}

type LineData = { trimmed: string; words: Set<string>; total: number }

function lineData(text: string): LineData {
  const trimmed = text.trim()
  const set = new Set(words(trimmed).map(([w]) => w))
  let total = 0
  for (const w of set) total += w.length
  return { trimmed, words: set, total }
}

// beyond this many combinations the lines are paired in order: matching them all costs O(n²)
const MAX_COMBINATIONS = 100 * 100
const INSIGNIFICANT_SCORE = 0.1

/** Which removed line (index) became which added line, in order. */
export function linePairs(removed: string[], added: string[]): [number, number][] {
  const combos = removed.length * added.length
  if (combos < 1) return []
  if (combos === 1 || combos > MAX_COMBINATIONS) {
    return Array.from({ length: Math.min(removed.length, added.length) }, (_, i): [number, number] => [i, i])
  }
  const r = removed.map(lineData)
  const a = added.map(lineData)
  const out: [number, number][] = []
  pairs(r, a, 0, r.length, 0, a.length, out)
  return out
}

function pairs(r: LineData[], a: LineData[], rFrom: number, rTo: number, aFrom: number, aTo: number, out: [number, number][]) {
  const [ri, ai] = bestLineMatch(r.slice(rFrom, rTo), a.slice(aFrom, aTo))
  if (ri > 0 && ai > 0) pairs(r, a, rFrom, rFrom + ri, aFrom, aFrom + ai, out)
  out.push([rFrom + ri, aFrom + ai])
  if (rFrom + ri + 1 < rTo && aFrom + ai + 1 < aTo) pairs(r, a, rFrom + ri + 1, rTo, aFrom + ai + 1, aTo, out)
}

function bestLineMatch(removed: LineData[], added: LineData[]): [number, number] {
  // the longest line found again once trimmed: an indented line
  let best = -1
  let found: [number, number] | null = null
  removed.forEach((r, i) => {
    const at = added.findIndex((a) => a.trimmed === r.trimmed)
    const key = at < 0 ? -1 : r.trimmed.length
    if (key > best) {
      best = key
      found = at < 0 ? null : [i, at]
    }
  })
  if (found) return found

  // else the lines whose shared words are the longest
  let maxScore = -1
  let pick: [number, number] = [0, 0]
  for (const [ri, ai] of combinations(removed.length, added.length)) {
    const score = wordScore(removed[ri], added[ai])
    if (maxScore < score) {
      maxScore = score
      pick = [ri, ai]
      if (maxScore === 1) return pick
    }
  }
  return maxScore <= INSIGNIFICANT_SCORE ? [0, 0] : pick
}

function wordScore(r: LineData, a: LineData): number {
  if (r.words.size === 0 || a.words.size === 0) return -1
  let shared = 0
  for (const w of r.words) if (a.words.has(w)) shared += w.length
  return shared / Math.max(r.total, a.total)
}
