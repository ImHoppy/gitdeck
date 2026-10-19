import { useState } from 'react'
import { loadSetting, saveSetting } from '../../lib/storedSetting'
import type { PatchOptions } from '../../protocol/types'

export const CONTEXT_CHOICES = ['0', '3', '10', '25', '100000'] as const
export const DEFAULT_OPTIONS: PatchOptions = { context: 3, ignoreWhitespace: false }

const KEY_CONTEXT = 'gitdeck.diff.context'
const KEY_WS = 'gitdeck.diff.ignoreWhitespace'

export function useDiffOptions() {
  const [options, setOptionsState] = useState<PatchOptions>(() => ({
    context: Number(loadSetting(KEY_CONTEXT, CONTEXT_CHOICES, '3')),
    ignoreWhitespace: loadSetting(KEY_WS, ['true', 'false'], 'false') === 'true',
  }))

  const setOptions = (o: PatchOptions) => {
    saveSetting(KEY_CONTEXT, String(o.context))
    saveSetting(KEY_WS, String(o.ignoreWhitespace))
    setOptionsState(o)
  }

  const isDefault = options.context === DEFAULT_OPTIONS.context && !options.ignoreWhitespace
  return { options, setOptions, isDefault }
}
