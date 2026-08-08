import { activeLocale, createTranslator, type TranslateParams } from './core'
import { ru } from './ru'
import { uk } from './uk'
import type { MessageKey } from './uk'

/**
 * Переклад для чистих функцій форматування (`date.ts`, `sm2.ts`). Окремий
 * файл, а не `index.ts`, щоб вони не тягнули за собою React і `useDeck` —
 * інакше вийшов би цикл імпортів: useDeck → date.ts → i18n → useDeck.
 */
export function translateUnits(key: MessageKey, params?: TranslateParams): string {
  const locale = activeLocale()
  return createTranslator(locale === 'ru' ? ru : uk, locale)(key, params)
}
