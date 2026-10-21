import { loadSetting, saveSetting } from './storedSetting'

export const repoWindowOnDoubleClick = () => loadSetting('repoWindow', ['1', '0'] as const, '0') === '1'

export const setRepoWindowOnDoubleClick = (on: boolean) => saveSetting('repoWindow', on ? '1' : '0')

export function openRepoWindow(path: string) {
  window.open(`/?${new URLSearchParams({ open: path })}`, `browse-${path}`, 'popup,width=1400,height=900')
}
