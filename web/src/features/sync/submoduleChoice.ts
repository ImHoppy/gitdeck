export type SubmoduleChoice = 'ask' | 'always' | 'never'

const KEY = 'gitdeck.submoduleUpdate'

export function loadChoice(): SubmoduleChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'always' || v === 'never' ? v : 'ask'
  } catch {
    return 'ask'
  }
}

export function saveChoice(choice: SubmoduleChoice) {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}
