export type Theme = 'light' | 'dark' | 'system'

const KEY = 'xpenses.theme'
const DEFAULT: Theme = 'dark'

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* private mode / storage disabled */
  }
  return DEFAULT
}

export function resolveTheme(t: Theme): 'light' | 'dark' {
  if (t === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return t
}

/** Sets data-theme on <html>; every `dark:` style keys off that attribute. */
export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = resolveTheme(t)
}

export function setStoredTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* ignore */
  }
  applyTheme(t)
}

/** Keeps a 'system' choice in step with the OS; returns an unsubscribe fn. */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  if (!mq) return () => {}
  const handler = () => {
    if (getStoredTheme() === 'system') applyTheme('system')
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
