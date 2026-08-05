import { create } from 'zustand'

import { ApiError, api, isOffline, type DeckMeta, type PublicUser } from '@/lib/api'
import { LOCAL_DECK_ID, useDeck } from './useDeck'

export type AuthStatus = 'loading' | 'guest' | 'authed'
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

interface SessionState {
  status: AuthStatus
  user: PublicUser | null
  decks: DeckMeta[]
  syncStatus: SyncStatus
  syncError: string | null
  lastSyncedAt: string | null

  bootstrap: () => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>

  createDeck: (input: { name: string; sourceLang: string; targetLang: string }) => Promise<DeckMeta>
  updateDeck: (id: string, input: Partial<DeckMeta>) => Promise<void>
  deleteDeck: (id: string) => Promise<void>

  sync: (deckId?: string) => Promise<void>
  activeDeckMeta: () => DeckMeta | null
}

export const useSession = create<SessionState>()((set, get) => {
  /** Заводить локальні контейнери під серверні колоди й обирає активну. */
  function adoptDecks(decks: DeckMeta[]) {
    const deckStore = useDeck.getState()
    for (const deck of decks) deckStore.ensureDeck(deck.id)

    const active = deckStore.activeDeckId
    if (!decks.some((d) => d.id === active) && decks[0]) {
      deckStore.setActiveDeck(decks[0].id)
    }
    set({ decks })
  }

  return {
    status: 'loading',
    user: null,
    decks: [],
    syncStatus: 'idle',
    syncError: null,
    lastSyncedAt: null,

    bootstrap: async () => {
      try {
        const { user, decks } = await api.me()
        adoptDecks(decks)
        set({ status: 'authed', user })
        void get().sync()
      } catch (error) {
        // 401 — просто гість; недоступний сервер — теж працюємо локально.
        set({
          status: 'guest',
          user: null,
          decks: [],
          syncStatus: isOffline(error) ? 'offline' : 'idle',
        })
        useDeck.getState().setActiveDeck(LOCAL_DECK_ID)
      }
    },

    register: async (email, password, displayName) => {
      const { user, decks } = await api.register(email, password, displayName)
      adoptDecks(decks)
      set({ status: 'authed', user, syncError: null })
      await get().sync()
    },

    login: async (email, password) => {
      const { user, decks } = await api.login(email, password)
      adoptDecks(decks)
      set({ status: 'authed', user, syncError: null })
      await get().sync()
    },

    logout: async () => {
      try {
        await api.logout()
      } catch {
        // Навіть якщо сервер не відповів — локально виходимо.
      }
      set({ status: 'guest', user: null, decks: [], syncStatus: 'idle', lastSyncedAt: null })
      useDeck.getState().setActiveDeck(LOCAL_DECK_ID)
    },

    createDeck: async (input) => {
      const { deck } = await api.createDeck(input)
      useDeck.getState().ensureDeck(deck.id)
      set((state) => ({ decks: [...state.decks, deck] }))
      return deck
    },

    updateDeck: async (id, input) => {
      const { deck } = await api.updateDeck(id, input)
      set((state) => ({ decks: state.decks.map((d) => (d.id === deck.id ? deck : d)) }))
    },

    deleteDeck: async (id) => {
      await api.deleteDeck(id)
      useDeck.getState().dropDeck(id)
      const decks = get().decks.filter((d) => d.id !== id)
      set({ decks })
      if (decks[0]) useDeck.getState().setActiveDeck(decks[0].id)
    },

    /**
     * Двофазна синхронізація: спершу забираємо серверні зміни (щоб побачити
     * правки з інших пристроїв), потім віддаємо локальні. Конфлікти
     * вирішуються за `updatedAt` — і тут, і на сервері.
     */
    sync: async (deckId) => {
      const { status } = get()
      const deckStore = useDeck.getState()
      const target = deckId ?? deckStore.activeDeckId

      if (status !== 'authed' || target === LOCAL_DECK_ID) return
      if (get().syncStatus === 'syncing') return

      set({ syncStatus: 'syncing', syncError: null })

      try {
        const local = deckStore.decks[target]
        const pulled = await api.pull(target, local?.lastSyncAt)
        deckStore.applyServerChanges(target, pulled.cards, pulled.days)

        // Перший вхід на порожню серверну колоду — переносимо доробок гостя.
        const guest = deckStore.decks[LOCAL_DECK_ID]
        const serverEmpty = pulled.cards.length === 0 && !local?.cards.length
        if (serverEmpty && guest?.cards.length) {
          deckStore.setActiveDeck(target)
          deckStore.importCards(
            guest.cards.filter((c) => !c.deletedAt),
            'merge',
          )
        }

        const pending = useDeck.getState().pendingChanges(target)
        const pushed =
          pending.cards.length || pending.days.length
            ? await api.push(target, pending)
            : { serverTime: pulled.serverTime }

        // Позначку рухаємо лише тепер — до цього моменту зміни ще не на сервері.
        useDeck.getState().markSynced(target, pushed.serverTime)
        set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
      } catch (error) {
        if (isOffline(error)) {
          set({ syncStatus: 'offline' })
          return
        }
        // Сесія протухла — повертаємось у гостьовий режим.
        if (error instanceof ApiError && error.status === 401) {
          set({ status: 'guest', user: null, decks: [], syncStatus: 'idle' })
          useDeck.getState().setActiveDeck(LOCAL_DECK_ID)
          return
        }
        set({
          syncStatus: 'error',
          syncError: error instanceof Error ? error.message : 'Помилка синхронізації.',
        })
      }
    },

    activeDeckMeta: () => {
      const activeDeckId = useDeck.getState().activeDeckId
      return get().decks.find((d) => d.id === activeDeckId) ?? null
    },
  }
})
