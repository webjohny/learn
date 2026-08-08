import type {
  DeckKind,
  DeckMeta,
  PublicUser,
  SyncCard,
  SyncDayStat,
  SyncPullResponse,
} from '@server/types'

import type { Quiz, QuizRun } from '@/lib/quizTypes'

export type { DeckKind, DeckMeta, PublicUser, SyncCard, SyncDayStat, SyncPullResponse }

export interface CreateDeckInput {
  name: string
  kind: DeckKind
  /** Тільки для `kind: 'language'` */
  sourceLang?: string
  targetLang?: string
}

/** `kind` змінити не можна — предметна колода не має мов. */
export type UpdateDeckInput = Partial<Omit<CreateDeckInput, 'kind'>>

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Код із сервера — клієнт перекладає його сам; текст лишається відкотом. */
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** true — сервер недоступний (офлайн або не запущений), а не відмовив. */
export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Немає зв’язку із сервером.', 0)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const body = data as { message?: string; error?: string; code?: string } | null
    const message = body?.message ?? body?.error ?? 'Не вдалося виконати запит.'
    throw new ApiError(message, response.status, body?.code)
  }

  return data as T
}

export interface AuthResponse {
  user: PublicUser
  decks: DeckMeta[]
}

export const api = {
  register: (email: string, password: string, displayName?: string) =>
    request<AuthResponse>('POST', '/api/auth/register', { email, password, displayName }),

  login: (email: string, password: string) =>
    request<AuthResponse>('POST', '/api/auth/login', { email, password }),

  logout: () => request<void>('POST', '/api/auth/logout'),

  me: () => request<AuthResponse>('GET', '/api/auth/me'),

  listDecks: () => request<{ decks: DeckMeta[] }>('GET', '/api/decks'),

  createDeck: (input: CreateDeckInput) =>
    request<{ deck: DeckMeta }>('POST', '/api/decks', input),

  updateDeck: (id: string, input: UpdateDeckInput) =>
    request<{ deck: DeckMeta }>('PATCH', `/api/decks/${id}`, input),

  deleteDeck: (id: string) => request<void>('DELETE', `/api/decks/${id}`),

  pull: (deckId: string, since?: string | null) =>
    request<SyncPullResponse>(
      'GET',
      `/api/sync/${deckId}${since ? `?since=${encodeURIComponent(since)}` : ''}`,
    ),

  push: (deckId: string, payload: { cards?: SyncCard[]; days?: SyncDayStat[] }) =>
    request<{ serverTime: string; appliedCards: number; skippedCards: number }>(
      'POST',
      `/api/sync/${deckId}`,
      payload,
    ),
}

/** Окремий контур: вікторини належать акаунту, а не колоді. */
export const quizApi = {
  pull: (since?: string | null) =>
    request<{ serverTime: string; quizzes: Quiz[]; runs: QuizRun[] }>(
      'GET',
      `/api/quiz${since ? `?since=${encodeURIComponent(since)}` : ''}`,
    ),

  push: (payload: { quizzes?: Quiz[]; runs?: QuizRun[] }) =>
    request<{
      serverTime: string
      appliedQuizzes: number
      skippedQuizzes: number
      appliedRuns: number
    }>('POST', '/api/quiz', payload),
}
