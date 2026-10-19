const PATHS = {
  commit: 'M1 8h4.5M10.5 8H15M8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  pull: 'M8 2v9M4.5 7.5 8 11l3.5-3.5M3 14h10',
  push: 'M8 14V5M4.5 8.5 8 5l3.5 3.5M3 2h10',
  fetch: 'M8 2v7M5 6l3 3 3-3M2.5 10.5v2.5h11v-2.5',
  sync: 'M13 6.5A5 5 0 0 0 3.6 5M3 9.5A5 5 0 0 0 12.4 11M13 2.5v4h-4M3 13.5v-4h4',
  stash: 'M2.5 5.5h11v8h-11zM1.5 3h13v2.5h-13zM6 8.5h4',
  branch: 'M5 2.5v11M5 10.5c0-3 6-2 6-6M11 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM5 11.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  tag: 'M2 2.5h5.5l6.5 6.5-5 5-7-6.5zM5 5.5h.01',
  folder: 'M1.5 3.5h4.5l1.5 1.5h7v8h-13z',
  terminal: 'M1.5 2.5h13v11h-13zM4 6l2.5 2L4 10M8 10.5h4',
  settings:
    'M8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3',
  refresh: 'M13.5 8A5.5 5.5 0 1 1 11.8 4M13.5 2v3.5H10',
  pin: 'M6 1.5h4M7 1.5v5l-3 3h8l-3-3v-5M8 9.5V15',
  copy: 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3',
  trash: 'M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4',
  merge: 'M4 2.5v11M4 5.5c0 4 8 3 8 8M4 2.5h.01M12 13.5h.01',
  checkout: 'M3 8.5 6.5 12 13 4.5',
  add: 'M8 3v10M3 8h10',
  close: 'M3.5 3.5l9 9M12.5 3.5l-9 9',
  history: 'M8 4.5V8l2.5 1.5M2 8a6 6 0 1 0 1.8-4.3M2 2v3h3',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      style={{ flex: 'none', verticalAlign: '-2px' }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
