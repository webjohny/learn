import { ApiError } from '@/lib/api'
import type { Translate } from './index'
import { uk } from './uk'

/**
 * Текст помилки для користувача. Сервер віддає код (`auth.badCredentials`,
 * `validation.password.minLength`), клієнт має для нього переклад — і лише
 * якщо коду немає в словнику, показує серверний текст як є.
 * Так нові помилки на бекенді не залишають користувача без пояснення.
 */
export function apiErrorMessage(error: unknown, t: Translate, fallback: string): string {
  if (error instanceof ApiError && error.code) {
    const key = `error.${error.code}`
    if (key in uk) return t(key as keyof typeof uk)
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
