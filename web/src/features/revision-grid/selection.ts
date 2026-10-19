export type GridSelection =
  | { kind: 'worktree' }
  | { kind: 'index' }
  | { kind: 'commit'; sha: string; parents: string[]; subject: string }
