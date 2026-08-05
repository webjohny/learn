import { stripCloze } from './text'

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

export const ttsSupported = Boolean(synth)

const cachedVoices = new Map<string, SpeechSynthesisVoice[]>()

/** Голоси для мови колоди: 'de-DE' підбирає і 'de-AT', якщо точного немає. */
export function getVoicesFor(lang: string): SpeechSynthesisVoice[] {
  if (!synth) return []

  const base = lang.split('-')[0].toLowerCase()
  const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(base))
  if (voices.length) cachedVoices.set(base, voices)
  return cachedVoices.get(base) ?? []
}

/** Голоси в Chrome вантажаться асинхронно — даємо підписку на подію. */
export function onVoicesChanged(cb: () => void): () => void {
  if (!synth) return () => {}
  synth.addEventListener('voiceschanged', cb)
  return () => synth.removeEventListener('voiceschanged', cb)
}

export interface SpeakOptions {
  rate?: number
  voiceURI?: string | null
  /** BCP-47 код мови відповіді — береться з мовної пари колоди. */
  lang?: string
}

export function speak(text: string, { rate = 0.95, voiceURI, lang = 'en-US' }: SpeakOptions = {}) {
  if (!synth || !text.trim()) return

  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(stripCloze(text))
  utterance.lang = lang
  utterance.rate = rate

  const voices = getVoicesFor(lang)
  // Явно обраний голос застосовуємо лише якщо він тієї ж мови, що й колода.
  const voice = voiceURI ? voices.find((v) => v.voiceURI === voiceURI) : undefined
  if (voice) utterance.voice = voice

  synth.speak(utterance)
}

export function stopSpeaking() {
  synth?.cancel()
}
