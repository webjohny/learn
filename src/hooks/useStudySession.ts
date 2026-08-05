import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { dayKey } from '@/lib/date'
import { isDue, isNew } from '@/lib/sm2'
import { shuffle } from '@/lib/text'
import { useDeck } from '@/store/useDeck'
import { useCards, useDays, useStudyPool } from '@/store/selectors'
import type { Card, Grade, StudyMode } from '@/types'

/** Через скільки карток забута картка повертається в чергу. */
const REQUEUE_GAP = 3

export interface SessionStats {
  answered: number
  correct: number
  again: number
  startedAt: number
  elapsedMs: number
}

export interface StudySession {
  card: Card | undefined
  revealed: boolean
  reveal: () => void
  answer: (grade: Grade) => void
  skip: () => void
  restart: () => void
  finished: boolean
  /** Скільки карток лишилось у черзі, включно з поточною */
  remaining: number
  total: number
  progress: number
  stats: SessionStats
  /** Для Speed Review — мілісекунди до кінця сесії */
  timeLeftMs: number | null
}

function buildQueue(
  pool: Card[],
  mode: StudyMode,
  limits: { newLeft: number; reviewsLeft: number; speedSize: number },
): string[] {
  if (mode === 'speed') {
    // Тайм-атак: беремо будь-які картки, спершу ті, що вже знайомі.
    const known = shuffle(pool.filter((c) => !isNew(c)))
    const fresh = shuffle(pool.filter(isNew))
    return [...known, ...fresh].slice(0, limits.speedSize).map((c) => c.id)
  }

  const now = Date.now()
  const due = pool
    .filter((c) => !isNew(c) && isDue(c, now))
    .sort(
      (a, b) => new Date(a.nextReview ?? 0).getTime() - new Date(b.nextReview ?? 0).getTime(),
    )
  const fresh = pool.filter(isNew).slice(0, Math.max(0, limits.newLeft))

  // Перемішуємо нові між повтореннями, щоб сесія не була монотонною.
  const merged: Card[] = []
  const step = fresh.length ? Math.max(1, Math.ceil(due.length / (fresh.length + 1))) : 0
  let freshIndex = 0

  due.forEach((card, i) => {
    merged.push(card)
    if (step && (i + 1) % step === 0 && freshIndex < fresh.length) merged.push(fresh[freshIndex++])
  })
  while (freshIndex < fresh.length) merged.push(fresh[freshIndex++])

  return merged.slice(0, Math.max(0, limits.reviewsLeft)).map((c) => c.id)
}

export function useStudySession(mode: StudyMode): StudySession {
  const pool = useStudyPool()
  const cards = useCards()
  const days = useDays()
  const settings = useDeck((s) => s.settings)
  const rate = useDeck((s) => s.rate)
  const activeDeckId = useDeck((s) => s.activeDeckId)
  const todayStat = days[dayKey()]

  // Черга будується один раз на сесію — свіжі дані беремо з `cards` за id.
  const poolRef = useRef(pool)
  poolRef.current = pool
  const limitsRef = useRef({ newLeft: 0, reviewsLeft: 0, speedSize: 0 })
  limitsRef.current = {
    newLeft: settings.newPerDay - (todayStat?.newCards ?? 0),
    reviewsLeft: settings.reviewsPerDay - (todayStat?.reviews ?? 0),
    speedSize: settings.speedSessionSize,
  }

  const [queue, setQueue] = useState<string[]>(() =>
    buildQueue(poolRef.current, mode, limitsRef.current),
  )
  const [total, setTotal] = useState(queue.length)
  const [revealed, setRevealed] = useState(false)
  const [stats, setStats] = useState<SessionStats>(() => ({
    answered: 0,
    correct: 0,
    again: 0,
    startedAt: Date.now(),
    elapsedMs: 0,
  }))
  const [expiresAt, setExpiresAt] = useState<number | null>(() =>
    mode === 'speed' ? Date.now() + settings.speedSessionSeconds * 1000 : null,
  )
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(
    mode === 'speed' ? settings.speedSessionSeconds * 1000 : null,
  )

  const shownAtRef = useRef(Date.now())

  const restart = useCallback(() => {
    const next = buildQueue(poolRef.current, mode, limitsRef.current)
    setQueue(next)
    setTotal(next.length)
    setRevealed(false)
    setStats({ answered: 0, correct: 0, again: 0, startedAt: Date.now(), elapsedMs: 0 })
    setExpiresAt(mode === 'speed' ? Date.now() + settings.speedSessionSeconds * 1000 : null)
    setTimeLeftMs(mode === 'speed' ? settings.speedSessionSeconds * 1000 : null)
    shownAtRef.current = Date.now()
  }, [mode, settings.speedSessionSeconds])

  // Зміна режиму або колоди = нова сесія.
  useEffect(() => {
    restart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeDeckId])

  // Таймер Speed Review.
  useEffect(() => {
    if (expiresAt === null) return
    const tick = () => setTimeLeftMs(Math.max(0, expiresAt - Date.now()))
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [expiresAt])

  const timeUp = timeLeftMs !== null && timeLeftMs <= 0
  const currentId = timeUp ? undefined : queue[0]
  const card = useMemo(() => cards.find((c) => c.id === currentId), [cards, currentId])

  useEffect(() => {
    shownAtRef.current = Date.now()
    setRevealed(false)
  }, [currentId])

  const reveal = useCallback(() => setRevealed(true), [])

  const advance = useCallback((requeueId?: string) => {
    setQueue((prev) => {
      const [, ...rest] = prev
      if (requeueId === undefined) return rest
      const at = Math.min(REQUEUE_GAP, rest.length)
      return [...rest.slice(0, at), requeueId, ...rest.slice(at)]
    })
  }, [])

  const answer = useCallback(
    (grade: Grade) => {
      if (!card) return
      const ms = Date.now() - shownAtRef.current
      rate(card.id, grade, ms, mode)

      setStats((s) => ({
        ...s,
        answered: s.answered + 1,
        correct: s.correct + (grade > 0 ? 1 : 0),
        again: s.again + (grade === 0 ? 1 : 0),
        elapsedMs: Date.now() - s.startedAt,
      }))

      // У Speed Review не ганяємо картку по колу — сесія коротка.
      advance(grade === 0 && mode !== 'speed' ? card.id : undefined)
    },
    [advance, card, mode, rate],
  )

  const skip = useCallback(() => advance(), [advance])

  return {
    card,
    revealed,
    reveal,
    answer,
    skip,
    restart,
    finished: !card,
    remaining: queue.length,
    total,
    progress: total ? Math.min(1, (total - queue.length) / total) : 0,
    stats,
    timeLeftMs,
  }
}
