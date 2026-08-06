/**
 * Вікторини — окремий функціонал: із картками, колодами й SM-2 не пов'язані.
 * Типи навмисно живуть тут, а не в `@/types`, щоб межа була видима.
 */

export type QuizMode = 'graded' | 'survey'
export type QuizQuestionType = 'single' | 'multiple'

export interface QuizAnswerOption {
  id: string
  text: string
  correct: boolean
}

export interface QuizQuestion {
  id: string
  text: string
  type: QuizQuestionType
  answers: QuizAnswerOption[]
}

export interface Quiz {
  id: string
  title: string
  description: string | null
  /** 'graded' — фідбек одразу; 'survey' — розбір лише в кінці */
  mode: QuizMode
  questions: QuizQuestion[]
  createdAt: string
  updatedAt: string
  /** М'яке видалення: запис лишається до підтвердження синхронізації */
  deletedAt: string | null
}

/** Прогон вікторини. Незмінний після завершення. */
export interface QuizRun {
  id: string
  quizId: string
  finishedAt: string
  score: number
  total: number
}

/** Формат JSON-імпорту — усі службові поля опційні. */
export type QuizImport = {
  title?: string
  description?: string | null
  mode?: string
  questions?: unknown
}

export function isCorrectSelection(question: QuizQuestion, selected: string[]): boolean {
  const correct = question.answers.filter((a) => a.correct).map((a) => a.id)
  if (correct.length !== selected.length) return false
  return correct.every((id) => selected.includes(id))
}
