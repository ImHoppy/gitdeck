import { useEffect, useState } from 'react'
import { loadSetting, saveSetting } from '../../lib/storedSetting'

export type Theme = 'auto' | 'light' | 'dark'

const KEY = 'gitdeck.theme'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => loadSetting<Theme>(KEY, ['auto', 'light', 'dark'], 'auto'))

  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [theme])

  const setTheme = (t: Theme) => {
    saveSetting(KEY, t)
    setThemeState(t)
  }

  return { theme, setTheme }
}
