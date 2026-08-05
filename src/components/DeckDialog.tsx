import { useEffect, useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { LANGUAGES, findLanguage } from '@/lib/langs'
import { useDeck } from '@/store/useDeck'
import { useSession } from '@/store/useSession'

interface DeckDialogProps {
  open: boolean
  onClose: () => void
}

/** Створення та керування мовними парами акаунта. */
export function DeckDialog({ open, onClose }: DeckDialogProps) {
  const decks = useSession((s) => s.decks)
  const createDeck = useSession((s) => s.createDeck)
  const deleteDeck = useSession((s) => s.deleteDeck)
  const setActiveDeck = useDeck((s) => s.setActiveDeck)
  const activeDeckId = useDeck((s) => s.activeDeckId)
  const toast = useToast()

  const [name, setName] = useState('')
  const [sourceLang, setSourceLang] = useState('uk')
  const [targetLang, setTargetLang] = useState('de-DE')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setConfirmDelete(null)
    setName('')
  }, [open])

  // Підказуємо назву за обраною мовою, поки користувач не ввів свою.
  const suggestedName = `${findLanguage(targetLang).label} — розмовна`

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const deck = await createDeck({
        name: name.trim() || suggestedName,
        sourceLang,
        targetLang,
      })
      setActiveDeck(deck.id)
      toast(`Створено пару ${findLanguage(sourceLang).label} → ${findLanguage(targetLang).label}`)
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
      title="Мовні пари"
      description="Кожна пара — окрема колода з власним прогресом і голосом озвучення."
      footer={
        <>
          <button className="btn-soft" onClick={onClose}>
            Закрити
          </button>
          <button className="btn-primary" onClick={create} disabled={busy || sourceLang === targetLang}>
            <Icon name="plus" size={16} /> Створити
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <LangSelect label="Мова питання" value={sourceLang} onChange={setSourceLang} />
          <LangSelect label="Мова відповіді (TTS)" value={targetLang} onChange={setTargetLang} />
        </div>

        {sourceLang === targetLang && (
          <p className="text-[12px] text-amber-600 dark:text-amber-400">
            Мови питання й відповіді мають відрізнятися.
          </p>
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
          <p className="text-xs font-medium text-ink-500 dark:text-ink-400">Наявні пари</p>
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 dark:border-white/10"
            >
              <span className="text-sm">
                {findLanguage(deck.sourceLang).flag} → {findLanguage(deck.targetLang).flag}
              </span>
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
