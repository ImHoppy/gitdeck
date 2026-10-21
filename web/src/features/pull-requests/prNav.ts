export type PullsTab = 'conversation' | 'commits' | 'files' | 'checks'

/**
 * Where the PR view is, kept in browser history (`lib/navState`, key `pulls`): Back and Forward
 * walk through the PRs followed, a reload reopens the same PR and tab.
 */
export type PullsPlace = {
  /** The repo selector: a workspace repo path, `*` for all repos, null for the current repo. */
  repo: string | null
  pr: number | null
  /** `owner/name` of the shown PR when it isn't the selector's repo (all repos, another repo). */
  prRepo: string | null
  tab: PullsTab
  /** The head branch of a PR being created: the new-PR form is shown. */
  create: string | null
}

export const PULLS_KEY = 'pulls'

export const NO_PULLS: PullsPlace = { repo: null, pr: null, prRepo: null, tab: 'conversation', create: null }

export const ALL_REPOS = '*'
