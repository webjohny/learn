import { Link, useParams } from 'react-router-dom'

import { Icon } from '@/components/ui/Icon'
import { newId } from '@/lib/deck'
import { useT } from '@/lib/i18n'
import type { QuizQuestion } from '@/lib/quizTypes'
import { emptyQuestion, useQuizzes } from '@/store/useQuizzes'

export function QuizEditorView() {
  const { id } = useParams<{ id: string }>()
  const quiz = useQuizzes((s) => s.quizzes.find((q) => q.id === id && !q.deletedAt))
  const updateQuiz = useQuizzes((s) => s.updateQuiz)
  const t = useT()

  if (!quiz) {
    return (
      <div className="surface flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Icon name="info" size={26} className="text-ink-400" />
        <p className="text-sm font-medium">{t('quiz.run.notFound')}</p>
        <Link to="/quiz" className="btn-soft">
          {t('quiz.run.toList')}
        </Link>
      </div>
    )
  }

  const setQuestions = (questions: QuizQuestion[]) => updateQuiz(quiz.id, { questions })

  const patchQuestion = (questionId: string, patch: Partial<QuizQuestion>) =>
    setQuestions(quiz.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)))

  /**
   * У `single` правильний варіант лише один — вибір нового знімає попередній,
   * інакше питання мовчки стало б мультивибірним при проходженні.
   */
  const toggleCorrect = (question: QuizQuestion, answerId: string) =>
    patchQuestion(question.id, {
      answers: question.answers.map((a) =>
        question.type === 'single'
          ? { ...a, correct: a.id === answerId }
          : a.id === answerId
            ? { ...a, correct: !a.correct }
            : a,
      ),
    })

  const changeType = (question: QuizQuestion, type: QuizQuestion['type']) => {
    const correct = question.answers.filter((a) => a.correct)
    // Перехід multiple → single з кількома правильними лишив би питання без
    // однозначної відповіді: лишаємо перший правильний.
    const answers =
      type === 'single' && correct.length > 1
        ? question.answers.map((a) => ({ ...a, correct: a.id === correct[0].id }))
        : question.answers
    patchQuestion(question.id, { type, answers })
  }

  const questionsWithoutCorrect = quiz.questions.filter((q) => !q.answers.some((a) => a.correct))

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      <div className="flex items-center gap-2">
        <Link to="/quiz" className="btn-ghost px-2 py-1.5 text-[13px]">
          <Icon name="chevronDown" size={15} className="rotate-90" /> {t('quiz.editor.back')}
        </Link>
        <Link
          to={`/quiz/${quiz.id}/run`}
          className={`btn-soft ml-auto px-3 py-1.5 text-[13px] ${
            quiz.questions.length ? '' : 'pointer-events-none opacity-40'
          }`}
        >
          <Icon name="play" size={14} /> {t('quiz.list.run')}
        </Link>
      </div>

      <section className="surface space-y-3 p-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{t('quiz.editor.name')}</span>
          <input
            className="field"
            value={quiz.title}
            onChange={(e) => updateQuiz(quiz.id, { title: e.target.value })}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-500 dark:text-ink-400">
            {t('quiz.editor.description', { optional: t('common.optional') })}
          </span>
          <input
            className="field"
            value={quiz.description ?? ''}
            onChange={(e) => updateQuiz(quiz.id, { description: e.target.value || null })}
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{t('quiz.editor.mode')}</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <ModeOption
              active={quiz.mode === 'graded'}
              onClick={() => updateQuiz(quiz.id, { mode: 'graded' })}
              title={t('quiz.editor.graded')}
              description={t('quiz.editor.gradedHint')}
            />
            <ModeOption
              active={quiz.mode === 'survey'}
              onClick={() => updateQuiz(quiz.id, { mode: 'survey' })}
              title={t('quiz.editor.survey')}
              description={t('quiz.editor.surveyHint')}
            />
          </div>
        </div>
      </section>

      {questionsWithoutCorrect.length > 0 && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
          {t('quiz.editor.noCorrectWarning', { count: questionsWithoutCorrect.length })}
        </p>
      )}

      <div className="space-y-2">
        {quiz.questions.map((question, index) => (
          <section key={question.id} className="surface space-y-3 p-4">
            <div className="flex items-center gap-2">
              <span className="chip shrink-0">#{index + 1}</span>
              <select
                className="field h-8 w-auto py-0 text-xs"
                value={question.type}
                onChange={(e) => changeType(question, e.target.value as QuizQuestion['type'])}
              >
                <option value="single">{t('quiz.editor.typeSingle')}</option>
                <option value="multiple">{t('quiz.editor.typeMultiple')}</option>
              </select>
              <button
                className="btn-ghost ml-auto px-2 py-1 text-rose-500 hover:bg-rose-500/10"
                onClick={() => setQuestions(quiz.questions.filter((q) => q.id !== question.id))}
                title={t('quiz.editor.deleteQuestion')}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>

            <textarea
              className="field resize-y"
              rows={2}
              placeholder={t('quiz.editor.questionText')}
              value={question.text}
              onChange={(e) => patchQuestion(question.id, { text: e.target.value })}
            />

            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-ink-400">{t('quiz.editor.qDescription', { optional: t('common.optional') })}</span>
              <textarea
                className="field resize-y text-[13px]"
                rows={2}
                placeholder={t('quiz.editor.qDescriptionHint')}
                value={question.description ?? ''}
                onChange={(e) =>
                  patchQuestion(question.id, { description: e.target.value || undefined })
                }
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-ink-400">
                {t('quiz.editor.subRules', { optional: t('common.optional') })}
              </span>
              <textarea
                className="field resize-y text-[13px]"
                rows={2}
                placeholder={t('quiz.editor.subRulesPlaceholder')}
                value={(question.subRules ?? []).join('\n')}
                onChange={(e) => {
                  const lines = e.target.value.split('\n').filter((l) => l.trim())
                  patchQuestion(question.id, { subRules: lines.length ? lines : undefined })
                }}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-ink-400">{t('quiz.editor.code', { optional: t('common.optional') })}</span>
              <textarea
                className="field resize-y font-mono text-[12.5px]"
                rows={4}
                spellCheck={false}
                placeholder="const a = [1, 2, 3]"
                // Значення не тримаємо: відступи в коді значущі.
                value={question.code ?? ''}
                onChange={(e) => patchQuestion(question.id, { code: e.target.value || undefined })}
              />
            </label>

            <div className="space-y-1.5">
              {question.answers.map((answer) => (
                <div key={answer.id} className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCorrect(question, answer.id)}
                    title={t('quiz.editor.markCorrect')}
                    className={`grid size-[22px] shrink-0 place-items-center border-2 ${
                      question.type === 'single' ? 'rounded-full' : 'rounded'
                    } ${
                      answer.correct
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-ink-300 dark:border-white/20'
                    }`}
                  >
                    {answer.correct && <Icon name="check" size={13} />}
                  </button>
                  <input
                    className="field h-9 flex-1 text-[13px]"
                    placeholder={t('quiz.editor.answerPlaceholder')}
                    value={answer.text}
                    onChange={(e) =>
                      patchQuestion(question.id, {
                        answers: question.answers.map((a) =>
                          a.id === answer.id ? { ...a, text: e.target.value } : a,
                        ),
                      })
                    }
                  />
                  <button
                    className="btn-ghost px-2 py-1 text-rose-500 hover:bg-rose-500/10 disabled:opacity-30"
                    disabled={question.answers.length <= 2}
                    title={
                      question.answers.length <= 2
                        ? t('quiz.editor.minTwo')
                        : t('quiz.editor.deleteAnswer')
                    }
                    onClick={() =>
                      patchQuestion(question.id, {
                        answers: question.answers.filter((a) => a.id !== answer.id),
                      })
                    }
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              ))}

              <button
                className="btn-ghost px-2 py-1 text-[12px]"
                onClick={() =>
                  patchQuestion(question.id, {
                    answers: [...question.answers, { id: newId(), text: '', correct: false }],
                  })
                }
              >
                <Icon name="plus" size={13} /> {t('quiz.editor.addAnswer')}
              </button>
            </div>
          </section>
        ))}
      </div>

      <button
        className="btn-soft w-full py-2.5"
        onClick={() => setQuestions([...quiz.questions, emptyQuestion()])}
      >
        <Icon name="plus" size={16} /> {t('quiz.editor.addQuestion')}
      </button>
    </div>
  )
}

function ModeOption({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean
  onClick: () => void
  title: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-colors ${
        active
          ? 'border-brand-500/50 bg-brand-500/10'
          : 'border-ink-200 hover:bg-ink-900/4 dark:border-white/10 dark:hover:bg-white/6'
      }`}
    >
      <span className="block text-[13px] font-semibold">{title}</span>
      <span className="mt-0.5 block text-[11px] text-ink-500 dark:text-ink-400">{description}</span>
    </button>
  )
}
