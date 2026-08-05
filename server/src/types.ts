/** Спільні типи API — фронтенд імпортує їх через `@server/types`. */

export interface PublicUser {
  id: string
  email: string
  displayName: string
  createdAt: string
}

/** Колода = мовна пара. У користувача їх може бути кілька. */
export interface DeckMeta {
  id: string
  userId: string
  name: string
  /** BCP-47 код мови питання, напр. 'uk' */
  sourceLang: string
  /** BCP-47 код мови відповіді — за ним обирається голос TTS, напр. 'en-US' */
  targetLang: string
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
