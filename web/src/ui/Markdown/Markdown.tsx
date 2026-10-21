import type { FootnoteDefinition, Root } from 'mdast'
import { useMemo, useState } from 'react'
import type { MdNode } from '../../lib/markdownTree'
import { ImageViewer } from '../ImageViewer/ImageViewer'
import { Spinner } from '../Spinner/Spinner'
import { MarkdownCtx, type MarkdownContext } from './context'
import type { MarkdownLinks } from './links'
import styles from './Markdown.module.css'
import { renderAll } from './renderNode'

type Props = {
  /** The parsed text (`useMarkdown`); null while it is parsed. */
  tree: Root | null
  links: MarkdownLinks
  /** Shown when the text is empty. */
  empty?: string
}

function footnotes(tree: Root): FootnoteDefinition[] {
  const out: FootnoteDefinition[] = []
  const walk = (n: MdNode) => {
    if (n.type === 'footnoteDefinition') out.push(n)
    else if ('children' in n && Array.isArray(n.children)) n.children.forEach(walk)
  }
  walk(tree)
  return out
}

/** GitHub-flavoured markdown as React elements: no HTML string is ever put in the page. */
export function Markdown({ tree, links, empty }: Props) {
  const [viewing, setViewing] = useState<{ src: string; alt: string } | null>(null)
  const ctx: MarkdownContext = useMemo(() => ({ ...links, openImage: (src, alt) => setViewing({ src, alt }) }), [links])
  const notes = useMemo(() => (tree ? footnotes(tree) : []), [tree])
  if (!tree) return <div className={styles.markdown}><Spinner /></div>
  if (tree.children.length === 0) return <div className={`${styles.markdown} ${styles.empty}`}>{empty ?? ''}</div>
  return (
    <MarkdownCtx.Provider value={ctx}>
      <div className={styles.markdown}>
        {renderAll(tree.children as MdNode[], ctx)}
        {notes.length > 0 && (
          <section className={styles.footnotes}>
            <ol>
              {notes.map((n) => (
                <li key={n.identifier} id={`fn-${n.identifier}`}>
                  {renderAll(n.children as MdNode[], ctx)} <a href={`#fnref-${n.identifier}`}>↩</a>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      {viewing && <ImageViewer src={viewing.src} alt={viewing.alt} onClose={() => setViewing(null)} />}
    </MarkdownCtx.Provider>
  )
}
