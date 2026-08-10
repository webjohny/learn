import { useEffect, useMemo, useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { adminApi, api, type AdminDeckSummary, type AdminUserSummary, type SyncCard } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { apiErrorMessage } from '@/lib/i18n/apiError'
import { pairLabel } from '@/lib/langs'
import { useSession } from '@/store/useSession'

const NEW_DECK = ''

interface GrantCardsDialogProps {
  open: boolean
  onClose: () => void
  user: AdminUserSummary
  /** Колоди отримувача — куди можна покласти картки. */
  decks: AdminDeckSummary[]
  onGranted: () => void
}

/**
 * Передача карток користувачеві. Список власних карток тягнемо звичайним
 * `pull` по своїй колоді — окремий адмінський ендпоінт для цього не потрібен.
 */
export function GrantCardsDialog({ open, onClose, user, decks, onGranted }: GrantCardsDialogProps) {
  const myDecks = useSession((s) => s.decks)
  const toast = useToast()
  const t = useT()

  const [fromDeckId, setFromDeckId] = useState('')
  const [targetDeckId, setTargetDeckId] = useState(NEW_DECK)
  const [newDeckName, setNewDeckName] = useState('')
  const [cards, setCards] = useState<SyncCard[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setQuery('')
    setNewDeckName('')
    setFromDeckId(myDecks[0]?.id ?? '')
    setTargetDeckId(decks[0]?.id ?? NEW_DECK)
  }, [open, myDecks, decks])

  // Кожна зміна колоди-джерела перезавантажує список і скидає вибір.
  useEffect(() => {
    if (!open || !fromDeckId) return
    let cancelled = false
    setLoading(true)
    api
      .pull(fromDeckId)
      .then((data) => {
        if (cancelled) return
        const live = data.cards.filter((card) => !card.deletedAt)
        setCards(live)
        setSelected(new Set(live.map((card) => card.id)))
      })
      .catch((e) => !cancelled && setError(apiErrorMessage(e, t, t('admin.loadFailed'))))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, fromDeckId, t])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return cards
    return cards.filter(
      (card) =>
        card.front.toLowerCase().includes(needle) || card.back.toLowerCase().includes(needle),
    )
  }, [cards, query])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const send = async () => {
    if (!selected.size) {
      setError(t('admin.grantNoSelection'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await adminApi.grantCards(user.id, {
        fromDeckId,
        cardIds: [...selected],
        ...(targetDeckId === NEW_DECK
          ? { newDeckName: newDeckName.trim() || myDecks.find((d) => d.id === fromDeckId)?.name }
          : { deckId: targetDeckId }),
      })
      toast(
        result.skipped
          ? t('admin.grantDoneSkipped', { added: result.added, skipped: result.skipped })
          : t('admin.grantDone', { added: result.added, deck: result.deck.name }),
      )
      onGranted()
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e, t, t('admin.grantFailed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('admin.grantTitle', { name: user.displayName })}
      description={t('admin.grantDescription')}
      footer={
        <>
          <button className="btn-soft" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={send} disabled={busy || loading || !fromDeckId}>
            <Icon name="upload" size={16} /> {t('admin.grantSend')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400">
              {t('admin.grantSource')}
            </span>
            <select
              className="field"
              value={fromDeckId}
              onChange={(e) => setFromDeckId(e.target.value)}
            >
              {myDecks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {pairLabel(deck.sourceLang, deck.targetLang)} {deck.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400">
              {t('admin.grantTarget')}
            </span>
            <select
              className="field"
              value={targetDeckId}
              onChange={(e) => setTargetDeckId(e.target.value)}
            >
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {pairLabel(deck.sourceLang, deck.targetLang)} {deck.name}
                </option>
              ))}
              <option value={NEW_DECK}>{t('admin.grantNewDeck')}</option>
            </select>
          </label>
        </div>

        {targetDeckId === NEW_DECK && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400">
              {t('admin.grantNewDeckName')}
            </span>
            <input
              className="field"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              placeholder={myDecks.find((d) => d.id === fromDeckId)?.name}
            />
          </label>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400">
              {t('admin.grantPick')}
            </span>
            <span className="text-[11px] text-ink-400">
              {t('admin.grantSelected', { count: selected.size, total: cards.length })}
            </span>
            <div className="ml-auto flex gap-1.5">
              <button
                className="btn-soft px-2 py-1 text-[11px]"
                onClick={() => setSelected(new Set(cards.map((c) => c.id)))}
              >
                {t('admin.grantSelectAll')}
              </button>
              <button
                className="btn-soft px-2 py-1 text-[11px]"
                onClick={() => setSelected(new Set())}
              >
                {t('admin.grantClear')}
              </button>
            </div>
          </div>

          <input
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin.grantSearch')}
          />

          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-ink-200 p-1.5 dark:border-white/10">
            {loading && <p className="p-2 text-[13px] text-ink-400">{t('admin.grantLoading')}</p>}
            {!loading && !visible.length && (
              <p className="p-2 text-[13px] text-ink-400">{t('admin.grantEmptyDeck')}</p>
            )}
            {visible.map((card) => (
              <label
                key={card.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-ink-900/4 dark:hover:bg-white/6"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.has(card.id)}
                  onChange={() => toggle(card.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{card.front}</span>
                  <span className="block truncate text-[11px] text-ink-400">{card.back}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-[13px] text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
