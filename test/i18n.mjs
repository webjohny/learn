/**
 * Регресія на переклад: повнота словників, множина і мапінг серверних кодів
 * помилок. Запуск: `npm run test:i18n` (сервер не потрібен).
 */
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'node_modules/.cache-i18n.mjs')

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
globalThis.window = { matchMedia: () => ({ matches: false }), localStorage: globalThis.localStorage }
// У Node navigator лише для читання — перевизначаємо через defineProperty.
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'uk', languages: ['uk'] },
  configurable: true,
})
globalThis.crypto ??= (await import('node:crypto')).webcrypto

await build({
  entryPoints: [resolve(ROOT, 'test/i18n.entry.ts')],
  outfile: OUT,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['import', 'default'],
  alias: { '@': resolve(ROOT, 'src'), '@server': resolve(ROOT, 'server/src') },
  logLevel: 'error',
})

const { uk, ru, translate, apiErrorMessage, ApiError } = await import(pathToFileURL(OUT).href)

let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('\nПовнота словників')
const ukKeys = Object.keys(uk)
const ruKeys = Object.keys(ru)
check(`українська має ${ukKeys.length} ключів`, ukKeys.length > 250)
check('склад ключів збігається', ukKeys.length === ruKeys.length)
const missing = ukKeys.filter((k) => !(k in ru))
check('жодного неперекладеного ключа', missing.length === 0, missing.slice(0, 5).join(', '))
const empty = ukKeys.filter((k) => {
  const v = ru[k]
  return typeof v === 'string' ? !v.trim() : Object.values(v).some((f) => !String(f).trim())
})
check('порожніх перекладів немає', empty.length === 0, empty.slice(0, 5).join(', '))

console.log('\nМножина — три форми, не дві')
check('1 повторення', translate('uk', 'stats.activityHint', { count: 1 }).includes('1 повторення'))
check('3 повторення', translate('uk', 'stats.activityHint', { count: 3 }).includes('3 повторення'))
check('5 повторень', translate('uk', 'stats.activityHint', { count: 5 }).includes('5 повторень'))
check('ru: 1 повторение', translate('ru', 'stats.activityHint', { count: 1 }).includes('1 повторение'))
check('ru: 3 повторения', translate('ru', 'stats.activityHint', { count: 3 }).includes('3 повторения'))
check('ru: 5 повторений', translate('ru', 'stats.activityHint', { count: 5 }).includes('5 повторений'))

console.log('\nПідстановка значень')
check('{count} замінюється', !translate('uk', 'browse.showMore', { count: 7 }).includes('{'))
check(
  'кілька плейсхолдерів',
  translate('ru', 'browse.shown', { shown: 2, total: 9 }) === '2 из 9 карточек',
  translate('ru', 'browse.shown', { shown: 2, total: 9 }),
)

console.log('\nКоди помилок сервера')
const t = (key, params) => translate('ru', key, params)
const withCode = (code) => new ApiError('текст із сервера', 400, code)

check(
  'відомий код → переклад інтерфейсу',
  apiErrorMessage(withCode('auth.badCredentials'), t, 'fallback') === 'Неверная почта или пароль.',
  apiErrorMessage(withCode('auth.badCredentials'), t, 'fallback'),
)
check(
  'код валідації → переклад',
  apiErrorMessage(withCode('validation.password.minLength'), t, 'fallback').includes('8 символов'),
)
// Новий код на бекенді не має лишати користувача без пояснення.
check(
  'невідомий код → серверний текст',
  apiErrorMessage(withCode('some.brand.new.code'), t, 'fallback') === 'текст із сервера',
)
check(
  'помилка без коду → серверний текст',
  apiErrorMessage(new ApiError('офлайн', 0), t, 'fallback') === 'офлайн',
)
check('не-помилка → відкіт', apiErrorMessage(null, t, 'fallback') === 'fallback')

console.log(`\n${passed} пройдено, ${failed} провалено`)
process.exit(failed ? 1 : 0)
