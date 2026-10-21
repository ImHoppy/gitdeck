import { describe, expect, test } from 'bun:test'
import { parseMarkdown } from './parse'

const BODY = `### Description

Fixes #14745, see [the docs][docs] and https://github.com/cli/cli/pull/14700.

- [x] tests
- [ ] docs

| a | b |
|:--|--:|
| 1 | 2 |

<details>
<summary>Logs</summary>

\`\`\`go
fmt.Println("#1 is not a ref here")
\`\`\`

</details>

![shot](https://github.com/user-attachments/assets/abc)

[docs]: https://example.com/docs
`

describe('parseMarkdown', () => {
  const tree = parseMarkdown(BODY)
  const json = JSON.stringify(tree)

  test('GFM blocks', () => {
    const types = tree.children.map((c) => c.type)
    expect(types).toEqual(['heading', 'paragraph', 'list', 'table', 'htmlElement' as never, 'paragraph'])
    expect(json).not.toContain('"position"')
    expect(json).toContain('"checked":true')
  })

  test('references resolved, refs linked, code left alone', () => {
    expect(json).toContain('"url":"https://example.com/docs"')
    expect(json).not.toContain('linkReference')
    expect(json).toContain('{"type":"ghRef","repo":null,"number":14745,"text":"#14745"}')
    expect(json).toContain('"text":"cli/cli#14700"')
    expect(json).toContain('#1 is not a ref here')
  })
})
