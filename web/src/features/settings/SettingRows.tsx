import type { ReactNode } from 'react'
import { Select } from '../../ui/Select/Select'
import styles from './SettingsPage.module.css'

export type Choice<T extends string> = { value: T; options: [T, string][]; onChange: (v: T) => void }

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.row}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function ChoiceSelect<T extends string>({ choice }: { choice: Choice<T> }) {
  return <Select value={choice.value} options={choice.options} onChange={choice.onChange} />
}
