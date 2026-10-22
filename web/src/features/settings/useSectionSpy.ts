import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

/** How far below the top of the scroller a section's heading counts as the one being read. */
const READING_LINE = 32
const CLICK_SCROLL_MS = 700

/** The section of `scroller` being read, following manual scrolling; `go` scrolls one into view. */
export function useSectionSpy(scroller: RefObject<HTMLElement | null>, ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? null)
  const clickedAt = useRef(0)
  const key = ids.join(',')

  useEffect(() => {
    const box = scroller.current
    if (!box) return
    const update = () => {
      if (Date.now() - clickedAt.current < CLICK_SCROLL_MS) return
      const sections = key.split(',').map((id) => document.getElementById(id)).filter((el) => el !== null)
      if (!sections.length) return
      const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 2
      const top = box.getBoundingClientRect().top + READING_LINE
      const reading = atBottom ? sections[sections.length - 1] : (sections.filter((el) => el.getBoundingClientRect().top <= top).pop() ?? sections[0])
      setActive(reading.id)
    }
    update()
    box.addEventListener('scroll', update, { passive: true })
    return () => box.removeEventListener('scroll', update)
  }, [scroller, key])

  const go = useCallback((id: string) => {
    clickedAt.current = Date.now()
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return { active, go }
}
