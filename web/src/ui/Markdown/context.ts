import { createContext, useContext } from 'react'
import type { MarkdownLinks } from './links'

export type MarkdownContext = MarkdownLinks & { openImage: (src: string, alt: string) => void }

export const MarkdownCtx = createContext<MarkdownContext>({ repo: null, image: () => null, openImage: () => {} })

export const useMarkdownCtx = () => useContext(MarkdownCtx)
