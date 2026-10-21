import type { ReactNode } from 'react'
import type { MdNode } from '../../lib/markdownTree'
import { CodeBlock } from './CodeBlock'
import { HtmlNode } from './HtmlNode'
import { isAttachment } from './links'
import { SafeLink } from './SafeLink'
import type { MarkdownContext } from './context'
import { MdImage } from './MdImage'
import { RefLink } from './RefLink'
import styles from './Markdown.module.css'

export function renderAll(nodes: readonly MdNode[], ctx: MarkdownContext): ReactNode[] {
  return nodes.map((n, i) => renderNode(n, i, ctx))
}

/** A paragraph that is only an attachment link: GitHub shows it as the picture or video itself. */
function attachmentOnly(n: MdNode): string | null {
  if (n.type !== 'paragraph' || n.children.length !== 1) return null
  const only = n.children[0]
  if (only.type === 'link' && isAttachment(only.url)) return only.url
  if (only.type === 'text' && isAttachment(only.value.trim())) return only.value.trim()
  return null
}

export function renderNode(n: MdNode, key: number, ctx: MarkdownContext): ReactNode {
  const kids = (nodes: readonly MdNode[]) => renderAll(nodes, ctx)
  switch (n.type) {
    case 'paragraph': {
      const media = attachmentOnly(n)
      if (media) return <p key={key}><MdImage url={media} alt="" maybeVideo /></p>
      return <p key={key}>{kids(n.children)}</p>
    }
    case 'heading': {
      const H = `h${n.depth}` as 'h1'
      return <H key={key}>{kids(n.children)}</H>
    }
    case 'thematicBreak':
      return <hr key={key} />
    case 'blockquote':
      return <blockquote key={key}>{kids(n.children)}</blockquote>
    case 'list': {
      const tasks = n.children.some((c) => c.checked != null)
      return n.ordered ? (
        <ol key={key} start={n.start ?? undefined}>{kids(n.children)}</ol>
      ) : (
        <ul key={key} className={tasks ? styles.tasks : undefined}>{kids(n.children)}</ul>
      )
    }
    case 'listItem':
      return (
        <li key={key}>
          {n.checked != null && <input type="checkbox" checked={n.checked} disabled readOnly className={styles.task} />}
          {n.spread || n.children.length !== 1 || n.children[0].type !== 'paragraph' ? kids(n.children) : kids(n.children[0].children)}
        </li>
      )
    case 'table':
      return (
        <div key={key} className={styles.tableBox}>
          <table>
            <thead>{n.children.slice(0, 1).map((row, r) => (
              <tr key={r}>{row.children.map((c, i) => <th key={i} style={{ textAlign: n.align?.[i] ?? undefined }}>{kids(c.children)}</th>)}</tr>
            ))}</thead>
            <tbody>{n.children.slice(1).map((row, r) => (
              <tr key={r}>{row.children.map((c, i) => <td key={i} style={{ textAlign: n.align?.[i] ?? undefined }}>{kids(c.children)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )
    case 'code':
      return <CodeBlock key={key} code={n.value} lang={n.lang ?? null} />
    case 'html':
      return <span key={key}>{n.value}</span>
    case 'text':
      return n.value
    case 'emphasis':
      return <em key={key}>{kids(n.children)}</em>
    case 'strong':
      return <strong key={key}>{kids(n.children)}</strong>
    case 'delete':
      return <del key={key}>{kids(n.children)}</del>
    case 'inlineCode':
      return <code key={key}>{n.value}</code>
    case 'break':
      return <br key={key} />
    case 'link':
      return <SafeLink key={key} href={n.url} ctx={ctx}>{kids(n.children)}</SafeLink>
    case 'image':
      return <MdImage key={key} url={n.url} alt={n.alt ?? ''} />
    case 'footnoteReference':
      return <sup key={key}><a href={`#fn-${n.identifier}`} id={`fnref-${n.identifier}`}>{n.label ?? n.identifier}</a></sup>
    case 'footnoteDefinition':
      return null
    case 'htmlElement':
      return <HtmlNode key={key} node={n} ctx={ctx} />
    case 'ghRef':
      return <RefLink key={key} repo={n.repo} number={n.number} text={n.text} />
    case 'ghCommit':
      return ctx.onCommit ? (
        <button key={key} className={styles.sha} onClick={() => ctx.onCommit?.(n.repo, n.sha)} title={n.sha}>{n.text}</button>
      ) : (
        <code key={key}>{n.text}</code>
      )
    case 'mention':
      return <span key={key} className={styles.mention}>@{n.login}</span>
    default:
      return null
  }
}
