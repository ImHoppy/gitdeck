import styles from './Spinner.module.css'

export function Spinner({ size = 12 }: { size?: number }) {
  return (
    <svg className={styles.spinner} width={size} height={size} viewBox="0 0 16 16" aria-label="loading">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
