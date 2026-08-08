import { useRef, useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n'
import { QUIZ_SAMPLE, QuizImportError, parseQuizImport } from '@/lib/quizImport'
import type { Quiz } from '@/lib/quizTypes'
import { useQuizzes } from '@/store/useQuizzes'

interface QuizImportDialogProps {
  open: boolean
  onClose: () => void
}

/** Імпорт вікторин із JSON — за зразком ImportDialog для карток. */
export function QuizImportDialog({ open, onClose }: QuizImportDialogProps) {
  const addQuizzes = useQuizzes((s) => s.addQuizzes)
  const toast = useToast()
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [parsed, setParsed] = useState<Quiz[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyse = (value: string) => {
    setText(value)
    setError(null)
    setParsed(null)
    if (!value.trim()) return

    try {
      setParsed(parseQuizImport(value))
    } catch (e) {
      setError(e instanceof QuizImportError ? e.message : t('import.unreadable'))
    }
  }

  const readFile = async (file: File) => {
    if (!/\.(json|txt)$/i.test(file.name)) {
      setError(t('import.onlyJson'))
      return
    }
    analyse(await file.text())
  }

  const confirmImport = () => {
    if (!parsed) return
    const added = addQuizzes(parsed)
    toast(added === 1 ? t('quiz.import.done') : t('quiz.import.doneMany', { count: added }))
    setText('')
    setParsed(null)
    setError(null)
    onClose()
  }

  const totalQuestions = parsed?.reduce((sum, q) => sum + q.questions.length, 0) ?? 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('quiz.import.title')}
      description={t('quiz.import.description')}
      size="lg"
      footer={
        <>
          <button className="btn-soft" onClick={onClose}>
            {t('common.close')}
          </button>
          <button className="btn-primary" onClick={confirmImport} disabled={!parsed}>
            <Icon name="upload" size={16} />
            {parsed ? t('import.doImportCount', { count: parsed.length }) : t('import.doImport')}
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
          <p className="text-sm font-medium">{t('import.dropzone')}</p>
          <p className="text-xs text-ink-400">{t('quiz.import.dropzoneHint')}</p>
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
              {t('import.paste')}
            </span>
            <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => analyse(QUIZ_SAMPLE)}>
              {t('import.sample')}
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => analyse(e.target.value)}
            rows={9}
            spellCheck={false}
            placeholder={QUIZ_SAMPLE}
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
          <div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3.5">
            <p className="flex items-center gap-2 text-[13px] font-medium text-emerald-700 dark:text-emerald-300">
              <Icon name="check" size={15} />
              {t('quiz.import.recognized', { quizzes: parsed.length, questions: totalQuestions })}
            </p>
            <ul className="space-y-1 text-[12px] text-ink-500 dark:text-ink-400">
              {parsed.slice(0, 3).map((quiz, i) => (
                <li key={i} className="truncate">
                  · {t('quiz.import.item', { title: quiz.title, count: quiz.questions.length })}
                </li>
              ))}
              {parsed.length > 3 && <li>· {t('import.more', { count: parsed.length - 3 })}</li>}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
