import { useEffect, useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useCategories } from '@/store/selectors'
import { useDeck } from '@/store/useDeck'
import type { Card, Difficulty } from '@/types'

interface CardEditorProps {
  open: boolean
  /** null — створення нової картки */
  card: Card | null
  onClose: () => void
}

interface Draft {
  category: string
  front: string
  back: string
  tags: string
  difficulty: Difficulty
  note: string
}

const EMPTY: Draft = {
  category: '',
  front: '',
  back: '',
  tags: '',
  difficulty: 'medium',
  note: '',
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Легка' },
  { value: 'medium', label: 'Середня' },
  { value: 'hard', label: 'Складна' },
]

export function CardEditor({ open, card, onClose }: CardEditorProps) {
  const addCard = useDeck((s) => s.addCard)
  const updateCard = useDeck((s) => s.updateCard)
  const deleteCard = useDeck((s) => s.deleteCard)
  const categories = useCategories()
  const toast = useToast()

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setConfirmDelete(false)
    setDraft(
      card
        ? {
            category: card.category,
            front: card.front,
            back: card.back,
            tags: card.tags.join(', '),
            difficulty: card.difficulty,
            note: card.note ?? '',
          }
        : EMPTY,
    )
  }, [card, open])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const valid = draft.front.trim() && draft.back.trim()

  const save = () => {
    if (!valid) return
    const payload = {
      category: draft.category.trim() || 'Без категорії',
      front: draft.front.trim(),
      back: draft.back.trim(),
      tags: draft.tags,
      difficulty: draft.difficulty,
      note: draft.note.trim() || undefined,
    }

    if (card) {
      updateCard(card.id, {
        ...payload,
        tags: draft.tags
          .split(/[,\s]+/)
          .map((t) => t.replace(/^#/, '').toLowerCase())
          .filter(Boolean),
      })
      toast('Картку оновлено')
    } else {
      addCard(payload)
      toast('Картку додано')
    }
    onClose()
  }

  const remove = () => {
    if (!card) return
    if (!confirmDelete) return setConfirmDelete(true)
    deleteCard(card.id)
    toast('Картку видалено', 'info')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={card ? 'Редагувати картку' : 'Нова картка'}
      description="Оберніть ключову конструкцію в *[дужки]*, щоб сховати її під блюром."
      footer={
        <>
          {card && (
            <button
              className={`btn mr-auto gap-1.5 px-3 py-2 text-sm ${
                confirmDelete
                  ? 'bg-rose-600 text-white hover:bg-rose-500'
                  : 'text-rose-500 hover:bg-rose-500/10'
              }`}
              onClick={remove}
            >
              <Icon name="trash" size={15} />
              {confirmDelete ? 'Точно видалити?' : 'Видалити'}
            </button>
          )}
          <button className="btn-soft" onClick={onClose}>
            Скасувати
          </button>
          <button className="btn-primary" onClick={save} disabled={!valid}>
            <Icon name="check" size={16} /> Зберегти
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Labeled label="Українською (питання)">
          <textarea
            className="field min-h-20 resize-y"
            value={draft.front}
            onChange={(e) => set('front', e.target.value)}
            placeholder="Просто відпочивав удома з дружиною."
            autoFocus
          />
        </Labeled>

        <Labeled label="English (відповідь)">
          <textarea
            className="field min-h-20 resize-y"
            value={draft.back}
            onChange={(e) => set('back', e.target.value)}
            placeholder="Just *[kicked back]* at home with my wife."
          />
        </Labeled>

        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Категорія">
            <input
              className="field"
              list="editor-categories"
              value={draft.category}
              onChange={(e) => set('category', e.target.value)}
              placeholder="Small Talk"
            />
            <datalist id="editor-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Labeled>

          <Labeled label="Теги (через кому)">
            <input
              className="field"
              value={draft.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="casual, work-slack"
            />
          </Labeled>
        </div>

        <Labeled label="Підказка щодо вживання (необов’язково)">
          <input
            className="field"
            value={draft.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="kick back = розслаблятися"
          />
        </Labeled>

        <Labeled label="Складність">
          <div className="flex gap-1.5">
            {DIFFICULTIES.map((option) => (
              <button
                key={option.value}
                onClick={() => set('difficulty', option.value)}
                className={`btn flex-1 border py-2 text-sm ${
                  draft.difficulty === option.value
                    ? 'border-brand-500/40 bg-brand-500/12 text-brand-600 dark:text-brand-400'
                    : 'border-ink-200 text-ink-500 dark:border-white/10 dark:text-ink-400'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Labeled>
      </div>
    </Modal>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{label}</span>
      {children}
    </label>
  )
}
