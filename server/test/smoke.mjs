/**
 * Наскрізний smoke-тест API. Запуск: `npm run test:api` (сервер має бути піднятий).
 * Перевіряє авторизацію, ізоляцію користувачів, мовні пари та злиття синхронізації.
 */
const BASE = process.env.API_BASE ?? 'http://localhost:8787'

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

/** Мінімальний клієнт із власною «банкою» cookie — імітує окремий браузер. */
function createClient() {
  let cookie = ''
  return async function request(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const setCookie = res.headers.getSetCookie?.() ?? []
    for (const raw of setCookie) {
      const pair = raw.split(';')[0]
      if (pair.startsWith('pd_session=')) cookie = pair
    }

    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { status: res.status, data }
  }
}

const uniq = Date.now()
// Унікальні на кожен запуск — інакше тест не переживає повторного прогону
// на тій самій БД (id карток унікальні глобально).
const CARD_ID = `card-${uniq}`
const alice = createClient()
const bob = createClient()

section('Реєстрація та сесія')
const registered = await alice('POST', '/api/auth/register', {
  email: `alice${uniq}@example.com`,
  password: 'supersecret1',
  displayName: 'Аліса',
})
check('register → 201', registered.status === 201, `отримано ${registered.status}`)
check('повертає користувача', registered.data?.user?.email === `alice${uniq}@example.com`)
check('display name у UTF-8 не побився', registered.data?.user?.displayName === 'Аліса')
check('одразу створено колоду за замовчуванням', registered.data?.decks?.length === 1)
check(
  'колода за замовчуванням — uk → en-US',
  registered.data?.decks?.[0]?.sourceLang === 'uk' &&
    registered.data?.decks?.[0]?.targetLang === 'en-US',
)

const me = await alice('GET', '/api/auth/me')
check('me → 200 за сесійною cookie', me.status === 200)

section('Валідація')
const weak = await alice('POST', '/api/auth/register', {
  email: `weak${uniq}@example.com`,
  password: '123',
})
check('короткий пароль → 400', weak.status === 400, `отримано ${weak.status}`)
check('повідомлення українською', String(weak.data?.message ?? '').includes('щонайменше 8'))

const badEmail = await alice('POST', '/api/auth/register', {
  email: 'not-an-email',
  password: 'supersecret1',
})
check('некоректний email → 400', badEmail.status === 400)

const dup = await alice('POST', '/api/auth/register', {
  email: `alice${uniq}@example.com`,
  password: 'supersecret1',
})
check('дубль пошти → 409', dup.status === 409, `отримано ${dup.status}`)

const wrongPass = await createClient()('POST', '/api/auth/login', {
  email: `alice${uniq}@example.com`,
  password: 'wrongpassword',
})
check('невірний пароль → 401', wrongPass.status === 401)

const anon = await createClient()('GET', '/api/decks')
check('без сесії → 401', anon.status === 401)

section('Мовні пари')
const german = await alice('POST', '/api/decks', {
  name: 'Німецька для роботи',
  sourceLang: 'uk',
  targetLang: 'de-DE',
})
check('створення колоди uk → de-DE', german.status === 201, `отримано ${german.status}`)
const germanDeck = german.data?.deck

const badLang = await alice('POST', '/api/decks', {
  name: 'Погана',
  sourceLang: 'украї́нська',
  targetLang: 'de-DE',
})
check('нелегальний код мови → 400', badLang.status === 400, `отримано ${badLang.status}`)

const decks = await alice('GET', '/api/decks')
check('дві колоди в акаунті', decks.data?.decks?.length === 2)
const enDeck = decks.data.decks.find((d) => d.targetLang === 'en-US')

section('Синхронізація карток')
const t1 = new Date(Date.now() - 60_000).toISOString()
const push1 = await alice('POST', `/api/sync/${enDeck.id}`, {
  cards: [
    {
      id: CARD_ID,
      category: 'Small Talk',
      front: 'Як воно?',
      back: "How's it going?",
      tags: ['casual', 'smalltalk'],
      difficulty: 'easy',
      interval: 1,
      repetition: 0,
      efactor: 2.5,
      updatedAt: t1,
    },
  ],
  days: [
    { date: '2026-08-05', reviews: 10, correct: 8, seconds: 120, newCards: 3, updatedAt: t1 },
  ],
})
check('push → 200', push1.status === 200, `отримано ${push1.status}`)
check('картку застосовано', push1.data?.appliedCards === 1)

const pull1 = await alice('GET', `/api/sync/${enDeck.id}`)
check('pull повертає картку', pull1.data?.cards?.length === 1)
check('кирилиця вціліла', pull1.data?.cards?.[0]?.front === 'Як воно?')
check('теги збереглися масивом', Array.isArray(pull1.data?.cards?.[0]?.tags))
check('денна статистика повернулася', pull1.data?.days?.[0]?.reviews === 10)

section('Конфлікти (last-write-wins)')
const stale = await alice('POST', `/api/sync/${enDeck.id}`, {
  cards: [
    {
      id: CARD_ID,
      front: 'СТАРА ВЕРСІЯ',
      back: 'stale',
      updatedAt: new Date(Date.now() - 120_000).toISOString(),
    },
  ],
})
check('застаріла версія відкинута', stale.data?.skippedCards === 1, JSON.stringify(stale.data))

const fresh = await alice('POST', `/api/sync/${enDeck.id}`, {
  cards: [
    {
      id: CARD_ID,
      front: 'НОВА ВЕРСІЯ',
      back: "How's it going?",
      updatedAt: new Date().toISOString(),
    },
  ],
})
check('свіжа версія прийнята', fresh.data?.appliedCards === 1)

const afterConflict = await alice('GET', `/api/sync/${enDeck.id}`)
const card = afterConflict.data.cards.find((c) => c.id === CARD_ID)
check('переміг свіжіший запис', card?.front === 'НОВА ВЕРСІЯ', card?.front)

section('Денна статистика зливається за максимумом')
await alice('POST', `/api/sync/${enDeck.id}`, {
  days: [
    { date: '2026-08-05', reviews: 4, correct: 4, seconds: 30, newCards: 1, updatedAt: new Date().toISOString() },
  ],
})
const afterDays = await alice('GET', `/api/sync/${enDeck.id}`)
const day = afterDays.data.days.find((d) => d.date === '2026-08-05')
check('менші лічильники не затирають більші', day?.reviews === 10, `reviews=${day?.reviews}`)

section('Ізоляція між акаунтами')
await bob('POST', '/api/auth/register', {
  email: `bob${uniq}@example.com`,
  password: 'supersecret1',
})
const steal = await bob('GET', `/api/sync/${enDeck.id}`)
check('чужа колода → 404', steal.status === 404, `отримано ${steal.status}`)

const stealPush = await bob('POST', `/api/sync/${enDeck.id}`, { cards: [] })
check('запис у чужу колоду → 404', stealPush.status === 404)

const bobDecks = await bob('GET', '/api/decks')
check('Боб бачить лише свою колоду', bobDecks.data?.decks?.length === 1)

// id карток унікальні глобально, тож чужий id не має ані блокувати запис,
// ані перетягувати картку між колодами.
const collide = await bob('POST', `/api/sync/${bobDecks.data.decks[0].id}`, {
  cards: [
    {
      id: CARD_ID,
      front: 'Спроба перехопити',
      back: 'hijack attempt',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    },
  ],
})
check('чужий id картки відхилено', collide.data?.skippedCards === 1, JSON.stringify(collide.data))

const aliceIntact = await alice('GET', `/api/sync/${enDeck.id}`)
check(
  'картка Аліси лишилась у її колоді',
  aliceIntact.data.cards.find((c) => c.id === CARD_ID)?.front === 'НОВА ВЕРСІЯ',
)

section('Видалення колод')
const delLast = await bob('DELETE', `/api/decks/${bobDecks.data.decks[0].id}`)
check('останню колоду видалити не можна → 400', delLast.status === 400, `отримано ${delLast.status}`)

const delGerman = await alice('DELETE', `/api/decks/${germanDeck.id}`)
check('зайву колоду видалено → 204', delGerman.status === 204, `отримано ${delGerman.status}`)

section('Вихід')
const logout = await alice('POST', '/api/auth/logout')
check('logout → 204', logout.status === 204)
const afterLogout = await alice('GET', '/api/auth/me')
check('сесія анульована → 401', afterLogout.status === 401, `отримано ${afterLogout.status}`)

console.log(`\n${passed} пройдено, ${failed} провалено`)
process.exit(failed ? 1 : 0)
