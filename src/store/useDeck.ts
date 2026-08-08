import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { seedCards } from '@/data/seed'
import type { SyncCard, SyncDayStat } from '@/lib/api'
import { canonicalCategory } from '@/lib/categories'
import { dayKey } from '@/lib/date'
import { BACKUP_VERSION, dedupe, newId, normalizeCard } from '@/lib/deck'
import { detectLocale } from '@/lib/i18n/core'
import { schedule } from '@/lib/sm2'
import type { Card, CardImport, DayStat, Grade, ReviewLogEntry, Settings, StudyMode } from '@/types'

const LOG_LIMIT = 3000
/** Верхня межа часу на одну картку — захист від «залишив вкладку відкритою». */
const MAX_MS_PER_CARD = 60_000

/** Колода гостя — до входу в акаунт усе живе тут. */
export const LOCAL_DECK_ID = 'local'

/** Перший запуск підхоплює тему системи; далі рішення за перемикачем. */
function preferredTheme(): Settings['theme'] {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export const defaultSettings: Settings = {
  theme: preferredTheme(),
  locale: detectLocale(),
  autoSpeak: true,
  speechRate: 0.95,
  voiceURI: null,
  newPerDay: 15,
  reviewsPerDay: 120,
  reverse: false,
  clozeBlur: true,
  speedSessionSeconds: 60,
  speedSessionSize: 10,
  hapticFeedback: true,
}

/** Дані однієї колоди. Ключ у `decks` — id колоди на сервері або LOCAL_DECK_ID. */
export interface DeckData {
  cards: Card[]
  days: Record<string, DayStat>
  log: ReviewLogEntry[]
  activeCategories: string[]
  activeTags: string[]
  /** serverTime останньої вдалої синхронізації — база для інкрементального pull. */
  lastSyncAt: string | null
}

export function emptyDeckData(): DeckData {
  return { cards: [], days: {}, log: [], activeCategories: [], activeTags: [], lastSyncAt: null }
}

export function seededDeckData(): DeckData {
  return { ...emptyDeckData(), cards: seedCards.map((raw) => normalizeCard(raw)) }
}

function emptyDay(date: string): DayStat {
  return { date, reviews: 0, correct: 0, seconds: 0, newCards: 0 }
}

function nowISO() {
  return new Date().toISOString()
}

export interface DeckState {
  activeDeckId: string
  decks: Record<string, DeckData>
  settings: Settings

  /** Дані активної колоди — усі екрани працюють через це. */
  current: () => DeckData

  setActiveDeck: (deckId: string) => void
  ensureDeck: (deckId: string, seed?: boolean) => void
  dropDeck: (deckId: string) => void
  /** Прибирає локальні дані серверних колод — викликається при виході з акаунта. */
  forgetServerDecks: () => void
  /** Одноразове перенесення доробку гостя у першу колоду нового акаунта. */
  migrateGuestCards: (deckId: string) => number

  rate: (cardId: string, grade: Grade, ms: number, mode: StudyMode) => void
  addCard: (draft: CardImport) => Card
  updateCard: (id: string, patch: Partial<Card>) => void
  deleteCard: (id: string) => void
  toggleSuspend: (id: string) => void

  importCards: (cards: Card[], mode: 'merge' | 'replace') => number
  restoreBackup: (payload: BackupPayload) => void
  loadSeed: () => void
  /** Спорожняє активну колоду. Повертає, скільки карток видалено. */
  deleteAllCards: () => number
  resetAllProgress: () => void

  setSettings: (patch: Partial<Settings>) => void
  setActiveCategories: (categories: string[]) => void
  setActiveTags: (tags: string[]) => void

  /** Зміни, які ще не пішли на сервер. */
  pendingChanges: (deckId: string) => { cards: SyncCard[]; days: SyncDayStat[] }
  /** Застосовує серверні зміни поверх локальних за last-write-wins. */
  applyServerChanges: (deckId: string, cards: SyncCard[], days: SyncDayStat[]) => void
  markSynced: (deckId: string, serverTime: string) => void
}

export interface BackupPayload {
  version: number
  exportedAt: string
  cards: Card[]
  settings: Settings
  days: Record<string, DayStat>
  log: ReviewLogEntry[]
}

export const useDeck = create<DeckState>()(
  persist(
    (set, get) => {
      /** Точкова зміна активної (або вказаної) колоди. */
      const patch = (deckId: string, update: (data: DeckData) => Partial<DeckData>) =>
        set((state) => {
          const data = state.decks[deckId] ?? emptyDeckData()
          return { decks: { ...state.decks, [deckId]: { ...data, ...update(data) } } }
        })

      const patchActive = (update: (data: DeckData) => Partial<DeckData>) =>
        patch(get().activeDeckId, update)

      return {
        activeDeckId: LOCAL_DECK_ID,
        decks: { [LOCAL_DECK_ID]: seededDeckData() },
        settings: defaultSettings,

        current: () => get().decks[get().activeDeckId] ?? emptyDeckData(),

        setActiveDeck: (deckId) => {
          get().ensureDeck(deckId)
          set({ activeDeckId: deckId })
        },

        ensureDeck: (deckId, seed = false) =>
          set((state) =>
            state.decks[deckId]
              ? state
              : {
                  decks: {
                    ...state.decks,
                    [deckId]: seed ? seededDeckData() : emptyDeckData(),
                  },
                },
          ),

        dropDeck: (deckId) =>
          set((state) => {
            const decks = { ...state.decks }
            delete decks[deckId]
            return {
              decks,
              activeDeckId:
                state.activeDeckId === deckId
                  ? (Object.keys(decks)[0] ?? LOCAL_DECK_ID)
                  : state.activeDeckId,
            }
          }),

        // Колоди акаунта не мають лежати в браузері після виходу: наступний
        // користувач цього комп'ютера не повинен бачити чужі картки.
        forgetServerDecks: () =>
          set((state) => ({
            decks: { [LOCAL_DECK_ID]: state.decks[LOCAL_DECK_ID] ?? seededDeckData() },
            activeDeckId: LOCAL_DECK_ID,
          })),

        migrateGuestCards: (deckId) => {
          const guest = get().decks[LOCAL_DECK_ID]
          const cards = (guest?.cards ?? []).filter((c) => !c.deletedAt)
          if (!cards.length) return 0

          const at = nowISO()
          // Перевипускаємо id: гостьові збіглися б з картками іншого акаунта,
          // який реєструвався в цьому ж браузері, і сервер їх би відхилив.
          const copies = cards.map((c) => ({ ...c, id: newId(), updatedAt: at }))

          set((state) => {
            const target = state.decks[deckId] ?? emptyDeckData()
            return {
              decks: {
                ...state.decks,
                [deckId]: { ...target, cards: [...target.cards, ...copies] },
                // Гостьова колода повертається до стартового набору — перенесення
                // одноразове й більше нікуди не потрапить.
                [LOCAL_DECK_ID]: seededDeckData(),
              },
            }
          })

          return copies.length
        },

        rate: (cardId, grade, ms, mode) =>
          patchActive((data) => {
            const card = data.cards.find((c) => c.id === cardId)
            if (!card) return {}

            const wasNew = card.repetition === 0 && !card.nextReview
            const { card: updated } = schedule(card, grade)
            const today = dayKey()
            const day = data.days[today] ?? emptyDay(today)
            const entry: ReviewLogEntry = {
              cardId,
              grade,
              at: nowISO(),
              ms: Math.min(ms, MAX_MS_PER_CARD),
              mode,
            }

            return {
              cards: data.cards.map((c) =>
                c.id === cardId ? { ...updated, updatedAt: nowISO() } : c,
              ),
              days: {
                ...data.days,
                [today]: {
                  ...day,
                  reviews: day.reviews + 1,
                  correct: day.correct + (grade > 0 ? 1 : 0),
                  seconds: day.seconds + entry.ms / 1000,
                  newCards: day.newCards + (wasNew ? 1 : 0),
                },
              },
              log: [...data.log, entry].slice(-LOG_LIMIT),
            }
          }),

        addCard: (draft) => {
          const card = normalizeCard({ ...draft, createdAt: nowISO() })
          patchActive((data) => ({ cards: [card, ...data.cards] }))
          return card
        },

        updateCard: (id, cardPatch) =>
          patchActive((data) => ({
            cards: data.cards.map((c) =>
              c.id === id ? { ...c, ...cardPatch, id, updatedAt: nowISO() } : c,
            ),
          })),

        // М'яке видалення: картка потрібна, щоб донести факт видалення до сервера.
        deleteCard: (id) =>
          patchActive((data) => ({
            cards: data.cards.map((c) =>
              c.id === id ? { ...c, deletedAt: nowISO(), updatedAt: nowISO() } : c,
            ),
          })),

        toggleSuspend: (id) =>
          patchActive((data) => ({
            cards: data.cards.map((c) =>
              c.id === id ? { ...c, suspended: !c.suspended, updatedAt: nowISO() } : c,
            ),
          })),

        importCards: (incoming, mode) => {
          const at = nowISO()
          const stamped = dedupe(incoming).map((c) => ({ ...c, updatedAt: at }))

          if (mode === 'replace') {
            patchActive((data) => ({
              // Наявні картки позначаємо видаленими, щоб сервер теж їх прибрав.
              cards: [
                ...data.cards.map((c) => ({ ...c, deletedAt: at, updatedAt: at })),
                ...stamped,
              ],
              activeCategories: [],
              activeTags: [],
            }))
            return stamped.length
          }

          const data = get().current()
          const existing = new Set(
            data.cards
              .filter((c) => !c.deletedAt)
              .map((c) => `${c.front.toLowerCase()}|${c.back.toLowerCase()}`),
          )
          const fresh = stamped.filter(
            (c) => !existing.has(`${c.front.toLowerCase()}|${c.back.toLowerCase()}`),
          )

          patchActive((d) => ({ cards: [...d.cards, ...fresh] }))
          return fresh.length
        },

        restoreBackup: (payload) => {
          const at = nowISO()
          patchActive(() => ({
            cards: payload.cards.map((c) => ({
              ...normalizeCard(c, c.id ?? newId()),
              updatedAt: at,
            })),
            days: payload.days ?? {},
            log: payload.log ?? [],
            activeCategories: [],
            activeTags: [],
          }))
          set({ settings: { ...defaultSettings, ...payload.settings } })
        },

        loadSeed: () => patchActive(() => seededDeckData()),

        /**
         * Саме видалення, а не заміна стартовим набором: картки позначаються
         * `deletedAt`, щоб порожнеча доїхала на сервер і не повернулася
         * наступним pull. Зачіпає лише активну колоду — сусідні пари цілі.
         * Денна статистика лишається: практика справді була.
         */
        deleteAllCards: () => {
          const alive = get().current().cards.filter((c) => !c.deletedAt).length
          if (!alive) return 0

          const at = nowISO()
          patchActive((data) => ({
            cards: data.cards.map((c) =>
              c.deletedAt ? c : { ...c, deletedAt: at, updatedAt: at },
            ),
            // Фільтри вказували б на категорії, яких більше немає.
            activeCategories: [],
            activeTags: [],
          }))
          return alive
        },

        resetAllProgress: () =>
          patchActive((data) => ({
            cards: data.cards.map((c) => ({
              ...c,
              nextReview: null,
              interval: 0,
              repetition: 0,
              efactor: 2.5,
              lapses: 0,
              updatedAt: nowISO(),
            })),
            days: {},
            log: [],
          })),

        setSettings: (settingsPatch) =>
          set((state) => ({ settings: { ...state.settings, ...settingsPatch } })),

        setActiveCategories: (activeCategories) => patchActive(() => ({ activeCategories })),
        setActiveTags: (activeTags) => patchActive(() => ({ activeTags })),

        pendingChanges: (deckId) => {
          const data = get().decks[deckId] ?? emptyDeckData()
          const since = data.lastSyncAt ?? ''

          return {
            cards: data.cards
              .filter((c) => (c.updatedAt ?? '') > since)
              .map((c) => toSyncCard(c, deckId)),
            days: Object.values(data.days).map((d) => ({
              deckId,
              date: d.date,
              reviews: d.reviews,
              correct: d.correct,
              seconds: d.seconds,
              newCards: d.newCards,
              updatedAt: nowISO(),
            })),
          }
        },

        applyServerChanges: (deckId, serverCards, serverDays) =>
          patch(deckId, (data) => {
            const byId = new Map(data.cards.map((c) => [c.id, c]))

            for (const remote of serverCards) {
              const local = byId.get(remote.id)
              // Локальна версія свіжіша — лишаємо її, вона поїде наступним push.
              if (local && (local.updatedAt ?? '') > remote.updatedAt) continue
              byId.set(remote.id, fromSyncCard(remote))
            }

            const days = { ...data.days }
            for (const remote of serverDays) {
              const local = days[remote.date]
              // Лічильники лише зростають — беремо максимум, як і сервер.
              days[remote.date] = {
                date: remote.date,
                reviews: Math.max(local?.reviews ?? 0, remote.reviews),
                correct: Math.max(local?.correct ?? 0, remote.correct),
                seconds: Math.max(local?.seconds ?? 0, remote.seconds),
                newCards: Math.max(local?.newCards ?? 0, remote.newCards),
              }
            }

            // lastSyncAt навмисно не чіпаємо: його рухає лише markSynced після
            // вдалого push, інакше локальні правки загубились би при збої.
            return { cards: [...byId.values()], days }
          }),

        markSynced: (deckId, serverTime) => patch(deckId, () => ({ lastSyncAt: serverTime })),
      }
    },
    {
      name: 'phrase-deck-v1',
      version: 3,
      partialize: (state) => ({
        activeDeckId: state.activeDeckId,
        decks: state.decks,
        settings: state.settings,
      }),
      migrate: (persisted, version) => {
        const saved = (persisted ?? {}) as Record<string, unknown>

        // v1 → v2: зведення дрібних категорій у 10 канонічних.
        // v2 → v3: пласка колода стає мапою колод, id карток — UUID.
        if (version < 3) {
          const legacyCards = Array.isArray(saved.cards) ? (saved.cards as Card[]) : []
          const at = nowISO()

          return {
            activeDeckId: LOCAL_DECK_ID,
            decks: {
              [LOCAL_DECK_ID]: {
                ...emptyDeckData(),
                cards: legacyCards.map((card) => ({
                  ...card,
                  id: typeof card.id === 'string' ? card.id : newId(),
                  category: canonicalCategory(card.category),
                  updatedAt: at,
                  deletedAt: null,
                })),
                days: (saved.days as Record<string, DayStat>) ?? {},
                log: [],
              },
            },
            settings: { ...defaultSettings, ...(saved.settings as Settings) },
          }
        }

        return saved
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<DeckState>
        return {
          ...current,
          ...saved,
          settings: { ...defaultSettings, ...saved.settings },
          decks: saved.decks ?? current.decks,
        }
      },
    },
  ),
)

function toSyncCard(card: Card, deckId: string): SyncCard {
  return {
    id: card.id,
    deckId,
    category: card.category,
    front: card.front,
    back: card.back,
    tags: card.tags,
    difficulty: card.difficulty,
    note: card.note ?? null,
    nextReview: card.nextReview,
    interval: card.interval,
    repetition: card.repetition,
    efactor: card.efactor,
    lapses: card.lapses ?? 0,
    suspended: Boolean(card.suspended),
    createdAt: card.createdAt ?? nowISO(),
    updatedAt: card.updatedAt ?? nowISO(),
    deletedAt: card.deletedAt ?? null,
  }
}

function fromSyncCard(card: SyncCard): Card {
  return {
    id: card.id,
    category: card.category,
    front: card.front,
    back: card.back,
    tags: card.tags,
    difficulty: card.difficulty,
    note: card.note ?? undefined,
    nextReview: card.nextReview,
    interval: card.interval,
    repetition: card.repetition,
    efactor: card.efactor,
    lapses: card.lapses,
    suspended: card.suspended,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    deletedAt: card.deletedAt,
  }
}

export function buildBackup(state: DeckState): BackupPayload {
  const data = state.decks[state.activeDeckId] ?? emptyDeckData()
  return {
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    cards: data.cards.filter((c) => !c.deletedAt),
    settings: state.settings,
    days: data.days,
    log: data.log,
  }
}
