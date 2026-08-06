import { newId } from '@/lib/deck'
import type { Quiz, QuizAnswerOption, QuizMode, QuizQuestion, QuizQuestionType } from '@/lib/quizTypes'

/** Помилки імпорту вікторин — окремий клас, щоб UI відрізняв їх від решти. */
export class QuizImportError extends Error {}

const MODES: QuizMode[] = ['graded', 'survey']
const TYPES: QuizQuestionType[] = ['single', 'multiple']

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseAnswers(raw: unknown, where: string): QuizAnswerOption[] {
  if (!Array.isArray(raw)) {
    throw new QuizImportError(`${where}: поле "answers" має бути масивом.`)
  }

  const answers = raw.map((item, index) => {
    const record = asRecord(item)
    if (!record) throw new QuizImportError(`${where}, варіант #${index + 1}: очікується об'єкт.`)

    const text = asString(record.text)
    if (!text) {
      throw new QuizImportError(`${where}, варіант #${index + 1}: потрібне непорожнє поле "text".`)
    }

    // Приймаємо і `correct`, і `isCorrect` — друге зустрічається в експортах
    // інших інструментів і мовчазне ігнорування зробило б усі варіанти хибними.
    const correct = record.correct ?? record.isCorrect
    return { id: newId(), text, correct: correct === true }
  })

  if (!answers.length) throw new QuizImportError(`${where}: потрібен хоча б один варіант відповіді.`)
  if (!answers.some((a) => a.correct)) {
    throw new QuizImportError(`${where}: жоден варіант не позначено правильним.`)
  }

  return answers
}

/** Приймає і масив рядків, і один рядок із переносами. */
function parseSubRules(raw: unknown, where: string): string[] {
  if (raw === undefined || raw === null) return []

  if (typeof raw === 'string') {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  if (!Array.isArray(raw)) {
    throw new QuizImportError(`${where}: "subRules" має бути масивом рядків.`)
  }

  return raw.map((item) => asString(item)).filter(Boolean)
}

function parseQuestions(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) {
    throw new QuizImportError('Поле "questions" має бути масивом питань.')
  }

  const questions = raw.map((item, index) => {
    const where = `Питання #${index + 1}`
    const record = asRecord(item)
    if (!record) throw new QuizImportError(`${where}: очікується об'єкт.`)

    const text = asString(record.text)
    if (!text) throw new QuizImportError(`${where}: потрібне непорожнє поле "text".`)

    const rawType = asString(record.type, 'single')
    if (rawType && !TYPES.includes(rawType as QuizQuestionType)) {
      throw new QuizImportError(`${where}: тип "${rawType}" не підтримується (single або multiple).`)
    }

    const answers = parseAnswers(record.answers, where)
    const correctCount = answers.filter((a) => a.correct).length
    // Тип виводимо з даних, якщо він суперечить кількості правильних варіантів:
    // файл із двома правильними і type "single" інакше став би непрохідним.
    const type: QuizQuestionType =
      correctCount > 1 ? 'multiple' : (rawType as QuizQuestionType) || 'single'

    const question: QuizQuestion = { id: newId(), text, type, answers }

    const description = asString(record.description)
    if (description) question.description = description

    const subRules = parseSubRules(record.subRules, where)
    if (subRules.length) question.subRules = subRules

    // Код не тримаємо: відступи й переноси — це його зміст.
    if (typeof record.code === 'string' && record.code.trim()) question.code = record.code

    return question
  })

  if (!questions.length) throw new QuizImportError('У вікторині немає жодного питання.')
  return questions
}

/**
 * Приймає один об'єкт вікторини або масив таких. Усі id перевипускаються:
 * id з чужого файлу конфліктували б із наявними записами.
 */
export function parseQuizImport(text: string): Quiz[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new QuizImportError('Некоректний JSON — перевірте синтаксис файлу.')
  }

  const list = Array.isArray(data) ? data : [data]
  const now = new Date().toISOString()

  const quizzes = list.map((item, index) => {
    const record = asRecord(item)
    if (!record) throw new QuizImportError(`Вікторина #${index + 1}: очікується об'єкт.`)

    const title = asString(record.title)
    if (!title) throw new QuizImportError(`Вікторина #${index + 1}: потрібне поле "title".`)

    const rawMode = asString(record.mode, 'graded')
    if (rawMode && !MODES.includes(rawMode as QuizMode)) {
      throw new QuizImportError(
        `Вікторина «${title}»: mode "${rawMode}" не підтримується (graded або survey).`,
      )
    }

    return {
      id: newId(),
      title,
      description: asString(record.description) || null,
      mode: (rawMode as QuizMode) || 'graded',
      questions: parseQuestions(record.questions),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } satisfies Quiz
  })

  if (!quizzes.length) throw new QuizImportError('У файлі не знайдено жодної вікторини.')
  return quizzes
}

export const QUIZ_SAMPLE = `{
  "title": "ПДР: дорожні знаки",
  "mode": "graded",
  "questions": [
    {
      "text": "Що означає знак «Стоп»?",
      "description": "Знак встановлено перед перехрестям із головною дорогою.",
      "subRules": [
        "Зупинка обов'язкова навіть за відсутності інших авто",
        "Зупинятись треба перед стоп-лінією"
      ],
      "type": "single",
      "answers": [
        { "text": "Рух без зупинки заборонено", "correct": true },
        { "text": "Поступитися дорогою", "correct": false },
        { "text": "Обмеження швидкості", "correct": false }
      ]
    },
    {
      "text": "Що виведе цей код?",
      "code": "const a = [1, 2, 3]\\nconsole.log(a.map(x => x * 2))",
      "type": "single",
      "answers": [
        { "text": "[2, 4, 6]", "correct": true },
        { "text": "[1, 2, 3]", "correct": false }
      ]
    }
  ]
}`
