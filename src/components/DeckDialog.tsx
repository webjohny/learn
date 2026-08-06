import { useEffect, useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { DeckKind } from '@/lib/api'
import { LANGUAGES, findLanguage, pairLabel } from '@/lib/langs'
import { useDeck } from '@/store/useDeck'
import { useSession } from '@/store/useSession'

interface DeckDialogProps {
  open: boolean
  onClose: () => void
}

/** Готові теми для предметних колод — просто підказка назви, не обмеження. */
const SUBJECT_PRESETS = ['Підготовка до співбесіди', 'ПДР', 'Історія України', 'Терміни та поняття']

/** Створення та керування колодами акаунта: мовні пари й предмети. */
export function DeckDialog({ open, onClose }: DeckDialogProps) {
  const decks = useSession((s) => s.decks)
  const createDeck = useSession((s) => s.createDeck)
  const deleteDeck = useSession((s) => s.deleteDeck)
  const setActiveDeck = useDeck((s) => s.setActiveDeck)
  const activeDeckId = useDeck((s) => s.activeDeckId)
  const toast = useToast()

  const [kind, setKind] = useState<DeckKind>('language')
  const [name, setName] = useState('')
  const [sourceLang, setSourceLang] = useState('uk')
  const [targetLang, setTargetLang] = useState('de-DE')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const isLanguage = kind === 'language'

  useEffect(() => {
    if (!open) return
    setError(null)
    setConfirmDelete(null)
    setName('')
    setKind('language')
  }, [open])

  // Підказуємо назву за обраною мовою, поки користувач не ввів свою.
  const suggestedName = isLanguage ? `${findLanguage(targetLang).label} — розмовна` : 'Нова тема'
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
          ? `Створено пару ${findLanguage(sourceLang).label} → ${findLanguage(targetLang).label}`
          : `Створено колоду «${deck.name}»`,
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося створити колоду.')
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
      toast('Колоду видалено', 'info')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося видалити колоду.')
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Колоди"
      description="Кожна колода має власні картки, прогрес і налаштування."
      footer={
        <>
          <button className="btn-soft" onClick={onClose}>
            Закрити
          </button>
          <button className="btn-primary" onClick={create} disabled={busy || sameLangs}>
            <Icon name="plus" size={16} /> Створити
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1 rounded-xl bg-ink-900/5 p-1 dark:bg-white/6">
          <KindTab
            active={isLanguage}
            onClick={() => setKind('language')}
            title="Мовна пара"
            hint="Переклад, озвучення, друк"
          />
          <KindTab
            active={!isLanguage}
            onClick={() => setKind('subject')}
            title="Предмет"
            hint="Питання → відповідь: ПДР, співбесіда"
          />
        </div>

        {isLanguage ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <LangSelect label="Мова питання" value={sourceLang} onChange={setSourceLang} />
              <LangSelect label="Мова відповіді (TTS)" value={targetLang} onChange={setTargetLang} />
            </div>

            {sameLangs && (
              <p className="text-[12px] text-amber-600 dark:text-amber-400">
                Мови питання й відповіді мають відрізнятися.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {SUBJECT_PRESETS.map((preset) => (
              <button key={preset} className="chip hover:bg-brand-500/12" onClick={() => setName(preset)}>
                {preset}
              </button>
            ))}
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Назва колоди</span>
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
          <p className="text-xs font-medium text-ink-500 dark:text-ink-400">Наявні колоди</p>
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 dark:border-white/10"
            >
              <span className="text-sm">{pairLabel(deck.sourceLang, deck.targetLang)}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{deck.name}</span>
              {deck.id === activeDeckId && <span className="chip">активна</span>}
              <button
                className={`btn px-2 py-1 text-xs ${
                  confirmDelete === deck.id
                    ? 'bg-rose-600 text-white'
                    : 'text-rose-500 hover:bg-rose-500/10'
                }`}
                onClick={() => remove(deck.id)}
                disabled={decks.length <= 1}
                title={decks.length <= 1 ? 'Останню колоду видалити не можна' : 'Видалити'}
              >
                <Icon name="trash" size={14} />
                {confirmDelete === deck.id && 'Точно?'}
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
