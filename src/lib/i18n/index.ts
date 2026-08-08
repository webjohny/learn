import { useMemo } from 'react'

import { useDeck } from '@/store/useDeck'
import { createTranslator, setActiveLocale, type Dictionary, type Locale, type TranslateParams } from './core'
import { ru } from './ru'
import { uk } from './uk'
import type { MessageKey } from './uk'

export { LOCALES, LOCALE_LABELS, detectLocale } from './core'
export type { Locale } from './core'
export type { MessageKey }

const DICTIONARIES: Record<Locale, Dictionary> = { uk, ru }

export type Translate = (key: MessageKey, params?: TranslateParams) => string

/** Перекладач поза React — для сторів і бібліотечного коду. */
export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  return createTranslator(DICTIONARIES[locale] ?? uk, locale)(key, params)
}

/**
 * Мова інтерфейсу лежить у налаштуваннях (вони вже persist-яться), тож вибір
 * переживає перезавантаження без окремого сховища.
 */
export function useLocale(): Locale {
  return useDeck((s) => s.settings.locale) ?? 'uk'
}

export function useT(): Translate {
  const locale = useLocale()
  // Синхронізуємо мову для чистих функцій форматування ще до першого рядка
  // розмітки — інакше одиниці («хв», «д») відставали б на один кадр.
  setActiveLocale(locale)
  return useMemo(() => createTranslator(DICTIONARIES[locale] ?? uk, locale), [locale])
}
