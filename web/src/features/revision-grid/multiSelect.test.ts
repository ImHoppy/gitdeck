import { expect, test } from 'bun:test'
import { NO_MARKS, nextMarks } from './multiSelect'

const plain = { ctrl: false, shift: false }
const ctrl = { ctrl: true, shift: false }
const shift = { ctrl: false, shift: true }
const sorted = (s: ReadonlySet<number>) => [...s].sort((a, b) => a - b)

test('click picks one, ctrl adds and removes', () => {
  let m = nextMarks(NO_MARKS, 3, plain)
  expect(sorted(m.set)).toEqual([3])
  m = nextMarks(m, 7, ctrl)
  expect(sorted(m.set)).toEqual([3, 7])
  m = nextMarks(m, 3, ctrl)
  expect(sorted(m.set)).toEqual([7])
})

test('shift spans from the anchor, either direction', () => {
  let m = nextMarks(NO_MARKS, 5, plain)
  m = nextMarks(m, 2, shift)
  expect(sorted(m.set)).toEqual([2, 3, 4, 5])
  m = nextMarks(m, 6, shift)
  expect(sorted(m.set)).toEqual([5, 6])
})

test('ctrl on a single selection keeps it', () => {
  const m = nextMarks({ set: new Set(), anchor: 4 }, 9, ctrl)
  expect(sorted(m.set)).toEqual([4, 9])
})
