import { useCallback, useEffect, useState } from 'react'

import { useDeck } from '@/store/useDeck'

/** Тримає клас `dark` на <html> синхронно з налаштуваннями. */
export function useTheme() {
  const theme = useDeck((s) => s.settings.theme)
  const setSettings = useDeck((s) => s.setSettings)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0b0f17' : '#f6f7fb')
  }, [theme])

  const toggle = useCallback(
    () => setSettings({ theme: theme === 'dark' ? 'light' : 'dark' }),
    [setSettings, theme],
  )

  return { theme, toggle }
}

/** Коротка вібрація на мобільних — підтверджує свайп/оцінку. */
export function useHaptics() {
  const enabled = useDeck((s) => s.settings.hapticFeedback)

  return useCallback(
    (pattern: number | number[] = 12) => {
      if (!enabled || typeof navigator === 'undefined' || !navigator.vibrate) return
      navigator.vibrate(pattern)
    },
    [enabled],
  )
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** true на пристроях без точного вказівника — вмикає підказки про свайпи. */
export function useIsTouch(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)')
}
