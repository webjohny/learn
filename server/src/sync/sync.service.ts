import { Injectable } from '@nestjs/common'

import { DatabaseService, nowISO } from '../database/database.service.js'
import { DecksService } from '../decks/decks.service.js'
import type { SyncCard, SyncDayStat, SyncPullResponse } from '../types.js'
import type { SyncPushDto } from './dto.js'

const EPOCH = '1970-01-01T00:00:00.000Z'

interface CardRow {
  id: string
  deck_id: string
  category: string
  front: string
  back: string
  tags: string
  difficulty: string
  note: string | null
  next_review: string | null
  interval: number
  repetition: number
  efactor: number
  lapses: number
  suspended: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface DayRow {
  deck_id: string
  date: string
  reviews: number
  correct: number
  seconds: number
  new_cards: number
  updated_at: string
}

export interface PushResult {
  serverTime: string
  appliedCards: number
  skippedCards: number
  appliedDays: number
}

@Injectable()
export class SyncService {
  constructor(
    private readonly database: DatabaseService,
    private readonly decks: DecksService,
  ) {}

  /** Усе, що змінилося на сервері після `since`. */
  pull(userId: string, deckId: string, since = EPOCH): SyncPullResponse {
    const deck = this.decks.requireOwned(deckId, userId)

    const cards = this.database
      .all<CardRow>(
        'SELECT * FROM cards WHERE deck_id = ? AND updated_at > ? ORDER BY updated_at',
        deck.id,
        since,
      )
      .map(toCard)

    const days = this.database
      .all<DayRow>(
        'SELECT * FROM day_stats WHERE deck_id = ? AND updated_at > ? ORDER BY updated_at',
        deck.id,
        since,
      )
      .map(toDay)

    return { serverTime: nowISO(), cards, days }
  }

  /**
   * Картки зливаються за last-write-wins (`updatedAt`); денна статистика —
   * за максимумом лічильників, бо вони лише зростають і два пристрої за один
   * день не мають затирати одне одного.
   */
  push(userId: string, deckId: string, dto: SyncPushDto): PushResult {
    const deck = this.decks.requireOwned(deckId, userId)
    const cards = dto.cards ?? []
    const days = dto.days ?? []

    let appliedCards = 0
    let skippedCards = 0

    this.database.transaction(() => {
      const selectCard = this.database.prepare('SELECT updated_at, deck_id FROM cards WHERE id = ?')
      const upsertCard = this.database.prepare(`
        INSERT INTO cards (id, deck_id, category, front, back, tags, difficulty, note, next_review,
                           interval, repetition, efactor, lapses, suspended,
                           created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category = excluded.category, front = excluded.front, back = excluded.back,
          tags = excluded.tags, difficulty = excluded.difficulty, note = excluded.note,
          next_review = excluded.next_review, interval = excluded.interval,
          repetition = excluded.repetition, efactor = excluded.efactor,
          lapses = excluded.lapses, suspended = excluded.suspended,
          updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      `)
      const upsertDay = this.database.prepare(`
        INSERT INTO day_stats (deck_id, date, reviews, correct, seconds, new_cards, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(deck_id, date) DO UPDATE SET
          reviews    = MAX(day_stats.reviews,   excluded.reviews),
          correct    = MAX(day_stats.correct,   excluded.correct),
          seconds    = MAX(day_stats.seconds,   excluded.seconds),
          new_cards  = MAX(day_stats.new_cards, excluded.new_cards),
          updated_at = excluded.updated_at
      `)

      for (const card of cards) {
        const existing = selectCard.get(card.id) as
          | { updated_at: string; deck_id: string }
          | undefined

        // id зайнятий карткою з іншої колоди — не перетягуємо її сюди.
        if (existing && existing.deck_id !== deck.id) {
          skippedCards++
          continue
        }

        // Серверна версія свіжіша або така сама — локальна програє.
        if (existing && existing.updated_at >= card.updatedAt) {
          skippedCards++
          continue
        }

        upsertCard.run(
          card.id,
          deck.id,
          card.category ?? 'Без категорії',
          card.front,
          card.back,
          JSON.stringify(card.tags ?? []),
          card.difficulty ?? 'medium',
          card.note ?? null,
          card.nextReview ?? null,
          card.interval ?? 0,
          Math.round(card.repetition ?? 0),
          card.efactor ?? 2.5,
          Math.round(card.lapses ?? 0),
          card.suspended ? 1 : 0,
          card.createdAt ?? card.updatedAt,
          card.updatedAt,
          card.deletedAt ?? null,
        )
        appliedCards++
      }

      for (const day of days) {
        upsertDay.run(
          deck.id,
          day.date,
          Math.round(day.reviews),
          Math.round(day.correct),
          day.seconds,
          Math.round(day.newCards),
          day.updatedAt,
        )
      }
    })

    return { serverTime: nowISO(), appliedCards, skippedCards, appliedDays: days.length }
  }
}

function toCard(row: CardRow): SyncCard {
  return {
    id: row.id,
    deckId: row.deck_id,
    category: row.category,
    front: row.front,
    back: row.back,
    tags: JSON.parse(row.tags) as string[],
    difficulty: row.difficulty as SyncCard['difficulty'],
    note: row.note,
    nextReview: row.next_review,
    interval: row.interval,
    repetition: row.repetition,
    efactor: row.efactor,
    lapses: row.lapses,
    suspended: row.suspended === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

function toDay(row: DayRow): SyncDayStat {
  return {
    deckId: row.deck_id,
    date: row.date,
    reviews: row.reviews,
    correct: row.correct,
    seconds: row.seconds,
    newCards: row.new_cards,
    updatedAt: row.updated_at,
  }
}
