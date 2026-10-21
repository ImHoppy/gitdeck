import { describe, expect, test } from 'bun:test'
import type { MdNode } from '../../lib/markdownTree'
import { decodeEntities, groupHtml, tokenize } from './rawHtml'

const html = (value: string): MdNode => ({ type: 'html', value })
const text = (value: string): MdNode => ({ type: 'text', value })
const para = (...children: MdNode[]): MdNode => ({ type: 'paragraph', children } as MdNode)

describe('tokenize', () => {
  test('keeps allowed attributes only', () => {
    const [t] = tokenize('<img src="a.png" onerror="x()" width=40 alt=\'shot\'>')
    expect(t).toMatchObject({ kind: 'open', tag: 'img', attrs: { src: 'a.png', width: '40', alt: 'shot' }, selfClosing: true })
  })

  test('comments vanish, entities decode', () => {
    expect(tokenize('a<!-- hidden -->b')).toEqual([{ kind: 'text', text: 'a' }, { kind: 'text', text: 'b' }])
    expect(decodeEntities('&lt;x&gt; &amp; &#x1F600; &#65;')).toBe('<x> & 😀 A')
  })
})

describe('groupHtml', () => {
  test('inline tags across text nodes', () => {
    const out = groupHtml([para(text('H'), html('<sub>'), text('2'), html('</sub>'), text('O'))])
    expect(out).toEqual([para(text('H'), { type: 'htmlElement', tag: 'sub', attrs: {}, children: [text('2')] }, text('O'))])
  })

  test('details wraps the markdown blocks between its tags', () => {
    const out = groupHtml([html('<details>\n<summary>Logs</summary>'), para(text('body')), html('</details>'), para(text('after'))])
    expect(out).toEqual([
      {
        type: 'htmlElement',
        tag: 'details',
        attrs: {},
        children: [text('\n'), { type: 'htmlElement', tag: 'summary', attrs: {}, children: [text('Logs')] }, para(text('body'))],
      },
      para(text('after')),
    ])
  })

  test('scripts and styles show as text', () => {
    const out = groupHtml([html('<script>alert(1)</script>'), html('<style>a{}</style>')])
    expect(out).toEqual([text('<script>'), text('alert(1)'), text('</script>'), text('<style>'), text('a{}'), text('</style>')])
  })

  test('picture keeps only its img', () => {
    const out = groupHtml([html('<picture><source media="(prefers-color-scheme: dark)" srcset="d.png"><img src="l.png"></picture>')])
    expect(out).toEqual([{ type: 'htmlElement', tag: 'picture', attrs: {}, children: [{ type: 'htmlElement', tag: 'img', attrs: { src: 'l.png' }, children: [] }] }])
  })
})
