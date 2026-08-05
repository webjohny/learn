import type { Card, Grade } from '@/types'

const MIN_EF = 1.3
const HARD_MULTIPLIER = 1.2
const EASY_BONUS = 1.3
const MAX_INTERVAL = 365 * 2
/** Хвилини до повторного показу картки, яку забули. */
export const RELEARN_MINUTES = 10

/** SM-2 очікує оцінку 0..5 — мапимо наші чотири кнопки. */
const QUALITY: Record<Grade, number> = { 0: 0, 1: 3, 2: 4, 3: 5 }

export const MINUTE = 60_000
export const DAY = 86_400_000

function clampEF(ef: number) {
  return Math.max(MIN_EF, Math.min(3.2, Number(ef.toFixed(3))))
}

function nextEF(ef: number, q: number) {
  return clampEF(ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
}

/**
 * Рахує наступний інтервал у днях. `Again` повертає 0 — картка
 * повертається в поточну сесію через RELEARN_MINUTES.
 */
function nextInterval(card: Card, grade: Grade, ef: number): number {
  if (grade === 0) return 0

  // Картка ще не вивчена — короткі стартові кроки.
  if (card.repetition === 0) {
    return grade === 1 ? 1 : grade === 2 ? 1 : 3
  }
  if (card.repetition === 1) {
    return grade === 1 ? 3 : grade === 2 ? 6 : 8
  }

  const base = Math.max(1, card.interval)
  const raw =
    grade === 1 ? base * HARD_MULTIPLIER : grade === 2 ? base * ef : base * ef * EASY_BONUS

  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(raw)))
}

export interface ScheduleResult {
  card: Card
  /** true — картку треба повернути в чергу поточної сесії */
  requeue: boolean
}

export function schedule(card: Card, grade: Grade, now = new Date()): ScheduleResult {
  const q = QUALITY[grade]
  const ef = nextEF(card.efactor ?? 2.5, q)
  const interval = nextInterval(card, grade, ef)
  const failed = grade === 0

  const due = failed
    ? new Date(now.getTime() + RELEARN_MINUTES * MINUTE)
    : new Date(now.getTime() + interval * DAY)

  return {
    requeue: failed,
    card: {
      ...card,
      efactor: ef,
      interval,
      repetition: failed ? 0 : card.repetition + 1,
      lapses: (card.lapses ?? 0) + (failed ? 1 : 0),
      nextReview: due.toISOString(),
    },
  }
}

/** Підписи інтервалів під кнопками оцінки. */
export function previewIntervals(card: Card): Record<Grade, string> {
  const out = {} as Record<Grade, string>
  for (const g of [0, 1, 2, 3] as Grade[]) {
    const { card: next } = schedule(card, g)
    out[g] = g === 0 ? `${RELEARN_MINUTES} хв` : formatInterval(next.interval)
  }
  return out
}

export function formatInterval(days: number): string {
  if (days < 1) return '<1 д'
  if (days < 30) return `${Math.round(days)} д`
  if (days < 365) return `${(days / 30).toFixed(days < 60 ? 1 : 0)} міс`
  return `${(days / 365).toFixed(1)} р`
}

export function isDue(card: Card, now = Date.now()): boolean {
  if (card.suspended) return false
  if (!card.nextReview) return true
  return new Date(card.nextReview).getTime() <= now
}

export function isNew(card: Card): boolean {
  return card.repetition === 0 && !card.nextReview
}
