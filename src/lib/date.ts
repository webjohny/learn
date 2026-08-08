// units-i18n: одиниці беруть поточну мову інтерфейсу
import { translateUnits as u } from '@/lib/i18n/units'
/** Локальний ключ дня — YYYY-MM-DD (не UTC, щоб серія рахувалась за місцевим часом). */
export function dayKey(d: Date | number | string = new Date()): string {
  const date = d instanceof Date ? d : new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return dayKey(date)
}

/** Кількість днів поспіль із практикою, рахуючи назад від сьогодні (або вчора). */
export function calcStreak(activeDays: Set<string>, today = dayKey()): number {
  let cursor = activeDays.has(today) ? today : shiftDay(today, -1)
  if (!activeDays.has(cursor)) return 0

  let streak = 0
  while (activeDays.has(cursor)) {
    streak++
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

export function lastNDays(n: number, today = dayKey()): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(today, -(n - 1 - i)))
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} ${u('units.sec')}`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} ${u('units.min')}`
  const h = Math.floor(m / 60)
  return `${h} ${u('units.hour')} ${m % 60} ${u('units.min')}`
}

export function formatRelative(iso: string | null): string {
  if (!iso) return u('date.newCard')
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return u('date.now')
  const mins = Math.round(diff / 60000)
  if (mins < 60) return u('date.in', { value: `${mins} ${u('units.min')}` })
  const hours = Math.round(mins / 60)
  if (hours < 24) return u('date.in', { value: `${hours} ${u('units.hour')}` })
  const days = Math.round(hours / 24)
  if (days < 30) return u('date.in', { value: `${days} ${u('units.day')}` })
  return u('date.in', { value: `${Math.round(days / 30)} ${u('units.month')}` })
}
