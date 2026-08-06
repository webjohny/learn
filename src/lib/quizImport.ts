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

    return { id: newId(), text, type, answers }
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
      "type": "single",
      "answers": [
        { "text": "Рух без зупинки заборонено", "correct": true },
        { "text": "Поступитися дорогою", "correct": false },
        { "text": "Обмеження швидкості", "correct": false }
      ]
    }
  ]
}`
