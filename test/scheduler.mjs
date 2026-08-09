/**
 * Регресія на планувальник: SM-2 і побудова черги.
 * Запуск: `npm run test:sm2` (сервер не потрібен).
 */
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'node_modules/.cache-scheduler.mjs')

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
globalThis.window = { matchMedia: () => ({ matches: false }), localStorage: globalThis.localStorage }
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'uk', languages: ['uk'] },
  configurable: true,
})
globalThis.crypto ??= (await import('node:crypto')).webcrypto

await build({
  entryPoints: [resolve(ROOT, 'test/scheduler.entry.ts')],
  outfile: OUT,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['import', 'default'],
  alias: { '@': resolve(ROOT, 'src'), '@server': resolve(ROOT, 'server/src') },
  external: ['react'],
  logLevel: 'error',
})

const { schedule, isDue, isNew, buildQueue, requeue, DAY, MINUTE, RELEARN_MINUTES } = await import(
  pathToFileURL(OUT).href
)

let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

const NOW = new Date('2026-08-08T10:00:00.000Z')
const card = (over = {}) => ({
  id: 'c1', category: 'x', front: 'a', back: 'b', tags: [], difficulty: 'medium',
  nextReview: null, interval: 0, repetition: 0, efactor: 2.5, lapses: 0, ...over,
})
const daysUntil = (iso) => Math.round((new Date(iso) - NOW) / DAY)

console.log('\nНова картка: перші кроки')
const AGAIN = 0, HARD = 1, GOOD = 2, EASY = 3
check('Again → через 10 хв, не через день',
  Math.round((new Date(schedule(card(), AGAIN, NOW).card.nextReview) - NOW) / MINUTE) === RELEARN_MINUTES)
check('Again вимагає повернення в сесію', schedule(card(), AGAIN, NOW).requeue === true)
check('Good → 1 день', daysUntil(schedule(card(), GOOD, NOW).card.nextReview) === 1)
check('Easy → 3 дні', daysUntil(schedule(card(), EASY, NOW).card.nextReview) === 3)
check('Easy довше за Good',
  schedule(card(), EASY, NOW).card.interval > schedule(card(), GOOD, NOW).card.interval)

console.log('\nСходинки зростають, а не топчуться')
let c = card()
const ladder = []
for (let i = 0; i < 6; i++) {
  c = schedule(c, GOOD, NOW).card
  ladder.push(c.interval)
}
check(`інтервали зростають монотонно: ${ladder.join(' → ')}`,
  ladder.every((v, i) => i === 0 || v > ladder[i - 1]))
check('після 6 «Добре» інтервал > 30 днів', ladder[5] > 30, `${ladder[5]}`)

console.log('\nЗабув — відкат і облік')
const mature = card({ repetition: 5, interval: 40, efactor: 2.5, lapses: 1 })
const lapsed = schedule(mature, AGAIN, NOW).card
check('repetition скидається', lapsed.repetition === 0)
check('lapses росте', lapsed.lapses === 2)
check('EF падає', lapsed.efactor < mature.efactor, `${lapsed.efactor}`)
check('картка не вважається новою після провалу', !isNew(lapsed))
check('через 10 хв знову due', isDue(lapsed, NOW.getTime() + 11 * MINUTE))
check('одразу після провалу ще не due', !isDue(lapsed, NOW.getTime()))

console.log('\nЛегкість забуття не безмежна')
let sinking = card({ repetition: 3, interval: 10 })
for (let i = 0; i < 20; i++) sinking = schedule(sinking, AGAIN, NOW).card
check('EF не падає нижче 1.3', sinking.efactor >= 1.3, `${sinking.efactor}`)
let rising = card({ repetition: 3, interval: 10 })
for (let i = 0; i < 30; i++) rising = schedule(rising, EASY, NOW).card
check('EF не росте вище 3.2', rising.efactor <= 3.2, `${rising.efactor}`)
check('інтервал не перевищує 2 роки', rising.interval <= 730, `${rising.interval}`)

console.log('\nПорядок оцінок для зрілої картки')
const m = card({ repetition: 4, interval: 20, efactor: 2.5 })
const iv = (g) => schedule(m, g, NOW).card.interval
check(`Hard < Good < Easy: ${iv(HARD)} < ${iv(GOOD)} < ${iv(EASY)}`,
  iv(HARD) < iv(GOOD) && iv(GOOD) < iv(EASY))

console.log('\nЧерга: ліміти й відбір')
const iso = (offsetDays) => new Date(NOW.getTime() + offsetDays * DAY).toISOString()
const pool = [
  card({ id: 'due-old', repetition: 3, interval: 5, nextReview: iso(-3) }),
  card({ id: 'due-new', repetition: 3, interval: 5, nextReview: iso(-1) }),
  card({ id: 'future', repetition: 3, interval: 5, nextReview: iso(+5) }),
  card({ id: 'suspended', repetition: 3, interval: 5, nextReview: iso(-2), suspended: true }),
  card({ id: 'fresh-1' }),
  card({ id: 'fresh-2' }),
  card({ id: 'fresh-3' }),
]
const q = buildQueue(pool, 'srs', { newLeft: 2, reviewsLeft: 100, speedSize: 10 })
check('картки з майбутнім строком не потрапляють', !q.includes('future'))
check('призупинені не потрапляють', !q.includes('suspended'))
check('ліміт нових дотримано', q.filter((id) => id.startsWith('fresh')).length === 2, q.join(','))
check('прострочені раніше — першими', q.indexOf('due-old') < q.indexOf('due-new'))

const capped = buildQueue(pool, 'srs', { newLeft: 5, reviewsLeft: 3, speedSize: 10 })
check('денний ліміт відповідей обрізає чергу', capped.length === 3, `${capped.length}`)

const noNew = buildQueue(pool, 'srs', { newLeft: 0, reviewsLeft: 100, speedSize: 10 })
check('newLeft = 0 → жодної нової', noNew.every((id) => !id.startsWith('fresh')), noNew.join(','))

const exhausted = buildQueue(pool, 'srs', { newLeft: -4, reviewsLeft: -2, speedSize: 10 })
check('перевищені ліміти не дають від\'ємної черги', exhausted.length === 0, `${exhausted.length}`)

console.log('\nЧерга: спринт')
const sprint = buildQueue(pool, 'speed', { newLeft: 0, reviewsLeft: 0, speedSize: 4 })
check('спринт ігнорує денні ліміти', sprint.length === 4, `${sprint.length}`)
check('спринт не бере призупинених', !sprint.includes('suspended'))
check('спринт бере й майбутні (це тайм-атака)', sprint.includes('future'))

console.log('\nЧерга без нових карток')
const onlyDue = buildQueue(
  [card({ id: 'a', repetition: 2, interval: 3, nextReview: iso(-1) })],
  'srs',
  { newLeft: 10, reviewsLeft: 10, speedSize: 5 },
)
check('одна прострочена — черга з однієї', onlyDue.length === 1 && onlyDue[0] === 'a')
const onlyFresh = buildQueue([card({ id: 'f1' }), card({ id: 'f2' })], 'srs', {
  newLeft: 10, reviewsLeft: 10, speedSize: 5,
})
check('лише нові — обидві в черзі', onlyFresh.length === 2, onlyFresh.join(','))

console.log('\nПовернення забутої картки в чергу')
check('оцінка без «Забув» просто знімає картку', requeue(['a', 'b', 'c']).join() === 'b,c')
check(
  'забута картка відходить на REQUEUE_GAP назад',
  requeue(['a', 'b', 'c', 'd', 'e'], 'a').join() === 'b,c,d,a,e',
)
check(
  'у короткій черзі стає в кінець',
  requeue(['a', 'b', 'c'], 'a').join() === 'b,c,a',
)
check('передостання міняється місцями з останньою', requeue(['a', 'b'], 'a').join() === 'b,a')
// Саме цей випадок ламав кнопку «Забув»: черга не змінюється, тож зміни
// `currentId` немає — скидати відповідь мусить лічильник показів `step`.
check('остання забута лишається єдиною в черзі', requeue(['a'], 'a').join() === 'a')
check('остання відгадана спорожняє чергу', requeue(['a']).length === 0)

console.log(`\n${passed} пройдено, ${failed} провалено`)
process.exit(failed ? 1 : 0)
