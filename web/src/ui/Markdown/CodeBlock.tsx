import { useMemo } from 'react'
import { languageFor } from '../../lib/highlight'
import { useHighlight } from '../../lib/useHighlight'
import styles from './Markdown.module.css'

/** A fenced block, coloured by the diff's highlighter; ```` ```suggestion ```` shows as added lines. */
export function CodeBlock({ code, lang }: { code: string; lang: string | null }) {
  const lines = useMemo(() => code.split('\n'), [code])
  const suggestion = lang === 'suggestion'
  const path = lang && !suggestion && languageFor(`x.${lang}`) ? `x.${lang}` : undefined
  const html = useHighlight(path, lines)
  return (
    <pre className={`${styles.code} ${suggestion ? styles.suggestion : ''}`}>
      {suggestion && <div className={styles.suggestionHead}>Suggested change</div>}
      <code>
        {lines.map((line, i) => (
          <div key={i} className={suggestion ? styles.added : undefined}>
            {suggestion && <span className={styles.sign}>+</span>}
            {/* the highlighter's output: escaped text in its own spans */}
            {html ? <span dangerouslySetInnerHTML={{ __html: html[i] || ' ' }} /> : line || ' '}
          </div>
        ))}
      </code>
    </pre>
  )
}
