/** Спільні типи API — фронтенд імпортує їх через `@server/types`. */

export interface PublicUser {
  id: string
  email: string
  displayName: string
  createdAt: string
  /** Обчислюється з пошти (див. `common/admin.ts`), у БД не зберігається. */
  isAdmin: boolean
}

/**
 * Тип колоди:
 * - `language` — мовна пара, у якої є TTS, зворотний напрям і режим «Друк»;
 * - `subject`  — довільний предмет (ПДР, співбесіда) — питання/відповідь без мов.
 */
export type DeckKind = 'language' | 'subject'

/** Колода = мовна пара або предмет. У користувача їх може бути кілька. */
export interface DeckMeta {
  id: string
  userId: string
  name: string
  kind: DeckKind
  /** BCP-47 код мови питання, напр. 'uk'. `null` для `subject`. */
  sourceLang: string | null
  /** BCP-47 код мови відповіді — за ним обирається голос TTS. `null` для `subject`. */
  targetLang: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface SyncCard {
  id: string
  deckId: string
  category: string
  front: string
  back: string
  tags: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  note: string | null
  nextReview: string | null
  interval: number
  repetition: number
  efactor: number
  lapses: number
  suspended: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface SyncDayStat {
  deckId: string
  /** YYYY-MM-DD у локальному часі клієнта */
  date: string
  reviews: number
  correct: number
  seconds: number
  newCards: number
  updatedAt: string
}

export interface SyncPushBody {
  cards?: SyncCard[]
  days?: SyncDayStat[]
}

export interface SyncPullResponse {
  serverTime: string
  cards: SyncCard[]
  days: SyncDayStat[]
}

export interface ApiError {
  error: string
}

/* ── Адмінка ─────────────────────────────────────────────────────────────
   Окремих таблиць метрик немає: усе рахується на льоту з `day_stats`,
   `cards` і `sessions`. Масштаб персонального застосунку це витримує.        */

export interface AdminTotals {
  users: number
  decks: number
  cards: number
  quizzes: number
  reviews: number
  correct: number
  seconds: number
}

export interface AdminOverview {
  totals: AdminTotals
  /** Скільки користувачів мали повтори сьогодні / за останні 7 днів. */
  activeToday: number
  activeWeek: number
  newUsersWeek: number
  daily: { date: string; reviews: number; users: number }[]
}

export interface AdminUserSummary {
  id: string
  email: string
  displayName: string
  createdAt: string
  isAdmin: boolean
  decks: number
  cards: number
  reviews: number
  correct: number
  seconds: number
  quizzes: number
  quizRuns: number
  /** Останній день із повторами — YYYY-MM-DD за годинником клієнта. */
  lastActiveDate: string | null
  /** Останній вхід: момент створення найсвіжішої сесії. */
  lastSessionAt: string | null
}

export interface AdminDeckSummary {
  id: string
  name: string
  kind: DeckKind
  sourceLang: string | null
  targetLang: string | null
  cards: number
  /** Картки, готові до повтору просто зараз (нові теж). */
  due: number
  createdAt: string
}

export interface AdminUserDetail {
  user: AdminUserSummary
  decks: AdminDeckSummary[]
  daily: { date: string; reviews: number; correct: number; seconds: number }[]
  recentRuns: {
    id: string
    quizId: string
    title: string | null
    finishedAt: string
    score: number
    total: number
  }[]
}

/** Результат передачі карток користувачеві. */
export interface AdminGrantResult {
  deck: DeckMeta
  added: number
  /** Дублі за парою «питання + відповідь» — щоб повторне надсилання не плодило копій. */
  skipped: number
}
