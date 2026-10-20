import { describe, expect, test } from 'bun:test'
import { buildPathTree, flattenPathTree } from './pathTree'

const paths = ['src/a/b/x.ts', 'src/y.ts', 'README.md', 'src/a/b/z.ts']

describe('buildPathTree', () => {
  test('folders first, single-folder chains merged', () => {
    const flat = flattenPathTree(buildPathTree(paths, (p) => p), new Set())
    expect(flat.map(({ node, depth }) => `${depth}:${node.name}`)).toEqual([
      '0:src',
      '1:a/b',
      '2:x.ts',
      '2:z.ts',
      '1:y.ts',
      '0:README.md',
    ])
  })

  test('collapsed folders hide their children', () => {
    const flat = flattenPathTree(buildPathTree(paths, (p) => p), new Set(['src/a/b']))
    expect(flat.map(({ node }) => node.path)).toEqual(['src', 'src/a/b', 'src/y.ts', 'README.md'])
  })
})
