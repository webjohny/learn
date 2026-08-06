import { useMemo } from 'react'

import type { DeckKind } from '@/lib/api'
import { calcStreak, dayKey } from '@/lib/date'
import { isDue, isNew } from '@/lib/sm2'
import type { Card, DayStat, ReviewLogEntry } from '@/types'
import { emptyDeckData, useDeck, type DeckData } from './useDeck'
import { useSession } from './useSession'

/** Дані активної колоди. Видалені картки сюди не потрапляють. */
export function useDeckData(): DeckData {
  const activeDeckId = useDeck((s) => s.activeDeckId)
  const decks = useDeck((s) => s.decks)
  return decks[activeDeckId] ?? emptyDeckData()
}

export interface DeckProfile {
  kind: DeckKind
  /** Мовна пара: доступні TTS, зворотний напрям і режим «Друк». */
  isLanguage: boolean
  /** Мова питання; для предметної колоди — мова інтерфейсу. */
  sourceLang: string
  /** Мова відповіді (голос TTS). */
  targetLang: string
}

/**
 * Тип активної колоди. Гість працює з локальною колодою без метаданих —
 * для нього це мовна пара 🇺🇦 → 🇺🇸, як і було до появи предметних колод.
 */
export function useDeckProfile(): DeckProfile {
  // Підписуємось на обидва стори: id активної колоди живе в useDeck,
  // а її метадані — в useSession.
  const activeDeckId = useDeck((s) => s.activeDeckId)
  const decks = useSession((s) => s.decks)
  const meta = decks.find((d) => d.id === activeDeckId) ?? null
  const kind = meta?.kind ?? 'language'
  return useMemo(
    () => ({
      kind,
      isLanguage: kind === 'language',
      sourceLang: meta?.sourceLang ?? 'uk',
      targetLang: meta?.targetLang ?? 'en-US',
    }),
    [kind, meta?.sourceLang, meta?.targetLang],
  )
}

export function useCards(): Card[] {
  const data = useDeckData()
  return useMemo(() => data.cards.filter((c) => !c.deletedAt), [data.cards])
}

export function useDays(): Record<string, DayStat> {
  return useDeckData().days
}

export function useLog(): ReviewLogEntry[] {
  return useDeckData().log
}

export function matchesFilters(card: Card, categories: string[], tags: string[]): boolean {
  if (categories.length && !categories.includes(card.category)) return false
  if (tags.length && !card.tags.some((t) => tags.includes(t))) return false
  return true
}

/** Картки, що пройшли фільтри категорій/тегів і не призупинені. */
export function useStudyPool(): Card[] {
  const cards = useCards()
  const { activeCategories, activeTags } = useDeckData()

  return useMemo(
    () => cards.filter((c) => !c.suspended && matchesFilters(c, activeCategories, activeTags)),
    [cards, activeCategories, activeTags],
  )
}

export interface DeckCounts {
  due: number
  fresh: number
  learning: number
  total: number
  /** Скільки реально буде показано з урахуванням денних лімітів */
  queued: number
}

export function useCounts(): DeckCounts {
  const pool = useStudyPool()
  const settings = useDeck((s) => s.settings)
  const days = useDays()
  const today = days[dayKey()]

  return useMemo(() => {
    const now = Date.now()
    const fresh = pool.filter(isNew)
    const due = pool.filter((c) => !isNew(c) && isDue(c, now))
    const learning = pool.filter((c) => c.repetition > 0 && c.interval < 7)

    const newLeft = Math.max(0, settings.newPerDay - (today?.newCards ?? 0))
    const reviewsLeft = Math.max(0, settings.reviewsPerDay - (today?.reviews ?? 0))
    const queued = Math.min(reviewsLeft, due.length + Math.min(fresh.length, newLeft))

    return {
      due: due.length,
      fresh: fresh.length,
      learning: learning.length,
      total: pool.length,
      queued,
    }
  }, [pool, settings.newPerDay, settings.reviewsPerDay, today])
}

export interface TodayStats {
  reviews: number
  correct: number
  seconds: number
  accuracy: number
  streak: number
  goalDone: boolean
}

export function useToday(): TodayStats {
  const days = useDays()

  return useMemo(() => {
    const today = days[dayKey()]
    const active = new Set(
      Object.values(days)
        .filter((d) => d.reviews > 0)
        .map((d) => d.date),
    )
    const reviews = today?.reviews ?? 0

    return {
      reviews,
      correct: today?.correct ?? 0,
      seconds: today?.seconds ?? 0,
      accuracy: reviews ? Math.round(((today?.correct ?? 0) / reviews) * 100) : 0,
      streak: calcStreak(active),
      goalDone: reviews >= 20,
    }
  }, [days])
}

export function useCategories(): string[] {
  const cards = useCards()
  return useMemo(
    () => [...new Set(cards.map((c) => c.category))].sort((a, b) => a.localeCompare(b, 'uk')),
    [cards],
  )
}

export function useTags(): string[] {
  const cards = useCards()
  return useMemo(() => [...new Set(cards.flatMap((c) => c.tags))].sort(), [cards])
}

/** Розподіл карток за стадією — для екрана статистики. */
export function useMaturity() {
  const cards = useCards()
  return useMemo(() => {
    let fresh = 0
    let young = 0
    let mature = 0
    for (const card of cards) {
      if (isNew(card)) fresh++
      else if (card.interval < 21) young++
      else mature++
    }
    return { fresh, young, mature, total: cards.length }
  }, [cards])
}
