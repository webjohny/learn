import { canonicalCategory } from './categories'
import type { Card, CardImport, Difficulty } from '@/types'

export const BACKUP_VERSION = 1

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((t) => asString(t).replace(/^#/, '').toLowerCase()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, '').toLowerCase())
      .filter(Boolean)
  }
  return []
}

function asISO(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

export function newId(): string {
  return crypto.randomUUID()
}

export function normalizeCard(raw: CardImport, id: string = newId()): Card {
  const difficulty = asString(raw.difficulty) as Difficulty
  return {
    id,
    // Старі назви з попередніх експортів зводимо до канонічних.
    category: canonicalCategory(asString(raw.category, 'Без категорії') || 'Без категорії'),
    front: asString(raw.front),
    back: asString(raw.back),
    tags: asTags(raw.tags),
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'medium',
    nextReview: asISO(raw.nextReview),
    interval: Math.max(0, asNumber(raw.interval, 0)),
    repetition: Math.max(0, Math.round(asNumber(raw.repetition, 0))),
    efactor: Math.min(3.2, Math.max(1.3, asNumber(raw.efactor, 2.5))),
    note: asString(raw.note) || undefined,
    lapses: Math.max(0, Math.round(asNumber(raw.lapses, 0))),
    createdAt: asISO(raw.createdAt) ?? new Date().toISOString(),
    suspended: raw.suspended === true,
    updatedAt: asISO(raw.updatedAt) ?? new Date().toISOString(),
    deletedAt: asISO(raw.deletedAt),
  }
}

export interface ParsedImport {
  cards: Card[]
  /** true — файл є повним бекапом додатка, а не просто масивом карток */
  isBackup: boolean
  raw: unknown
}

export class ImportError extends Error {}

/** Приймає масив карток або повний бекап `{ version, cards, ... }`. */
export function parseImport(text: string): ParsedImport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('Некоректний JSON — перевірте синтаксис файлу.')
  }

  const isBackup =
    typeof data === 'object' && data !== null && Array.isArray((data as { cards?: unknown }).cards)
  const list = isBackup ? (data as { cards: unknown[] }).cards : data

  if (!Array.isArray(list)) {
    throw new ImportError('Очікується масив карток або бекап з полем "cards".')
  }

  const cards: Card[] = []

  list.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) return
    const candidate = item as CardImport
    const front = asString(candidate.front)
    const back = asString(candidate.back)
    if (!front || !back) {
      throw new ImportError(`Картка #${index + 1}: потрібні непорожні поля "front" і "back".`)
    }
    // Імпортовані id завжди перевипускаємо: числа зі старих файлів
    // конфліктували б з UUID сервера.
    cards.push(normalizeCard(candidate))
  })

  if (!cards.length) throw new ImportError('У файлі не знайдено жодної картки.')
  return { cards, isBackup, raw: data }
}

/** Видаляє дублікати за парою front+back, лишаючи перший варіант. */
export function dedupe(cards: Card[]): Card[] {
  const seen = new Set<string>()
  return cards.filter((card) => {
    const key = `${card.front.toLowerCase()}|${card.back.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function download(filename: string, contents: string, type = 'application/json') {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
