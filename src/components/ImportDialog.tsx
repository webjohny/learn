import { useRef, useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { ImportError, download, parseImport } from '@/lib/deck'
import { buildBackup, useDeck, type BackupPayload } from '@/store/useDeck'
import type { Card } from '@/types'

const SAMPLE = `[
  {
    "category": "Morning & Coffee",
    "front": "Нічого особливого, просто розгойдуюся зранку.",
    "back": "Not much, just *[getting through]* the morning.",
    "tags": ["casual", "morning"],
    "difficulty": "medium"
  }
]`

type Mode = 'merge' | 'replace'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
}

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const importCards = useDeck((s) => s.importCards)
  const restoreBackup = useDeck((s) => s.restoreBackup)
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('merge')
  const [dragging, setDragging] = useState(false)
  const [parsed, setParsed] = useState<{ cards: Card[]; isBackup: boolean; raw: unknown } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const analyse = (value: string) => {
    setText(value)
    setError(null)
    setParsed(null)
    if (!value.trim()) return

    try {
      setParsed(parseImport(value))
    } catch (e) {
      setError(e instanceof ImportError ? e.message : 'Не вдалося прочитати файл.')
    }
  }

  const readFile = async (file: File) => {
    if (!/\.(json|txt)$/i.test(file.name)) {
      setError('Підтримуються лише .json файли.')
      return
    }
    analyse(await file.text())
  }

  const confirmImport = () => {
    if (!parsed) return
    const added = importCards(parsed.cards, mode)
    toast(
      mode === 'replace'
        ? `Колоду замінено: ${added} карток`
        : added
          ? `Додано ${added} нових карток`
          : 'Нових карток не знайдено — усі вже є в колоді',
      added || mode === 'replace' ? 'success' : 'info',
    )
    reset()
    onClose()
  }

  const confirmRestore = () => {
    if (!parsed?.isBackup) return
    restoreBackup(parsed.raw as BackupPayload)
    toast('Бекап відновлено разом із прогресом')
    reset()
    onClose()
  }

  const reset = () => {
    setText('')
    setParsed(null)
    setError(null)
  }

  const exportDeck = () => {
    const { cards } = buildBackup(useDeck.getState())
    download(
      `phrase-deck-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(cards, null, 2),
    )
    toast('Колоду вивантажено')
  }

  const exportBackup = () => {
    download(
      `phrase-deck-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(buildBackup(useDeck.getState()), null, 2),
    )
    toast('Бекап із прогресом вивантажено')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Дані колоди"
      description="Імпорт JSON, експорт колоди та повний бекап прогресу."
      size="lg"
      footer={
        <>
          <button className="btn-soft mr-auto" onClick={exportDeck}>
            <Icon name="download" size={16} /> Експорт колоди
          </button>
          <button className="btn-soft" onClick={exportBackup}>
            <Icon name="download" size={16} /> Бекап із прогресом
          </button>
          {parsed?.isBackup && (
            <button className="btn-soft" onClick={confirmRestore}>
              <Icon name="undo" size={16} /> Відновити бекап
            </button>
          )}
          <button className="btn-primary" onClick={confirmImport} disabled={!parsed}>
            <Icon name="upload" size={16} />
            {parsed ? `Імпортувати ${parsed.cards.length}` : 'Імпортувати'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) void readFile(file)
          }}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragging
              ? 'border-brand-500 bg-brand-500/8'
              : 'border-ink-200 hover:border-brand-500/50 dark:border-white/12'
          }`}
        >
          <Icon name="upload" size={24} className="text-ink-400" />
          <p className="text-sm font-medium">Перетягніть JSON-файл або натисніть, щоб обрати</p>
          <p className="text-xs text-ink-400">
            Підтримується масив карток або повний бекап додатка
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void readFile(file)
              e.target.value = ''
            }}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400">
              …або вставте JSON сюди
            </span>
            <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => analyse(SAMPLE)}>
              Показати приклад
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => analyse(e.target.value)}
            rows={7}
            spellCheck={false}
            placeholder={SAMPLE}
            className="field resize-y font-mono text-xs leading-relaxed"
          />
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2.5 text-[13px] text-rose-600 dark:text-rose-300">
            <Icon name="info" size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {parsed && (
          <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3.5">
            <p className="flex items-center gap-2 text-[13px] font-medium text-emerald-700 dark:text-emerald-300">
              <Icon name="check" size={15} />
              Розпізнано {parsed.cards.length} карток
              {parsed.isBackup && ' (повний бекап з прогресом)'}
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <ModeOption
                active={mode === 'merge'}
                onClick={() => setMode('merge')}
                title="Додати до колоди"
                description="Дублікати за текстом пропускаються, прогрес зберігається"
              />
              <ModeOption
                active={mode === 'replace'}
                onClick={() => setMode('replace')}
                title="Замінити колоду"
                description="Поточні картки буде видалено"
                danger
              />
            </div>

            <ul className="space-y-1 text-[12px] text-ink-500 dark:text-ink-400">
              {parsed.cards.slice(0, 3).map((card) => (
                <li key={card.id} className="truncate">
                  · {card.front} → {card.back}
                </li>
              ))}
              {parsed.cards.length > 3 && <li>· …ще {parsed.cards.length - 3}</li>}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

function ModeOption({
  active,
  onClick,
  title,
  description,
  danger = false,
}: {
  active: boolean
  onClick: () => void
  title: string
  description: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-colors ${
        active
          ? danger
            ? 'border-rose-500/50 bg-rose-500/10'
            : 'border-brand-500/50 bg-brand-500/10'
          : 'border-ink-200 hover:bg-ink-900/4 dark:border-white/10 dark:hover:bg-white/6'
      }`}
    >
      <span className="block text-[13px] font-semibold">{title}</span>
      <span className="mt-0.5 block text-[11px] text-ink-500 dark:text-ink-400">{description}</span>
    </button>
  )
}
