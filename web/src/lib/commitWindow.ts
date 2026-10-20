import { loadSetting, saveSetting } from './storedSetting'

/** Whether the commit page always opens in its own window instead of over the repo view. */
export const commitInWindow = () => loadSetting('commitWindow', ['1', '0'] as const, '0') === '1'

export const setCommitInWindow = (on: boolean) => saveSetting('commitWindow', on ? '1' : '0')
