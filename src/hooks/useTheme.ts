import { useEffect, useState } from 'react'
import { getStoredTheme, setStoredTheme, type Theme, watchSystemTheme } from '../lib/theme'

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  useEffect(() => watchSystemTheme(), [])

  return [
    theme,
    (t: Theme) => {
      setStoredTheme(t)
      setTheme(t)
    },
  ]
}
