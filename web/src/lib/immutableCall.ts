import { gitd } from '../protocol/client'

const DB = 'gitdeck'
const STORE = 'immutable'

let db: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  db ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return db
}

async function get<T>(key: string): Promise<T | undefined> {
  const d = await open()
  if (!d) return undefined
  return new Promise((resolve) => {
    const req = d.transaction(STORE).objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => resolve(undefined)
  })
}

async function put(key: string, value: unknown) {
  const d = await open()
  try {
    d?.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key)
  } catch {
    // quota or private mode: the next visit asks the server again
  }
}

/** Repo ids are only discovery order; the commit ids in the params already pin the answer. */
export function immutableKey(method: string, params: object): string {
  return JSON.stringify([method, { ...params, id: undefined }])
}

/** For answers fixed by commit ids (bodies, trees, A..B diffs): served from IndexedDB after the first call. */
export async function immutableCall<T>(method: string, params: object): Promise<T> {
  const key = immutableKey(method, params)
  const hit = await get<T>(key)
  if (hit !== undefined) return hit
  const value = await gitd.call<T>(method, params)
  void put(key, value)
  return value
}
