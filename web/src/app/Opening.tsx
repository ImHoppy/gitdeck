import { Spinner } from '../ui/Spinner/Spinner'
import styles from './Opening.module.css'

export function Opening({ name }: { name: string | null }) {
  return (
    <div className={styles.opening}>
      <Spinner size={16} />
      <span>{name ? `Opening ${name}…` : 'Opening…'}</span>
    </div>
  )
}
