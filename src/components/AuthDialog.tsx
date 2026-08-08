import { useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n'
import { apiErrorMessage } from '@/lib/i18n/apiError'
import { useCards } from '@/store/selectors'
import { LOCAL_DECK_ID, useDeck } from '@/store/useDeck'
import { useSession } from '@/store/useSession'

type Mode = 'login' | 'register'

interface AuthDialogProps {
  open: boolean
  onClose: () => void
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const login = useSession((s) => s.login)
  const register = useSession((s) => s.register)
  const isGuestDeck = useDeck((s) => s.activeDeckId === LOCAL_DECK_ID)
  const localCards = useCards()
  const toast = useToast()

  const t = useT()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else await register(email.trim(), password, displayName.trim() || undefined)

      toast(mode === 'login' ? t('auth.loggedIn') : t('auth.registered'))
      setPassword('')
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e, t, t('auth.failed')))
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = email.includes('@') && password.length >= (mode === 'register' ? 8 : 1)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
      description={t('auth.description')}
      size="sm"
      footer={
        <>
          <button
            className="btn-ghost mr-auto text-xs"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError(null)
            }}
          >
            {mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
          </button>
          <button className="btn-soft" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={submit} disabled={!canSubmit || busy}>
            {busy ? t('common.loading') : mode === 'login' ? t('account.login') : t('common.create')}
          </button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit && !busy) void submit()
        }}
      >
        {mode === 'register' && (
          <Field label={t('auth.name', { optional: t('common.optional') })}>
            <input
              className="field"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('auth.namePlaceholder')}
              autoComplete="nickname"
            />
          </Field>
        )}

        <Field label={t('auth.email')}>
          <input
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
          />
        </Field>

        <Field label={mode === 'register' ? t('auth.passwordMin') : t('auth.password')}>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
        </Field>

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-[13px] text-rose-600 dark:text-rose-300">
            <Icon name="info" size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {isGuestDeck && localCards.length > 0 && (
          <p className="rounded-xl bg-brand-500/8 px-3 py-2 text-[12px] text-ink-600 dark:text-ink-300">
            {mode === 'register' ? (
              t('auth.migrateHint', { count: localCards.length })
            ) : (
              t('auth.noMigrateHint')
            )}
          </p>
        )}

        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{label}</span>
      {children}
    </label>
  )
}
