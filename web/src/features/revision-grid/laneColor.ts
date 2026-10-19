const PALETTE = ['#e5484d', '#3e63dd', '#30a46c', '#f76b15', '#8e4ec6', '#12a594', '#d6409f', '#978365', '#0090ff', '#ab4aba']

export function laneColor(id: number): string {
  return PALETTE[id % PALETTE.length]
}
