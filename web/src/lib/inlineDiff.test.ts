import { expect, test } from 'bun:test'
import { parseDiff } from './diffLines'
import { blocks, inlineMarks, pairMarks } from './inlineDiff'

const diff = (body: string[]) => parseDiff(['@@ -1,9 +1,9 @@', ...body].join('\n'))

test('a block is removed lines then added lines, a few context lines apart at most', () => {
  const lines = diff(['-a', ' keep', '-b', '+c', ' x', ' y', '+d', ' z', '-e'])
  expect(blocks(lines)).toEqual([{ removed: [1, 3], added: [4, 7] }])
})

test('what both lines share is dimmed, the change is not', () => {
  const [r, a] = pairMarks('    if (focused !== true) return;', '    if (focused !== true) {')
  expect(r.same).toEqual([[0, 26]])
  expect(a.same).toEqual([[0, 26]])
})

test('a pure insertion leaves an anchor in the removed line', () => {
  const [r, a] = pairMarks('call(a)', 'call(a, b)')
  expect(r).toEqual({ same: [[0, 6], [6, 7]], anchors: [6] })
  expect(a.same).toEqual([[0, 6], [9, 10]])
})

test('lines with nothing in common stay whole', () => {
  const [r, a] = pairMarks('+++', '---')
  expect(r.same).toEqual([])
  expect(a.same).toEqual([])
})

test('only paired lines get marks', () => {
  const marks = inlineMarks(diff([' ctx', '-let x = 1;', '-unrelated();', '+let x = 2;']))
  expect(marks(0)).toBeNull()
  expect(marks(2)?.same).toEqual([[0, 8], [9, 10]])
  expect(marks(3)).toBeNull()
  expect(marks(4)?.same).toEqual([[0, 8], [9, 10]])
})
