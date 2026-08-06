import { Injectable } from '@nestjs/common'

import { DatabaseService, nowISO } from '../database/database.service.js'
import type { QuizPushDto } from './dto.js'
import type {
  QuizPullResponse,
  QuizPushResult,
  QuizQuestion,
  SyncQuiz,
  SyncQuizRun,
} from './quiz.types.js'

const EPOCH = '1970-01-01T00:00:00.000Z'

interface QuizRow {
  id: string
  user_id: string
  title: string
  description: string | null
  mode: string
  questions: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface QuizRunRow {
  id: string
  user_id: string
  quiz_id: string
  finished_at: string
  score: number
  total: number
  updated_at: string
}

@Injectable()
export class QuizService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Скоуп — акаунт: власності перевіряти окремо не треба, фільтр по `user_id`
   * у кожному запиті і є перевіркою. Колода тут ні до чого.
   */
  pull(userId: string, since = EPOCH): QuizPullResponse {
    const quizzes = this.database
      .all<QuizRow>(
        'SELECT * FROM quizzes WHERE user_id = ? AND updated_at > ? ORDER BY updated_at',
        userId,
        since,
      )
      .map(toQuiz)

    const runs = this.database
      .all<QuizRunRow>(
        'SELECT * FROM quiz_runs WHERE user_id = ? AND updated_at > ? ORDER BY updated_at',
        userId,
        since,
      )
      .map(toRun)

    return { serverTime: nowISO(), quizzes, runs }
  }

  /**
   * Вікторини зливаються за last-write-wins (`updatedAt`) — як картки.
   * Прогони незмінні після завершення, тож повторний push того самого id
   * просто ігнорується, без порівняння версій.
   */
  push(userId: string, dto: QuizPushDto): QuizPushResult {
    const quizzes = dto.quizzes ?? []
    const runs = dto.runs ?? []

    let appliedQuizzes = 0
    let skippedQuizzes = 0
    let appliedRuns = 0

    this.database.transaction(() => {
      const selectQuiz = this.database.prepare(
        'SELECT updated_at, user_id FROM quizzes WHERE id = ?',
      )
      const upsertQuiz = this.database.prepare(`
        INSERT INTO quizzes (id, user_id, title, description, mode, questions,
                             created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title, description = excluded.description,
          mode = excluded.mode, questions = excluded.questions,
          updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      `)
      const insertRun = this.database.prepare(`
        INSERT INTO quiz_runs (id, user_id, quiz_id, finished_at, score, total, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `)

      for (const quiz of quizzes) {
        const existing = selectQuiz.get(quiz.id) as
          | { updated_at: string; user_id: string }
          | undefined

        // id зайнятий вікториною іншого користувача — не перетягуємо її сюди.
        if (existing && existing.user_id !== userId) {
          skippedQuizzes++
          continue
        }

        // Серверна версія свіжіша або така сама — локальна програє.
        if (existing && existing.updated_at >= quiz.updatedAt) {
          skippedQuizzes++
          continue
        }

        upsertQuiz.run(
          quiz.id,
          userId,
          quiz.title,
          quiz.description ?? null,
          quiz.mode,
          JSON.stringify(quiz.questions ?? []),
          quiz.createdAt ?? quiz.updatedAt,
          quiz.updatedAt,
          quiz.deletedAt ?? null,
        )
        appliedQuizzes++
      }

      for (const run of runs) {
        const result = insertRun.run(
          run.id,
          userId,
          run.quizId,
          run.finishedAt,
          Math.round(run.score),
          Math.round(run.total),
          nowISO(),
        )
        if (result.changes > 0) appliedRuns++
      }
    })

    return { serverTime: nowISO(), appliedQuizzes, skippedQuizzes, appliedRuns }
  }
}

function toQuiz(row: QuizRow): SyncQuiz {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    mode: row.mode as SyncQuiz['mode'],
    questions: parseQuestions(row.questions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

/** Битий JSON у колонці не має ронити пул усіх вікторин. */
function parseQuestions(raw: string): QuizQuestion[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QuizQuestion[]) : []
  } catch {
    return []
  }
}

function toRun(row: QuizRunRow): SyncQuizRun {
  return {
    id: row.id,
    quizId: row.quiz_id,
    finishedAt: row.finished_at,
    score: row.score,
    total: row.total,
  }
}
