/**
 * Регресія на ізоляцію колод. Запуск: `npm run test:deck` (сервер не потрібен).
 *
 * Ловить клас помилок, через який картки однієї мовної пари опинялись в іншій,
 * а доробок гостя перетікав у наступний акаунт того самого браузера.
 * Тест-фреймворку в проєкті немає — бандлимо стор наявним esbuild і
 * ганяємо чисті дії, як це робить `server/test/smoke.mjs` для API.
 */
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'node_modules/.cache-deck-isolation.mjs')

// zustand/persist чіпає localStorage на етапі створення стора.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
// zustand/persist шукає сховище і через `window`, не лише через глобальну назву.
globalThis.window = { matchMedia: () => ({ matches: false }), localStorage: globalThis.localStorage }
globalThis.crypto ??= (await import('node:crypto')).webcrypto

await build({
  entryPoints: [resolve(ROOT, 'src/store/useDeck.ts')],
  outfile: OUT,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['import', 'default'],
  alias: { '@': resolve(ROOT, 'src'), '@server': resolve(ROOT, 'server/src') },
  logLevel: 'error',
})

const { useDeck, LOCAL_DECK_ID } = await import(pathToFileURL(OUT).href)

let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) {
    passed++
    console.log(`  \u2713 ${name}`)
  } else {
    failed++
    console.log(`  \u2717 ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
const s = () => useDeck.getState()
const cardsOf = (id) => (s().decks[id]?.cards ?? []).filter((c) => !c.deletedAt)

console.log('\nСтартовий стан')
check('гість має стартовий набір', cardsOf(LOCAL_DECK_ID).length > 0)

console.log('\nНова колода не успадковує чужих карток')
s().ensureDeck('deck-uk-bg')
check('щойно створена пара порожня', cardsOf('deck-uk-bg').length === 0)

s().setActiveDeck('deck-uk-bg')
s().addCard({ front: 'привіт', back: 'здравей' })
check('додана картка потрапила у свою пару', cardsOf('deck-uk-bg').length === 1)

s().ensureDeck('deck-uk-pl')
s().setActiveDeck('deck-uk-pl')
s().addCard({ front: 'привіт', back: 'cześć' })
check('друга пара має лише власну картку', cardsOf('deck-uk-pl').length === 1)
check(
  'перша пара не змінилась',
  cardsOf('deck-uk-bg').length === 1 && cardsOf('deck-uk-bg')[0].back === 'здравей',
)
check('гість не отримав карток з пар', !cardsOf(LOCAL_DECK_ID).some((c) => c.back === 'здравей'))

console.log('\nІмпорт б\'є лише в активну колоду')
s().setActiveDeck('deck-uk-bg')
const imported = s().importCards(
  [{ id: 'x1', front: 'дякую', back: 'благодаря', tags: [], difficulty: 'medium' }],
  'merge',
)
check('імпортовано в активну пару', imported === 1 && cardsOf('deck-uk-bg').length === 2)
check('сусідня пара не зачеплена', cardsOf('deck-uk-pl').length === 1)

console.log('\nВихід з акаунта прибирає колоди акаунта')
s().forgetServerDecks()
check('серверні колоди зникли', !s().decks['deck-uk-bg'] && !s().decks['deck-uk-pl'])
check('гостьова колода лишилась', cardsOf(LOCAL_DECK_ID).length > 0)
check('активною стала гостьова', s().activeDeckId === LOCAL_DECK_ID)

console.log('\nПеренесення гостя при реєстрації — разове')
s().setActiveDeck(LOCAL_DECK_ID)
s().addCard({ front: 'гостьова', back: 'guest-only' })
const guestBefore = cardsOf(LOCAL_DECK_ID).length
s().ensureDeck('deck-first')
const moved = s().migrateGuestCards('deck-first')
check('картки гостя переїхали', moved === guestBefore && cardsOf('deck-first').length === guestBefore)
check(
  'гостьова колода скинута до стартового набору',
  !cardsOf(LOCAL_DECK_ID).some((c) => c.back === 'guest-only'),
)

// Другий акаунт у тому ж браузері не має отримати доробок першого.
s().ensureDeck('deck-second')
const movedAgain = s().migrateGuestCards('deck-second')
check(
  'наступному акаунту дістався лише стартовий набір',
  !cardsOf('deck-second').some((c) => c.back === 'guest-only'),
  `перенесено ${movedAgain}`,
)

console.log(`\n${passed} пройдено, ${failed} провалено`)
process.exit(failed ? 1 : 0)
