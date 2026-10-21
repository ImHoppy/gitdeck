import type { Definition, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import type { MdNode, MdParent } from '../../lib/markdownTree'
import { hasChildren } from '../../lib/markdownTree'
import { linkGithub } from './githubText'
import { groupHtml } from './rawHtml'

/** Positions are dead weight once parsed: the tree goes to the page as JSON. */
function strip(node: MdNode) {
  delete (node as { position?: unknown }).position
  if (hasChildren(node)) node.children.forEach(strip)
}

function collect(node: MdNode, into: Map<string, Definition>) {
  if (node.type === 'definition') into.set(node.identifier, node)
  if (hasChildren(node)) node.children.forEach((c) => collect(c, into))
}

/** `[text][ref]` and `![alt][ref]` become plain links and images; definitions go. */
function resolveReferences(node: MdNode, defs: Map<string, Definition>) {
  if (!hasChildren(node)) return
  const parent = node as MdParent
  parent.children = parent.children
    .filter((c) => c.type !== 'definition')
    .map((c): MdNode => {
      if (c.type === 'linkReference') {
        const d = defs.get(c.identifier)
        return d ? { type: 'link', url: d.url, title: d.title, children: c.children } : { type: 'text', value: `[${c.label ?? c.identifier}]` }
      }
      if (c.type === 'imageReference') {
        const d = defs.get(c.identifier)
        return d ? { type: 'image', url: d.url, title: d.title, alt: c.alt } : { type: 'text', value: `![${c.alt ?? ''}]` }
      }
      return c
    })
  parent.children.forEach((c) => resolveReferences(c, defs))
}

export function parseMarkdown(text: string): Root {
  const root = fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
  const tree = root as unknown as MdNode & MdParent
  strip(tree)
  const defs = new Map<string, Definition>()
  collect(tree, defs)
  resolveReferences(tree, defs)
  tree.children = groupHtml(tree.children)
  linkGithub(tree)
  return root
}
