import { decorate, escapeHtml, type Mark } from '../../lib/decorate'
import styles from './DiffViewer.module.css'

type Props = { html: string | undefined; text: string; marks: Mark[] }

/** A diff line's text: highlighted when the worker is done, with the word marks laid over it. */
export function LineText({ html, text, marks }: Props) {
  if (!html && marks.length === 0) {
    return (
      <span className={styles.text} data-text>
        {text}
      </span>
    )
  }
  const __html = decorate(html ?? escapeHtml(text), text.length, marks)
  return <span className={styles.text} data-text dangerouslySetInnerHTML={{ __html }} />
}
