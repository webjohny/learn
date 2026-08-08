import { useEffect, useRef, useState } from 'react'

import { AuthDialog } from '@/components/AuthDialog'
import { DeckDialog } from '@/components/DeckDialog'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { pairLabel } from '@/lib/langs'
import { useT, type MessageKey } from '@/lib/i18n'
import { LOCAL_DECK_ID, useDeck } from '@/store/useDeck'
import { useSession } from '@/store/useSession'

/** Акаунт + перемикач колод. Гостю показує лише кнопку входу. */
export function AccountMenu() {
  const status = useSession((s) => s.status)
  const user = useSession((s) => s.user)
  const decks = useSession((s) => s.decks)
  const syncStatus = useSession((s) => s.syncStatus)
  const logout = useSession((s) => s.logout)
  const activeDeckId = useDeck((s) => s.activeDeckId)
  const setActiveDeck = useDeck((s) => s.setActiveDeck)
  const toast = useToast()
  const t = useT()

  const [open, setOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [deckDialogOpen, setDeckDialogOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const activeDeck = decks.find((d) => d.id === activeDeckId)

  if (status !== 'authed') {
    return (
      <>
        <button
          className="btn-soft px-2.5 py-1.5 text-xs"
          onClick={() => setAuthOpen(true)}
          disabled={status === 'loading'}
        >
          <Icon name="user" size={15} />
          <span className="hidden sm:inline">{t('account.login')}</span>
        </button>
        <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
      </>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-soft gap-1.5 px-2.5 py-1.5 text-xs"
        onClick={() => setOpen((v) => !v)}
        title={user?.email}
      >
        <SyncDot status={syncStatus} />
        <span className="hidden sm:inline">
          {activeDeck ? pairLabel(activeDeck.sourceLang, activeDeck.targetLang) : user?.displayName}
        </span>
        <Icon name="chevronDown" size={13} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl dark:border-white/10 dark:bg-ink-900">
          <div className="border-b border-ink-200/70 px-3.5 py-2.5 dark:border-white/8">
            <p className="truncate text-[13px] font-semibold">{user?.displayName}</p>
            <p className="truncate text-[11px] text-ink-400">{user?.email}</p>
            <p className="mt-1 text-[11px] text-ink-400">{t(syncLabel(syncStatus))}</p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1.5">
            <p className="px-3.5 py-1 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">
              {t('account.decks')}
            </p>
            {decks.map((deck) => (
              <button
                key={deck.id}
                onClick={() => {
                  setActiveDeck(deck.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] transition-colors ${
                  deck.id === activeDeckId
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                    : 'hover:bg-ink-900/4 dark:hover:bg-white/6'
                }`}
              >
                <span>{pairLabel(deck.sourceLang, deck.targetLang)}</span>
                <span className="min-w-0 flex-1 truncate">{deck.name}</span>
                {deck.id === activeDeckId && <Icon name="check" size={14} />}
              </button>
            ))}
          </div>

          <div className="border-t border-ink-200/70 p-1.5 dark:border-white/8">
            <MenuItem
              icon="plus"
              label={t('account.newDeck')}
              onClick={() => {
                setDeckDialogOpen(true)
                setOpen(false)
              }}
            />
            <MenuItem
              icon="rotate"
              label={t('account.syncNow')}
              onClick={() => {
                void useSession.getState().sync()
                setOpen(false)
              }}
            />
            <MenuItem
              icon="undo"
              label={t('account.logout')}
              tone="danger"
              onClick={async () => {
                await logout()
                setOpen(false)
                toast(t('account.loggedOut'), 'info')
              }}
            />
          </div>
        </div>
      )}

      <DeckDialog open={deckDialogOpen} onClose={() => setDeckDialogOpen(false)} />
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: 'plus' | 'rotate' | 'undo'
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] transition-colors ${
        tone === 'danger'
          ? 'text-rose-500 hover:bg-rose-500/10'
          : 'hover:bg-ink-900/4 dark:hover:bg-white/6'
      }`}
    >
      <Icon name={icon} size={15} />
      {label}
    </button>
  )
}

const dots: Record<string, string> = {
  idle: 'bg-emerald-500',
  syncing: 'bg-amber-400 animate-pulse',
  offline: 'bg-ink-400',
  error: 'bg-rose-500',
}

function SyncDot({ status }: { status: string }) {
  return <span className={`size-2 shrink-0 rounded-full ${dots[status] ?? dots.idle}`} />
}

function syncLabel(status: string): MessageKey {
  if (status === 'syncing') return 'account.syncing'
  if (status === 'offline') return 'account.offline'
  if (status === 'error') return 'account.syncError'
  return 'account.synced'
}

export { LOCAL_DECK_ID }
