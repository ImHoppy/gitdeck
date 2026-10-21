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
    'M13.0 7.0L14.7 7.4L14.7 8.6L13.0 9.0L12.2 10.8L13.2 12.3L12.3 13.2L10.8 12.2L9.0 13.0L8.6 14.7L7.4 14.7L7.0 13.0L5.2 12.2L3.7 13.2L2.8 12.3L3.8 10.8L3.0 9.0L1.3 8.6L1.3 7.4L3.0 7.0L3.8 5.2L2.8 3.7L3.7 2.8L5.2 3.8L7.0 3.0L7.4 1.3L8.6 1.3L9.0 3.0L10.8 3.8L12.3 2.8L13.2 3.7L12.2 5.2zM8 5.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z',
  refresh: 'M13.5 8A5.5 5.5 0 1 1 11.8 4M13.5 2v3.5H10',
  pin: 'M6 1.5h4M7 1.5v5l-3 3h8l-3-3v-5M8 9.5V15',
  copy: 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3',
  restore: 'M5.5 2.5 2.5 5.5l3 3M2.5 5.5h7a4 4 0 0 1 0 8H6',
  trash: 'M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4',
  merge: 'M4 2.5v11M4 5.5c0 4 8 3 8 8M4 2.5h.01M12 13.5h.01',
  checkout: 'M3 8.5 6.5 12 13 4.5',
  add: 'M8 3v10M3 8h10',
  close: 'M3.5 3.5l9 9M12.5 3.5l-9 9',
  repo: 'M3.5 1.5h9v11h-9zM3.5 12.5v2.5l1.5-1 1.5 1v-2.5M3.5 10.5h9M6 4h4',
  popout: 'M9 2.5h4.5V7M13.5 2.5 7.5 8.5M11.5 9.5v4h-9v-9h4',
  alert: 'M8 1.5 15 14H1zM8 6v4M8 12h.01',
  info: 'M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM8 7v4.5M8 4.8h.01',
  search: 'M7 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM10.3 10.3 14 14',
  code: 'M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5M9 3l-2 10',
  chart: 'M2 13.5h12M4 11V8M7 11V4M10 11V6.5M13 11V9',
  tree: 'M2.5 2.5h4M4.5 2.5v9h3M4.5 6.5h3M9.5 5.5h4v2h-4zM9.5 10.5h4v2h-4z',
  list: 'M2 4h12M2 8h12M2 12h12',
  file: 'M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3',
  editor: 'M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5M9 2.5 7 13.5',
  diff: 'M4.5 2v6M1.5 5h6M8.5 11h6M5 14 11 2',
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
      style={{ flex: 'none', display: 'block' }}
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
