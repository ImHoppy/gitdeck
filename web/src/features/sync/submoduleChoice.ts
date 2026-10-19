import { loadSetting, saveSetting } from '../../lib/storedSetting'

export type SubmoduleChoice = 'ask' | 'always' | 'never'

const KEY = 'gitdeck.submoduleUpdate'

export const loadChoice = () => loadSetting<SubmoduleChoice>(KEY, ['ask', 'always', 'never'], 'ask')

export const saveChoice = (choice: SubmoduleChoice) => saveSetting(KEY, choice)
