export type Marks = { set: ReadonlySet<number>; anchor: number | null }

export const NO_MARKS: Marks = { set: new Set(), anchor: null }

export type Mods = { ctrl: boolean; shift: boolean }

const range = (a: number, b: number) => {
  const s = new Set<number>()
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) s.add(i)
  return s
}

/** Explorer-style picking: click picks one, Ctrl toggles, Shift spans from the last plain/Ctrl click. */
export function nextMarks(marks: Marks, index: number, { ctrl, shift }: Mods): Marks {
  if (shift && marks.anchor !== null) {
    const span = range(marks.anchor, index)
    return { set: ctrl ? new Set([...marks.set, ...span]) : span, anchor: marks.anchor }
  }
  if (ctrl) {
    const set = new Set(marks.set)
    if (set.size === 0 && marks.anchor !== null) set.add(marks.anchor)
    if (!set.delete(index)) set.add(index)
    return { set, anchor: index }
  }
  return { set: new Set([index]), anchor: index }
}
