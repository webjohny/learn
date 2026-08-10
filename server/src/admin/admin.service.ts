import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { isAdminEmail } from '../common/admin.js'
import { ERROR_CODES, withCode } from '../common/error-codes.js'
import { DatabaseService, nowISO } from '../database/database.service.js'
import { DecksService } from '../decks/decks.service.js'
import type {
  AdminDeckSummary,
  AdminGrantResult,
  AdminOverview,
  AdminTotals,
  AdminUserDetail,
  AdminUserSummary,
  DeckKind,
} from '../types.js'
import type { GrantCardsDto } from './dto.js'

const OVERVIEW_DAYS = 14
const USER_DAYS = 30
const RECENT_RUNS = 10

/** Активність по користувачу — однакові підзапити для списку й картки. */
const USER_COLUMNS = `
  u.id, u.email, u.display_name, u.created_at,
  (SELECT COUNT(*) FROM decks d
     WHERE d.user_id = u.id AND d.deleted_at IS NULL)                          AS decks,
  (SELECT COUNT(*) FROM cards c JOIN decks d ON d.id = c.deck_id
     WHERE d.user_id = u.id AND d.deleted_at IS NULL AND c.deleted_at IS NULL)  AS cards,
  (SELECT COALESCE(SUM(s.reviews), 0) FROM day_stats s JOIN decks d ON d.id = s.deck_id
     WHERE d.user_id = u.id)                                                    AS reviews,
  (SELECT COALESCE(SUM(s.correct), 0) FROM day_stats s JOIN decks d ON d.id = s.deck_id
     WHERE d.user_id = u.id)                                                    AS correct,
  (SELECT COALESCE(SUM(s.seconds), 0) FROM day_stats s JOIN decks d ON d.id = s.deck_id
     WHERE d.user_id = u.id)                                                    AS seconds,
  (SELECT COUNT(*) FROM quizzes q
     WHERE q.user_id = u.id AND q.deleted_at IS NULL)                           AS quizzes,
  (SELECT COUNT(*) FROM quiz_runs r WHERE r.user_id = u.id)                     AS quiz_runs,
  (SELECT MAX(s.date) FROM day_stats s JOIN decks d ON d.id = s.deck_id
     WHERE d.user_id = u.id AND s.reviews > 0)                                  AS last_active_date,
  (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id)             AS last_session_at
`

interface UserRow {
  id: string
  email: string
  display_name: string
  created_at: string
  decks: number
  cards: number
  reviews: number
  correct: number
  seconds: number
  quizzes: number
  quiz_runs: number
  last_active_date: string | null
  last_session_at: string | null
}

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly decks: DecksService,
  ) {}

  overview(): AdminOverview {
    const totals = this.database.get<AdminTotals>(`
      SELECT
        (SELECT COUNT(*) FROM users)                                        AS users,
        (SELECT COUNT(*) FROM decks WHERE deleted_at IS NULL)               AS decks,
        (SELECT COUNT(*) FROM cards c JOIN decks d ON d.id = c.deck_id
           WHERE c.deleted_at IS NULL AND d.deleted_at IS NULL)             AS cards,
        (SELECT COUNT(*) FROM quizzes WHERE deleted_at IS NULL)             AS quizzes,
        (SELECT COALESCE(SUM(reviews), 0) FROM day_stats)                   AS reviews,
        (SELECT COALESCE(SUM(correct), 0) FROM day_stats)                   AS correct,
        (SELECT COALESCE(SUM(seconds), 0) FROM day_stats)                   AS seconds
    `)!

    const today = dayKey()
    const weekAgo = shiftDay(today, -6)
    const since = shiftDay(today, -(OVERVIEW_DAYS - 1))

    const rows = this.database.all<{ date: string; reviews: number; users: number }>(
      `SELECT s.date AS date, SUM(s.reviews) AS reviews, COUNT(DISTINCT d.user_id) AS users
         FROM day_stats s JOIN decks d ON d.id = s.deck_id
        WHERE s.date >= ?
        GROUP BY s.date`,
      since,
    )
    const byDate = new Map(rows.map((row) => [row.date, row]))

    return {
      totals,
      activeToday: this.activeUsers(today),
      activeWeek: this.activeUsers(weekAgo),
      newUsersWeek:
        this.database.get<{ n: number }>(
          'SELECT COUNT(*) AS n FROM users WHERE created_at >= ?',
          `${weekAgo}T00:00:00.000Z`,
        )?.n ?? 0,
      daily: lastDays(OVERVIEW_DAYS).map((date) => ({
        date,
        reviews: byDate.get(date)?.reviews ?? 0,
        users: byDate.get(date)?.users ?? 0,
      })),
    }
  }

  users(): AdminUserSummary[] {
    return this.database
      .all<UserRow>(`SELECT ${USER_COLUMNS} FROM users u ORDER BY u.created_at DESC`)
      .map(toSummary)
  }

  detail(userId: string): AdminUserDetail {
    const user = this.requireUser(userId)
    const now = nowISO()

    const decks = this.database
      .all<{
        id: string
        name: string
        kind: DeckKind | null
        source_lang: string
        target_lang: string
        created_at: string
        cards: number
        due: number
      }>(
        `SELECT d.id, d.name, d.kind, d.source_lang, d.target_lang, d.created_at,
                (SELECT COUNT(*) FROM cards c
                   WHERE c.deck_id = d.id AND c.deleted_at IS NULL)          AS cards,
                (SELECT COUNT(*) FROM cards c
                   WHERE c.deck_id = d.id AND c.deleted_at IS NULL AND c.suspended = 0
                     AND (c.next_review IS NULL OR c.next_review <= ?))      AS due
           FROM decks d
          WHERE d.user_id = ? AND d.deleted_at IS NULL
          ORDER BY d.created_at`,
        now,
        userId,
      )
      .map(
        (row): AdminDeckSummary => ({
          id: row.id,
          name: row.name,
          kind: row.kind ?? 'language',
          sourceLang: row.source_lang || null,
          targetLang: row.target_lang || null,
          cards: row.cards,
          due: row.due,
          createdAt: row.created_at,
        }),
      )

    const since = shiftDay(dayKey(), -(USER_DAYS - 1))
    const stats = this.database.all<{
      date: string
      reviews: number
      correct: number
      seconds: number
    }>(
      `SELECT s.date AS date, SUM(s.reviews) AS reviews, SUM(s.correct) AS correct,
              SUM(s.seconds) AS seconds
         FROM day_stats s JOIN decks d ON d.id = s.deck_id
        WHERE d.user_id = ? AND s.date >= ?
        GROUP BY s.date`,
      userId,
      since,
    )
    const byDate = new Map(stats.map((row) => [row.date, row]))

    const recentRuns = this.database
      .all<{
        id: string
        quiz_id: string
        title: string | null
        finished_at: string
        score: number
        total: number
      }>(
        `SELECT r.id, r.quiz_id, q.title AS title, r.finished_at, r.score, r.total
           FROM quiz_runs r LEFT JOIN quizzes q ON q.id = r.quiz_id
          WHERE r.user_id = ?
          ORDER BY r.finished_at DESC
          LIMIT ${RECENT_RUNS}`,
        userId,
      )
      .map((row) => ({
        id: row.id,
        quizId: row.quiz_id,
        title: row.title,
        finishedAt: row.finished_at,
        score: row.score,
        total: row.total,
      }))

    return {
      user,
      decks,
      daily: lastDays(USER_DAYS).map((date) => ({
        date,
        reviews: byDate.get(date)?.reviews ?? 0,
        correct: byDate.get(date)?.correct ?? 0,
        seconds: byDate.get(date)?.seconds ?? 0,
      })),
      recentRuns,
    }
  }

  /**
   * Копіює картки з колоди адміна в колоду користувача. Саме копіює, а не
   * переносить: у джерела вони лишаються, а прогрес SM-2 у копій обнуляється —
   * отримувач починає з нуля. Отримувач побачить їх при найближчому pull.
   */
  grantCards(adminId: string, userId: string, dto: GrantCardsDto): AdminGrantResult {
    this.requireUser(userId)

    const source = this.decks.requireOwned(dto.fromDeckId, adminId)
    const target = dto.deckId
      ? this.decks.requireOwned(dto.deckId, userId)
      : this.decks.create(userId, {
          name: dto.newDeckName!.trim(),
          kind: source.kind,
          sourceLang: source.sourceLang ?? undefined,
          targetLang: source.targetLang ?? undefined,
        })

    const ids = dto.cardIds?.length ? dto.cardIds : null
    const rows = this.database.all<{
      category: string
      front: string
      back: string
      tags: string
      difficulty: string
      note: string | null
    }>(
      `SELECT category, front, back, tags, difficulty, note
         FROM cards
        WHERE deck_id = ? AND deleted_at IS NULL
          ${ids ? `AND id IN (${ids.map(() => '?').join(',')})` : ''}
        ORDER BY created_at`,
      source.id,
      ...(ids ?? []),
    )

    if (!rows.length) {
      throw new BadRequestException(withCode('Немає карток для передачі.', ERROR_CODES.adminNoCards))
    }

    // Дублі рахуємо за парою «питання + відповідь»: повторне надсилання тієї
    // самої підбірки не має плодити копій у колоді отримувача.
    const existing = new Set(
      this.database
        .all<{ front: string; back: string }>(
          'SELECT front, back FROM cards WHERE deck_id = ? AND deleted_at IS NULL',
          target.id,
        )
        .map((row) => dedupeKey(row.front, row.back)),
    )

    let added = 0
    let skipped = 0

    this.database.transaction(() => {
      const insert = this.database.prepare(`
        INSERT INTO cards (id, deck_id, category, front, back, tags, difficulty, note,
                           next_review, interval, repetition, efactor, lapses, suspended,
                           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, 2.5, 0, 0, ?, ?)
      `)

      for (const row of rows) {
        const key = dedupeKey(row.front, row.back)
        if (existing.has(key)) {
          skipped++
          continue
        }
        existing.add(key)

        const at = nowISO()
        insert.run(
          randomUUID(),
          target.id,
          row.category,
          row.front,
          row.back,
          row.tags,
          row.difficulty,
          row.note,
          at,
          at,
        )
        added++
      }
    })

    return { deck: target, added, skipped }
  }

  private activeUsers(sinceDate: string): number {
    return (
      this.database.get<{ n: number }>(
        `SELECT COUNT(DISTINCT d.user_id) AS n
           FROM day_stats s JOIN decks d ON d.id = s.deck_id
          WHERE s.date >= ? AND s.reviews > 0`,
        sinceDate,
      )?.n ?? 0
    )
  }

  private requireUser(userId: string): AdminUserSummary {
    const row = this.database.get<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`,
      userId,
    )
    if (!row) {
      throw new NotFoundException(
        withCode('Користувача не знайдено.', ERROR_CODES.adminUserNotFound),
      )
    }
    return toSummary(row)
  }
}

function toSummary(row: UserRow): AdminUserSummary {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    isAdmin: isAdminEmail(row.email),
    decks: row.decks,
    cards: row.cards,
    reviews: row.reviews,
    correct: row.correct,
    seconds: row.seconds,
    quizzes: row.quizzes,
    quizRuns: row.quiz_runs,
    lastActiveDate: row.last_active_date,
    lastSessionAt: row.last_session_at,
  }
}

/** Ключ дубля: розділювач — символ, якого в тексті картки не буває. */
function dedupeKey(front: string, back: string): string {
  return front + String.fromCharCode(0) + back
}

/** YYYY-MM-DD за годинником сервера — так само, як їх пише клієнт. */
function dayKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function shiftDay(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00`)
  date.setDate(date.getDate() + days)
  return dayKey(date)
}

function lastDays(count: number): string[] {
  const today = dayKey()
  return Array.from({ length: count }, (_, i) => shiftDay(today, i - count + 1))
}
