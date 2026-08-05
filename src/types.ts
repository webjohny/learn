export type Difficulty = 'easy' | 'medium' | 'hard'

/** 0 = Again, 1 = Hard, 2 = Good, 3 = Easy */
export type Grade = 0 | 1 | 2 | 3

export interface Card {
  /** UUID — спільний ключ із сервером, тому рядок, а не лічильник. */
  id: string
  category: string
  /** Рідна мова (питання) */
  front: string
  /** Англійська (відповідь) */
  back: string
  tags: string[]
  difficulty: Difficulty
  /** ISO-рядок або null для нової картки */
  nextReview: string | null
  interval: number
  repetition: number
  efactor: number
  /** Підказка щодо вживання, показується на звороті */
  note?: string
  lapses?: number
  createdAt?: string
  suspended?: boolean
  /** Оновлюється при кожній зміні — за ним сервер вирішує конфлікти. */
  updatedAt?: string
  /** М'яке видалення: картка лишається до підтвердження синхронізації. */
  deletedAt?: string | null
}

/** Формат картки в JSON-файлі імпорту — усі поля прогресу опційні. */
export type CardImport = Omit<Partial<Card>, 'tags'> & {
  front: string
  back: string
  /** Приймаємо і масив, і рядок "casual, work" */
  tags?: string[] | string
}

export interface ReviewLogEntry {
  cardId: string
  grade: Grade
  /** ISO-час рецензії */
  at: string
  /** мілісекунди, витрачені на картку */
  ms: number
  mode: StudyMode
}

export interface DayStat {
  /** YYYY-MM-DD */
  date: string
  reviews: number
  correct: number
  /** секунди активної практики */
  seconds: number
  newCards: number
}

export type StudyMode = 'srs' | 'speed' | 'type'

export interface Settings {
  theme: 'dark' | 'light'
  /** Автоозвучення англійського боку при відкритті */
  autoSpeak: boolean
  speechRate: number
  voiceURI: string | null
  /** Ліміт нових карток на день */
  newPerDay: number
  /** Ліміт повторень на день */
  reviewsPerDay: number
  /** Показувати картку зворотним боком (англ → укр) */
  reverse: boolean
  /** Приховувати cloze-фрагменти під блюром */
  clozeBlur: boolean
  speedSessionSeconds: number
  speedSessionSize: number
  hapticFeedback: boolean
}

export interface SpeedResult {
  answered: number
  correct: number
  seconds: number
}
