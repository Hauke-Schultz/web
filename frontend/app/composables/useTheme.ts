type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

export function useTheme() {
  const theme = useState<Theme>('theme', () => 'dark')

  function applyTheme(value: Theme) {
    theme.value = value
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', value)
      localStorage.setItem(STORAGE_KEY, value)
    }
  }

  function toggle() {
    applyTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  function init() {
    if (!import.meta.client) return
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
    const systemTheme: Theme = prefersDark ? 'dark' : prefersLight ? 'light' : 'dark'
    applyTheme(stored ?? systemTheme)
  }

  return { theme, toggle, init }
}
