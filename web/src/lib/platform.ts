/** The browser's OS, not gitd's host: window controls follow what the user's desktop does. */
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
