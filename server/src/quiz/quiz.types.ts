/**
 * Вікторини — самостійна сутність, з картками не пов'язана: власні таблиці,
 * власний ендпоінт, власний курсор синхронізації. Скоуп — акаунт, не колода.
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
  /** Розгорнутий контекст під заголовком питання */
  description?: string
  /** Уточнення/умови — показуються списком під описом */
  subRules?: string[]
  /** Фрагмент коду: моноширинний, без підсвітки */
  code?: string
  type: QuizQuestionType
  answers: QuizAnswerOption[]
}

export interface SyncQuiz {
  id: string
  title: string
  description: string | null
  /** 'graded' — фідбек після кожного питання; 'survey' — розбір лише в кінці */
  mode: QuizMode
  /** Зберігається JSON-рядком в одній колонці — вікторина синкається цілим об'єктом */
  questions: QuizQuestion[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** Прогон вікторини. Незмінний після завершення, тому конфліктів синку не буває. */
export interface SyncQuizRun {
  id: string
  quizId: string
  finishedAt: string
  score: number
  total: number
}

export interface QuizPushBody {
  quizzes?: SyncQuiz[]
  runs?: SyncQuizRun[]
}

export interface QuizPullResponse {
  serverTime: string
  quizzes: SyncQuiz[]
  runs: SyncQuizRun[]
}

export interface QuizPushResult {
  serverTime: string
  appliedQuizzes: number
  skippedQuizzes: number
  appliedRuns: number
}
