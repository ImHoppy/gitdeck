import { IconButton } from '../../ui/IconButton/IconButton'
import styles from './PullRequests.module.css'

type Props = { page: number; pages: number | null; hasNext: boolean; loading: boolean; onPage: (p: number) => void }

/** `‹ Prev  Page 2 of 5  Next ›` under the list; the count shows once the last page is known. */
export function PrPager({ page, pages, hasNext, loading, onPage }: Props) {
  if (page === 1 && !hasNext) return null
  return (
    <div className={styles.pager}>
      <IconButton title="Previous page" disabled={page === 1 || loading} onClick={() => onPage(page - 1)}>
        ‹ Prev
      </IconButton>
      <span>
        Page {page}
        {pages ? ` of ${pages}` : ''}
      </span>
      <IconButton title="Next page" disabled={!hasNext || loading} onClick={() => onPage(page + 1)}>
        Next ›
      </IconButton>
    </div>
  )
}
