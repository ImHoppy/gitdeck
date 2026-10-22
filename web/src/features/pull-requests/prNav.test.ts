import { expect, test } from 'bun:test'
import { NO_PULLS, placeIn } from './prNav'

test("another project's PR is not shown", () => {
  const stored = { ...NO_PULLS, project: 'ava', pr: 12, prRepo: 'a/b' }
  expect(placeIn(stored, 'ava')).toBe(stored)
  expect(placeIn(stored, 'gitdeck')).toEqual({ ...NO_PULLS, project: 'gitdeck' })
})
