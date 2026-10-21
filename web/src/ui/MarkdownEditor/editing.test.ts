import { expect, test } from 'bun:test'
import { insertBlock, link, wrap } from './editing'

test('wrap toggles a mark around the selection', () => {
  expect(wrap('a big b', 2, 5, '**')).toEqual({ text: 'a **big** b', start: 4, end: 7 })
  expect(wrap('a **big** b', 4, 7, '**')).toEqual({ text: 'a big b', start: 2, end: 5 })
  expect(wrap('ab', 1, 1, '_')).toEqual({ text: 'a__b', start: 2, end: 2 })
})

test('link selects the url to type over', () => {
  const e = link('see docs', 4, 8)
  expect(e.text).toBe('see [docs](url)')
  expect(e.text.slice(e.start, e.end)).toBe('url')
})

test('pictures go on their own line', () => {
  expect(insertBlock('hello', 5, '![x](./x.png)').text).toBe('hello\n![x](./x.png)\n')
  expect(insertBlock('', 0, '![x](./x.png)').text).toBe('![x](./x.png)\n')
  expect(insertBlock('a\nb', 2, 'P')).toEqual({ text: 'a\nP\nb', start: 4, end: 4 })
})
