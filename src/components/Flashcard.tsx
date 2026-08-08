import { motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from 'framer-motion'
import { useEffect } from 'react'

import { ClozeText } from '@/components/ClozeText'
import { Icon } from '@/components/ui/Icon'
import { ttsSupported } from '@/lib/tts'
import { useT } from '@/lib/i18n'
import type { Card, Grade } from '@/types'

const SWIPE_DISTANCE = 110
const SWIPE_VELOCITY = 520

/** Напрямок свайпу → оцінка. Ліво/право — основні, верх/низ — точніші. */
const HINTS = {
  left: { grade: 0 as Grade, labelKey: 'rating.again' as const, tone: 'text-rose-400 border-rose-400/50 bg-rose-500/12' },
  right: { grade: 2 as Grade, labelKey: 'rating.good' as const, tone: 'text-emerald-400 border-emerald-400/50 bg-emerald-500/12' },
  up: { grade: 3 as Grade, labelKey: 'rating.easy' as const, tone: 'text-sky-400 border-sky-400/50 bg-sky-500/12' },
  down: { grade: 1 as Grade, labelKey: 'rating.hard' as const, tone: 'text-amber-400 border-amber-400/50 bg-amber-500/12' },
}

interface FlashcardProps {
  card: Card
  revealed: boolean
  onFlip: () => void
  onSwipe: (grade: Grade) => void
  /** Свайпи вмикаються лише коли картку вже перевернуто */
  swipeEnabled: boolean
  reverse: boolean
  clozeBlur: boolean
  onSpeak: () => void
  /** Чи має колода озвучення (мовна пара) */
  speakable?: boolean
  hideAnswerText?: boolean
}

export function Flashcard({
  card,
  revealed,
  onFlip,
  onSwipe,
  swipeEnabled,
  reverse,
  clozeBlur,
  onSpeak,
  speakable = true,
  hideAnswerText = false,
}: FlashcardProps) {
  const x = useMotionValue(0)
  const t = useT()
  const y = useMotionValue(0)

  const rotate = useTransform(x, [-240, 240], [-9, 9])
  const leftOpacity = useTransform(x, [-SWIPE_DISTANCE, -30], [1, 0])
  const rightOpacity = useTransform(x, [30, SWIPE_DISTANCE], [0, 1])
  const upOpacity = useTransform(y, [-SWIPE_DISTANCE, -30], [1, 0])
  const downOpacity = useTransform(y, [30, SWIPE_DISTANCE], [0, 1])

  useEffect(() => {
    x.set(0)
    y.set(0)
  }, [card.id, revealed, x, y])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (!swipeEnabled) return
    const { offset, velocity } = info
    const horizontal = Math.abs(offset.x) > Math.abs(offset.y)

    if (horizontal) {
      if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) return onSwipe(HINTS.left.grade)
      if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) return onSwipe(HINTS.right.grade)
    } else {
      if (offset.y < -SWIPE_DISTANCE || velocity.y < -SWIPE_VELOCITY) return onSwipe(HINTS.up.grade)
      if (offset.y > SWIPE_DISTANCE || velocity.y > SWIPE_VELOCITY) return onSwipe(HINTS.down.grade)
    }
  }

  const question = reverse ? card.back : card.front
  const answer = reverse ? card.front : card.back
  // Озвучуємо лише цільову мову: у зворотному напрямі відповідь — рідною.
  const canSpeak = speakable && !reverse

  return (
    <motion.div
      className="relative h-full w-full touch-none [perspective:1600px]"
      style={{ x, y, rotate }}
      drag={swipeEnabled}
      dragSnapToOrigin
      dragElastic={0.55}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: swipeEnabled ? 'grabbing' : 'pointer' }}
    >
      <SwipeBadge className="left-4 top-1/2 -translate-y-1/2" opacity={leftOpacity} hint={HINTS.left} />
      <SwipeBadge className="right-4 top-1/2 -translate-y-1/2" opacity={rightOpacity} hint={HINTS.right} />
      <SwipeBadge className="left-1/2 top-4 -translate-x-1/2" opacity={upOpacity} hint={HINTS.up} />
      <SwipeBadge className="bottom-4 left-1/2 -translate-x-1/2" opacity={downOpacity} hint={HINTS.down} />

      <motion.div
        className="preserve-3d relative h-full w-full"
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      >
        <Face onClick={onFlip}>
          <Meta card={card} side="question" />
          <p className="text-balance text-[clamp(1.25rem,4.4vw,2rem)] leading-snug font-medium">
            {question}
          </p>
          <Footer>
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <span className="kbd">Space</span> {t('card.flipHint')}
            </span>
            <span className="inline-flex items-center gap-1.5 sm:hidden">{t('card.tapHint')}</span>
          </Footer>
        </Face>

        <Face
          onClick={onFlip}
          className="absolute inset-0 [transform:rotateY(180deg)]"
          highlight
        >
          <Meta card={card} side="answer" />

          <div className="space-y-3">
            {hideAnswerText ? (
              <p className="text-[clamp(1.1rem,3.6vw,1.5rem)] text-ink-400 italic">
                {t('card.typeBelow')}
              </p>
            ) : (
              <p className="text-balance text-[clamp(1.25rem,4.4vw,2rem)] leading-snug font-semibold">
                <ClozeText text={answer} blur={clozeBlur} />
              </p>
            )}

            <p className="text-sm text-ink-500 dark:text-ink-400">{question}</p>

            {card.note && (
              <p className="rounded-xl bg-brand-500/8 px-3 py-2 text-left text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
                💡 {card.note}
              </p>
            )}
          </div>

          <Footer>
            {canSpeak && ttsSupported && (
              <button
                className="btn-soft px-2.5 py-1.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onSpeak()
                }}
              >
                <Icon name="volume" size={14} /> {t('common.listen')}
              </button>
            )}
            <span className="hidden sm:inline">{t('card.rateBelow')}</span>
            <span className="sm:hidden">{t('card.swipeHint')}</span>
          </Footer>
        </Face>
      </motion.div>
    </motion.div>
  )
}

function Face({
  children,
  className = '',
  onClick,
  highlight = false,
}: {
  children: React.ReactNode
  className?: string
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={[
        'backface-hidden flex h-full w-full cursor-pointer flex-col justify-between gap-4 overflow-y-auto',
        'rounded-3xl border p-5 text-center sm:p-8',
        'border-ink-200 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)]',
        'dark:border-white/10 dark:bg-gradient-to-b dark:from-ink-800 dark:to-ink-900 dark:shadow-[0_24px_70px_-30px_rgba(0,0,0,0.9)]',
        highlight ? 'dark:from-ink-800 dark:to-[#151a2b]' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function Meta({ card, side }: { card: Card; side: 'question' | 'answer' }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="chip bg-brand-500/12! text-brand-600! dark:text-brand-400!">
        {card.category}
      </span>
      {side === 'answer' &&
        card.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="chip">
            #{tag}
          </span>
        ))}
    </div>
  )
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-ink-400">
      {children}
    </div>
  )
}

function SwipeBadge({
  hint,
  opacity,
  className,
}: {
  hint: (typeof HINTS)[keyof typeof HINTS]
  opacity: MotionValue<number>
  className: string
}) {
  const t = useT()
  return (
    <motion.div
      style={{ opacity }}
      className={`pointer-events-none absolute z-10 rounded-xl border px-3 py-1.5 text-xs font-bold tracking-wide uppercase backdrop-blur-sm ${hint.tone} ${className}`}
    >
      {t(hint.labelKey)}
    </motion.div>
  )
}
