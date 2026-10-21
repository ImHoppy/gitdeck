import { type ReactNode, useRef, useState } from 'react'
import { Menu } from '../Menu/Menu'
import styles from './Select.module.css'

type Props<T extends string> = {
  value: T
  options: readonly (readonly [T, ReactNode])[]
  onChange: (value: T) => void
  title?: string
  className?: string
  /** Sized like the text inputs of a form. */
  field?: boolean
}

export function Select<T extends string>({ value, options, onChange, title, className, field }: Props<T>) {
  const ref = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<DOMRect | null>(null)
  const current = options.find(([v]) => v === value)?.[1] ?? value

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`${styles.select} ${field ? styles.field : ''} ${at ? styles.open : ''} ${className ?? ''}`}
        title={title}
        aria-haspopup="menu"
        onClick={() => setAt(at ? null : (ref.current?.getBoundingClientRect() ?? null))}
      >
        <span className={styles.label}>{current}</span>
        <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {at && (
        <Menu
          at={at}
          owner={ref}
          onClose={() => setAt(null)}
          items={options.map(([v, label]) => ({ key: v, label, checked: v === value, onSelect: () => onChange(v) }))}
        />
      )}
    </>
  )
}
