import { useEffect } from 'react'

import { useDeck } from '@/store/useDeck'
import { useSession } from '@/store/useSession'

const INTERVAL_MS = 60_000
const DEBOUNCE_MS = 4_000

/**
 * Тримає колоду синхронізованою: підіймає сесію на старті, штовхає зміни
 * через паузу після правок і підхоплює серверні при поверненні у вкладку.
 */
export function useAutoSync() {
  const status = useSession((s) => s.status)
  const activeDeckId = useDeck((s) => s.activeDeckId)

  useEffect(() => {
    void useSession.getState().bootstrap()
  }, [])

  // Перемикання колоди — одразу підтягуємо її стан.
  useEffect(() => {
    if (status === 'authed') void useSession.getState().sync(activeDeckId)
  }, [status, activeDeckId])

  useEffect(() => {
    if (status !== 'authed') return

    const timer = window.setInterval(() => void useSession.getState().sync(), INTERVAL_MS)

    const onFocus = () => void useSession.getState().sync()
    const onOnline = () => void useSession.getState().sync()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [status])

  // Будь-яка зміна колоди планує відкладений push.
  useEffect(() => {
    if (status !== 'authed') return

    let timer: number | undefined
    const unsubscribe = useDeck.subscribe((state, previous) => {
      if (state.decks === previous.decks) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void useSession.getState().sync(), DEBOUNCE_MS)
    })

    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [status])
}
