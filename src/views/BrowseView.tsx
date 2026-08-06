import { useMemo, useState } from 'react'

import { CardEditor } from '@/components/CardEditor'
import { Icon } from '@/components/ui/Icon'
import { formatRelative } from '@/lib/date'
import { formatInterval, isNew } from '@/lib/sm2'
import { normalize, stripCloze } from '@/lib/text'
import { speak, ttsSupported } from '@/lib/tts'
import {
  matchesFilters,
  useCards,
  useCategories,
  useDeckData,
  useDeckProfile,
  useTags,
} from '@/store/selectors'
import { useDeck } from '@/store/useDeck'
import type { Card } from '@/types'

const PAGE = 40

export function BrowseView() {
  const cards = useCards()
  const { activeCategories, activeTags } = useDeckData()
  const settings = useDeck((s) => s.settings)
  const setActiveCategories = useDeck((s) => s.setActiveCategories)
  const setActiveTags = useDeck((s) => s.setActiveTags)
  const toggleSuspend = useDeck((s) => s.toggleSuspend)

  const categories = useCategories()
  const tags = useTags()

  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState<Card | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const { isLanguage, targetLang } = useDeckProfile()

  const filtered = useMemo(() => {
    const q = normalize(query)
    return cards.filter((card) => {
      if (!matchesFilters(card, activeCategories, activeTags)) return false
      if (!q) return true
      return (
        normalize(card.front).includes(q) ||
        normalize(card.back).includes(q) ||
        normalize(card.category).includes(q) ||
        card.tags.some((t) => t.includes(q))
      )
    })
  }, [cards, query, activeCategories, activeTags])

  const toggle = (list: string[], value: string, set: (next: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const openEditor = (card: Card | null) => {
    setEditing(card)
    setEditorOpen(true)
  }

  const filtersActive = activeCategories.length > 0 || activeTags.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
            placeholder="Пошук за фразою, категорією, тегом…"
            className="field pl-9"
          />
        </div>
        <button className="btn-primary shrink-0" onClick={() => openEditor(null)}>
          <Icon name="plus" size={16} />
          <span className="hidden sm:inline">Додати</span>
        </button>
      </div>

      <div className="space-y-2">
        <FilterRow
          title="Категорії"
          values={categories}
          active={activeCategories}
          onToggle={(v) => toggle(activeCategories, v, setActiveCategories)}
        />
        <FilterRow
          title="Теги"
          values={tags}
          active={activeTags}
          prefix="#"
          onToggle={(v) => toggle(activeTags, v, setActiveTags)}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-ink-400">
        <span>
          {filtered.length} з {cards.length} карток
          {filtersActive && ' · фільтр застосовано і до навчання'}
        </span>
        {filtersActive && (
          <button
            className="btn-ghost px-2 py-1 text-xs"
            onClick={() => {
              setActiveCategories([])
              setActiveTags([])
            }}
          >
            Скинути фільтри
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
        {filtered.slice(0, limit).map((card) => (
          <article
            key={card.id}
            className={`surface group flex items-start gap-3 p-3.5 transition-colors ${
              card.suspended ? 'opacity-50' : ''
            }`}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="chip bg-brand-500/12! text-brand-600! dark:text-brand-400!">
                  {card.category}
                </span>
                {card.tags.map((tag) => (
                  <span key={tag} className="chip">
                    #{tag}
                  </span>
                ))}
              </div>
              <p className="text-sm font-medium">{stripCloze(card.back)}</p>
              <p className="text-[13px] text-ink-500 dark:text-ink-400">{card.front}</p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
                <span>{isNew(card) ? '🆕 нова' : `⏱ ${formatRelative(card.nextReview)}`}</span>
                {!isNew(card) && <span>інтервал {formatInterval(card.interval)}</span>}
                <span>EF {card.efactor.toFixed(2)}</span>
                {(card.lapses ?? 0) > 0 && <span>забув {card.lapses}×</span>}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-1">
              {isLanguage && ttsSupported && (
                <button
                  className="btn-ghost px-2 py-1"
                  title="Прослухати"
                  onClick={() =>
                    speak(card.back, {
                      rate: settings.speechRate,
                      voiceURI: settings.voiceURI,
                      lang: targetLang,
                    })
                  }
                >
                  <Icon name="volume" size={15} />
                </button>
              )}
              <button
                className="btn-ghost px-2 py-1"
                title="Редагувати"
                onClick={() => openEditor(card)}
              >
                <Icon name="edit" size={15} />
              </button>
              <button
                className="btn-ghost px-2 py-1"
                title={card.suspended ? 'Повернути в навчання' : 'Призупинити'}
                onClick={() => toggleSuspend(card.id)}
              >
                <Icon name={card.suspended ? 'eyeOff' : 'eye'} size={15} />
              </button>
            </div>
          </article>
        ))}

        {filtered.length > limit && (
          <button className="btn-soft w-full" onClick={() => setLimit((l) => l + PAGE)}>
            Показати ще {Math.min(PAGE, filtered.length - limit)}
          </button>
        )}

        {!filtered.length && (
          <div className="surface flex flex-col items-center gap-3 p-10 text-center">
            <Icon name="search" size={26} className="text-ink-400" />
            <p className="text-sm text-ink-500 dark:text-ink-400">
              Нічого не знайдено. Спробуйте інший запит або додайте картку.
            </p>
            <button className="btn-primary" onClick={() => openEditor(null)}>
              <Icon name="plus" size={16} /> Нова картка
            </button>
          </div>
        )}
      </div>

      <CardEditor open={editorOpen} card={editing} onClose={() => setEditorOpen(false)} />
    </div>
  )
}

function FilterRow({
  title,
  values,
  active,
  onToggle,
  prefix = '',
}: {
  title: string
  values: string[]
  active: string[]
  onToggle: (value: string) => void
  prefix?: string
}) {
  if (!values.length) return null

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] font-medium text-ink-400">{title}</span>
      <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto py-0.5">
        {values.map((value) => {
          const on = active.includes(value)
          return (
            <button
              key={value}
              onClick={() => onToggle(value)}
              className={`chip shrink-0 whitespace-nowrap transition-colors ${
                on
                  ? 'bg-brand-500/18! text-brand-600! dark:text-brand-400!'
                  : 'hover:bg-ink-900/10 dark:hover:bg-white/12'
              }`}
            >
              {prefix}
              {value}
            </button>
          )
        })}
      </div>
    </div>
  )
}
