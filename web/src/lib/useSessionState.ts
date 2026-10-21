import { useCallback, useState } from 'react'

const values = new Map<string, unknown>()

export function useSessionState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => (values.has(key) ? (values.get(key) as T) : initial))
  const set = useCallback(
    (v: T) => {
      values.set(key, v)
      setValue(v)
    },
    [key],
  )
  return [value, set]
}
