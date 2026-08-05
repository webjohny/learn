/**
 * Cloze-розмітка: `*[текст]*` позначає ключовий фрагмент, який ховається під блюром.
 * Приклад: "Just *[kicked back]* with my wife".
 */
const CLOZE_RE = /\*\[(.+?)\]\*/g

export interface TextSegment {
  text: string
  cloze: boolean
}

export function parseCloze(input: string): TextSegment[] {
  const segments: TextSegment[] = []
  let last = 0

  for (const match of input.matchAll(CLOZE_RE)) {
    const start = match.index ?? 0
    if (start > last) segments.push({ text: input.slice(last, start), cloze: false })
    segments.push({ text: match[1], cloze: true })
    last = start + match[0].length
  }

  if (last < input.length) segments.push({ text: input.slice(last), cloze: false })
  return segments.length ? segments : [{ text: input, cloze: false }]
}

export function hasCloze(input: string): boolean {
  CLOZE_RE.lastIndex = 0
  return CLOZE_RE.test(input)
}

/** Чистий текст без cloze-дужок — для TTS та порівняння у Type-In. */
export function stripCloze(input: string): string {
  return input.replace(CLOZE_RE, '$1')
}

/** Нормалізація для порівняння введеної відповіді: регістр, пунктуація, пробіли. */
export function normalize(input: string): string {
  return stripCloze(input)
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,!?;:"()\[\]…—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Схожість Левенштейна 0..1 — дозволяє дрібні одруківки у Type-In. */
export function similarity(a: string, b: string): number {
  const s = normalize(a)
  const t = normalize(b)
  if (!s && !t) return 1
  if (!s || !t) return 0
  if (s === t) return 1

  const prev = new Array<number>(t.length + 1)
  const curr = new Array<number>(t.length + 1)
  for (let j = 0; j <= t.length; j++) prev[j] = j

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= t.length; j++) prev[j] = curr[j]
  }

  return 1 - prev[t.length] / Math.max(s.length, t.length)
}

/** Пословна діф-розмітка відповіді користувача проти еталона. */
export interface DiffWord {
  word: string
  ok: boolean
}

export function diffWords(answer: string, expected: string): DiffWord[] {
  const expectedWords = new Set(normalize(expected).split(' '))
  return normalize(answer)
    .split(' ')
    .filter(Boolean)
    .map((word) => ({ word, ok: expectedWords.has(word) }))
}

export function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
