import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

import { CardEditor } from '@/components/CardEditor'
import { Flashcard } from '@/components/Flashcard'
import { RatingBar } from '@/components/RatingBar'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useHaptics, useIsTouch } from '@/hooks/useMisc'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useStudySession } from '@/hooks/useStudySession'
import { formatDuration } from '@/lib/date'
import { useT, type MessageKey, type Translate } from '@/lib/i18n'
import { speak, ttsSupported } from '@/lib/tts'
import { useCounts, useDeckProfile } from '@/store/selectors'
import { useDeck } from '@/store/useDeck'
import { useOverlayOpen } from '@/store/useOverlay'
import type { Grade, StudyMode } from '@/types'
import { TypeInPanel } from './TypeInPanel'

interface ModeItem {
  key: StudyMode
  label: MessageKey
  icon: IconName
  hint: MessageKey
  /** Лише для мовних пар: посимвольне звіряння відповіді. */
  languageOnly?: boolean
}

const MODES: ModeItem[] = [
  { key: 'srs', label: 'study.modeSrs', icon: 'cards', hint: 'study.modeSrsHint' },
  { key: 'speed', label: 'study.modeSpeed', icon: 'zap', hint: 'study.modeSpeedHint' },
  {
    key: 'type',
    label: 'study.modeType',
    icon: 'pencilLine',
    hint: 'study.modeTypeHint',
    languageOnly: true,
  },
]

export function StudyView() {
  const [mode, setMode] = useState<StudyMode>('srs')
  const [editorOpen, setEditorOpen] = useState(false)

  const settings = useDeck((s) => s.settings)
  const overlayOpen = useOverlayOpen()
  const counts = useCounts()
  const haptic = useHaptics()
  const isTouch = useIsTouch()
  const session = useStudySession(mode)
  const { card, revealed, reveal, answer, restart, finished } = session

  const t = useT()
  const { isLanguage, sourceLang, targetLang } = useDeckProfile()
  // Предметна колода не має TTS і зворотного напряму — картка суто «питання → відповідь».
  const reverse = isLanguage && settings.reverse
  const modes = isLanguage ? MODES : MODES.filter((m) => !m.languageOnly)

  // Перемикання на предметну колоду посеред сесії «Друку» лишило б недоступний режим.
  useEffect(() => {
    if (!isLanguage && mode === 'type') setMode('srs')
  }, [isLanguage, mode])

  const speakAnswer = useCallback(() => {
    if (!card || !isLanguage) return
    speak(reverse ? card.front : card.back, {
      rate: settings.speechRate,
      voiceURI: settings.voiceURI,
      lang: reverse ? sourceLang : targetLang,
    })
  }, [card, isLanguage, reverse, settings.speechRate, settings.voiceURI, sourceLang, targetLang])

  // Автоозвучення цільової мови одразу після перевороту.
  useEffect(() => {
    if (!revealed || !card || !isLanguage || !settings.autoSpeak || reverse) return
    speak(card.back, {
      rate: settings.speechRate,
      voiceURI: settings.voiceURI,
      lang: targetLang,
    })
  }, [
    revealed,
    card,
    isLanguage,
    settings.autoSpeak,
    reverse,
    settings.speechRate,
    settings.voiceURI,
    targetLang,
  ])

  const flip = useCallback(() => {
    if (revealed) return
    haptic(8)
    reveal()
  }, [haptic, reveal, revealed])

  const rate = useCallback(
    (grade: Grade) => {
      if (!revealed) return
      haptic(grade === 0 ? [12, 40, 12] : 14)
      answer(grade)
    },
    [answer, haptic, revealed],
  )

  useHotkeys(
    {
      ' ': () => (revealed ? undefined : flip()),
      enter: () => (revealed ? rate(2) : flip()),
      '1': () => rate(0),
      '2': () => rate(1),
      '3': () => rate(2),
      '4': () => rate(3),
      arrowleft: () => rate(0),
      arrowright: () => rate(2),
      arrowup: () => rate(3),
      arrowdown: () => rate(1),
      s: () => speakAnswer(),
      e: () => card && setEditorOpen(true),
    },
    // У режимі «Друк» клавіші вмикаються лише після перевірки — до того фокус у полі вводу.
    Boolean(card) && !overlayOpen && (mode !== 'type' || revealed),
  )

  const timeLeft = session.timeLeftMs
  const speedProgress =
    mode === 'speed' && timeLeft !== null ? timeLeft / (settings.speedSessionSeconds * 1000) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-xl bg-ink-900/5 p-1 dark:bg-white/6">
          {modes.map((item) => (
            <button
              key={item.key}
              onClick={() => setMode(item.key)}
              title={t(item.hint)}
              className={`btn flex-1 gap-1.5 py-1.5 text-[13px] ${
                mode === item.key
                  ? 'bg-white text-ink-900 shadow-sm dark:bg-white/12 dark:text-white'
                  : 'text-ink-500 dark:text-ink-400'
              }`}
            >
              <Icon name={item.icon} size={15} />
              {t(item.label)}
            </button>
          ))}
        </div>
        {card && (
          <button
            className="btn-ghost px-2"
            onClick={() => setEditorOpen(true)}
            title={t('study.editCard')}
          >
            <Icon name="edit" size={17} />
          </button>
        )}
      </div>

      {speedProgress !== null ? (
        <ProgressBar value={speedProgress} tone="amber" label={`${Math.ceil((timeLeft ?? 0) / 1000)} с`} />
      ) : (
        <ProgressBar
          value={session.progress}
          tone="brand"
          label={`${session.total - session.remaining} / ${session.total}`}
        />
      )}

      <AnimatePresence mode="wait">
        {card ? (
          <motion.div
            key="card"
            className="flex min-h-0 flex-1 flex-col gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="min-h-[46dvh] flex-1">
              <Flashcard
                card={card}
                revealed={revealed}
                onFlip={flip}
                onSwipe={rate}
                swipeEnabled={revealed && isTouch}
                reverse={reverse}
                clozeBlur={settings.clozeBlur}
                onSpeak={speakAnswer}
                speakable={isLanguage}
                hideAnswerText={mode === 'type' && !revealed}
              />
            </div>

            {mode === 'type' ? (
              <TypeInPanel
                // Забута остання картка повторюється тим самим id — без кроку
                // поле вводу лишилось би із попередньою (неправильною) відповіддю.
                key={`${card.id}:${session.step}`}
                card={card}
                revealed={revealed}
                onReveal={reveal}
                onRate={rate}
                reverse={reverse}
              />
            ) : !revealed ? (
              <button className="btn-primary w-full py-3 text-base" onClick={flip}>
                {t('study.showAnswer')}
                <span className="kbd ml-1 hidden border-white/25 bg-white/15 text-white sm:inline-flex">
                  Space
                </span>
              </button>
            ) : mode === 'speed' ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn border border-rose-500/25 bg-rose-500/10 py-3.5 text-base font-semibold text-rose-600 dark:text-rose-300"
                  onClick={() => rate(0)}
                >
                  {t('study.didntKnow')}
                </button>
                <button
                  className="btn border border-emerald-500/25 bg-emerald-500/10 py-3.5 text-base font-semibold text-emerald-600 dark:text-emerald-300"
                  onClick={() => rate(2)}
                >
                  {t('study.knew')}
                </button>
              </div>
            ) : (
              <RatingBar card={card} onRate={rate} />
            )}
          </motion.div>
        ) : (
          // Підсумок навмисно не анімує opacity: якщо анімація застрягне
          // (StrictMode у dev, переривання, повільний пристрій), користувач
          // побачив би порожній екран замість «Сесію завершено». Рухаємо лише
          // по вертикалі — вміст лишається читабельним за будь-якого збою.
          // motion.div тут прямий дитина AnimatePresence — як і гілка картки.
          <motion.div
            key="done"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ y: 12 }}
            animate={{ y: 0 }}
          >
            <SessionDone
              mode={mode}
              stats={session.stats}
              queued={counts.queued}
              // `extra`: якщо за розкладом уже нічого немає, «Ще раз» крутить
              // колоду по колу замість того, щоб відкрити порожню сесію.
              onRestart={() => restart({ extra: true })}
              canRestart={counts.total > 0}
              onSwitchMode={setMode}
              finished={finished}
              t={t}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {isLanguage && ttsSupported && card && revealed && !settings.autoSpeak && (
        <p className="text-center text-[11px] text-ink-400">
          <span className="kbd">S</span> {t('study.speakHint')}
        </p>
      )}

      <CardEditor open={editorOpen} card={card ?? null} onClose={() => setEditorOpen(false)} />
    </div>
  )
}

function ProgressBar({
  value,
  label,
  tone,
}: {
  value: number
  label: string
  tone: 'brand' | 'amber'
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900/8 dark:bg-white/8">
        <motion.div
          className={`h-full rounded-full ${tone === 'brand' ? 'bg-brand-500' : 'bg-amber-500'}`}
          animate={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span className="text-[11px] font-medium tabular-nums text-ink-400">{label}</span>
    </div>
  )
}

function SessionDone({
  mode,
  stats,
  queued,
  onRestart,
  canRestart,
  onSwitchMode,
  finished,
  t,
}: {
  mode: StudyMode
  stats: { answered: number; correct: number; again: number; elapsedMs: number }
  queued: number
  onRestart: () => void
  /** У порожній колоді перезапускати нічого — кнопка мовчала б без пояснень. */
  canRestart: boolean
  onSwitchMode: (mode: StudyMode) => void
  finished: boolean
  t: Translate
}) {
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0
  const nothingToDo = stats.answered === 0 && finished

  // Анімацію тримає motion.div-обгортка у StudyView — тут звичайний div.
  return (
    <div className="surface flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-sky-500 text-white shadow-lg shadow-brand-500/25">
        <Icon name={nothingToDo ? 'check' : 'award'} size={26} />
      </span>

      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold">
          {nothingToDo ? t('study.allDone') : t('study.sessionDone')}
        </h2>
        <p className="max-w-sm text-sm text-ink-500 dark:text-ink-400">
          {nothingToDo
            ? queued > 0
              ? t('study.limitReached')
              : t('study.nothingDue')
            : t('study.sessionSummary', { count: stats.answered, duration: formatDuration(stats.elapsedMs / 1000) })}
        </p>
      </div>

      {stats.answered > 0 && (
        <div className="grid w-full max-w-sm grid-cols-3 gap-2">
          <Metric value={stats.answered} label={t('study.metricCards')} />
          <Metric value={`${accuracy}%`} label={t('study.metricAccuracy')} tone="emerald" />
          <Metric value={stats.again} label={t('study.metricAgain')} tone="rose" />
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button className="btn-primary disabled:opacity-40" onClick={onRestart} disabled={!canRestart}>
          <Icon name="rotate" size={16} /> {t('study.again')}
        </button>
        {mode !== 'speed' && (
          <button className="btn-soft" onClick={() => onSwitchMode('speed')}>
            <Icon name="zap" size={16} /> {t('study.toSprint')}
          </button>
        )}
        {mode === 'speed' && (
          <button className="btn-soft" onClick={() => onSwitchMode('srs')}>
            <Icon name="cards" size={16} /> {t('study.toSrs')}
          </button>
        )}
      </div>
    </div>
  )
}

function Metric({
  value,
  label,
  tone = 'default',
}: {
  value: string | number
  label: string
  tone?: 'default' | 'emerald' | 'rose'
}) {
  const colors = {
    default: 'text-ink-900 dark:text-white',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }
  return (
    <div className="rounded-xl bg-ink-900/4 px-3 py-2.5 dark:bg-white/6">
      <div className={`text-lg font-semibold tabular-nums ${colors[tone]}`}>{value}</div>
      <div className="text-[11px] text-ink-400">{label}</div>
    </div>
  )
}
