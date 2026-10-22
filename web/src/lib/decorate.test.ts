import { expect, test } from 'bun:test'
import { decorate, escapeHtml, occurrences, wordAt } from './decorate'

test('marks nest inside the highlighter spans and count an entity as one character', () => {
  const html = '<span class="k">let</span> a &amp;&amp; b'
  const out = decorate(html, 11, [{ start: 2, end: 6, cls: 'm' }])
  expect(out).toBe('<span class="k">le<span class="m">t</span></span><span class="m"> a </span>&amp;&amp; b')
})

test('a zero-width mark is an empty span at its place', () => {
  expect(decorate(escapeHtml('a<b'), 3, [{ start: 1, end: 1, cls: 'x' }])).toBe('a<span class="x"></span>&#60;b')
})

test('overlapping marks join their classes', () => {
  expect(decorate('abc', 3, [{ start: 0, end: 2, cls: 'a' }, { start: 1, end: 3, cls: 'b' }])).toBe(
    '<span class="a">a</span><span class="a b">b</span><span class="b">c</span>',
  )
})

test('a word matches whole words only, any other text anywhere', () => {
  expect(occurrences('focus focused focus', 'focus')).toEqual([[0, 5], [14, 19]])
  expect(occurrences('a.b a.b', '.b')).toEqual([[1, 3], [5, 7]])
})

test('a double click picks the word under it', () => {
  expect(wordAt('await fetchNui(x)', 8)).toBe('fetchNui')
  expect(wordAt('await fetchNui(x)', 14)).toBe('fetchNui')
  expect(wordAt('a  b', 2)).toBeNull()
})
