import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { quizApi } from '@/lib/api'
import { newId } from '@/lib/deck'
import type { Quiz, QuizQuestion, QuizRun } from '@/lib/quizTypes'

/** Скільки прогонів тримати локально на одну вікторину (D21). */
const RUNS_PER_QUIZ = 200

interface QuizState {
  quizzes: Quiz[]
  runs: QuizRun[]
  lastSyncAt: string | null

  createQuiz: (title: string, mode: Quiz['mode']) => Quiz
  updateQuiz: (id: string, patch: Partial<Omit<Quiz, 'id' | 'createdAt'>>) => void
  deleteQuiz: (id: string) => void
  addQuizzes: (incoming: Quiz[]) => number
  recordRun: (quizId: string, score: number, total: number) => void

  /** Живі вікторини — без м'яко видалених. */
  visibleQuizzes: () => Quiz[]
  runsFor: (quizId: string) => QuizRun[]
  /** Чистить локальні дані при виході — вікторини належать акаунту. */
  forgetAccountData: () => void

  sync: () => Promise<void>
}

function touch(quiz: Quiz): Quiz {
  return { ...quiz, updatedAt: new Date().toISOString() }
}

export const useQuizzes = create<QuizState>()(
  persist(
    (set, get) => ({
      quizzes: [],
      runs: [],
      lastSyncAt: null,

      createQuiz: (title, mode) => {
        const now = new Date().toISOString()
        const quiz: Quiz = {
          id: newId(),
          title,
          description: null,
          mode,
          questions: [],
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }
        set((state) => ({ quizzes: [...state.quizzes, quiz] }))
        return quiz
      },

      updateQuiz: (id, patch) =>
        set((state) => ({
          quizzes: state.quizzes.map((q) => (q.id === id ? touch({ ...q, ...patch }) : q)),
        })),

      // М'яке видалення: запис має доїхати до сервера, інакше повернеться з pull.
      deleteQuiz: (id) =>
        set((state) => ({
          quizzes: state.quizzes.map((q) =>
            q.id === id ? touch({ ...q, deletedAt: new Date().toISOString() }) : q,
          ),
        })),

      addQuizzes: (incoming) => {
        if (!incoming.length) return 0
        set((state) => ({ quizzes: [...state.quizzes, ...incoming] }))
        return incoming.length
      },

      recordRun: (quizId, score, total) =>
        set((state) => {
          const run: QuizRun = {
            id: newId(),
            quizId,
            finishedAt: new Date().toISOString(),
            score,
            total,
          }
          const mine = state.runs.filter((r) => r.quizId === quizId)
          const others = state.runs.filter((r) => r.quizId !== quizId)
          const trimmed = [...mine, run].slice(-RUNS_PER_QUIZ)
          return { runs: [...others, ...trimmed] }
        }),

      // Разом із курсором: інакше наступний акаунт почав би pull з чужої позначки
      // й дозаливав би на сервер вікторини попереднього користувача.
      forgetAccountData: () => set({ quizzes: [], runs: [], lastSyncAt: null }),

      visibleQuizzes: () => get().quizzes.filter((q) => !q.deletedAt),

      runsFor: (quizId) =>
        get()
          .runs.filter((r) => r.quizId === quizId)
          .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)),

      /**
       * Власний двофазний синк, окремий від колод: спершу забираємо серверні
       * зміни, потім віддаємо локальні. Конфлікти вікторин — за `updatedAt`,
       * прогони незмінні, тож зливаються за id.
       */
      sync: async () => {
        const since = get().lastSyncAt
        const pulled = await quizApi.pull(since)

        set((state) => {
          const byId = new Map(state.quizzes.map((q) => [q.id, q]))
          for (const remote of pulled.quizzes) {
            const local = byId.get(remote.id)
            // Локальна версія свіжіша — лишаємо, вона поїде наступним push.
            if (local && local.updatedAt > remote.updatedAt) continue
            byId.set(remote.id, remote)
          }

          const runIds = new Set(state.runs.map((r) => r.id))
          const newRuns = pulled.runs.filter((r) => !runIds.has(r.id))

          return { quizzes: [...byId.values()], runs: [...state.runs, ...newRuns] }
        })

        const state = get()
        const cursor = since ?? ''
        const pending = {
          quizzes: state.quizzes.filter((q) => q.updatedAt > cursor),
          runs: state.runs,
        }

        const pushed =
          pending.quizzes.length || pending.runs.length
            ? await quizApi.push(pending)
            : { serverTime: pulled.serverTime }

        // Курсор рухаємо лише після вдалого push — інакше локальні правки
        // випали б з наступного pending.
        set({ lastSyncAt: pushed.serverTime })
      },
    }),
    {
      name: 'phrase-quizzes-v1',
      version: 1,
      partialize: (state) => ({
        quizzes: state.quizzes,
        runs: state.runs,
        lastSyncAt: state.lastSyncAt,
      }),
    },
  ),
)

/** Нове порожнє питання для редактора — два варіанти, перший правильний. */
export function emptyQuestion(): QuizQuestion {
  return {
    id: newId(),
    text: '',
    type: 'single',
    answers: [
      { id: newId(), text: '', correct: true },
      { id: newId(), text: '', correct: false },
    ],
  }
}
