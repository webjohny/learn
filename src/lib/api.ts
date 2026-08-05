import type {
  DeckMeta,
  PublicUser,
  SyncCard,
  SyncDayStat,
  SyncPullResponse,
} from '@server/types'

export type { DeckMeta, PublicUser, SyncCard, SyncDayStat, SyncPullResponse }

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
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
    const message =
      (data as { message?: string; error?: string } | null)?.message ??
      (data as { error?: string } | null)?.error ??
      'Не вдалося виконати запит.'
    throw new ApiError(message, response.status)
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

  createDeck: (input: { name: string; sourceLang: string; targetLang: string }) =>
    request<{ deck: DeckMeta }>('POST', '/api/decks', input),

  updateDeck: (id: string, input: Partial<{ name: string; sourceLang: string; targetLang: string }>) =>
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
