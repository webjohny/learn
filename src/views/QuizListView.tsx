import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { QuizImportDialog } from '@/components/QuizImportDialog'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { download } from '@/lib/deck'
import { formatRelative } from '@/lib/date'
import type { Quiz } from '@/lib/quizTypes'
import { useQuizzes } from '@/store/useQuizzes'

export function QuizListView() {
  const quizzes = useQuizzes((s) => s.quizzes)
  const runs = useQuizzes((s) => s.runs)
  const createQuiz = useQuizzes((s) => s.createQuiz)
  const deleteQuiz = useQuizzes((s) => s.deleteQuiz)
  const navigate = useNavigate()
  const toast = useToast()

  const [importOpen, setImportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const visible = useMemo(() => quizzes.filter((q) => !q.deletedAt), [quizzes])

  const lastRunOf = (quizId: string) =>
    runs
      .filter((r) => r.quizId === quizId)
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0]

  const create = () => {
    const quiz = createQuiz('Нова вікторина', 'graded')
    navigate(`/quiz/${quiz.id}/edit`)
  }

  const exportQuiz = (quiz: Quiz) => {
    // Службові поля не експортуємо: id перевипускаються при імпорті.
    const payload = {
      title: quiz.title,
      description: quiz.description,
      mode: quiz.mode,
      questions: quiz.questions.map((q) => ({
        text: q.text,
        // Порожні поля не пишемо — інакше експорт обростає "description": null.
        ...(q.description ? { description: q.description } : {}),
        ...(q.subRules?.length ? { subRules: q.subRules } : {}),
        ...(q.code ? { code: q.code } : {}),
        type: q.type,
        answers: q.answers.map((a) => ({ text: a.text, correct: a.correct })),
      })),
    }
    const slug = quiz.title.toLowerCase().replace(/[^\wа-яіїєґ]+/gi, '-').slice(0, 40)
    download(`quiz-${slug || 'export'}.json`, JSON.stringify(payload, null, 2))
    toast('Вікторину вивантажено')
  }

  const remove = (quiz: Quiz) => {
    if (confirmDelete !== quiz.id) {
      setConfirmDelete(quiz.id)
      return
    }
    deleteQuiz(quiz.id)
    setConfirmDelete(null)
    toast('Вікторину видалено', 'info')
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={create}>
          <Icon name="plus" size={16} /> Створити
        </button>
        <button className="btn-soft" onClick={() => setImportOpen(true)}>
          <Icon name="upload" size={16} /> Імпортувати JSON
        </button>
        {visible.length > 0 && (
          <span className="ml-auto text-[11px] text-ink-400">
            {visible.length} {visible.length === 1 ? 'вікторина' : 'вікторин'}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-500 text-white shadow-lg shadow-brand-500/25">
            <Icon name="target" size={22} />
          </span>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Тут поки порожньо</h2>
            <p className="mx-auto max-w-sm text-[13px] text-ink-500 dark:text-ink-400">
              Вікторини — окремий тренажер: питання з варіантами відповідей, без
              інтервальних повторень. Створіть свою або завантажте готову з JSON.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((quiz) => {
            const lastRun = lastRunOf(quiz.id)
            const empty = quiz.questions.length === 0
            return (
              <div key={quiz.id} className="surface flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{quiz.title}</span>
                    <span className="chip">{quiz.mode === 'graded' ? 'з оцінкою' : 'опитування'}</span>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
                    <span>
                      {quiz.questions.length}{' '}
                      {quiz.questions.length === 1 ? 'питання' : 'питань'}
                    </span>
                    {lastRun && (
                      <span>
                        останній результат {lastRun.score}/{lastRun.total} ·{' '}
                        {formatRelative(lastRun.finishedAt)}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    to={`/quiz/${quiz.id}/run`}
                    className={`btn-soft px-2.5 py-1.5 text-xs ${
                      empty ? 'pointer-events-none opacity-40' : ''
                    }`}
                    title={empty ? 'Спершу додайте питання' : 'Пройти'}
                  >
                    <Icon name="play" size={14} /> Пройти
                  </Link>
                  <Link
                    to={`/quiz/${quiz.id}/edit`}
                    className="btn-ghost px-2 py-1"
                    title="Редагувати"
                  >
                    <Icon name="edit" size={15} />
                  </Link>
                  <button
                    className="btn-ghost px-2 py-1"
                    onClick={() => exportQuiz(quiz)}
                    title="Експорт JSON"
                  >
                    <Icon name="download" size={15} />
                  </button>
                  <button
                    className={`btn px-2 py-1 text-xs ${
                      confirmDelete === quiz.id
                        ? 'bg-rose-600 text-white'
                        : 'text-rose-500 hover:bg-rose-500/10'
                    }`}
                    onClick={() => remove(quiz)}
                    title="Видалити"
                  >
                    <Icon name="trash" size={14} />
                    {confirmDelete === quiz.id && 'Точно?'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <QuizImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
