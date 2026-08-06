import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Icon } from '@/components/ui/Icon'
import { isCorrectSelection, type Quiz, type QuizQuestion } from '@/lib/quizTypes'
import { useQuizzes } from '@/store/useQuizzes'

type Phase = 'question' | 'feedback' | 'done'

interface Answered {
  question: QuizQuestion
  selected: string[]
  correct: boolean
}

export function QuizRunView() {
  const { id } = useParams<{ id: string }>()
  const quiz = useQuizzes((s) => s.quizzes.find((q) => q.id === id && !q.deletedAt))
  const recordRun = useQuizzes((s) => s.recordRun)

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('question')
  const [selected, setSelected] = useState<string[]>([])
  const [answers, setAnswers] = useState<Answered[]>([])
  const [error, setError] = useState<string | null>(null)

  const question = quiz?.questions[index]
  const total = quiz?.questions.length ?? 0
  const score = answers.filter((a) => a.correct).length

  if (!quiz) return <Missing />
  if (!total) return <Missing empty quizId={quiz.id} />

  const submit = () => {
    if (!question) return
    if (!selected.length) {
      setError('Оберіть відповідь.')
      return
    }
    setError(null)

    const correct = isCorrectSelection(question, selected)
    const next = [...answers, { question, selected, correct }]
    setAnswers(next)

    const last = index + 1 >= total
    if (last) {
      recordRun(quiz.id, next.filter((a) => a.correct).length, total)
      setPhase('done')
      return
    }

    // Опитування не перериває потік фідбеком — розбір буде в кінці.
    if (quiz.mode === 'survey') {
      setIndex(index + 1)
      setSelected([])
    } else {
      setPhase('feedback')
    }
  }

  const goNext = () => {
    setIndex(index + 1)
    setSelected([])
    setPhase('question')
  }

  const restart = () => {
    setIndex(0)
    setSelected([])
    setAnswers([])
    setError(null)
    setPhase('question')
  }

  if (phase === 'done') {
    return <Summary quiz={quiz} answers={answers} score={score} total={total} onRestart={restart} />
  }

  if (phase === 'feedback') {
    const last = answers[answers.length - 1]
    return (
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
        <Progress current={index + 1} total={total} />
        <div
          className={`surface flex items-center gap-3 p-4 ${
            last.correct
              ? 'border-emerald-500/30 bg-emerald-500/8'
              : 'border-rose-500/30 bg-rose-500/8'
          }`}
        >
          <Icon
            name={last.correct ? 'check' : 'info'}
            size={22}
            className={last.correct ? 'text-emerald-500' : 'text-rose-500'}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {last.correct ? 'Правильно' : 'Неправильно'}
            </p>
            {!last.correct && (
              <p className="mt-0.5 text-[13px] text-ink-500 dark:text-ink-400">
                Правильна відповідь:{' '}
                {last.question.answers
                  .filter((a) => a.correct)
                  .map((a) => a.text)
                  .join(', ')}
              </p>
            )}
          </div>
          <span className="chip shrink-0">
            {score} / {answers.length}
          </span>
        </div>

        <button className="btn-primary w-full py-3 text-base" onClick={goNext}>
          Далі <Icon name="chevronDown" size={16} className="-rotate-90" />
        </button>
      </div>
    )
  }

  if (!question) return <Missing />

  const multiple = question.type === 'multiple'

  const toggle = (answerId: string) => {
    setError(null)
    setSelected((prev) =>
      multiple
        ? prev.includes(answerId)
          ? prev.filter((a) => a !== answerId)
          : [...prev, answerId]
        : [answerId],
    )
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      <Progress current={index + 1} total={total} />

      <div className="surface space-y-4 p-5">
        <h2 className="text-balance text-[clamp(1.05rem,3.2vw,1.4rem)] leading-snug font-semibold">
          {question.text}
        </h2>

        {multiple && (
          <p className="text-[11px] text-ink-400">Можна обрати кілька варіантів</p>
        )}

        <div className="grid gap-2">
          {question.answers.map((answer) => {
            const checked = selected.includes(answer.id)
            return (
              <button
                key={answer.id}
                onClick={() => toggle(answer.id)}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-[14px] transition-colors ${
                  checked
                    ? 'border-brand-500/50 bg-brand-500/10'
                    : 'border-ink-200 hover:bg-ink-900/4 dark:border-white/10 dark:hover:bg-white/6'
                }`}
              >
                <span
                  className={`grid size-[18px] shrink-0 place-items-center border-2 ${
                    multiple ? 'rounded' : 'rounded-full'
                  } ${
                    checked
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-ink-300 dark:border-white/20'
                  }`}
                >
                  {checked && <Icon name="check" size={12} />}
                </span>
                <span className="min-w-0 flex-1">{answer.text}</span>
              </button>
            )
          })}
        </div>

        {error && <p className="text-[12px] text-amber-600 dark:text-amber-400">{error}</p>}
      </div>

      <div className="flex items-center gap-2">
        {quiz.mode === 'graded' && (
          <span className="chip">
            <Icon name="target" size={13} /> {score} / {answers.length}
          </span>
        )}
        <button className="btn-primary ml-auto px-5 py-2.5" onClick={submit}>
          <Icon name="check" size={16} /> Відповісти
        </button>
      </div>
    </div>
  )
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900/8 dark:bg-white/8">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
          style={{ width: `${((current - 1) / total) * 100}%` }}
        />
      </div>
      <span className="text-[11px] font-medium tabular-nums text-ink-400">
        {current} / {total}
      </span>
    </div>
  )
}

function Summary({
  quiz,
  answers,
  score,
  total,
  onRestart,
}: {
  quiz: Quiz
  answers: Answered[]
  score: number
  total: number
  onRestart: () => void
}) {
  const pct = total ? Math.round((score / total) * 100) : 0
  const survey = quiz.mode === 'survey'

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      <div className="surface flex flex-col items-center gap-3 p-6 text-center">
        <span className="text-5xl">{survey ? '✅' : pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</span>
        <h2 className="text-xl font-semibold">Вікторину пройдено</h2>
        <p className="text-2xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
          {score} / {total}
          <span className="ml-2 text-base font-medium text-ink-400">{pct}%</span>
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={onRestart}>
            <Icon name="rotate" size={16} /> Ще раз
          </button>
          <Link to="/quiz" className="btn-soft">
            <Icon name="layers" size={16} /> До переліку
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-500 dark:text-ink-400">Розбір відповідей</p>
        {answers.map((a, i) => (
          <div
            key={i}
            className={`surface space-y-1.5 p-3.5 ${
              a.correct ? 'border-emerald-500/25' : 'border-rose-500/25'
            }`}
          >
            <div className="flex items-start gap-2">
              <Icon
                name={a.correct ? 'check' : 'info'}
                size={15}
                className={`mt-0.5 shrink-0 ${a.correct ? 'text-emerald-500' : 'text-rose-500'}`}
              />
              <p className="min-w-0 flex-1 text-[13px] font-medium">{a.question.text}</p>
            </div>
            <p className="pl-[23px] text-[12px] text-ink-500 dark:text-ink-400">
              Ваша відповідь:{' '}
              {a.question.answers
                .filter((opt) => a.selected.includes(opt.id))
                .map((opt) => opt.text)
                .join(', ') || '—'}
            </p>
            {!a.correct && (
              <p className="pl-[23px] text-[12px] text-emerald-600 dark:text-emerald-400">
                Правильно:{' '}
                {a.question.answers
                  .filter((opt) => opt.correct)
                  .map((opt) => opt.text)
                  .join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Missing({ empty = false, quizId }: { empty?: boolean; quizId?: string }) {
  return (
    <div className="surface flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <Icon name="info" size={26} className="text-ink-400" />
      <p className="text-sm font-medium">
        {empty ? 'У цій вікторині ще немає питань' : 'Вікторину не знайдено'}
      </p>
      <div className="flex gap-2">
        {empty && quizId && (
          <Link to={`/quiz/${quizId}/edit`} className="btn-primary">
            <Icon name="edit" size={16} /> Додати питання
          </Link>
        )}
        <Link to="/quiz" className="btn-soft">
          До переліку
        </Link>
      </div>
    </div>
  )
}
