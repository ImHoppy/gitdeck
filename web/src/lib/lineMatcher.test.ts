import { expect, test } from 'bun:test'
import { bestWordMatch, combinations, linePairs, subwords, words } from './lineMatcher'

test('words are letter, digit and underscore runs', () => {
  expect(words('a.b_c(12)')).toEqual([['a', 0], ['b_c', 2], ['12', 6]])
})

test('subwords split camel case and underscores', () => {
  expect(subwords('fetchNuiCopy')).toEqual([['fetch', 0], ['Nui', 5], ['Copy', 8]])
  expect(subwords('max_gap_lines')).toEqual([['max', 0], ['gap', 4], ['lines', 8]])
})

test('combinations walk the diagonals', () => {
  expect([...combinations(2, 3)]).toEqual([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]])
})

test('the longest shared word, else a shared subword', () => {
  expect(bestWordMatch('if (focused) return;', 'if (focused) {')).toEqual({ word: 'focused', removed: 4, added: 4 })
  expect(bestWordMatch('oldName', 'newName')).toEqual({ word: 'Name', removed: 3, added: 3 })
  expect(bestWordMatch('+', '-')).toBeNull()
})

test('lines pair with the line they became, an indented one first', () => {
  const removed = ['const a = 1', 'while (x) {', '  call(a)']
  const added = ['call(a)', 'const a = 2']
  expect(linePairs(removed, added)).toEqual([[2, 0]])
  expect(linePairs(['let x = 1', 'foo()'], ['let x = 2', 'bar()'])).toEqual([[0, 0], [1, 1]])
})
