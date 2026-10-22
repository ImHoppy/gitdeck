import { gitd } from '../protocol/client'

declare global {
  interface Window {
    /** Set by gitd in its own windows; a browser tab zooms by itself. */
    gitdeckWindow?: boolean
  }
}

/** The same steps as gitd's, for the Settings choice. */
export const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]

/** A touchpad pinch sends a burst of wheel events: one step per burst. */
const WHEEL_STEP_MS = 150

export const inGitdeckWindow = () => window.gitdeckWindow === true

/** Ctrl + / Ctrl - / Ctrl 0 and Ctrl + wheel zoom every gitdeck window, as a browser would. */
export function installZoomKeys() {
  if (!inGitdeckWindow()) return
  const step = (by: number) => void gitd.call('server.zoom', { step: by }).catch(() => {})
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    if (e.key === '=' || e.key === '+') step(1)
    else if (e.key === '-' || e.key === '_') step(-1)
    else if (e.key === '0') step(0)
    else return
    e.preventDefault()
  })
  let lastWheel = 0
  window.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      if (e.timeStamp - lastWheel < WHEEL_STEP_MS) return
      lastWheel = e.timeStamp
      step(e.deltaY < 0 ? 1 : -1)
    },
    { passive: false },
  )
}
