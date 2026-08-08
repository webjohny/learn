/**
 * Мінімальний i18n без залежностей.
 *
 * Українська — джерело істини: словник `ru` типизований від неї, тож забутий
 * ключ стає помилкою компіляції, а не порожнім місцем в інтерфейсі.
 * Множина рахується через `Intl.PluralRules` — у слов'янських мовах форм три,
 * і вгадувати їх вручну не варто.
 */

export const LOCALES = ['uk', 'ru'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  uk: 'Українська',
  ru: 'Русский',
}

/** Рядок або набір форм множини під `Intl.PluralRules`. */
export type Message = string | Partial<Record<Intl.LDMLPluralRule, string>>

export type Dictionary = Record<string, Message>

export interface TranslateParams {
  /** Вмикає вибір форми множини */
  count?: number
  [key: string]: string | number | undefined
}

const pluralRules = new Map<Locale, Intl.PluralRules>()

function pickForm(message: Message, locale: Locale, count?: number): string {
  if (typeof message === 'string') return message
  if (count === undefined) return message.other ?? ''

  let rules = pluralRules.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(locale)
    pluralRules.set(locale, rules)
  }

  const form = rules.select(count)
  return message[form] ?? message.other ?? ''
}

/** `Привіт, {name}` + `{count}` з підставленим числом. */
function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}

export function createTranslator(dictionary: Dictionary, locale: Locale) {
  return (key: string, params?: TranslateParams): string => {
    const message = dictionary[key]
    // Ключ без перекладу показуємо як є: краще видимий маркер, ніж порожнеча.
    if (message === undefined) return key
    return interpolate(pickForm(message, locale, params?.count), params)
  }
}

/**
 * Поточна мова поза React. Потрібна чистим функціям форматування
 * (`date.ts`, `sm2.ts`), які викликаються з коду без доступу до хуків.
 * Значення оновлює i18n-шар на кожному рендері — розсинхрону не буває.
 */
let active: Locale = 'uk'

export function setActiveLocale(locale: Locale) {
  active = locale
}

export function activeLocale(): Locale {
  return active
}

/** Мова інтерфейсу при першому запуску — за системною, з відкатом на українську. */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'uk'
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag?.split('-')[0]
    if (LOCALES.includes(base as Locale)) return base as Locale
  }
  return 'uk'
}
