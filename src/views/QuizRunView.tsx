import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Icon } from '@/components/ui/Icon'
import { useT, type Translate } from '@/lib/i18n'
import { isCorrectSelection, type Quiz, type QuizQuestion } from '@/lib/quizTypes'
import { shuffle } from '@/lib/text'
import { useQuizzes } from '@/store/useQuizzes'

type Phase = 'intro' | 'question' | 'feedback' | 'done'

/** 'config' — порядок питань такий, як у самій вікторині. */
type QuestionOrder = 'config' | 'random'

interface Answered {
  question: QuizQuestion
  selected: string[]
  correct: boolean
}

export function QuizRunView() {
  const { id } = useParams<{ id: string }>()
  const quiz = useQuizzes((s) => s.quizzes.find((q) => q.id === id && !q.deletedAt))
  const recordRun = useQuizzes((s) => s.recordRun)
  const t = useT()

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('intro')
  const [selected, setSelected] = useState<string[]>([])
  const [answers, setAnswers] = useState<Answered[]>([])
  const [error, setError] = useState<string | null>(null)
  // Порядок фіксуємо на старті прогону: перемішувати на кожному рендері
  // означало б тасувати питання просто від зміни стану.
  const [questions, setQuestions] = useState<QuizQuestion[]>([])

  const question = questions[index]
  const total = questions.length
  const score = answers.filter((a) => a.correct).length

  if (!quiz) return <Missing t={t} />
  if (!quiz.questions.length) return <Missing empty quizId={quiz.id} t={t} />

  const start = (order: QuestionOrder) => {
    setQuestions(order === 'random' ? shuffle(quiz.questions) : quiz.questions)
    setIndex(0)
    setSelected([])
    setAnswers([])
    setError(null)
    setPhase('question')
  }

  if (phase === 'intro') return <Intro quiz={quiz} onStart={start} t={t} />

  const submit = () => {
    if (!question) return
    if (!selected.length) {
      setError(t('quiz.run.pickAnswer'))
      return
    }
    setError(null)

    const correct = isCorrectSelection(question, selected)
    const next = [...answers, { question, selected, correct }]
    setAnswers(next)

    const last = index + 1 >= total

    // Опитування не перериває потік фідбеком — розбір буде в кінці.
    if (quiz.mode === 'survey') {
      if (last) return finish(next)
      setIndex(index + 1)
      setSelected([])
      return
    }

    // З оцінкою — підсвічуємо варіанти прямо на питанні, зокрема й на останньому:
    // інакше остання відповідь була б єдиною, чию правильність не показали.
    setPhase('feedback')
  }

  const finish = (all: Answered[]) => {
    recordRun(quiz.id, all.filter((a) => a.correct).length, total)
    setPhase('done')
  }

  const goNext = () => {
    if (index + 1 >= total) return finish(answers)
    setIndex(index + 1)
    setSelected([])
    setPhase('question')
  }

  // «Ще раз» повертає до вибору порядку — це теж новий запуск вікторини.
  const restart = () => setPhase('intro')

  if (phase === 'done') {
    return <Summary quiz={quiz} answers={answers} score={score} total={total} onRestart={restart} t={t} />
  }

  if (!question) return <Missing t={t} />

  const multiple = question.type === 'multiple'
  // Фідбек показуємо на самому питанні: варіанти лишаються на екрані й
  // перефарбовуються, а не підміняються окремим екраном.
  const revealed = phase === 'feedback'
  const lastCorrect = revealed && answers[answers.length - 1]?.correct

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

        {question.description && (
          <p className="text-[14px] leading-relaxed text-ink-600 dark:text-ink-300">
            {question.description}
          </p>
        )}

        {question.subRules && question.subRules.length > 0 && (
          <ul className="space-y-1 border-l-2 border-brand-500/30 pl-3">
            {question.subRules.map((rule, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-ink-500 dark:text-ink-400">
                {rule}
              </li>
            ))}
          </ul>
        )}

        {question.code && <CodeBlock code={question.code} />}

        {multiple && (
          <p className="text-[11px] text-ink-400">{t('quiz.run.multipleHint')}</p>
        )}

        <div className="grid gap-2">
          {question.answers.map((answer) => {
            const checked = selected.includes(answer.id)
            // Після відповіді: правильні — зелені завжди (навіть непозначені,
            // щоб було видно, що саме треба було обрати); хибно обраний — червоний.
            const missed = revealed && answer.correct
            const wrong = revealed && checked && !answer.correct

            const tone = missed
              ? 'border-emerald-500/60 bg-emerald-500/12'
              : wrong
                ? 'border-rose-500/60 bg-rose-500/12'
                : checked
                  ? 'border-brand-500/50 bg-brand-500/10'
                  : revealed
                    ? 'border-ink-200 opacity-55 dark:border-white/10'
                    : 'border-ink-200 hover:bg-ink-900/4 dark:border-white/10 dark:hover:bg-white/6'

            const boxTone = missed
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : wrong
                ? 'border-rose-500 bg-rose-500 text-white'
                : checked
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-ink-300 dark:border-white/20'

            return (
              <button
                key={answer.id}
                onClick={() => toggle(answer.id)}
                disabled={revealed}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-[14px] transition-colors disabled:cursor-default ${tone}`}
              >
                <span
                  className={`grid size-[18px] shrink-0 place-items-center border-2 ${
                    multiple ? 'rounded' : 'rounded-full'
                  } ${boxTone}`}
                >
                  {missed && <Icon name="check" size={12} />}
                  {wrong && <Icon name="x" size={12} />}
                  {!revealed && checked && <Icon name="check" size={12} />}
                </span>
                <span className="min-w-0 flex-1">{answer.text}</span>
                {/* Колір сам по собі не має нести сенс — дублюємо словом. */}
                {missed && (
                  <span className="shrink-0 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {t('quiz.run.correctMark')}
                  </span>
                )}
                {wrong && (
                  <span className="shrink-0 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {t('quiz.run.yourPick')}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {revealed && (
          <p
            className={`flex items-center gap-1.5 text-[13px] font-semibold ${
              lastCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            <Icon name={lastCorrect ? 'check' : 'x'} size={15} />
            {lastCorrect ? t('quiz.run.correct') : t('quiz.run.incorrect')}
          </p>
        )}

        {error && <p className="text-[12px] text-amber-600 dark:text-amber-400">{error}</p>}
      </div>

      <div className="flex items-center gap-2">
        {quiz.mode === 'graded' && (
          <span className="chip">
            <Icon name="target" size={13} /> {score} / {answers.length}
          </span>
        )}
        {revealed ? (
          <button className="btn-primary ml-auto px-5 py-2.5" onClick={goNext}>
            {index + 1 >= total ? t('quiz.run.summary') : t('quiz.run.next')}
            <Icon name="chevronRight" size={16} />
          </button>
        ) : (
          <button className="btn-primary ml-auto px-5 py-2.5" onClick={submit}>
            <Icon name="check" size={16} /> {t('quiz.run.answer')}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Екран запуску. Показується перед кожним прогоном — зокрема й після «Ще раз»,
 * щоб порядок питань можна було змінити, не виходячи до переліку.
 */
function Intro({
  quiz,
  onStart,
  t,
}: {
  quiz: Quiz
  onStart: (order: QuestionOrder) => void
  t: Translate
}) {
  const options: { order: QuestionOrder; icon: 'list' | 'shuffle'; label: string; hint: string }[] = [
    {
      order: 'config',
      icon: 'list',
      label: t('quiz.run.orderConfig'),
      hint: t('quiz.run.orderConfigHint'),
    },
    {
      order: 'random',
      icon: 'shuffle',
      label: t('quiz.run.orderRandom'),
      hint: t('quiz.run.orderRandomHint'),
    },
  ]

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      <div className="surface space-y-5 p-6">
        <div className="space-y-1.5 text-center">
          <h2 className="text-xl font-semibold">{quiz.title}</h2>
          <p className="flex flex-wrap items-center justify-center gap-2 text-[12px] text-ink-400">
            <span className="chip">
              {quiz.mode === 'graded' ? t('quiz.list.graded') : t('quiz.list.survey')}
            </span>
            <span>{t('quiz.list.questions', { count: quiz.questions.length })}</span>
          </p>
        </div>

        <p className="text-center text-[13px] text-ink-500 dark:text-ink-400">
          {t('quiz.run.startHint')}
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.order}
              onClick={() => onStart(option.order)}
              className="flex items-center gap-3 rounded-xl border border-ink-200 p-3.5 text-left transition-colors hover:bg-ink-900/4 dark:border-white/10 dark:hover:bg-white/6"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500/12 text-brand-600 dark:text-brand-400">
                <Icon name={option.icon} size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold">{option.label}</span>
                <span className="block text-[11.5px] text-ink-400">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <Link to="/quiz" className="btn-soft">
          <Icon name="layers" size={16} /> {t('quiz.run.toList')}
        </Link>
      </div>
    </div>
  )
}

/**
 * Код показуємо як є: без підсвітки й без переносу рядків — відступи та
 * довжина рядка часто і є суттю питання. Довгі рядки скролять сам блок,
 * а не розтягують сторінку.
 */
function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="max-h-[50dvh] overflow-auto rounded-xl border border-ink-200 bg-ink-900/4 p-3 text-[12.5px] leading-relaxed dark:border-white/10 dark:bg-black/30">
      <code className="font-mono whitespace-pre">{code}</code>
    </pre>
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
  t,
}: {
  quiz: Quiz
  answers: Answered[]
  score: number
  total: number
  onRestart: () => void
  t: Translate
}) {
  const pct = total ? Math.round((score / total) * 100) : 0
  const survey = quiz.mode === 'survey'

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      <div className="surface flex flex-col items-center gap-3 p-6 text-center">
        <span className="text-5xl">{survey ? '✅' : pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</span>
        <h2 className="text-xl font-semibold">{t('quiz.run.finished')}</h2>
        <p className="text-2xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
          {score} / {total}
          <span className="ml-2 text-base font-medium text-ink-400">{pct}%</span>
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={onRestart}>
            <Icon name="rotate" size={16} /> {t('quiz.run.retry')}
          </button>
          <Link to="/quiz" className="btn-soft">
            <Icon name="layers" size={16} /> {t('quiz.run.toList')}
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-500 dark:text-ink-400">{t('quiz.run.review')}</p>
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
              {t('quiz.run.yourAnswer', {
                value:
                  a.question.answers
                    .filter((opt) => a.selected.includes(opt.id))
                    .map((opt) => opt.text)
                    .join(', ') || '—',
              })}
            </p>
            {!a.correct && (
              <p className="pl-[23px] text-[12px] text-emerald-600 dark:text-emerald-400">
                {t('quiz.run.rightAnswer', {
                  value: a.question.answers
                    .filter((opt) => opt.correct)
                    .map((opt) => opt.text)
                    .join(', '),
                })}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Missing({ empty = false, quizId, t }: { empty?: boolean; quizId?: string; t: Translate }) {
  return (
    <div className="surface flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <Icon name="info" size={26} className="text-ink-400" />
      <p className="text-sm font-medium">
        {empty ? t('quiz.run.noQuestions') : t('quiz.run.notFound')}
      </p>
      <div className="flex gap-2">
        {empty && quizId && (
          <Link to={`/quiz/${quizId}/edit`} className="btn-primary">
            <Icon name="edit" size={16} /> {t('quiz.run.addQuestions')}
          </Link>
        )}
        <Link to="/quiz" className="btn-soft">
          {t('quiz.run.toList')}
        </Link>
      </div>
    </div>
  )
}
