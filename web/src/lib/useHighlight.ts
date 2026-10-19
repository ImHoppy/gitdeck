import { useEffect, useState } from 'react'
import { highlightLines, languageFor } from './highlight'

export function useHighlight(path: string | undefined, lines: string[]): string[] | null {
  const [done, setDone] = useState<{ lines: string[]; html: string[] } | null>(null)
  const lang = path ? languageFor(path) : null

  useEffect(() => {
    if (!lang || lines.length === 0) return
    let live = true
    highlightLines(lang, lines).then((html) => live && setDone({ lines, html }))
    return () => {
      live = false
    }
  }, [lang, lines])

  return done?.lines === lines ? done.html : null
}
