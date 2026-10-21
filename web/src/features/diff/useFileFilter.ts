import { useCallback, useState } from 'react'
import type { ChangedFile } from '../../protocol/types'
import { useDebounced } from '../../lib/useDebounced'
import { useSessionState } from '../../lib/useSessionState'

export function useFileFilter(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery)
  const [searchCode, setSearchCode] = useSessionState('diff.searchCode', false)
  const code = useDebounced(searchCode && query.trim() ? query : undefined, 300)
  const apply = useCallback(
    (files: ChangedFile[] | null) => (searchCode ? files : filterFiles(files, query)),
    [searchCode, query],
  )
  return { query, setQuery, searchCode, setSearchCode, code, apply }
}

export type FileFilterState = ReturnType<typeof useFileFilter>

function filterFiles(files: ChangedFile[] | null, query: string): ChangedFile[] | null {
  if (!files || !query.trim()) return files
  let re: RegExp
  try {
    re = new RegExp(query, 'i')
  } catch {
    const q = query.toLowerCase()
    return files.filter((f) => f.path.toLowerCase().includes(q))
  }
  return files.filter((f) => re.test(f.path))
}
