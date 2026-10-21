import type { Nodes } from 'mdast'

/** Raw HTML from an allow-listed tag, rebuilt as a node so it renders as React elements. */
export type HtmlElement = { type: 'htmlElement'; tag: string; attrs: Record<string, string>; children: MdNode[] }

/** `#12`, `GH-12`, `owner/repo#12` or a PR/issue URL; `repo` is null for this repo. */
export type GhRef = { type: 'ghRef'; repo: string | null; number: number; text: string }

/** A commit SHA, or `owner/repo@sha`. */
export type GhCommit = { type: 'ghCommit'; repo: string | null; sha: string; text: string }

export type Mention = { type: 'mention'; login: string }

export type MdNode = Nodes | HtmlElement | GhRef | GhCommit | Mention

export type MdParent = { type: string; children: MdNode[] }

export const hasChildren = (n: MdNode): n is MdNode & MdParent => Array.isArray((n as { children?: unknown }).children)
