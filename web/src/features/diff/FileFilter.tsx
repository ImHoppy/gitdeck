import { Icon } from '../../ui/Icon/Icon'
import { IconButton } from '../../ui/IconButton/IconButton'
import styles from './Diff.module.css'
import type { FileFilterState } from './useFileFilter'

export function FileFilter({ filter }: { filter: FileFilterState }) {
  return (
    <div className={styles.filterRow}>
      <input
        className={styles.fileFilter}
        placeholder={filter.searchCode ? 'Search changed code (regex)' : 'Filter files (regex)'}
        value={filter.query}
        onChange={(e) => filter.setQuery(e.target.value)}
      />
      <IconButton title="Search in the changed code" active={filter.searchCode} onClick={() => filter.setSearchCode(!filter.searchCode)}>
        <Icon name="code" size={14} />
      </IconButton>
    </div>
  )
}
