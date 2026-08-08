import { useEffect, useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { DeckKind } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { apiErrorMessage } from '@/lib/i18n/apiError'
import { LANGUAGES, findLanguage, pairLabel } from '@/lib/langs'
import { useDeck } from '@/store/useDeck'
import { useSession } from '@/store/useSession'

interface DeckDialogProps {
  open: boolean
  onClose: () => void
}

/** Створення та керування колодами акаунта: мовні пари й предмети. */
export function DeckDialog({ open, onClose }: DeckDialogProps) {
  const decks = useSession((s) => s.decks)
  const createDeck = useSession((s) => s.createDeck)
  const deleteDeck = useSession((s) => s.deleteDeck)
  const setActiveDeck = useDeck((s) => s.setActiveDeck)
  const activeDeckId = useDeck((s) => s.activeDeckId)
  const toast = useToast()
  const t = useT()

  const [kind, setKind] = useState<DeckKind>('language')
  const [name, setName] = useState('')
  const [sourceLang, setSourceLang] = useState('uk')
  const [targetLang, setTargetLang] = useState('de-DE')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const isLanguage = kind === 'language'
  // Готові теми — просто підказка назви, не обмеження.
  const subjectPresets = t('deck.presets').split(',')

  useEffect(() => {
    if (!open) return
    setError(null)
    setConfirmDelete(null)
    setName('')
    setKind('language')
  }, [open])

  // Підказуємо назву за обраною мовою, поки користувач не ввів свою.
  const suggestedName = isLanguage
    ? t('deck.suggestedLanguage', { lang: findLanguage(targetLang).label })
    : t('deck.suggestedSubject')
  const sameLangs = isLanguage && sourceLang === targetLang

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const deck = await createDeck(
        isLanguage
          ? { name: name.trim() || suggestedName, kind, sourceLang, targetLang }
          : { name: name.trim() || suggestedName, kind },
      )
      setActiveDeck(deck.id)
      toast(
        isLanguage
          ? t('deck.createdPair', { source: findLanguage(sourceLang).label, target: findLanguage(targetLang).label })
          : t('deck.createdSubject', { name: deck.name }),
      )
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e, t, t('deck.createFailed')))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      return
    }
    try {
      await deleteDeck(id)
      toast(t('deck.deleted'), 'info')
    } catch (e) {
      setError(apiErrorMessage(e, t, t('deck.deleteFailed')))
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('deck.title')}
      description={t('deck.description')}
      footer={
        <>
          <button className="btn-soft" onClick={onClose}>
            {t('common.close')}
          </button>
          <button className="btn-primary" onClick={create} disabled={busy || sameLangs}>
            <Icon name="plus" size={16} /> {t('common.create')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1 rounded-xl bg-ink-900/5 p-1 dark:bg-white/6">
          <KindTab
            active={isLanguage}
            onClick={() => setKind('language')}
            title={t('deck.kindLanguage')}
            hint={t('deck.kindLanguageHint')}
          />
          <KindTab
            active={!isLanguage}
            onClick={() => setKind('subject')}
            title={t('deck.kindSubject')}
            hint={t('deck.kindSubjectHint')}
          />
        </div>

        {isLanguage ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <LangSelect label={t('deck.sourceLang')} value={sourceLang} onChange={setSourceLang} />
              <LangSelect label={t('deck.targetLang')} value={targetLang} onChange={setTargetLang} />
            </div>

            {sameLangs && (
              <p className="text-[12px] text-amber-600 dark:text-amber-400">
                {t('deck.sameLangs')}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {subjectPresets.map((preset) => (
              <button key={preset} className="chip hover:bg-brand-500/12" onClick={() => setName(preset)}>
                {preset}
              </button>
            ))}
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{t('deck.name')}</span>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={suggestedName}
          />
        </label>

        {error && (
          <p className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-[13px] text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="space-y-1.5 border-t border-ink-200/70 pt-3 dark:border-white/8">
          <p className="text-xs font-medium text-ink-500 dark:text-ink-400">{t('deck.existing')}</p>
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 dark:border-white/10"
            >
              <span className="text-sm">{pairLabel(deck.sourceLang, deck.targetLang)}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{deck.name}</span>
              {deck.id === activeDeckId && <span className="chip">{t('deck.active')}</span>}
              <button
                className={`btn px-2 py-1 text-xs ${
                  confirmDelete === deck.id
                    ? 'bg-rose-600 text-white'
                    : 'text-rose-500 hover:bg-rose-500/10'
                }`}
                onClick={() => remove(deck.id)}
                disabled={decks.length <= 1}
                title={decks.length <= 1 ? t('deck.lastOne') : t('common.delete')}
              >
                <Icon name="trash" size={14} />
                {confirmDelete === deck.id && t('common.sure')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function KindTab({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean
  onClick: () => void
  title: string
  hint: string
}) {
  return (
    <button
      onClick={onClick}
      className={`btn flex-1 flex-col items-start gap-0 px-3 py-2 text-left ${
        active
          ? 'bg-white text-ink-900 shadow-sm dark:bg-white/12 dark:text-white'
          : 'text-ink-500 dark:text-ink-400'
      }`}
    >
      <span className="text-[13px] font-medium">{title}</span>
      <span className="text-[11px] text-ink-400">{hint}</span>
    </button>
  )
}

function LangSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.label}
          </option>
        ))}
      </select>
    </label>
  )
}
