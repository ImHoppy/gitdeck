import { useCallback, useSyncExternalStore } from 'react'

const CHANGE = 'gitdeck:navstate'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(CHANGE, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(CHANGE, onChange)
  }
}

const snapshot = () => history.state as Record<string, unknown> | null

function write(values: Record<string, unknown>, push: boolean) {
  const state = { ...snapshot(), ...values }
  if (push) history.pushState(state, '', location.href)
  else history.replaceState(state, '', location.href)
  window.dispatchEvent(new Event(CHANGE))
}

export const navPush = (key: string, value: unknown) => write({ [key]: value }, true)
export const navReplace = (key: string, value: unknown) => write({ [key]: value }, false)
/** Several keys in one history entry, so one Back restores them all (a jump to another repo's PR). */
export const navPushMany = (values: Record<string, unknown>) => write(values, true)
export const navBack = () => history.back()
export const navForward = () => history.forward()

export function useNavState<T>(key: string, initial: T): [T, (value: T) => void, (value: T) => void] {
  const state = useSyncExternalStore(subscribe, snapshot)
  const value = state && key in state ? (state[key] as T) : initial
  const push = useCallback((v: T) => navPush(key, v), [key])
  const replace = useCallback((v: T) => navReplace(key, v), [key])
  return [value, push, replace]
}
