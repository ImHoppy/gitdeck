import styles from './SettingsPage.module.css'

type Props = { sections: { id: string; title: string }[]; active: string | null; onPick: (id: string) => void }

export function SettingsNav({ sections, active, onPick }: Props) {
  return (
    <nav className={styles.nav}>
      {sections.map((s) => (
        <button key={s.id} className={s.id === active ? `${styles.navItem} ${styles.navActive}` : styles.navItem} onClick={() => onPick(s.id)}>
          {s.title}
        </button>
      ))}
    </nav>
  )
}
