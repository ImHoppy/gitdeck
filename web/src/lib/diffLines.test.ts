import { expect, test } from 'bun:test'
import { parseDiff } from './diffLines'

test('numbers context, added and removed lines from the hunk header', () => {
  const lines = parseDiff(
    ['diff --git a/x b/x', '--- a/x', '+++ b/x', '@@ -10,3 +10,3 @@ fn', ' keep', '-old', '+new', ' end', '\\ No newline at end of file', ''].join('\n'),
  )
  expect(lines.map((l) => l.kind)).toEqual(['meta', 'meta', 'meta', 'hunk', 'ctx', 'del', 'add', 'ctx', 'meta'])
  expect(lines[4]).toEqual({ kind: 'ctx', text: 'keep', oldNo: 10, newNo: 10 })
  expect(lines[5]).toMatchObject({ oldNo: 11, newNo: null })
  expect(lines[6]).toMatchObject({ oldNo: null, newNo: 11 })
  expect(lines[7]).toMatchObject({ oldNo: 12, newNo: 12 })
})
