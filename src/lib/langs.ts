/** Мови, доступні для мовних пар. `code` — BCP-47, як його очікує Web Speech API. */
export interface Language {
  code: string
  label: string
  flag: string
  /** Чи є для мови сенс у TTS (мови питання зазвичай не озвучуємо) */
  speech: boolean
}

export const LANGUAGES: Language[] = [
  { code: 'uk', label: 'Українська', flag: '🇺🇦', speech: true },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸', speech: true },
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧', speech: true },
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪', speech: true },
  { code: 'pl-PL', label: 'Polski', flag: '🇵🇱', speech: true },
  { code: 'es-ES', label: 'Español', flag: '🇪🇸', speech: true },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷', speech: true },
  { code: 'it-IT', label: 'Italiano', flag: '🇮🇹', speech: true },
  { code: 'pt-PT', label: 'Português', flag: '🇵🇹', speech: true },
  { code: 'nl-NL', label: 'Nederlands', flag: '🇳🇱', speech: true },
  { code: 'cs-CZ', label: 'Čeština', flag: '🇨🇿', speech: true },
  { code: 'bg-BG', label: 'Български', flag: '🇧🇬', speech: true },
  { code: 'tr-TR', label: 'Türkçe', flag: '🇹🇷', speech: true },
]

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]))

export function findLanguage(code: string | null | undefined): Language {
  if (!code) return { code: '', label: 'Без мови', flag: '📚', speech: false }
  return (
    BY_CODE.get(code) ??
    // Невідомий регіон — пробуємо базову мову ('en-AU' → 'en-US').
    LANGUAGES.find((l) => l.code.split('-')[0] === code.split('-')[0]) ?? {
      code,
      label: code,
      flag: '🌐',
      speech: true,
    }
  )
}

export function languageLabel(code: string): string {
  const lang = findLanguage(code)
  return `${lang.flag} ${lang.label}`
}

/** Короткий підпис колоди для перемикача: «🇺🇦 → 🇩🇪» або «📚» для предметної. */
export function pairLabel(sourceLang: string | null, targetLang: string | null): string {
  if (!sourceLang || !targetLang) return '📚'
  return `${findLanguage(sourceLang).flag} → ${findLanguage(targetLang).flag}`
}
