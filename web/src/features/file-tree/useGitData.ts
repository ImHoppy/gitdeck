import { useEffect, useState } from 'react'
import { gitd } from '../../protocol/client'

/** Calls `method` once per distinct params; results at a commit never change, so they are kept. */
const cache = new Map<string, unknown>()

export function useGitData<T>(method: string, params: object | null) {
  const key = params && JSON.stringify([method, params])
  const [loaded, setLoaded] = useState<{ key: string; data: T | null; error: string | null } | null>(null)

  useEffect(() => {
    if (!key || cache.has(key)) return
    let live = true
    gitd.call<T>(method, params).then(
      (data) => {
        cache.set(key, data)
        if (live) setLoaded({ key, data, error: null })
      },
      (e: Error) => live && setLoaded({ key, data: null, error: e.message }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (key && cache.has(key)) return { data: cache.get(key) as T, error: null }
  return loaded?.key === key ? loaded : { data: null, error: null }
}
