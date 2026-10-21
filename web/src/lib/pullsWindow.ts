import { loadSetting, saveSetting } from './storedSetting'

/** Whether Ctrl+Shift+P, the toolbar and the PR pills open the PR view in a window of its own. */
export const pullsInWindow = () => loadSetting('pullsWindow', ['1', '0'] as const, '0') === '1'

export const setPullsInWindow = (on: boolean) => saveSetting('pullsWindow', on ? '1' : '0')
