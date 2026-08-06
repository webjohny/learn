import { useEffect } from 'react'

import { useDeck } from '@/store/useDeck'
import { useQuizzes } from '@/store/useQuizzes'
import { useSession } from '@/store/useSession'

const INTERVAL_MS = 60_000
const DEBOUNCE_MS = 4_000

/** Помилку синку вікторин ковтаємо: колоди від неї страждати не мають. */
function syncQuizzes() {
  void useQuizzes.getState().sync().catch(() => {})
}

function syncAll() {
  void useSession.getState().sync()
  syncQuizzes()
}

/**
 * Тримає колоду синхронізованою: підіймає сесію на старті, штовхає зміни
 * через паузу після правок і підхоплює серверні при поверненні у вкладку.
 * Вікторини їдуть тими самими тригерами, але окремим контуром.
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

  // Вхід у акаунт — підтягуємо вікторини, які гість вів локально.
  useEffect(() => {
    if (status === 'authed') syncQuizzes()
  }, [status])

  useEffect(() => {
    if (status !== 'authed') return

    const timer = window.setInterval(syncAll, INTERVAL_MS)

    window.addEventListener('focus', syncAll)
    window.addEventListener('online', syncAll)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', syncAll)
      window.removeEventListener('online', syncAll)
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

  // Те саме для вікторин — окрема підписка, щоб контури не перепліталися.
  useEffect(() => {
    if (status !== 'authed') return

    let timer: number | undefined
    const unsubscribe = useQuizzes.subscribe((state, previous) => {
      if (state.quizzes === previous.quizzes && state.runs === previous.runs) return
      window.clearTimeout(timer)
      timer = window.setTimeout(syncQuizzes, DEBOUNCE_MS)
    })

    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [status])
}
