import styles from './App.module.css'

export type MainMode = 'history' | 'pulls'

/** `[ History | Pull requests (n) ]`: swaps the main area, each side keeping its state. */
export function ModeToggle({ mode, unread, onMode }: { mode: MainMode; unread: number; onMode: (m: MainMode) => void }) {
  return (
    <span className={styles.modeToggle}>
      <button className={mode === 'history' ? styles.modeOn : ''} onClick={() => onMode('history')} title="The history of the repo">
        History
      </button>
      <button className={mode === 'pulls' ? styles.modeOn : ''} onClick={() => onMode('pulls')} title="Pull requests on GitHub (Ctrl+Shift+P)">
        Pull requests{unread ? ` (${unread})` : ''}
      </button>
    </span>
  )
}
